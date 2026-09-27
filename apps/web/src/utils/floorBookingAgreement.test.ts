import { describe, expect, it } from 'vitest';
import * as api from '../../../api/src/utils/floorBooking';
import * as apiGeom from '../../../api/src/utils/floorGeometry';
import * as web from './floorBooking';
import * as apiPdf from '../../../api/src/modules/floorMap/floorMap.pdf.service';
import * as apiPdf2 from '../../../api/src/modules/public/pdf.service';
import { SERVED_CATEGORIES, servedPortions } from './kitchenDishes';
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

describe('a booking that names an area but holds no table', () => {
  // The Events page creates one of these every time: it has a hall picker and
  // no table picker. Both sides have to agree, or the map lists an evening the
  // server does not think is there — or refuses a whole-area booking the kiosk
  // offered.
  const CASES = [
    { wholeHall: false, floorTables: [] },
    { wholeHall: false, floorTables: [{ floorTableId: 't1', guestCount: 4 }] },
    { wholeHall: true, floorTables: [] },
    { wholeHall: true, floorTables: [{ floorTableId: 't1', guestCount: 4 }] },
  ];
  for (const [i, c] of CASES.entries()) {
    it(`case ${i + 1}`, () => {
      expect(web.assignsNoTables(c)).toBe(api.assignsNoTables(c));
    });
  }

  it('and it blocks the whole area on both sides', () => {
    const booking = {
      id: 'e1', eventNumber: 7, customerName: 'Nodira', eventDate: '2026-10-02T19:00:00.000Z',
      status: 'CONFIRMED', guestCount: 40, hallId: 'street', wholeHall: false, floorTables: [],
    };
    const byHall = new Map([['street', ['t1', 't2']]]);
    expect(web.wholeAreaAvailable('street', { day: '2026-10-02', bookings: [booking] }, byHall)).toBe(false);
    expect(api.wholeAreaAvailable('street', api.occupancyOf([booking]), byHall)).toBe(false);
    // …and an empty day still offers it, on both.
    expect(web.wholeAreaAvailable('street', { day: '2026-10-02', bookings: [] }, byHall)).toBe(true);
    expect(api.wholeAreaAvailable('street', api.occupancyOf([]), byHall)).toBe(true);
  });

  it('a CANCELLED one blocks nothing, on both', () => {
    const booking = {
      id: 'e1', eventNumber: 7, customerName: 'Nodira', eventDate: '2026-10-02T19:00:00.000Z',
      status: 'CANCELLED', guestCount: 40, hallId: 'street', wholeHall: false, floorTables: [],
    };
    const byHall = new Map([['street', ['t1', 't2']]]);
    expect(web.wholeAreaAvailable('street', { day: '2026-10-02', bookings: [booking] }, byHall)).toBe(true);
    expect(api.wholeAreaAvailable('street', api.occupancyOf([booking]), byHall)).toBe(true);
    expect(web.unassignedBookings({ day: '2026-10-02', bookings: [booking] })).toEqual([]);
    expect(api.unassignedBookings([booking])).toEqual([]);
  });

  it('but a single table in that room is still bookable — assigning them is the remedy', () => {
    const booking = {
      id: 'e1', eventNumber: 7, customerName: 'Nodira', eventDate: '2026-10-02T19:00:00.000Z',
      status: 'CONFIRMED', guestCount: 40, hallId: 'street', wholeHall: false, floorTables: [],
    };
    const byHall = new Map([['street', ['t1', 't2']]]);
    expect(api.bookingClash(
      { hallId: 'street', wholeHall: false, selections: [{ floorTableId: 't1', guestCount: 4 }] },
      api.occupancyOf([booking]), byHall,
    )).toBeNull();
    // The web side draws it from the same fact: it holds no table.
    expect(web.tableHolders({ day: '2026-10-02', bookings: [booking] }, byHall).size).toBe(0);
  });
});

