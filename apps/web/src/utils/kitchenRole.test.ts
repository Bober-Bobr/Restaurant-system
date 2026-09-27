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
    expect(page).toContain('{kitchen && packageGroups.length > 0 && (');
    expect(page).toContain("label={kitchen ? t('additional_dishes') : t('selected_dishes')}");
  });

  it('and the dishes are grouped into categories that fold away', () => {
    // A wedding runs to forty dishes; the flat column they were in could not be
    // skimmed.
    expect(page).toContain('groupKitchenDishes(');
    expect(page).toContain('<DishBlock');
    expect(page).toContain('aria-expanded={shown}');
    expect(page).toContain("t('ke_collapse_all')");
    // Both counts on the CLOSED row, so folding a group hides no number the
    // prep depends on.
    expect(page).toContain("t('ke_group_meta', { dishes: group.dishCount, portions: group.portions })");
  });

  it('the open groups are held by the PAGE, not by the block', () => {
    // A card re-rendered by a filter change or a refetch would otherwise snap
    // every group shut under the reader.
    expect(page).toContain('const [open, setOpen] = useState<Record<string, boolean>>({});');
    expect(page).toContain('keyFor={(c) => `${event.id}:pkg:${c}`}');
    expect(page).toContain('keyFor={(c) => `${event.id}:add:${c}`}');
  });

  it('portions are the PLATES, not the package\'s servings figure', () => {
    // A hot appetizer is one per guest, which is what the sheet this card
    // downloads has always said.
    expect(page).toContain('portions: servedPortions({ category: pi.menuItem.category, servings: pi.servings }, event.guestCount)');
  });

  it('names the room up beside the booking number', () => {
    // The first thing a cook wants off a list of bookings; as a cell in the
    // details grid it vanished entirely when a booking had no hall.
    expect(page).toContain('{kitchen && (');
    expect(page).toContain('className="adm-badge ke-hall"');
    expect(page).toContain("{hall?.name ?? t('not_selected')}");
  });

  it('and reads that room off the BOOKING, not only off the halls list', () => {
    // `/events` includes the hall on every booking. Depending on the second
    // request meant a retired hall, or a request that had not landed, left the
    // room unnamed.
    expect(page).toContain('const hall = event.hall ?? halls.find((h) => h.id === event.hallId);');
  });

  it('can search, filter and sort a list that holds every booking ever taken', () => {
    expect(page).toContain('visibleEvents(events, filters, sort)');
    // The list rendered is the filtered one, and the count matches it.
    expect(page).toContain('{shown.map((event, idx) => {');
    expect(page).toContain("t('ke_shown_of', { shown: shown.length, total: events.length })");
    // Two different empty states.
    expect(page).toContain("t('ke_none_match')");
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
