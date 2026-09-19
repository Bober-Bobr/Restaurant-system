import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { AdminRole } from '@prisma/client';
import {
  DISABLED_COLUMN, MENU_SCOPES, PRICE_COLUMN, menuScopeForRole, presentForScope, resolveRoleMenuScope,
} from './excludedCategories.js';

/**
 * The dish table is shared by three systems — Banquet, Small Banquets and
 * Catering — and the golden rule is that a change in one never reaches
 * another. Categories were split first; prices and single dishes follow the
 * same pattern: one column per system, and the ROLE decides which a request
 * reads and writes.
 */
const ROW = {
  id: 'm1', name: 'Lagman',
  priceCents: 100, priceCentsSmallBanquet: 200, priceCentsCatering: 300,
  disabledBanquet: true, disabledSmallBanquet: false, disabledCatering: false,
};

describe('a dish as one system sees it', () => {
  it('carries that system\'s price and switch, under the names every page already reads', () => {
    expect(presentForScope(ROW, 'banquet')).toEqual({ id: 'm1', name: 'Lagman', priceCents: 100, disabled: true });
    expect(presentForScope(ROW, 'smallBanquet')).toEqual({ id: 'm1', name: 'Lagman', priceCents: 200, disabled: false });
    expect(presentForScope(ROW, 'catering')).toEqual({ id: 'm1', name: 'Lagman', priceCents: 300, disabled: false });
  });

  it('and nothing of the other systems — no page can show or send back a price that is not its own', () => {
    for (const scope of MENU_SCOPES) {
      const keys = Object.keys(presentForScope(ROW, scope));
      for (const column of [...Object.values(PRICE_COLUMN), ...Object.values(DISABLED_COLUMN)]) {
        if (column === 'priceCents') continue; // the resolved price keeps the shared name
        expect(keys, `${scope} leaks ${column}`).not.toContain(column);
      }
    }
  });

  it('every system has its own price column and its own switch', () => {
    expect(new Set(Object.values(PRICE_COLUMN)).size).toBe(MENU_SCOPES.length);
    expect(new Set(Object.values(DISABLED_COLUMN)).size).toBe(MENU_SCOPES.length);
  });
});

describe('the role decides the system', () => {
  it('pins each staff role to its own system, whatever the request asks for', () => {
    expect(resolveRoleMenuScope(AdminRole.ADMIN, 'catering', 'banquet')).toBe('banquet');
    expect(resolveRoleMenuScope(AdminRole.CATERING_ADMIN, 'banquet', 'banquet')).toBe('catering');
    expect(resolveRoleMenuScope(AdminRole.SUPERVISOR, 'banquet', 'banquet')).toBe('smallBanquet');
    expect(resolveRoleMenuScope(AdminRole.CATERING_EMPLOYEE, 'banquet', 'banquet')).toBe('catering');
    expect(resolveRoleMenuScope(AdminRole.SMALL_KITCHEN, 'catering', 'banquet')).toBe('smallBanquet');
  });

  it('lets a platform role name one, and falls back when it names none', () => {
    for (const role of [AdminRole.CHIEF_ADMIN, AdminRole.OWNER, AdminRole.MANAGER]) {
      expect(menuScopeForRole(role)).toBeNull();
      expect(resolveRoleMenuScope(role, 'catering', 'banquet')).toBe('catering');
      expect(resolveRoleMenuScope(role, undefined, 'smallBanquet')).toBe('smallBanquet');
    }
  });
});

describe('the wiring', () => {
  const API_ROOT = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '..', '..');
  const read = (rel: string) => fs.readFileSync(path.join(API_ROOT, rel), 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, '');

  it('the menu pages\' list hides what THEIR system switched off, not only what every system did', () => {
    // The old intersection is what made "switch a category off for banquets"
    // look broken: the banquet pages went on showing it.
    const repo = read('src/modules/menu/menu.repository.ts');
    const listAll = repo.slice(repo.indexOf('async listAll('), repo.indexOf('async listActive('));
    expect(listAll).toContain('getExcludedCategories(restaurantId, scope)');
    expect(listAll).toContain('[DISABLED_COLUMN[scope]]: false');
    expect(listAll).not.toContain('getExcludedEverywhere');
  });

  it('a price edit lands in the caller\'s column only', () => {
    const repo = read('src/modules/menu/menu.repository.ts');
    const update = repo.slice(repo.indexOf('async updateById('), repo.indexOf('async deleteById('));
    expect(update).toContain('[PRICE_COLUMN[scope]]: priceCents');
    expect(update).toMatch(/const \{ nameI18n, descriptionI18n, priceCents, \.\.\.rest \} = payload/);
  });

  it('the tablet\'s packages leave out what the section switched off, and are priced by the section', () => {
    const repo = read('src/modules/tableCategory/tableCategory.repository.ts');
    const active = repo.slice(repo.indexOf('async listActive('), repo.indexOf('async listAll('));
    expect(active).toContain('presentPackage(row, { excluded })');
    expect(repo).toContain('presentForScope(pi.menuItem, scope)');
  });

  it('the migration starts every system at today\'s price, and nothing switched off', () => {
    const sql = fs.readFileSync(path.join(API_ROOT, 'prisma/migrations/20260921100000_menu_per_system/migration.sql'), 'utf8');
    expect(sql).toContain('SET "priceCentsSmallBanquet" = "priceCents", "priceCentsCatering" = "priceCents"');
    for (const c of Object.values(DISABLED_COLUMN)) expect(sql).toContain(`ADD COLUMN "${c}" BOOLEAN NOT NULL DEFAULT false`);
  });
});
