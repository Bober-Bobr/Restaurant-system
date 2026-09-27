import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { KITCHEN_ROLES, isKitchenRole } from './kitchenRole';
import { menuScopeOfRole } from './menuScope';

/**
 * Who reads a booking as a cook.
 *
 * `SMALL_KITCHEN` is required to work exactly as `KITCHEN` does — one route
 * table serves both, deliberately. But the events page those routes mount asked
 * `role === 'KITCHEN'` twice, so the Small Banquets cooks got **neither** the
 * table package's dishes nor the "Additional dishes" heading: a booking with no
 * food on it, which is the one thing a kitchen page is for.
 */
const WEB = join(__dirname, '..');
const strip = (code: string) => code.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, '');
const page = strip(readFileSync(join(WEB, 'pages', 'EmployeeEventsPage.tsx'), 'utf8'));

describe('the kitchen roles', () => {
  it('are both of them', () => {
    expect(isKitchenRole('KITCHEN')).toBe(true);
    expect(isKitchenRole('SMALL_KITCHEN')).toBe(true);
  });

  it('and nobody else — it is a POSITIVE list', () => {
    // `role !== 'EMPLOYEE'` reads the same way today and hands the kitchen view
    // to every role added to that layout afterwards.
    for (const role of ['EMPLOYEE', 'ADMIN', 'SUPERVISOR', 'CATERING_ADMIN', 'CHIEF_ADMIN', 'OWNER'] as const) {
      expect(isKitchenRole(role), role).toBe(false);
    }
    expect(isKitchenRole(null)).toBe(false);
    expect(isKitchenRole(undefined)).toBe(false);
    expect([...KITCHEN_ROLES]).toEqual(['KITCHEN', 'SMALL_KITCHEN']);
  });
});

describe('the staff events page', () => {
  it('decides what to show from the list, never from one role', () => {
    expect(page).toContain('const kitchen = isKitchenRole(role);');
    // Any surviving comparison against the literal is the bug coming back.
    expect(page.match(/role === 'KITCHEN'/g), "a role === 'KITCHEN' test is left").toBeNull();
  });

  it('so both kitchens get the package dishes and the Additional heading', () => {
    expect(page).toContain('{kitchen && tc && (tc.packageItems ?? []).length > 0 && (');
    expect(page).toContain("{kitchen ? t('additional_dishes') : t('selected_dishes')}");
  });

  it('and reads the dish table through its OWN system, not the banquet one', () => {
    // The three systems have separate prices and separate switched-off lists;
    // 'banquet' was hardcoded here.
    expect(page).toContain('const scope = menuScopeOfRole(role) ?? ');
    expect(page).toContain("queryKey: ['menu', scope]");
    expect(page).toContain('menuService.list(scope)');
    expect(menuScopeOfRole('SMALL_KITCHEN')).toBe('smallBanquet');
    expect(menuScopeOfRole('KITCHEN')).toBe('banquet');
  });

  it('names the tables the party sits at, and says so when there are none', () => {
    // A cook plating for table 7 needs the number, not only the hall's name.
    expect(page).toContain("label={t('fm_chosen_tables')}");
    expect(page).toContain("event.wholeHall ? t('fm_whole_area_taken')");
    expect(page).toContain("t('fm_no_tables_yet')");
  });
});
