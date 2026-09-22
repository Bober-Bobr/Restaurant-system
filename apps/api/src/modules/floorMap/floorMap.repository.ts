import type { Prisma } from '@prisma/client';
import { prisma } from '../../db/prisma.js';
import type { Section } from '../../utils/section.js';

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
   * drawing and its tables, all in ONE transaction. The area's tables are
   * REPLACED — deleted and written again — because a restore is "the room
   * stands like this", not "these tables also exist".
   */
  async restoreLayout(
    hallId: string,
    layout: { mapWidth: number | null; mapHeight: number | null; mapFeatures: unknown[]; tables: Omit<TableData, 'hallId'>[] },
  ): Promise<{ area: AreaRow; tables: TableRow[] }> {
    return prisma.$transaction(async (tx) => {
      await tx.floorTable.deleteMany({ where: { hallId } });
      if (layout.tables.length > 0) {
        await tx.floorTable.createMany({ data: layout.tables.map((t) => ({ ...t, hallId })) });
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
      return { area, tables };
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
