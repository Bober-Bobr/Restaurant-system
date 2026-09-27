import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Event } from '../types/domain';
import {
  EMPTY_FILTERS, isFiltering, matchesBookingNumber, matchesWhen, normalizeQuery, sortEvents, visibleEvents,
} from './kitchenEvents';
import { groupKitchenDishes, isServedCategory, servedPortions } from './kitchenDishes';

/**
 * Finding one booking, and reading its dishes.
 *
 * `/events` is unbounded on purpose, so a kitchen page holds every booking the
 * restaurant has ever taken. These are the two pieces of logic that make that
 * list usable, tested without a screen as everything else in this suite is.
 */
const ev = (over: Partial<Event> & { id: number }): Event => ({
  customerName: 'Nodira', eventDate: '2026-10-02T14:00:00.000Z', guestCount: 40,
  status: 'CONFIRMED', ...over,
} as Event);

describe('searching by booking number', () => {
  it('forgives the # and the spaces staff actually type', () => {
    expect(normalizeQuery('#12')).toBe('12');
    expect(normalizeQuery(' 12 ')).toBe('12');
    expect(normalizeQuery('no 7')).toBe('7');
    expect(normalizeQuery('')).toBe('');
    expect(normalizeQuery('abc')).toBe('');
  });

  it('matches on a PREFIX, so the list narrows as it is typed', () => {
    // An exact match shows nothing until the last digit; on a venue whose
    // numbers have reached four figures that is three empty screens.
    expect(matchesBookingNumber({ id: 12 }, '1')).toBe(true);
    expect(matchesBookingNumber({ id: 12 }, '12')).toBe(true);
    expect(matchesBookingNumber({ id: 1234 }, '12')).toBe(true);
    expect(matchesBookingNumber({ id: 3 }, '12')).toBe(false);
  });

  it('an empty search matches everything rather than nothing', () => {
    expect(matchesBookingNumber({ id: 12 }, '')).toBe(true);
    expect(matchesBookingNumber({ id: 12 }, '#')).toBe(true);
  });
});

describe('which day a booking counts as being on', () => {
  // The LOCAL day: this is somebody asking what is on today, in the restaurant.
  const now = new Date('2026-10-02T12:00:00');
  const on = (local: string) => ({ eventDate: new Date(local).toISOString() });

  it('today is today', () => {
    expect(matchesWhen(on('2026-10-02T19:00:00'), 'today', now)).toBe(true);
    expect(matchesWhen(on('2026-10-03T19:00:00'), 'today', now)).toBe(false);
    expect(matchesWhen(on('2026-10-01T19:00:00'), 'today', now)).toBe(false);
  });

  it('an early-hours booking today is still TODAY', () => {
    // THE case this reads local fields for, and the direction is easy to get
    // backwards: east of Greenwich local = UTC + offset, so it is 00:00-05:00
    // LOCAL that falls on the previous UTC day, not the late evening. Read with
    // `dayKey`'s UTC a 01:00 booking would be filed yesterday and drop off
    // today's list — which is the list a kitchen works from.
    expect(matchesWhen(on('2026-10-02T01:00:00'), 'today', now)).toBe(true);
    expect(matchesWhen(on('2026-10-02T23:30:00'), 'today', now)).toBe(true);
    // On a machine actually east or west of UTC, the case above and the UTC
    // reading genuinely disagree; on a UTC machine they cannot, so the rule is
    // also asserted against the source, which holds everywhere.
    const src = readFileSync(join(__dirname, 'kitchenEvents.ts'), 'utf8');
    expect(src).toContain('const today = localDateKey(now);');
    expect(src).toContain('const day = localDateKey(at);');
    expect(src.match(/toISOString\(\)\.slice\(0, 10\)/g), 'a UTC day key is back').toBeNull();
  });

  it('today is upcoming, and is not past', () => {
    // A booking being cooked for this evening is not history.
    expect(matchesWhen(on('2026-10-02T19:00:00'), 'upcoming', now)).toBe(true);
    expect(matchesWhen(on('2026-10-02T19:00:00'), 'past', now)).toBe(false);
    expect(matchesWhen(on('2026-10-01T19:00:00'), 'past', now)).toBe(true);
    expect(matchesWhen(on('2026-10-05T19:00:00'), 'upcoming', now)).toBe(true);
  });

  it('"all" means all, including an unparseable date', () => {
    expect(matchesWhen(on('2026-10-01T19:00:00'), 'all', now)).toBe(true);
    expect(matchesWhen({ eventDate: 'nonsense' }, 'all', now)).toBe(true);
    // And a broken date does not sneak into a narrower window.
    expect(matchesWhen({ eventDate: 'nonsense' }, 'today', now)).toBe(false);
  });
});

