import type { Prisma } from '@prisma/client';
import { prisma } from '../../db/prisma.js';
import type { Section } from '../../utils/section.js';
import { dayRange, type BookingRow } from '../../utils/floorBooking.js';

export type AreaKind = 'HALL' | 'OUTDOOR';
export type TableShape = 'RECT' | 'ROUND';

/** The size of an area's own map. */
export type AreaSize = { mapWidth: number; mapHeight: number };

export type AreaRow = {
  id: string;
  name: string;
  kind: string;
  capacity: number;
  isActive: boolean;
  restaurantId: string | null;
  section: string;
  mapWidth: number | null;
  mapHeight: number | null;
  mapFeatures: Prisma.JsonValue;
};

export type TableRow = {
  id: string;
  hallId: string;
  label: string;
  seats: number;
  shape: string;
  x: number;
  y: number;
  rotation: number;
  width: number | null;
  height: number | null;
  /** Null = the standing layout; a day = that day's own layout of the area. */
  day: string | null;
};

export type TableData = {
  hallId: string;
  label: string;
  seats: number;
  shape: TableShape;
  x: number;
  y: number;
  rotation: number;
  width?: number | null;
  height?: number | null;
  day?: string | null;
};

export type AreaPatch = Partial<AreaSize & { name: string; kind: AreaKind; mapFeatures: unknown[] }>;

const AREA_SELECT = {
  id: true, name: true, kind: true, capacity: true, isActive: true,
  restaurantId: true, section: true,
  mapWidth: true, mapHeight: true, mapFeatures: true,
} as const;

/** A booking as the map needs it: enough to draw it and to name who holds it. */
const BOOKING_SELECT = {
  id: true, eventNumber: true, customerName: true, customerPhone: true,
  eventDate: true, status: true, guestCount: true, eventType: true, notes: true,
  hallId: true, wholeHall: true,
  floorTables: { select: { floorTableId: true, guestCount: true } },
} as const;

const TABLE_SELECT = {
  id: true, hallId: true, label: true, seats: true, shape: true, x: true, y: true, rotation: true, width: true, height: true,
  day: true,
} as const;

/**
 * Which tables a day is drawn from: per area, that day's own layout when the
 * area has one, else the standing layout. With no day, the standing layout —
 * which is what the two editors change and every other day shows.
 */
const effectiveWhere = (day: string | null | undefined, ownDayHalls: string[]): Prisma.FloorTableWhereInput =>
  (!day
    ? { day: null }
    : { OR: [{ day, hallId: { in: ownDayHalls } }, { day: null, hallId: { notIn: ownDayHalls } }] });

/**
 * The floor map's storage. Areas ARE halls (see `Hall.kind`); tables hang off
 * a hall and carry neither a restaurant nor a section of their own.
 *
 * So the scope of a table is reached THROUGH its hall — `where: { hall: {
 * restaurantId, section } }` — and never stored twice. `section` is a required
 * argument on every list, as in the hall repository, so a caller cannot omit it
 * and get both sections' rooms back.
 */
export class FloorMapRepository {
  async listAreas(restaurantId: string, section: Section): Promise<AreaRow[]> {
    return prisma.hall.findMany({ where: { restaurantId, section }, orderBy: { name: 'asc' }, select: AREA_SELECT });
  }

  /** The areas that have a layout of their own on this day. */
  async dayLayoutHalls(restaurantId: string, section: Section, day: string): Promise<string[]> {
    const rows = await prisma.floorAreaDay.findMany({
      where: { day, hall: { restaurantId, section } },
      select: { hallId: true },
    });
    return rows.map((row) => row.hallId);
  }

  /** The tables a day is drawn from — the standing layout when `day` is absent. */
  async listTables(restaurantId: string, section: Section, day?: string | null): Promise<TableRow[]> {
    const own = day ? await this.dayLayoutHalls(restaurantId, section, day) : [];
    return prisma.floorTable.findMany({
      where: { hall: { restaurantId, section }, ...effectiveWhere(day, own) },
      orderBy: [{ hallId: 'asc' }, { label: 'asc' }],
      select: TABLE_SELECT,
    });
  }

  async getArea(id: string): Promise<AreaRow | null> {
    return prisma.hall.findUnique({ where: { id }, select: AREA_SELECT });
  }

