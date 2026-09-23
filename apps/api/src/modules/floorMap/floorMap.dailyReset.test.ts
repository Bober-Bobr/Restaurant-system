import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startOfDay } from './floorMap.dailyReset.js';

/**
 * The nightly layout reset.
 *
 * `resetLayoutsForDay` reads the Prisma singleton directly (it sweeps every
 * restaurant, so there is no repository to hand it a fake of), which is why
 * what is asserted here is the day arithmetic and the WIRING — the rules it
 * depends on are covered where they live: the reconcile in
 * `floorMap.service.test.ts`, the day key in `floorBooking.test.ts`.
 */
const API_ROOT = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '..', '..', '..');
const read = (rel: string) => fs.readFileSync(path.join(API_ROOT, rel), 'utf8')
  .replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, '');

const sweep = read('src/modules/floorMap/floorMap.dailyReset.ts');

describe('the day a reset belongs to', () => {
  it('is midnight UTC of the day in question', () => {
    expect(startOfDay(new Date('2026-10-02T19:30:00.000Z')).toISOString()).toBe('2026-10-02T00:00:00.000Z');
    expect(startOfDay(new Date('2026-10-02T00:00:00.000Z')).toISOString()).toBe('2026-10-02T00:00:00.000Z');
    expect(startOfDay(new Date('2026-10-02T23:59:59.000Z')).toISOString()).toBe('2026-10-02T00:00:00.000Z');
  });

  it('is the SAME boundary occupancy uses', () => {
    // A reset and the bookings it must not disturb have to agree about which
    // day it is, or the sweep protects the wrong evening.
    expect(sweep).toContain("import { dayKey } from '../../utils/floorBooking.js';");
    expect(sweep).toContain('const today = dayKey(now);');
  });
});

describe('the sweep', () => {
  it('asks "has this been done for today?" rather than firing at midnight', () => {
    // deploy.sh restarts pm2 on every deploy, which would reset a midnight
    // timer and quietly skip a day; a process down overnight would miss it
    // entirely. A day stamp compared against today is restart-proof.
    expect(sweep).toContain('lastLayoutResetDay: null');
    expect(sweep).toContain('lastLayoutResetDay: { not: today }');
    expect(sweep).toContain('data: { lastLayoutResetDay: today }');
  });

  it('touches only areas that HAVE a saved default', () => {
    // There is nothing to put an unsaved area back to, and emptying a room
    // would be the worst possible reading of "reset".
    expect(sweep).toContain('defaultLayout: { not: Prisma.DbNull }');
  });

  it('protects bookings from the start of today onward', () => {
    expect(sweep).toContain('repo.restoreLayout(hall.id, layout, startOfDay(now))');
  });

  it('stamps the day even when the stored layout is unusable', () => {
    // Otherwise a corrupt row is retried every quarter of an hour for ever.
    // The stamp must be UNCONDITIONAL — outside the `if (layout)` block and
    // guarded by nothing — so asserting only that it comes after that block
    // passes against a stamp that never runs.
    const body = sweep.slice(sweep.indexOf('for (const hall of due)'));
    expect(body).toMatch(
      /\}\n\s*await prisma\.hall\.update\(\{ where: \{ id: hall\.id \}, data: \{ lastLayoutResetDay: today \} \}\);/,
    );
  });

  it('one bad area does not stop the rest', () => {
    expect(sweep).toContain('catch (error)');
    const body = sweep.slice(sweep.indexOf('for (const hall of due)'));
    expect(body).toContain('try {');
  });

  it('a failed sweep never takes the API down', () => {
    expect(sweep).toContain(".catch((error) => console.error('[floor-map] daily reset sweep failed', error));");
  });

  it('says out loud when a room was NOT fully put back', () => {
    // The reason is somebody's booking, and staff reading the map need to know
    // the room is not as the default describes it.
    expect(sweep).toContain('kept booked table(s)');
  });

  it('is started once from the server, beside the other daily sweep', () => {
    const server = read('src/server.ts');
    expect(server).toContain('startFloorLayoutResetSweep();');
    expect(sweep).toContain('if (timer) return;');
  });

  it('the migration adds the day stamp nullable, so the first sweep does every area', () => {
    const sql = fs.readFileSync(path.join(API_ROOT, 'prisma/migrations/20260924100000_floor_daily_reset/migration.sql'), 'utf8');
    expect(sql).toContain('ADD COLUMN "lastLayoutResetDay" TEXT;');
    expect(sql).not.toMatch(/NOT NULL/);
  });
});
