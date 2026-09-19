import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { AdminRole } from '@prisma/client';
import {
  SHELL_COLUMNS, SHELL_SYSTEMS, fromRow, resolveShellSystem, shellPatchSchema, shellSystemsFor, toColumns,
  type ShellSystem,
} from './shellSettings.rules.js';
import { ShellSettingsService, type ShellRepo } from './shellSettings.service.js';

const other = (s: ShellSystem): ShellSystem => (s === 'tablet' ? 'catering' : 'tablet');
const FULL = { animations: false, music: false, trail: false, particles: 'snow' };

/** One restaurant row holding both systems' columns, as the database does. */
function fakeRepo(initial: Record<string, unknown> = {}) {
  const row: Record<string, unknown> = {
    tabletAnimations: true, tabletMusic: true, tabletTrail: true, tabletParticles: null,
    cateringAnimations: true, cateringMusic: true, cateringTrail: true, cateringParticles: null,
    ...initial,
  };
  const reads: string[][] = [];
  const repo: ShellRepo = {
    async read(_id, columns) { reads.push(columns); return Object.fromEntries(columns.map((c) => [c, row[c]])); },
    async write(_id, data, columns) { Object.assign(row, data); return Object.fromEntries(columns.map((c) => [c, row[c]])); },
  };
  return { repo, row, reads };
}

async function statusOf(run: () => Promise<unknown>): Promise<number> {
  try { await run(); } catch (error) { return (error as { status?: number }).status ?? 0; }
  throw new Error('expected a refusal');
}

describe('which system a role switches', () => {
  it('the main admin switches the tablet, the food admin the catering site', () => {
    expect(shellSystemsFor(AdminRole.ADMIN)).toEqual(['tablet']);
    expect(shellSystemsFor(AdminRole.CATERING_ADMIN)).toEqual(['catering']);
  });

  it('and neither can ask for the other — the role decides, not the request', () => {
    expect(resolveShellSystem(AdminRole.ADMIN, 'catering')).toBe('tablet');
    expect(resolveShellSystem(AdminRole.CATERING_ADMIN, 'tablet')).toBe('catering');
  });

  it('platform roles name a system, and must', () => {
    for (const role of [AdminRole.CHIEF_ADMIN, AdminRole.OWNER]) {
      expect(resolveShellSystem(role, 'tablet')).toBe('tablet');
      expect(resolveShellSystem(role, 'catering')).toBe('catering');
      expect(resolveShellSystem(role, undefined)).toBeNull();
      expect(resolveShellSystem(role, 'both')).toBeNull();
    }
  });

  it('every other role has no shell to switch — the supervisor included, whose kiosk is the main admin\'s tablet', () => {
    const others = Object.values(AdminRole).filter(
      (r) => !([AdminRole.ADMIN, AdminRole.CATERING_ADMIN, AdminRole.CHIEF_ADMIN, AdminRole.OWNER] as AdminRole[]).includes(r),
    );
    expect(others).toContain(AdminRole.SUPERVISOR);
    for (const role of others) {
      expect(shellSystemsFor(role), role).toEqual([]);
      expect(resolveShellSystem(role, 'tablet'), role).toBeNull();
    }
  });
});

