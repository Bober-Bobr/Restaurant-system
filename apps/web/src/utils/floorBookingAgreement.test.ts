import { describe, expect, it } from 'vitest';
import * as api from '../../../api/src/utils/floorBooking';
import * as apiGeom from '../../../api/src/utils/floorGeometry';
import * as web from './floorBooking';
import { MAX_SEATS, MIN_SEATS, clampSeats, defaultAreaSize, tableSize } from './floorMap';

/**
 * The floor-map rules exist twice — the API cannot import from the web app —
 * and this imports **both** and runs one set of cases through each, the same
 * guard already standing over `toSubdomainSlug`, the invoice arithmetic, the
 * section rule and the menu scope.
 *
 * Two separate copies are held here:
 *
 *  · **the booking rules** (`floorBooking`) — what day a booking falls on,
 *    which bookings still hold their tables, and how a head count is arrived
 *    at. If they drift, the kiosk offers a table the server then refuses, or
 *    shows a head count the booking was not saved with.
 *  · **the table geometry** (`floorGeometry` ↔ `floorMap`) — where a table
 *    stands and how big it is. The PRINTED plan is drawn from the API's copy
 *    and the screen from the web's, so a drift means the sheet is a map of
 *    somewhere else.
 */

describe('what day a booking falls on', () => {
  const CASES = [
    '2026-10-02T19:00:00.000Z',
    '2026-10-02T00:00:00.000Z',
    '2026-10-02T23:59:59.000Z',
    '2026-01-01T12:00:00.000Z',
    '2025-12-31T21:30:00.000Z',
    'not a date',
    '',
  ];
  for (const input of CASES) {
    it(input || '(empty)', () => {
      expect(web.dayKey(input)).toBe(api.dayKey(input));
    });
  }

  it('and a Date object reads the same on both sides', () => {
    const d = new Date('2026-07-04T22:15:00.000Z');
    expect(web.dayKey(d)).toBe(api.dayKey(d));
  });
});

describe('which bookings still hold their tables', () => {
  for (const status of ['DRAFT', 'CONFIRMED', 'CANCELLED', 'COMPLETED', 'MENU_NOT_SELECTED', '', null, undefined]) {
    it(String(status), () => {
      expect(web.holdsTables(status)).toBe(api.holdsTables(status));
    });
  }

  it('the released list itself is the same', () => {
    expect([...web.RELEASED_STATUSES]).toEqual([...api.RELEASED_STATUSES]);
  });
});

describe('the head count a booking is stored with', () => {
  const CASES: { selections: { floorTableId: string; guestCount: number }[]; fallback: number }[] = [
    { selections: [], fallback: 25 },
    { selections: [{ floorTableId: 't1', guestCount: 6 }], fallback: 0 },
    { selections: [{ floorTableId: 't1', guestCount: 6 }, { floorTableId: 't2', guestCount: 4 }], fallback: 99 },
    { selections: [{ floorTableId: 't1', guestCount: 0 }], fallback: 12 },
    { selections: [{ floorTableId: 't1', guestCount: -5 }, { floorTableId: 't2', guestCount: 8 }], fallback: 0 },
  ];
  for (const [i, c] of CASES.entries()) {
    it(`case ${i + 1}`, () => {
      expect(web.guestCountOf(c.selections, c.fallback)).toBe(api.guestCountOf(c.selections, c.fallback));
    });
  }
});

describe('a table is the same size on the screen and on the printed sheet', () => {
  for (const shape of ['RECT', 'ROUND']) {
    for (let seats = MIN_SEATS; seats <= MAX_SEATS; seats += 1) {
      it(`${shape} ${seats}`, () => {
        // Automatic size — the one that follows from the seat count, and the
        // one a plan loaded from a venue's own sheet uses throughout.
        expect(apiGeom.tableSize(shape, seats)).toEqual(tableSize(shape, seats));
      });
    }
  }

  it('a table resized by hand keeps that size on both', () => {
    for (const size of [{ width: 120, height: 80 }, { width: 300, height: 90 }, { width: 140, height: 140 }]) {
      expect(apiGeom.tableSize('RECT', 6, size)).toEqual(tableSize('RECT', 6, size));
      // A round table is forced square by the longer side, on both sides.
      expect(apiGeom.tableSize('ROUND', 6, size)).toEqual(tableSize('ROUND', 6, size));
    }
  });

  it('an unset size falls through to the seat count on both', () => {
    expect(apiGeom.tableSize('RECT', 8, { width: null, height: null })).toEqual(tableSize('RECT', 8, { width: null, height: null }));
    // Half a size is not a size: one null means "automatic" on both sides.
    expect(apiGeom.tableSize('RECT', 8, { width: 200, height: null })).toEqual(tableSize('RECT', 8, { width: 200, height: null }));
  });

  it('the seat count is clamped the same way', () => {
    for (const seats of [-3, 0, 1, 41, 1000, Number.NaN]) {
      expect(apiGeom.clampSeats(seats), String(seats)).toBe(clampSeats(seats));
      expect(apiGeom.tableSize('RECT', seats)).toEqual(tableSize('RECT', seats));
    }
  });
});

describe('an area with no size of its own starts the same size on both', () => {
  for (const kind of ['HALL', 'OUTDOOR', 'SOMETHING_ELSE']) {
    it(kind, () => {
      const fromApi = apiGeom.areaSize({ kind, mapWidth: null, mapHeight: null });
      expect(fromApi).toEqual(defaultAreaSize(kind));
    });
  }

  it('and a sized area reports its own size', () => {
    expect(apiGeom.areaSize({ kind: 'HALL', mapWidth: 1500, mapHeight: 900 })).toEqual({ width: 1500, height: 900 });
  });
});
