/**
 * Who holds which table, on which day.
 *
 * A booking on the floor map takes either **named tables** (with the guests
 * seated at each) or **the whole area**. Everything else in this file follows
 * from two decisions:
 *
 * 1. **A booking holds its tables for the WHOLE DAY it falls on.** An Event has
 *    a start and no end, so there is nothing to compute a window from; and a
 *    banquet holds its table for the evening in any case. So occupancy is
 *    keyed by a day, never by a time — `dayKey` is the one place that says
 *    what "the same day" means.
 * 2. **The booking's head count is the SUM of its tables' counts.** Two numbers
 *    describing one party is a bug waiting on a busy night, so when tables are
 *    chosen the event's own `guestCount` is derived, never typed.
 *
 * A CANCELLED booking holds nothing — the table is free again and must be
 * bookable, which is the whole reason cancelling exists. A DRAFT one **does**
 * hold its tables: a table being pencilled in is exactly what the next person
 * looking at the map needs to see.
 */

export const RELEASED_STATUSES = ['CANCELLED'] as const;

/** Whether a booking in this state still holds the tables it names. */
export function holdsTables(status: string | null | undefined): boolean {
  return !RELEASED_STATUSES.includes((status ?? '') as (typeof RELEASED_STATUSES)[number]);
}

/**
 * The day a booking falls on, as `YYYY-MM-DD`.
 *
 * **UTC, deliberately.** `eventDate` is stored as an instant and the server may
 * run anywhere; `toISOString().slice(0, 10)` is the same answer on every
 * machine, where `getDate()` would move a late-evening booking to the next day
 * on a server east of the restaurant. The web copy of this rule is in
 * apps/web/src/utils/floorBooking.ts and `floorBookingAgreement.test.ts` runs
 * one set of cases through both.
 */
export function dayKey(date: Date | string): string {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

/** The instants bounding a day, for a `gte`/`lt` query on `eventDate`. */
export function dayRange(day: string): { gte: Date; lt: Date } {
  const gte = new Date(`${day}T00:00:00.000Z`);
  return { gte, lt: new Date(gte.getTime() + 24 * 60 * 60 * 1000) };
}

export type BookingRow = {
  id: string;
  eventNumber: number;
  customerName: string;
  customerPhone?: string | null;
  eventDate: Date | string;
  status: string;
  guestCount: number;
  eventType?: string | null;
  notes?: string | null;
  hallId?: string | null;
  wholeHall: boolean;
  floorTables: { floorTableId: string; guestCount: number }[];
};

/** Which tables and which whole areas are held on a day. */
export type Occupancy = {
  /** table id → the booking holding it. */
  tables: Map<string, BookingRow>;
  /** hall id → the booking holding the whole area. */
  wholeAreas: Map<string, BookingRow>;
};

/**
 * Read the day's bookings into "what is taken".
 *
 * A whole-area booking takes every table in its area, so it is recorded
 * against the area and `takenTableIds` folds the area's tables in — the caller
 * supplies which tables stand where, because this file knows about bookings
 * and not about the map.
 */
export function occupancyOf(bookings: BookingRow[]): Occupancy {
  const tables = new Map<string, BookingRow>();
  const wholeAreas = new Map<string, BookingRow>();
  for (const booking of bookings) {
    if (!holdsTables(booking.status)) continue;
    if (booking.wholeHall && booking.hallId) wholeAreas.set(booking.hallId, booking);
    for (const t of booking.floorTables) tables.set(t.floorTableId, booking);
  }
  return { tables, wholeAreas };
}

/** Every table id that is unavailable, including those inside a booked area. */
export function takenTableIds(
  occupancy: Occupancy,
  tablesByHall: Map<string, string[]>,
): Set<string> {
  const taken = new Set(occupancy.tables.keys());
  for (const hallId of occupancy.wholeAreas.keys()) {
    for (const id of tablesByHall.get(hallId) ?? []) taken.add(id);
  }
  return taken;
}

/**
 * Whether an area can be taken whole on this day: only when **every** table in
 * it is free. A venue cannot be let out from under a booking that already
 * holds a table in it — and an area with no tables drawn on it yet cannot be
 * let either, since "all of nothing" is not a venue anyone can seat.
 */
export function wholeAreaAvailable(
  hallId: string,
  occupancy: Occupancy,
  tablesByHall: Map<string, string[]>,
  exceptEventId?: string,
): boolean {
  const tables = tablesByHall.get(hallId) ?? [];
  if (tables.length === 0) return false;
  const holder = occupancy.wholeAreas.get(hallId);
  if (holder && holder.id !== exceptEventId) return false;
  return tables.every((id) => {
    const taker = occupancy.tables.get(id);
    return !taker || taker.id === exceptEventId;
  });
}

export type TableSelection = { floorTableId: string; guestCount: number };

/** The booking's head count: the sum of its tables', when it names any. */
export function guestCountOf(selections: TableSelection[], fallback: number): number {
  if (selections.length === 0) return fallback;
  return selections.reduce((sum, s) => sum + Math.max(0, s.guestCount), 0);
}

export type ClashReason =
  | { kind: 'table'; floorTableId: string; booking: BookingRow }
  | { kind: 'area'; hallId: string; booking: BookingRow };

/**
 * Why this booking cannot take what it asks for, or null when it can.
 *
 * `exceptEventId` is the booking being EDITED: a booking must not collide with
 * the tables it already holds, or saving it a second time would refuse itself.
 */
export function bookingClash(
  request: { hallId?: string | null; wholeHall: boolean; selections: TableSelection[] },
  occupancy: Occupancy,
  tablesByHall: Map<string, string[]>,
  exceptEventId?: string,
): ClashReason | null {
  if (request.wholeHall) {
    const hallId = request.hallId;
    if (!hallId) return null;
    // Whichever booking stands in the way is named, so the message can say who.
    const holder = occupancy.wholeAreas.get(hallId);
    if (holder && holder.id !== exceptEventId) return { kind: 'area', hallId, booking: holder };
    for (const id of tablesByHall.get(hallId) ?? []) {
      const taker = occupancy.tables.get(id);
      if (taker && taker.id !== exceptEventId) return { kind: 'table', floorTableId: id, booking: taker };
    }
    return null;
  }
  for (const selection of request.selections) {
    const taker = occupancy.tables.get(selection.floorTableId);
    if (taker && taker.id !== exceptEventId) {
      return { kind: 'table', floorTableId: selection.floorTableId, booking: taker };
    }
    // A table inside an area somebody has taken whole is taken too.
    for (const [hallId, holder] of occupancy.wholeAreas) {
      if (holder.id === exceptEventId) continue;
      if ((tablesByHall.get(hallId) ?? []).includes(selection.floorTableId)) {
        return { kind: 'area', hallId, booking: holder };
      }
    }
  }
  return null;
}
