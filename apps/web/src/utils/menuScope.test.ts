import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as api from '../../../api/src/utils/excludedCategories';
import type { AdminRole } from '../store/auth.store';
import { menuScopeOfRole } from './menuScope';

/**
 * Which system — banquet, small banquets, catering — a role reads the dish
 * table through. The API decides it for every request (prices, switched-off
 * categories and dishes); the web uses the same answer to hide the right
 * categories on the menu pages. If the two drift, a page hides one system's
 * categories while the server serves another's.
 */
const src = (rel: string) => readFileSync(join(__dirname, '..', rel), 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, '');

describe('the web and the API agree on every role\'s system', () => {
  const schema = readFileSync(join(__dirname, '..', '..', '..', 'api', 'prisma', 'schema.prisma'), 'utf8');
  const body = schema.slice(schema.indexOf('enum AdminRole {'), schema.indexOf('}', schema.indexOf('enum AdminRole {')));
  const roles = [...body.matchAll(/^\s+([A-Z_]+)\s*$/gm)].map((m) => m[1]);

  it('found the roles', () => expect(roles.length).toBeGreaterThan(10));
  for (const role of roles) {
    it(role, () => {
      expect(menuScopeOfRole(role as AdminRole)).toEqual(api.menuScopeForRole(role as Parameters<typeof api.menuScopeForRole>[0]));
    });
  }
});

describe('a category switched off for a system is off that system\'s pages', () => {
  // The bug this fixes: these pages hid only what EVERY system had switched
  // off, so switching a category off for banquets changed nothing on them.
  for (const file of ['pages/AdminMenuPage.tsx', 'pages/AdminPhotosPage.tsx', 'pages/AdminSubcategoriesPage.tsx', 'pages/AdminTableCategoriesPage.tsx']) {
    it(file, () => {
      const code = src(file);
      expect(code).toContain('useOwnExcludedCategories()');
      expect(code).not.toContain('useExcludedEverywhere');
      expect(code).not.toContain("useExcludedCategories('banquet')");
    });
  }

  it('the Settings page saves ONE system\'s two lists together, and nothing else', () => {
    const code = src('pages/AdminSettingsPage.tsx');
    expect(code).toContain('excludedCategories: { [scope]: categories }, disabledDishes: { [scope]: dishes }');
    expect(code).toContain("queryKey: ['menu-settings-dishes', scope]");
  });
});
