import createHttpError from 'http-errors';
import { prisma } from '../../db/prisma.js';
import type { Section } from '../../utils/section.js';
import {
  bookingClash, dayKey, dayRange, guestCountOf, occupancyOf,
  type BookingRow, type TableSelection,
} from '../../utils/floorBooking.js';

/**
 * Taking tables on the floor map, as part of creating or updating a booking.
 *
 * The DECISION — what clashes with what — is in utils/floorBooking.ts and has
 * no database in it. This file is the part that has to touch one: reading the
 * day's bookings and the section's tables, then writing the join rows.
 *
 * Three rules are enforced here and nowhere else, because the map on the kiosk
 * and the map in the admin app both go through this path:
 *
 *  · **Every table must be in the caller's own section and restaurant**, and in
 *    the booking's own area. A table id is the only thing the caller sends;
 *    without this check a supervisor could seat a party in another
 *    restaurant's room by guessing one.
 *  · **A table already held that day is refused**, naming the booking that
 *    holds it — a receptionist told only "unavailable" has to go and find out
 *    who, on a busy night, at the desk.
 *  · **The head count is the sum of the tables'**, never what the client
 *    reported: a client that sets its own total sets its own seating.
 */

export type FloorTablesPayload = {
  floorTables?: TableSelection[];
  wholeHall?: boolean;
};

export type ResolvedFloorTables = {
  selections: TableSelection[];
  wholeHall: boolean;
  hallId: string | null;
  /** The head count this booking should be stored with. */
  guestCount: number;
};

const MAX_TABLES_PER_BOOKING = 200;

/**
 * Check what the booking asks for against the day, and say what should be
 * stored. Throws 4xx rather than returning a reason: every caller would
 * otherwise have to remember to look.
 */
export async function resolveFloorTables(
  restaurantId: string,
  section: Section,
  request: {
    eventDate: Date;
    hallId?: string | null;
    guestCount: number;
    payload: FloorTablesPayload;
    /** The booking being edited — it must not clash with itself. */
    exceptEventId?: string;
  },
): Promise<ResolvedFloorTables> {
  const selections = (request.payload.floorTables ?? []).filter((s) => !!s?.floorTableId);
  const wholeHall = !!request.payload.wholeHall;

  if (selections.length > MAX_TABLES_PER_BOOKING) {
    throw createHttpError(400, `A booking cannot hold more than ${MAX_TABLES_PER_BOOKING} tables`);
  }
  // A booking is either the named tables or the whole area — both at once says
  // two different things about the same evening.
  if (wholeHall && selections.length > 0) {
    throw createHttpError(400, 'A booking takes either named tables or the whole area, not both');
  }

  const ids = [...new Set(selections.map((s) => s.floorTableId))];
  if (ids.length !== selections.length) throw createHttpError(400, 'The same table was chosen twice');

  let hallId = request.hallId ?? null;

  if (ids.length > 0) {
    // Scoped through the hall, as every floor-map read is: a table carries no
    // restaurant and no section of its own.
    const tables = await prisma.floorTable.findMany({
      where: { id: { in: ids }, hall: { restaurantId, section } },
      select: { id: true, hallId: true },
    });
    if (tables.length !== ids.length) throw createHttpError(404, 'Table not found');

    const halls = [...new Set(tables.map((t) => t.hallId))];
    // One booking, one area. Tables in two rooms is a booking the map cannot
    // draw and the printed sheet cannot head.
    if (halls.length > 1) throw createHttpError(400, 'All the tables of one booking must be in the same area');
    // The area follows from the tables when the caller did not name one, and
    // must agree with it when they did.
    if (hallId && hallId !== halls[0]) throw createHttpError(400, 'Those tables are not in the chosen area');
    hallId = halls[0];
  }

  if (wholeHall && !hallId) throw createHttpError(400, 'Choose the area to reserve');

  if (ids.length > 0 || wholeHall) {
    const day = dayKey(request.eventDate);
    const [bookings, tableRows] = await Promise.all([
      prisma.event.findMany({
        where: {
          restaurantId, section,
          eventDate: dayRange(day),
          OR: [{ wholeHall: true }, { floorTables: { some: {} } }],
        },
        select: {
          id: true, eventNumber: true, customerName: true, customerPhone: true,
          eventDate: true, status: true, guestCount: true, eventType: true, notes: true,
          hallId: true, wholeHall: true,
          floorTables: { select: { floorTableId: true, guestCount: true } },
        },
      }),
      prisma.floorTable.findMany({ where: { hall: { restaurantId, section } }, select: { id: true, hallId: true } }),
    ]);

    const tablesByHall = new Map<string, string[]>();
    for (const row of tableRows) tablesByHall.set(row.hallId, [...(tablesByHall.get(row.hallId) ?? []), row.id]);

    const clash = bookingClash(
      { hallId, wholeHall, selections },
      occupancyOf(bookings as BookingRow[]),
      tablesByHall,
      request.exceptEventId,
    );
    if (clash) {
      // Named, so the message can say WHO holds it.
      const who = `#${clash.booking.eventNumber} (${clash.booking.customerName})`;
      throw createHttpError(409, clash.kind === 'area'
        ? `This area is already reserved on that day by booking ${who}`
        : `A table is already reserved on that day by booking ${who}`);
    }
    // Reserving a whole area that has no tables drawn on it yet is refused by
    // `bookingClash`'s caller rather than here — see wholeAreaAvailable.
    if (wholeHall && (tablesByHall.get(hallId!) ?? []).length === 0) {
      throw createHttpError(409, 'This area has no tables on its map yet');
    }
  }

  return {
    selections,
    wholeHall,
    hallId,
    guestCount: guestCountOf(selections, request.guestCount),
  };
}

/** Replace a booking's held tables with exactly these. */
export async function writeFloorTables(eventId: string, selections: TableSelection[]): Promise<void> {
  await prisma.$transaction(async (tx) => {
    // Replaced rather than merged: the selection the guest confirmed is the
    // whole of what they took, so a table dropped on the map must be released.
    await tx.eventFloorTable.deleteMany({ where: { eventId } });
    if (selections.length > 0) {
      await tx.eventFloorTable.createMany({
        data: selections.map((s) => ({
          eventId,
          floorTableId: s.floorTableId,
          guestCount: Math.max(0, s.guestCount),
        })),
      });
    }
  });
}