  async areaNameTaken(restaurantId: string, section: Section, name: string, exceptId?: string): Promise<boolean> {
    const found = await prisma.hall.findFirst({ where: { restaurantId, section, name }, select: { id: true } });
    return !!found && found.id !== exceptId;
  }

  async createArea(
    restaurantId: string,
    section: Section,
    data: { name: string; kind: AreaKind; capacity: number } & AreaSize,
  ): Promise<AreaRow> {
    return prisma.hall.create({ data: { ...data, restaurantId, section }, select: AREA_SELECT });
  }

  async updateArea(id: string, data: AreaPatch): Promise<AreaRow> {
    const { mapFeatures, ...rest } = data;
    return prisma.hall.update({
      where: { id },
      data: { ...rest, ...(mapFeatures ? { mapFeatures: mapFeatures as Prisma.InputJsonValue } : {}) },
      select: AREA_SELECT,
    });
  }

  /** The table together with the scope of the hall it stands in. */
  async getTable(id: string): Promise<(TableRow & { hall: { restaurantId: string | null; section: string } }) | null> {
    return prisma.floorTable.findUnique({
      where: { id },
      select: { ...TABLE_SELECT, hall: { select: { restaurantId: true, section: true } } },
    });
  }

  /**
   * Every booking in this section touching the floor map on a day — the ones
   * that name tables and the ones that take a whole area. Read by the DAY the
   * booking falls on, because that is how long a booking holds its tables
   * (see utils/floorBooking.ts).
   */
  async bookingsOnDay(restaurantId: string, section: Section, day: string): Promise<BookingRow[]> {
    const rows = await prisma.event.findMany({
      where: {
        restaurantId,
        section,
        eventDate: dayRange(day),
        // Only bookings that touch the map: the section's other events are none
        // of this query's business. **A booking that merely names an area is
        // one of them** — every booking made on the Events page is, since that
        // form has a hall picker and no table picker, and leaving them out is
        // what made an evening booked into a hall invisible here.
        OR: [{ wholeHall: true }, { floorTables: { some: {} } }, { hallId: { not: null } }],
      },
      select: BOOKING_SELECT,
      orderBy: { eventDate: 'asc' },
    });
    return rows as BookingRow[];
  }

  /**
   * The section's bookings between two days, for the schedule — past and
   * future alike, which is what makes it a schedule rather than a list of
   * what is left.
   */
  async bookingsBetween(restaurantId: string, section: Section, from: string, to: string): Promise<BookingRow[]> {
    const rows = await prisma.event.findMany({
      where: {
        restaurantId,
        section,
        eventDate: { gte: dayRange(from).gte, lt: dayRange(to).lt },
        OR: [{ wholeHall: true }, { floorTables: { some: {} } }, { hallId: { not: null } }],
      },
      select: BOOKING_SELECT,
      orderBy: { eventDate: 'asc' },
    });
    return rows as BookingRow[];
  }

  /** For the printed sheet's heading. */
  async restaurantName(restaurantId: string): Promise<string | null> {
    const row = await prisma.restaurant.findUnique({ where: { id: restaurantId }, select: { name: true } });
    return row?.name ?? null;
  }

  /** The table ids a day is drawn from, grouped by the area they stand in. */
  async tableIdsByHall(restaurantId: string, section: Section, day?: string | null): Promise<Map<string, string[]>> {
    const own = day ? await this.dayLayoutHalls(restaurantId, section, day) : [];
    const rows = await prisma.floorTable.findMany({
      where: { hall: { restaurantId, section }, ...effectiveWhere(day, own) },
      select: { id: true, hallId: true },
    });
    const byHall = new Map<string, string[]>();
    for (const row of rows) byHall.set(row.hallId, [...(byHall.get(row.hallId) ?? []), row.id]);
    return byHall;
  }

  /** One area's tables as a day is drawn from them (the standing layout with no day). */
  async tablesInArea(hallId: string, day?: string | null): Promise<TableRow[]> {
    const own = day && await this.hasDayLayout(hallId, day) ? [hallId] : [];
    return prisma.floorTable.findMany({
      where: { hallId, ...effectiveWhere(day, own) },
      orderBy: { label: 'asc' },
      select: TABLE_SELECT,
    });
  }