describe('the two systems never share a column', () => {
  it('their column sets are disjoint', () => {
    const tablet = new Set(Object.values(SHELL_COLUMNS.tablet));
    for (const c of Object.values(SHELL_COLUMNS.catering)) expect(tablet.has(c), c).toBe(false);
  });

  for (const system of SHELL_SYSTEMS) {
    it(`a ${system} save writes ${system} columns only, for every setting`, () => {
      const written = Object.keys(toColumns(system, FULL));
      expect(written.sort()).toEqual(Object.values(SHELL_COLUMNS[system]).sort());
      for (const c of Object.values(SHELL_COLUMNS[other(system)])) expect(written, c).not.toContain(c);
    });

    it(`saving the ${system} leaves every ${other(system)} value exactly as it was`, async () => {
      const store = fakeRepo({ [SHELL_COLUMNS[other(system)].particles]: 'hearts' });
      const before = Object.fromEntries(Object.values(SHELL_COLUMNS[other(system)]).map((c) => [c, store.row[c]]));
      await new ShellSettingsService(store.repo).save('r1', system, FULL);
      const after = Object.fromEntries(Object.values(SHELL_COLUMNS[other(system)]).map((c) => [c, store.row[c]]));
      expect(after).toEqual(before);
      expect(fromRow(system, store.row)).toEqual(FULL);
    });

    it(`reading the ${system} never touches the other system's columns`, async () => {
      const store = fakeRepo();
      await new ShellSettingsService(store.repo).get('r1', system);
      for (const c of Object.values(SHELL_COLUMNS[other(system)])) expect(store.reads.flat(), c).not.toContain(c);
    });
  }

  it('a body naming the other system\'s column is refused, not quietly dropped', async () => {
    const store = fakeRepo();
    const service = new ShellSettingsService(store.repo);
    expect(await statusOf(() => service.save('r1', 'tablet', { cateringMusic: false }))).toBe(400);
    expect(await statusOf(() => service.save('r1', 'catering', { tabletMusic: false }))).toBe(400);
    expect(store.row.cateringMusic).toBe(true);
    expect(store.row.tabletMusic).toBe(true);
  });
});

describe('the settings themselves', () => {
  it('a restaurant that never touched them reads as everything on and no particles — what both shells did before', () => {
    for (const system of SHELL_SYSTEMS) {
      expect(fromRow(system, {})).toEqual({ animations: true, music: true, trail: true, particles: 'none' });
    }
  });

  it('"none" is stored as null, the value both particle columns already used for none', () => {
    expect(toColumns('catering', { particles: 'none' })).toEqual({ cateringParticles: null });
    expect(toColumns('tablet', { particles: 'snow' })).toEqual({ tabletParticles: 'snow' });
  });

  it('a partial save changes only what it names', () => {
    expect(toColumns('tablet', { music: false })).toEqual({ tabletMusic: false });
  });

  it('the custom-image particle is the tablet\'s alone — the catering site has no image for it', () => {
    expect(shellPatchSchema('tablet').safeParse({ particles: 'custom' }).success).toBe(true);
    expect(shellPatchSchema('catering').safeParse({ particles: 'custom' }).success).toBe(false);
    expect(shellPatchSchema('catering').safeParse({ particles: 'lava' }).success).toBe(false);
    expect(shellPatchSchema('tablet').safeParse({ music: 'yes' }).success).toBe(false);
  });
});

describe('the wiring', () => {
  const API_ROOT = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '..', '..', '..');
  const read = (rel: string) => fs.readFileSync(path.join(API_ROOT, rel), 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, '');

  it('is mounted behind the restaurant scope', () => {
    expect(read('src/app.ts')).toMatch(/'\/shell-settings',\s*requireRestaurant,\s*shellSettingsRouter/);
  });

  it('the catering site\'s public list carries the catering settings and none of the tablet\'s', () => {
    const repo = read('src/modules/restaurant/restaurant.repository.ts');
    const list = repo.slice(repo.indexOf('async listAllPublic('), repo.indexOf('async findByStaffUserId('));
    for (const c of Object.values(SHELL_COLUMNS.catering)) expect(list).toContain(`${c}: true`);
    for (const c of Object.values(SHELL_COLUMNS.tablet)) expect(list).not.toContain(c);
  });

  it('the migration defaults every switch ON, so the deploy changes nothing', () => {
    const sql = fs.readFileSync(path.join(API_ROOT, 'prisma/migrations/20260920100000_shell_settings/migration.sql'), 'utf8');
    for (const system of SHELL_SYSTEMS) {
      for (const key of ['animations', 'music', 'trail'] as const) {
        expect(sql).toContain(`ADD COLUMN "${SHELL_COLUMNS[system][key]}" BOOLEAN NOT NULL DEFAULT true`);
      }
    }
    expect(sql).toContain('ADD COLUMN "cateringParticles" TEXT;');
  });
});
