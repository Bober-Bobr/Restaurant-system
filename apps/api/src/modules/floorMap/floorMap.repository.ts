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
  /** When this area's default layout was saved; null = it has none. */
  defaultLayoutAt: Date | null;
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
};

export type AreaPatch = Partial<AreaSize & { name: string; kind: AreaKind; mapFeatures: unknown[] }>;

const AREA_SELECT = {
  id: true, name: true, kind: true, capacity: true, isActive: true,
  restaurantId: true, section: true,
  mapWidth: true, mapHeight: true, mapFeatures: true,
  // The saved default's DATE, never the snapshot itself: the map only needs to
  // know there is one and when it was taken, and a whole venue's layout on
  // every page load is a payload nothing reads.
  defaultLayoutAt: true,
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
} as const;

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

  async listTables(restaurantId: string, section: Section): Promise<TableRow[]> {
    return prisma.floorTable.findMany({
      where: { hall: { restaurantId, section } },
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
        // Only bookings that actually touch the map: the section's other
        // events are none of this query's business.
        OR: [{ wholeHall: true }, { floorTables: { some: {} } }],
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
        OR: [{ wholeHall: true }, { floorTables: { some: {} } }],
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

  /** Every table id in the section, grouped by the area it stands in. */
  async tableIdsByHall(restaurantId: string, section: Section): Promise<Map<string, string[]>> {
    const rows = await prisma.floorTable.findMany({
      where: { hall: { restaurantId, section } },
      select: { id: true, hallId: true },
    });
    const byHall = new Map<string, string[]>();
    for (const row of rows) byHall.set(row.hallId, [...(byHall.get(row.hallId) ?? []), row.id]);
    return byHall;
  }

  async tablesInArea(hallId: string): Promise<TableRow[]> {
    return prisma.floorTable.findMany({ where: { hallId }, orderBy: { label: 'asc' }, select: TABLE_SELECT });
  }

  /** The stored snapshot, unparsed — the service validates it. */
  async readDefaultLayout(id: string): Promise<unknown> {
    const row = await prisma.hall.findUnique({ where: { id }, select: { defaultLayout: true } });
    return row?.defaultLayout ?? null;
  }

  async saveDefaultLayout(id: string, layout: unknown, at: Date): Promise<AreaRow> {
    return prisma.hall.update({
      where: { id },
      data: { defaultLayout: layout as Prisma.InputJsonValue, defaultLayoutAt: at },
      select: AREA_SELECT,
    });
  }

  /**
   * Put the area back the way the layout describes it: its map size, its
   * drawing and its tables, all in ONE transaction.
   *
   * **Tables are reconciled BY LABEL, not deleted and rewritten.** They used
   * to be replaced wholesale, which was harmless until bookings began holding
   * them: `EventFloorTable` cascades on the table, so recreating table 5 with
   * a fresh id silently released every booking sitting on it — including
   * future ones, and including the nightly reset. Matching on the label keeps
   * the row, so the booking keeps its table.
   *
   * A table in the area but NOT in the layout is removed, unless a booking
   * from `protectFrom` onward holds it. Putting the room back must never
   * cancel somebody's evening, so such a table is kept and named in `kept`.
   */
  async restoreLayout(
    hallId: string,
    layout: { mapWidth: number | null; mapHeight: number | null; mapFeatures: unknown[]; tables: (Omit<TableData, 'hallId'> & { label: string })[] },
    protectFrom?: Date,
  ): Promise<{ area: AreaRow; tables: TableRow[]; kept: string[] }> {
    return prisma.$transaction(async (tx) => {
      const existing = await tx.floorTable.findMany({ where: { hallId }, select: { id: true, label: true } });
      // Case-folded, like the label uniqueness rule itself: "vip 1" and
      // "VIP 1" are the same table when read aloud.
      const fold = (label: string) => label.trim().toLowerCase();
      const byLabel = new Map(existing.map((row) => [fold(row.label), row]));

      const wanted = new Set(layout.tables.map((tb) => fold(tb.label)));
      for (const table of layout.tables) {
        const match = byLabel.get(fold(table.label));
        if (match) await tx.floorTable.update({ where: { id: match.id }, data: { ...table, hallId } });
        else await tx.floorTable.create({ data: { ...table, hallId } });
      }

      const extras = existing.filter((row) => !wanted.has(fold(row.label)));
      const kept: string[] = [];
      if (extras.length > 0) {
        // Which of them a booking still needs. Cancelled bookings hold
        // nothing, so they do not protect a table.
        const booked = protectFrom
          ? await tx.eventFloorTable.findMany({
            where: {
              floorTableId: { in: extras.map((x) => x.id) },
              event: { eventDate: { gte: protectFrom }, status: { not: 'CANCELLED' } },
            },
            select: { floorTableId: true },
          })
          : [];
        const protectedIds = new Set(booked.map((x) => x.floorTableId));
        const removable = extras.filter((x) => !protectedIds.has(x.id));
        for (const row of extras) if (protectedIds.has(row.id)) kept.push(row.label);
        if (removable.length > 0) {
          await tx.floorTable.deleteMany({ where: { id: { in: removable.map((x) => x.id) } } });
        }
      }

      const area = await tx.hall.update({
        where: { id: hallId },
        data: {
          mapWidth: layout.mapWidth,
          mapHeight: layout.mapHeight,
          mapFeatures: layout.mapFeatures as Prisma.InputJsonValue,
        },
        select: AREA_SELECT,
      });
      const tables = await tx.floorTable.findMany({ where: { hallId }, orderBy: { label: 'asc' }, select: TABLE_SELECT });
      return { area, tables, kept };
    });
  }

  async labelsInArea(hallId: string): Promise<{ id: string; label: string }[]> {
    return prisma.floorTable.findMany({ where: { hallId }, select: { id: true, label: true } });
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
}
