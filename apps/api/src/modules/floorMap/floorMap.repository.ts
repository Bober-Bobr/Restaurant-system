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
