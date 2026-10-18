import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildEventExportPayload, diningDishRows, diningTotalCents } from './eventPdf';
import type { Event, MenuItem } from '../types/domain';

/**
 * The printed sheet for a FOOD-SERVICE booking — a Small Banquets party eating
 * à la carte, whose order was composed on the floor map.
 *
 * Reported as "after booking a catering order and downloading the PDF, the
 * dishes by category and their quantities are not displayed", and that is
 * exactly what it did: this payload was built from a table package and the
 * kiosk's Additional dishes, and such a booking has neither. Its food is on
 * `menuConfig.diningOrder`, and nothing read it — so every one of those sheets
 * went to the kitchen with no food on it.
 */
const dish = (id: string, name: string, category: string, priceCents = 1_000): MenuItem =>
  ({ id, name, category, priceCents, isActive: true } as MenuItem);

const booking = (lines: { menuItemId: string | null; name: string; quantity: number; unitPriceCents: number }[]): Event =>
  ({
    id: 7,
    customerName: 'Karimov',
    eventDate: '2026-11-02T14:00:00.000Z',
    guestCount: 40,
    menuConfig: {
      sessionKind: 'dining',
      diningOrder: { orderId: 'o1', placedAt: '', lines, portions: 0, totalCents: 0 },
    },
  } as unknown as Event);

const MENU = [dish('m1', 'Plov', 'SECOND_COURSE', 35_000), dish('m2', 'Achichuk', 'SALADS_OIL', 12_000)];

const LINES = [
  { menuItemId: 'm1', name: 'Plov', quantity: 40, unitPriceCents: 35_000 },
  { menuItemId: 'm2', name: 'Achichuk', quantity: 8, unitPriceCents: 12_000 },
];

describe('the order\'s dishes reach the sheet', () => {
  it('one row per line, with its portions', () => {
    expect(diningDishRows(booking(LINES), MENU)).toEqual([
      { name: 'Plov', category: 'SECOND_COURSE', qty: 40 },
      { name: 'Achichuk', category: 'SALADS_OIL', qty: 8 },
    ]);
  });

  it('the NAME is the order\'s snapshot, not the dish table\'s', () => {
    // The order is a record of what was agreed; a dish renamed since must not
    // rewrite it, exactly as OrderItem snapshots its own.
    const rows = diningDishRows(booking([
      { menuItemId: 'm1', name: 'Plov (as ordered)', quantity: 40, unitPriceCents: 35_000 },
    ]), MENU);
    expect(rows[0]!.name).toBe('Plov (as ordered)');
    // …and the CATEGORY is the live one, because the snapshot has never
    // carried one and the sheet is grouped by it.
    expect(rows[0]!.category).toBe('SECOND_COURSE');
  });

  it('a dish that has since gone still prints, under "other dishes"', () => {
    // Deleted, or switched off for this system and therefore absent from the
    // list. The kitchen needs the dish far more than the right heading over
    // it; dropping the row would hide food somebody has paid for.
    const rows = diningDishRows(booking([
      { menuItemId: 'gone', name: 'Shurpa', quantity: 12, unitPriceCents: 20_000 },
      { menuItemId: null, name: 'Off the menu', quantity: 3, unitPriceCents: 9_000 },
    ]), MENU);
    expect(rows.map((r) => r.category)).toEqual(['OTHER_DISHES', 'OTHER_DISHES']);
    expect(rows.map((r) => r.name)).toEqual(['Shurpa', 'Off the menu']);
  });

  it('a line of nothing is not a row', () => {
    expect(diningDishRows(booking([
      { menuItemId: 'm1', name: 'Plov', quantity: 0, unitPriceCents: 35_000 },
    ]), MENU)).toEqual([]);
  });

  it('a banquet booking has none of this', () => {
    expect(diningDishRows({ menuConfig: null } as Event, MENU)).toEqual([]);
    expect(diningTotalCents({ menuConfig: null } as Event)).toBe(0);
  });

  it('the total is added up from the LINES, not read off the figure beside them', () => {
    // One free-form JSON column: a figure its own lines do not add up to must
    // not be the one on the invoice. Same rule as `diningPortions`.
    expect(diningTotalCents(booking(LINES))).toBe(40 * 35_000 + 8 * 12_000);
  });
});

describe('the exported payload carries them', () => {
  const payload = buildEventExportPayload(booking(LINES), {
    menuItems: MENU,
    tableCategories: [],
    halls: [],
    restaurantName: 'Sangizar',
    restaurantLogoUrl: null,
    locale: 'ru',
    t: ((key: string) => key) as never,
  });

  it('the dishes are in it, so the exporter can group them', () => {
    expect(payload.orderedDishes).toHaveLength(2);
    expect(payload.orderedDishes!.map((d) => d.qty)).toEqual([40, 8]);
  });

  it('and the money is the order\'s, not a zero', () => {
    // Without it the sheet printed a total of nothing under a list of dishes
    // somebody is being charged for.
    const total = 40 * 35_000 + 8 * 12_000;
    expect(payload.pricing.totalCents).toBe(total);
    expect(payload.pricing.perGuestCents).toBe(Math.round(total / 40));
  });

  it('a banquet payload is unchanged by any of it', () => {
    const banquet = buildEventExportPayload(
      { id: 1, customerName: 'A', eventDate: '2026-11-02T14:00:00.000Z', guestCount: 10, menuConfig: null } as Event,
      {
        menuItems: MENU, tableCategories: [], halls: [],
        restaurantName: '', restaurantLogoUrl: null, locale: 'ru', t: ((k: string) => k) as never,
      },
    );
    expect(banquet.orderedDishes).toEqual([]);
    expect(banquet.pricing.totalCents).toBe(0);
  });
});

describe('both download screens send them', () => {
  // Two screens build this body — the admin/supervisor Events page through the
  // shared builder, and the kitchen's own page by hand. A fix applied to one
  // leaves the other handing a cook a sheet with no food on it.
  const SRC = join(__dirname, '..');
  const read = (rel: string) => readFileSync(join(SRC, rel), 'utf8');

  it('the Events page, through the shared builder', () => {
    expect(read('utils/eventPdf.ts')).toContain('orderedDishes,');
    expect(read('pages/AdminEventsPage.tsx')).toContain('buildEventExportPayload');
  });

  it('and the kitchen\'s page, which builds its own body', () => {
    const page = read('pages/EmployeeEventsPage.tsx');
    expect(page).toContain('orderedDishes: diningDishRows(event, menuItems)');
    expect(page).toContain("from '../utils/eventPdf'");
  });
});