describe('how full a reserved table is', () => {
  // The printed sheet has said this since the three fills went in; the screen
  // said nothing, so the paper and the map disagreed about the same room. One
  // set of cases through both, like every other rule kept in two places.
  const pdf = apiPdf;
  const TABLE = { id: 't1', seats: 10 };
  const bookingAt = (guestCount: number) => ({
    id: 'e1', eventNumber: 4, customerName: 'Nodira', eventDate: '2026-10-02T14:00:00.000Z',
    status: 'CONFIRMED', guestCount, hallId: 'street', wholeHall: false,
    floorTables: [{ floorTableId: 't1', guestCount }],
  });

  for (const seated of [0, 1, 3, 9, 10, 11]) {
    it(`${seated} of 10 seated`, () => {
      const booking = bookingAt(seated);
      const day = { day: '2026-10-02', bookings: [booking] };
      const webFill = web.tableFill(TABLE, web.tableHolders(day, new Map([['street', ['t1']]])), web.seatedAtTables(day));
      const { held, guests, whole } = pdf.heldTables([booking], 'street');
      expect(webFill).toBe(pdf.fillOf(TABLE, held, guests, whole));
    });
  }

  it('a free table reads free on both', () => {
    const day = { day: '2026-10-02', bookings: [] as never[] };
    const { held, guests, whole } = pdf.heldTables([], 'street');
    expect(web.tableFill(TABLE, web.tableHolders(day, new Map()), web.seatedAtTables(day)))
      .toBe(pdf.fillOf(TABLE, held, guests, whole));
  });

  it('a cancelled booking seats nobody', () => {
    // `tableFill` only reads the seat count for a table something HOLDS, and a
    // cancelled booking holds nothing — so this is invisible through the map
    // today and would surface the moment anything else read the counts. The
    // rule belongs to the function, not to its one caller.
    const gone = { ...bookingAt(3), status: 'CANCELLED' };
    expect(web.seatedAtTables({ day: '2026-10-02', bookings: [gone] }).size).toBe(0);
    // And the API's side agrees: `heldTables` skips it too.
    expect(pdf.heldTables([gone], 'street').guests.size).toBe(0);
  });

  it('a whole-area booking reads FULL on both — it has no per-table count', () => {
    const booking = { ...bookingAt(0), wholeHall: true, floorTables: [] };
    const day = { day: '2026-10-02', bookings: [booking] };
    const byHall = new Map([['street', ['t1']]]);
    const { held, guests, whole } = pdf.heldTables([booking], 'street');
    expect(web.tableFill(TABLE, web.tableHolders(day, byHall), web.seatedAtTables(day)))
      .toBe(pdf.fillOf(TABLE, held, guests, whole));
    expect(web.tableFill(TABLE, web.tableHolders(day, byHall), web.seatedAtTables(day))).toBe('taken');
  });
});

describe('how many portions of a dish the kitchen is asked for', () => {
  // The kitchen page lists the same dishes as the sheet it downloads, so the
  // two must not disagree about how many plates to make. A hot appetizer is one
  // per guest; everything else keeps the servings the package declares.
  const CASES = [
    { dish: { category: 'HOT_APPETIZERS', servings: 1 }, guests: 200 },
    { dish: { category: 'HOT_APPETIZERS' }, guests: 0 },
    { dish: { category: 'SALADS_OIL', servings: 1 }, guests: 200 },
    { dish: { category: 'FIRST_COURSE', servings: 3 }, guests: 40 },
    { dish: { category: 'DESSERT' }, guests: 40 },
  ];
  for (const [i, c] of CASES.entries()) {
    it(`case ${i + 1}`, () => {
      expect(servedPortions(c.dish, c.guests)).toBe(apiPdf2.servedPortions(c.dish, c.guests));
    });
  }

  it('and the serving order is the same list', () => {
    expect([...SERVED_CATEGORIES]).toEqual([...apiPdf2.SERVED_CATEGORIES]);
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
