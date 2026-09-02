import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { settingsScopesFor } from './AdminSettingsPage';
import type { AdminRole } from '../store/auth.store';

/**
 * The Settings page shows ONE table of switched-off dish categories per role,
 * and only that role's own product:
 *
 *   banquet ADMIN   → what banquets do not serve
 *   CATERING_ADMIN  → what the public food-service menu does not serve
 *
 * They have to be independent all the way down, because both products sell from
 * the same `MenuItem` table. Independence is enforced in three places, and this
 * covers the two that live on the client: which table a role is shown, and what
 * a save from that table actually sends. The third — that a scope the request
 * omits keeps its stored list — is covered in the API suite.
 */
describe('one table per role, and only their own product', () => {
  it('a banquet ADMIN manages the banquet list alone', () => {
    expect(settingsScopesFor('ADMIN')).toEqual(['banquet']);
  });

  it('a Food Admin manages the food-service list alone', () => {
    expect(settingsScopesFor('CATERING_ADMIN')).toEqual(['catering']);
  });

  it('neither can see the other product\'s table', () => {
    // The point of the split. A banquet ADMIN switching off energy drinks must
    // not be able to take them off the public menu, even by accident.
    expect(settingsScopesFor('ADMIN')).not.toContain('catering');
    expect(settingsScopesFor('CATERING_ADMIN')).not.toContain('banquet');
  });

  it('a role nobody has assigned a table gets none', () => {
    // Not a default. Inheriting the wrong product's switches is how a
    // restaurant loses dishes it never touched.
    for (const role of ['EMPLOYEE', 'KITCHEN', 'CATERING_EMPLOYEE', 'NFC_MAKER', 'PERFORMER'] as AdminRole[]) {
      expect(settingsScopesFor(role), role).toEqual([]);
    }
    expect(settingsScopesFor(null)).toEqual([]);
    expect(settingsScopesFor(undefined)).toEqual([]);
  });

  it('the platform roles would see both, if they ever reached the page', () => {
    for (const role of ['CHIEF_ADMIN', 'OWNER'] as AdminRole[]) {
      expect(settingsScopesFor(role)).toEqual(['banquet', 'catering']);
    }
  });

  it('every role the page is routed to has a table', () => {
    // Reading the router rather than trusting the list above: a role given the
    // route but no scope would land on a page with nothing on it.
    const app = readFileSync(join(__dirname, '..', 'app', 'App.tsx'), 'utf8');
    expect(app).toContain('<AdminSettingsPage />');
    for (const role of ['ADMIN', 'CATERING_ADMIN'] as AdminRole[]) {
      expect(settingsScopesFor(role).length, `${role} reaches the page with no table`).toBeGreaterThan(0);
    }
  });
});

describe('a save carries one product and nothing else', () => {
  const src = readFileSync(join(__dirname, 'AdminSettingsPage.tsx'), 'utf8');

  it('sends only the scope that was edited', () => {
    // `{ [scope]: categories }` — not both lists. Sending both would mean the
    // screen wrote the other product's list from a copy that may be stale.
    expect(src).toMatch(/excludedCategories:\s*\{\s*\[scope\]:\s*categories\s*\}/);
    expect(src).not.toMatch(/excludedCategories:\s*\{\s*banquet:[^}]*catering:/);
  });

  it('each section holds its own working copy', () => {
    // One shared `excluded` set across sections would let a save of one write
    // the other's ticks.
    expect(src).toMatch(/const ScopeSection = \(\{/);
    expect(src).toMatch(/const \[excluded, setExcluded\] = useState<Set<MenuCategory>>\(new Set\(saved\)\)/);
  });

  it('unsaved ticks survive a refetch, and a failed save does not discard them', () => {
    // The query refetches on window focus. The section stays "touched" until
    // the SERVER confirms the save; clearing that on the button press meant a
    // failed save let the next refetch throw the edits away silently.
    expect(src).toMatch(/if \(isSaved\) setTouched\(false\)/);
    expect(src).not.toMatch(/onClick=\{\(\) => \{[^}]*setTouched\(false\)/);
    expect(src).toMatch(/if \(!touched\) setExcluded\(new Set\(saved\)\)/);
  });
});