  async hasDayLayout(hallId: string, day: string): Promise<boolean> {
    return !!(await prisma.floorAreaDay.findUnique({ where: { hallId_day: { hallId, day } }, select: { id: true } }));
  }

  /**
   * Give an area a layout of its own on one day, by COPYING its standing
   * tables into rows carrying that day — and move that day's bookings onto
   * the copies, all in one transaction.
   *
   * The move is what keeps the bookings already taken for that day where they
   * were: they held the standing tables, and from now on that day is drawn
   * from the copies, so a booking left on a standing table would be holding a
   * table that is not on that day's map. Bookings on every other day stay on
   * the standing tables.
   *
   * `mapping` is standing id → copy id, so the caller can follow what it was
   * holding (a selection, a booking being drafted). Doing it again for a day
   * that already has its own layout changes nothing and maps nothing.
   */
  async forkDay(hallId: string, day: string): Promise<{ tables: TableRow[]; mapping: Record<string, string> }> {
    return prisma.$transaction(async (tx) => {
      const mapping: Record<string, string> = {};
      const already = await tx.floorAreaDay.findUnique({ where: { hallId_day: { hallId, day } }, select: { id: true } });
      if (!already) {
        await tx.floorAreaDay.create({ data: { hallId, day } });
        const standing = await tx.floorTable.findMany({ where: { hallId, day: null }, select: TABLE_SELECT });
        for (const { id, ...table } of standing) {
          const copy = await tx.floorTable.create({ data: { ...table, day }, select: { id: true } });
          mapping[id] = copy.id;
        }
        const ids = Object.keys(mapping);
        if (ids.length > 0) {
          const holds = await tx.eventFloorTable.findMany({
            where: { floorTableId: { in: ids }, event: { eventDate: dayRange(day) } },
            select: { id: true, floorTableId: true },
          });
          for (const hold of holds) {
            await tx.eventFloorTable.update({ where: { id: hold.id }, data: { floorTableId: mapping[hold.floorTableId] } });
          }
        }
      }
      const tables = await tx.floorTable.findMany({ where: { hallId, day }, orderBy: { label: 'asc' }, select: TABLE_SELECT });
      return { tables, mapping };
    });
  }

  /** The labels in ONE layout of an area — the standing one, or one day's. */
  async labelsInArea(hallId: string, day: string | null = null): Promise<{ id: string; label: string }[]> {
    return prisma.floorTable.findMany({ where: { hallId, day }, select: { id: true, label: true } });
  }

  async createTable(data: TableData): Promise<TableRow> {
    return prisma.floorTable.create({ data, select: TABLE_SELECT });
  }

  async updateTable(id: string, data: Partial<TableData>): Promise<TableRow> {
    return prisma.floorTable.update({ where: { id }, data, select: TABLE_SELECT });
  }

  async deleteTable(id: string): Promise<void> {
    await prisma.floorTable.delete({ where: { id } });
  }

  /**
   * Push several tables together into one: the kept row takes the merged size
   * and seat count, the others go.
   *
   * In ONE transaction, and the booking check is INSIDE it — `EventFloorTable`
   * cascades on the table, so deleting one silently releases every booking
   * sitting on it. A table a booking from
   * `protectFrom` onward still holds therefore blocks the merge: nothing is
   * written and its label comes back so the supervisor is told which one and
   * can look it up.
   */
  async mergeTables(
    keepId: string,
    removeIds: string[],
    data: Pick<TableData, 'seats' | 'shape' | 'x' | 'y' | 'rotation' | 'width' | 'height'>,
    protectFrom: Date,
  ): Promise<{ table: TableRow | null; blocked: string[] }> {
    return prisma.$transaction(async (tx) => {
      const held = await tx.eventFloorTable.findMany({
        where: {
          floorTableId: { in: removeIds },
          event: { eventDate: { gte: protectFrom }, status: { not: 'CANCELLED' } },
        },
        select: { floorTable: { select: { label: true } } },
      });
      if (held.length > 0) {
        // Nothing written: the transaction has done only reads so far.
        return { table: null, blocked: [...new Set(held.map((row) => row.floorTable.label))].sort() };
      }
      const table = await tx.floorTable.update({ where: { id: keepId }, data, select: TABLE_SELECT });
      await tx.floorTable.deleteMany({ where: { id: { in: removeIds } } });
      return { table, blocked: [] };
    });
  }
}
