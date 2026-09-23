/**
 * Bookings on the floor map, web side.
 *
 * The rules that both halves need — what "the same day" means, which bookings
 * still hold their tables, and how a booking's head count is arrived at — are
 * mirrored from apps/api/src/utils/floorBooking.ts, because the API cannot
 * import from the web app. `floorBookingAgreement.test.ts` imports **both**
 * and runs one set of cases through each, the same guard already standing over
 * `toSubdomainSlug`, the invoice arithmetic and the section rule.
 *
 * If they drift, the kiosk offers a table the server then refuses, or shows a
 * head count the booking was not saved with.
 */

/** A booking in one of these states has let its tables go. */
export const RELEASED_STATUSES = ['CANCELLED'] as const;

/**
 * Whether a booking in this state still holds its tables. A DRAFT one does —
 * a table being pencilled in is exactly what the next person to look at the
 * map needs to see.
 */
export function holdsTables(status: string | null | undefined): boolean {
  return !RELEASED_STATUSES.includes((status ?? '') as (typeof RELEASED_STATUSES)[number]);
}

/**
 * The day a booking falls on, as `YYYY-MM-DD`. **UTC**, like the API's copy:
 * the same answer on every machine, where a local reading would move a
 * late-evening booking to the next day on a server east of the restaurant.
 */
export function dayKey(date: Date | string): string {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

export type TableSelection = { floorTableId: string; guestCount: number };

/**
 * The booking's head count.
 *
 * **A specified figure WINS and is the cap.** A banquet's head count is typed
 * before the map is touched — it is what the per-person package is priced on —
 * so the seating has to fit inside it rather than redefine it. Only when
 * nothing was specified (a general-dining booking, where the map IS the
 * booking) do the tables supply it.
 */
export function guestCountOf(selections: TableSelection[], specified: number): number {
  if (specified > 0) return specified;
  return seatedGuests(selections);
}

/** How many people the chosen tables seat between them. */
export function seatedGuests(selections: TableSelection[]): number {
  return selections.reduce((sum, s) => sum + Math.max(0, s.guestCount), 0);
}

/**
 * How many seated guests are over the specified head count, or 0 when they
 * fit. With nothing specified there is no cap to exceed.
 */
export function seatingOverflow(selections: TableSelection[], specified: number): number {
  if (specified <= 0) return 0;
  return Math.max(0, seatedGuests(selections) - specified);
}

/** How many more may still be seated, or null when there is no cap. */
export function seatsRemaining(selections: TableSelection[], specified: number): number | null {
  if (specified <= 0) return null;
  return Math.max(0, specified - seatedGuests(selections));
}

// ── What the API hands back ─────────────────────────────────────────────────

/** A booking as the map shows it: enough to draw it and to name who holds it. */
export type MapBooking = {
  id: string;
  eventNumber: number;
  customerName: string;
  customerPhone?: string | null;
  eventDate: string;
  status: string;
  guestCount: number;
  eventType?: string | null;
  notes?: string | null;
  hallId?: string | null;
  wholeHall: boolean;
  floorTables: TableSelection[];
};

export type MapOccupancy = {
  /** The day these bookings were read for, `YYYY-MM-DD`. */
  day: string;
  bookings: MapBooking[];
};

/** table id → the booking holding it, whole-area bookings folded in. */
export function tableHolders(
  occupancy: MapOccupancy | undefined,
  tablesByHall: Map<string, string[]>,
): Map<string, MapBooking> {
  const holders = new Map<string, MapBooking>();
  for (const booking of occupancy?.bookings ?? []) {
    if (!holdsTables(booking.status)) continue;
    if (booking.wholeHall && booking.hallId) {
      for (const id of tablesByHall.get(booking.hallId) ?? []) holders.set(id, booking);
    }
    for (const t of booking.floorTables) holders.set(t.floorTableId, booking);
  }
  return holders;
}

/** The booking holding a whole area on this day, if any. */
export function areaHolder(occupancy: MapOccupancy | undefined, hallId: string): MapBooking | null {
  return (occupancy?.bookings ?? []).find((b) => b.wholeHall && b.hallId === hallId && holdsTables(b.status)) ?? null;
}

/**
 * Whether the whole area can still be taken: every table in it free. An area
 * with no tables drawn cannot be let — "all of nothing" is not a venue.
 */
export function wholeAreaAvailable(
  hallId: string,
  occupancy: MapOccupancy | undefined,
  tablesByHall: Map<string, string[]>,
): boolean {
  const tables = tablesByHall.get(hallId) ?? [];
  if (tables.length === 0) return false;
  const holders = tableHolders(occupancy, tablesByHall);
  return tables.every((id) => !holders.has(id));
}

/** Group a flat table list by the area each stands in. */
export function tablesByHallOf(tables: { id: string; hallId: string }[]): Map<string, string[]> {
  const byHall = new Map<string, string[]>();
  for (const t of tables) byHall.set(t.hallId, [...(byHall.get(t.hallId) ?? []), t.id]);
  return byHall;
}