describe('the list the kitchen sees', () => {
  const now = new Date('2026-10-02T12:00:00');
  const EVENTS: Event[] = [
    ev({ id: 1, eventDate: new Date('2026-10-01T19:00:00').toISOString(), status: 'COMPLETED', hallId: 'h1', guestCount: 80 }),
    ev({ id: 12, eventDate: new Date('2026-10-02T19:00:00').toISOString(), status: 'CONFIRMED', hallId: 'h1', guestCount: 40 }),
    ev({ id: 120, eventDate: new Date('2026-10-02T13:00:00').toISOString(), status: 'CANCELLED', hallId: 'h2', guestCount: 10 }),
    ev({ id: 7, eventDate: new Date('2026-10-09T19:00:00').toISOString(), status: 'DRAFT', hallId: 'h2', guestCount: 200 }),
  ];
  const ids = (list: Event[]) => list.map((e) => e.id);

  it('applies the search, the filters and the sort together', () => {
    // One pass, so the list cannot disagree with the count printed above it.
    expect(ids(visibleEvents(EVENTS, { ...EMPTY_FILTERS, query: '12' }, 'number-asc', now))).toEqual([12, 120]);
    expect(ids(visibleEvents(EVENTS, { ...EMPTY_FILTERS, when: 'today' }, 'date-asc', now))).toEqual([120, 12]);
    expect(ids(visibleEvents(EVENTS, { ...EMPTY_FILTERS, status: 'CONFIRMED' }, 'date-asc', now))).toEqual([12]);
    expect(ids(visibleEvents(EVENTS, { ...EMPTY_FILTERS, hallId: 'h2' }, 'number-asc', now))).toEqual([7, 120]);
    // Narrowing on two at once.
    expect(ids(visibleEvents(EVENTS, { ...EMPTY_FILTERS, when: 'today', hallId: 'h1' }, 'date-asc', now))).toEqual([12]);
  });

  it('sorts every way it offers, and never in place', () => {
    const before = ids(EVENTS);
    expect(ids(sortEvents(EVENTS, 'date-asc'))).toEqual([1, 120, 12, 7]);
    expect(ids(sortEvents(EVENTS, 'date-desc'))).toEqual([7, 12, 120, 1]);
    expect(ids(sortEvents(EVENTS, 'number-asc'))).toEqual([1, 7, 12, 120]);
    expect(ids(sortEvents(EVENTS, 'number-desc'))).toEqual([120, 12, 7, 1]);
    expect(ids(sortEvents(EVENTS, 'guests-desc'))).toEqual([7, 1, 12, 120]);
    // The query's cached array is somebody else's: sorting it in place would
    // reorder React Query's own data.
    expect(ids(EVENTS)).toEqual(before);
  });

  it('an unparseable date sorts last instead of scrambling the list', () => {
    // FIRST in the input, deliberately: appended last, a NaN comparator leaves
    // it last by never having to move it, and the assertion passes against the
    // very bug it is for.
    const broken = [ev({ id: 99, eventDate: 'nonsense' }), ...EVENTS];
    expect(ids(sortEvents(broken, 'date-asc'))).toEqual([1, 120, 12, 7, 99]);
    expect(ids(sortEvents(broken, 'date-desc'))).toEqual([99, 7, 12, 120, 1]);
  });

  it('says when it is narrowing anything, which is what Clear is for', () => {
    expect(isFiltering(EMPTY_FILTERS)).toBe(false);
    expect(isFiltering({ ...EMPTY_FILTERS, query: '#' })).toBe(false);
    expect(isFiltering({ ...EMPTY_FILTERS, query: '7' })).toBe(true);
    expect(isFiltering({ ...EMPTY_FILTERS, when: 'today' })).toBe(true);
    expect(isFiltering({ ...EMPTY_FILTERS, status: 'DRAFT' })).toBe(true);
    expect(isFiltering({ ...EMPTY_FILTERS, hallId: 'h1' })).toBe(true);
  });
});

describe('a booking\'s dishes, grouped', () => {
  const dish = (id: string, category: string, portions = 1, name = id) => ({ id, name, category, portions });

  it('puts the served courses first, in SERVING order', () => {
    // The order the printed sheet uses. The page has a "Download PDF" button on
    // every card, and two orders for one booking is worse than either.
    const groups = groupKitchenDishes([
      dish('a', 'DESSERT'), dish('b', 'THIRD_COURSE'), dish('c', 'SALADS_OIL'),
      dish('d', 'HOT_APPETIZERS'), dish('e', 'FIRST_COURSE'), dish('f', 'SECOND_COURSE'),
    ]);
    expect(groups.map((g) => g.category)).toEqual([
      'HOT_APPETIZERS', 'FIRST_COURSE', 'SECOND_COURSE', 'THIRD_COURSE', 'DESSERT', 'SALADS_OIL',
    ]);
    expect(groups.filter((g) => g.served).map((g) => g.category))
      .toEqual(['HOT_APPETIZERS', 'FIRST_COURSE', 'SECOND_COURSE', 'THIRD_COURSE']);
  });

  it('counts the dishes and the plates separately', () => {
    // "3 dishes" and "44 portions" answer different questions, and the prep is
    // the second one.
    const [group] = groupKitchenDishes([
      dish('a', 'SALADS_OIL', 4), dish('b', 'SALADS_OIL', 40), dish('c', 'SALADS_OIL', 0),
    ]);
    expect(group.dishCount).toBe(3);
    expect(group.portions).toBe(44);
  });

  it('has no empty groups, and keeps two dishes of the same name apart', () => {
    expect(groupKitchenDishes([])).toEqual([]);
    const [group] = groupKitchenDishes([dish('a', 'GRILL', 1, 'Shashlik'), dish('b', 'GRILL', 1, 'Shashlik')]);
    expect(group.dishes).toHaveLength(2);
  });

  it('a category nobody has heard of sorts LAST rather than first', () => {
    // Which is what a missing rank does with a plain `?? 0`.
    const groups = groupKitchenDishes([dish('a', 'MYSTERY'), dish('b', 'DESSERT')]);
    expect(groups.map((g) => g.category)).toEqual(['DESSERT', 'MYSTERY']);
    expect(isServedCategory('MYSTERY')).toBe(false);
  });

  it('a hot appetizer is one per guest, everything else what the package says', () => {
    expect(servedPortions({ category: 'HOT_APPETIZERS', servings: 1 }, 200)).toBe(200);
    expect(servedPortions({ category: 'SALADS_OIL', servings: 1 }, 200)).toBe(1);
    expect(servedPortions({ category: 'DESSERT' }, 200)).toBe(1);
  });
});
