import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { banquetMenuOf } from './eventMenuKind';
import type { EventMenuConfig } from '../types/domain';

/**
 * A banquet booked from the Small Banquets map has its menu chosen in the
 * kiosk, which records it on menuConfig and writes NO selection rows. The
 * Events page's Menu column counted only selection rows, so it said "—".
 */
const config = (over: Partial<EventMenuConfig>): EventMenuConfig => ({
  secondCourseIds: [], thirdCourseIds: [], replacements: {},
  childSecondCourseIds: [], childThirdCourseIds: [], childReplacements: {},
  extras: {}, ...over,
});
const items = [
  { id: 'hot', name: 'Somsa', nameI18n: { ru: 'Самса' } },
  { id: 'soup', name: 'Shurpa' },
  { id: 'plov', name: 'Plov' },
  { id: 'tea', name: 'Tea' },
  { id: 'cake', name: 'Cake' },
];

describe('banquetMenuOf', () => {
  it('lists the courses in serving order, then the paid extras with quantities', () => {
    const lines = banquetMenuOf({ menuConfig: config({
      hotAppetizerIds: ['hot'], firstCourseId: 'soup', secondCourseIds: ['plov'], thirdCourseIds: ['tea'],
      extras: { cake: 3 }, sessionKind: 'banquet',
    }) }, items, 'ru');
    expect(lines.map((l) => [l.name, l.quantity])).toEqual([
      ['Самса', null], ['Shurpa', null], ['Plov', null], ['Tea', null], ['Cake', 3],
    ]);
  });

  it('counts a dish missing from the list but leaves it unnamed', () => {
    const lines = banquetMenuOf({ menuConfig: config({ secondCourseIds: ['gone'] }) }, items);
    expect(lines).toEqual([{ menuItemId: 'gone', name: null, quantity: null }]);
  });

  it('skips zero / bad extras and is empty for no config or a food-service order', () => {
    expect(banquetMenuOf({ menuConfig: config({ extras: { cake: 0, tea: Number.NaN } }) }, items)).toEqual([]);
    expect(banquetMenuOf({ menuConfig: null } as never, items)).toEqual([]);
    expect(banquetMenuOf({ menuConfig: config({
      secondCourseIds: ['plov'],
      diningOrder: { lines: [], totalCents: 0 } as never,
    }) }, items)).toEqual([]);
  });
});

describe('the Events page reads it', () => {
  const list = readFileSync(join(__dirname, '..', 'components', 'events', 'EventList.tsx'), 'utf8');
  const page = readFileSync(join(__dirname, '..', 'pages', 'AdminEventsPage.tsx'), 'utf8');
  it('the Menu column falls back to the kiosk menu when there are no selection rows', () => {
    expect(list).toMatch(/banquetMenuOf\(event, menuItems, locale\)/);
    expect(list).toMatch(/dishTypes === 0 && banquet\.length > 0/);
  });
  it('the page hands the list its dish list, and the search card reads the same', () => {
    expect(page).toMatch(/<EventList\s+menuItems=\{menuItems\}/);
    expect(page).toMatch(/banquetMenuOf\(searchResult, menuItems, locale\)/);
  });
});
