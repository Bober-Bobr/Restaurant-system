import { beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { FloorMapService } from './floorMap.service.js';
import type { AreaRow, FloorMapRepository, TableData, TableRow } from './floorMap.repository.js';
import { createTableSchema, updateTableSchema } from './floorMap.schema.js';

type Repo = Pick<FloorMapRepository, keyof FloorMapRepository>;

/** An in-memory repository with the same scoping the Prisma one applies. */
function fakeRepo() {
  const areas: AreaRow[] = [];
  const tables: TableRow[] = [];
  let seq = 0;
  const repo: Repo = {
    async listAreas(restaurantId, section) {
      return areas.filter((a) => a.restaurantId === restaurantId && a.section === section);
    },
    async listTables(restaurantId, section) {
      const ids = new Set(areas.filter((a) => a.restaurantId === restaurantId && a.section === section).map((a) => a.id));
      return tables.filter((t) => ids.has(t.hallId));
    },
    async getArea(id) { return areas.find((a) => a.id === id) ?? null; },
    async areaNameTaken(restaurantId, section, name, exceptId) {
      return areas.some((a) => a.restaurantId === restaurantId && a.section === section && a.name === name && a.id !== exceptId);
    },
    async createArea(restaurantId, section, data) {
      const row: AreaRow = { id: `a${++seq}`, isActive: true, restaurantId, section, ...data };
      areas.push(row);
      return row;
    },
    async updateArea(id, data) {
      const row = areas.find((a) => a.id === id)!;
      Object.assign(row, data);
      return row;
    },
    async getTable(id) {
      const row = tables.find((t) => t.id === id);
      if (!row) return null;
      const hall = areas.find((a) => a.id === row.hallId)!;
      return { ...row, hall: { restaurantId: hall.restaurantId, section: hall.section } };
    },
    async labelsInArea(hallId) { return tables.filter((t) => t.hallId === hallId).map(({ id, label }) => ({ id, label })); },
    async createTable(data: TableData) {
      const row: TableRow = { id: `t${++seq}`, ...data };
      tables.push(row);
      return row;
    },
    async updateTable(id, data) {
      const row = tables.find((t) => t.id === id)!;
      Object.assign(row, data);
      return row;
    },
    async deleteTable(id) { tables.splice(tables.findIndex((t) => t.id === id), 1); },
  };
  return { repo, areas, tables };
}

async function statusOf(run: () => Promise<unknown>): Promise<number> {
  try {
    await run();
  } catch (error) {
    return (error as { status?: number }).status ?? 0;
  }
  throw new Error('expected the call to be refused, but it succeeded');
}

const LAYOUT = { mapX: 0, mapY: 0, mapWidth: 600, mapHeight: 400 };
const TABLE = { label: '1', seats: 6, shape: 'RECT' as const, x: 100, y: 100, rotation: 0 };

let store: ReturnType<typeof fakeRepo>;
let service: FloorMapService;
/** R1's Small Banquets hall, R1's banquet hall, and R2's Small Banquets hall. */
let mine: AreaRow; let banquet: AreaRow; let foreign: AreaRow;

beforeEach(async () => {
  store = fakeRepo();
  service = new FloorMapService(store.repo);
  mine = await service.createArea('r1', 'SMALL_BANQUET', { name: 'Main', kind: 'HALL', capacity: 80, ...LAYOUT });
  banquet = await service.createArea('r1', 'BANQUET', { name: 'Grand', kind: 'HALL', capacity: 300, ...LAYOUT });
  foreign = await service.createArea('r2', 'SMALL_BANQUET', { name: 'Main', kind: 'HALL', capacity: 80, ...LAYOUT });
});

describe('the map is one section of one restaurant', () => {
  it('lists only its own areas and the tables standing in them', async () => {
    await service.createTable('r1', 'SMALL_BANQUET', { ...TABLE, hallId: mine.id });
    await store.repo.createTable({ ...TABLE, hallId: banquet.id });
    await store.repo.createTable({ ...TABLE, hallId: foreign.id });

    const map = await service.getMap('r1', 'SMALL_BANQUET');
    expect(map.areas.map((a) => a.id)).toEqual([mine.id]);
    expect(map.tables.map((t) => t.hallId)).toEqual([mine.id]);
  });

  it('an outdoor area is an area like any other, stamped with the section', async () => {
    const terrace = await service.createArea('r1', 'SMALL_BANQUET', { name: 'Terrace', kind: 'OUTDOOR', capacity: 40, ...LAYOUT });
    expect(terrace).toMatchObject({ kind: 'OUTDOOR', section: 'SMALL_BANQUET', restaurantId: 'r1' });
    expect((await service.getMap('r1', 'SMALL_BANQUET')).areas).toHaveLength(2);
  });

  it('refuses a second area with a name the section already uses', async () => {
    expect(await statusOf(() => service.createArea('r1', 'SMALL_BANQUET', { name: 'Main', kind: 'OUTDOOR', capacity: 5, ...LAYOUT }))).toBe(409);
    // …which the other section and the other restaurant are free to use.
    await service.createArea('r1', 'BANQUET', { name: 'Main', kind: 'HALL', capacity: 5, ...LAYOUT });
  });
});

describe('an id is re-checked against BOTH scopes, and refused with 404', () => {
  // 404 rather than 403: "not yours" and "not there" must look identical.

  it('a table cannot be created in the other section\'s hall, or another restaurant\'s', async () => {
    expect(await statusOf(() => service.createTable('r1', 'SMALL_BANQUET', { ...TABLE, hallId: banquet.id }))).toBe(404);
    expect(await statusOf(() => service.createTable('r1', 'SMALL_BANQUET', { ...TABLE, hallId: foreign.id }))).toBe(404);
    expect(store.tables).toHaveLength(0);
  });

  it('an area outside the scope cannot be moved or renamed', async () => {
    expect(await statusOf(() => service.updateArea('r1', 'SMALL_BANQUET', banquet.id, { mapX: 50 }))).toBe(404);
    expect(await statusOf(() => service.updateArea('r1', 'SMALL_BANQUET', foreign.id, { name: 'Mine now' }))).toBe(404);
    expect(foreign.name).toBe('Main');
  });

  it('a table outside the scope cannot be edited or deleted', async () => {
    const theirs = await store.repo.createTable({ ...TABLE, hallId: foreign.id });
    const banquets = await store.repo.createTable({ ...TABLE, hallId: banquet.id });
    for (const id of [theirs.id, banquets.id]) {
      expect(await statusOf(() => service.updateTable('r1', 'SMALL_BANQUET', id, { seats: 2 }))).toBe(404);
      expect(await statusOf(() => service.deleteTable('r1', 'SMALL_BANQUET', id))).toBe(404);
    }
    expect(store.tables).toHaveLength(2);
    expect(theirs.seats).toBe(6);
  });

  it('a table of mine cannot be MOVED into a room outside the scope', async () => {
    // The move names a second id, and a check on the first alone would let a
    // table walk into another restaurant's hall.
    const table = await service.createTable('r1', 'SMALL_BANQUET', { ...TABLE, hallId: mine.id });
    expect(await statusOf(() => service.updateTable('r1', 'SMALL_BANQUET', table.id, { hallId: foreign.id }))).toBe(404);
    expect(await statusOf(() => service.updateTable('r1', 'SMALL_BANQUET', table.id, { hallId: banquet.id }))).toBe(404);
    expect(table.hallId).toBe(mine.id);
  });
});

describe('a table number is unique within its area', () => {
  it('refuses a duplicate, ignoring case', async () => {
    await service.createTable('r1', 'SMALL_BANQUET', { ...TABLE, label: 'VIP 1', hallId: mine.id });
    expect(await statusOf(() => service.createTable('r1', 'SMALL_BANQUET', { ...TABLE, label: 'vip 1', hallId: mine.id }))).toBe(409);
  });

  it('but another area may have its own table 1', async () => {
    const terrace = await service.createArea('r1', 'SMALL_BANQUET', { name: 'Terrace', kind: 'OUTDOOR', capacity: 40, ...LAYOUT });
    await service.createTable('r1', 'SMALL_BANQUET', { ...TABLE, hallId: mine.id });
    await service.createTable('r1', 'SMALL_BANQUET', { ...TABLE, hallId: terrace.id });
    expect(store.tables).toHaveLength(2);
  });

  it('a table keeps its own number when only its seats change', async () => {
    const table = await service.createTable('r1', 'SMALL_BANQUET', { ...TABLE, hallId: mine.id });
    await service.updateTable('r1', 'SMALL_BANQUET', table.id, { seats: 8, label: '1' });
    expect(table.seats).toBe(8);
  });

  it('and moving into an area where the number is taken is refused', async () => {
    const terrace = await service.createArea('r1', 'SMALL_BANQUET', { name: 'Terrace', kind: 'OUTDOOR', capacity: 40, ...LAYOUT });
    const inHall = await service.createTable('r1', 'SMALL_BANQUET', { ...TABLE, hallId: mine.id });
    await service.createTable('r1', 'SMALL_BANQUET', { ...TABLE, hallId: terrace.id });
    expect(await statusOf(() => service.updateTable('r1', 'SMALL_BANQUET', inHall.id, { hallId: terrace.id }))).toBe(409);
  });
});

describe('the request schema', () => {
  it('bounds the seat count and the coordinates', () => {
    const base = { ...TABLE, hallId: 'ckv0000000000000000000000' };
    expect(createTableSchema.safeParse(base).success).toBe(true);
    expect(createTableSchema.safeParse({ ...base, seats: 0 }).success).toBe(false);
    expect(createTableSchema.safeParse({ ...base, seats: 41 }).success).toBe(false);
    expect(createTableSchema.safeParse({ ...base, x: -1 }).success).toBe(false);
    expect(createTableSchema.safeParse({ ...base, shape: 'HEXAGON' }).success).toBe(false);
  });

  it('an update that omits rotation leaves it alone rather than resetting it to 0', () => {
    expect(updateTableSchema.parse({ seats: 4 })).not.toHaveProperty('rotation');
  });
});

describe('the wiring', () => {
  const API_ROOT = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '..', '..', '..');
  const read = (rel: string) => fs.readFileSync(path.join(API_ROOT, rel), 'utf8')
    .replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, '');

  it('every table query reaches its scope through the hall', () => {
    // A table carries no restaurant and no section of its own; a list of
    // tables filtered by anything less than the hall's scope is a hole.
    const src = read('src/modules/floorMap/floorMap.repository.ts');
    const at = src.indexOf('async listTables(');
    expect(at).toBeGreaterThan(-1);
    expect(src.slice(at, at + 300)).toMatch(/where:\s*\{\s*hall:\s*\{\s*restaurantId,\s*section\s*\}/);
    const areas = src.slice(src.indexOf('async listAreas('), src.indexOf('async listTables('));
    expect(areas).toMatch(/where:\s*\{\s*restaurantId,\s*section\s*\}/);
  });

  it('is mounted behind the restaurant scope and a role guard that excludes the kitchens and banquet staff', () => {
    const app = read('src/app.ts');
    const line = app.slice(app.indexOf("'/floor-map'"), app.indexOf('floorMapRouter);') + 1);
    expect(line, 'the floor map is not mounted').not.toBe('');
    expect(line).toContain('requireRestaurant');
    expect(line).toContain('AdminRole.SUPERVISOR');
    for (const role of ['KITCHEN', 'SMALL_KITCHEN', 'EMPLOYEE', 'ADMIN,', 'ADMIN)']) {
      expect(line, `the map is open to ${role}`).not.toContain(`AdminRole.${role}`);
    }
  });

  it('the schema cascades a hall\'s tables and keeps numbers unique per hall', () => {
    const schema = read('prisma/schema.prisma');
    const model = schema.slice(schema.indexOf('model FloorTable {'), schema.indexOf('model MenuItem {'));
    expect(model).toContain('onDelete: Cascade');
    expect(model).toContain('@@unique([hallId, label])');
    // No second copy of the scope on the table itself.
    expect(model).not.toMatch(/^\s*(restaurantId|section)\s/m);
    const migration = fs.readFileSync(path.join(API_ROOT, 'prisma/migrations/20260917100000_floor_map/migration.sql'), 'utf8');
    expect(migration).toContain('CREATE TABLE "FloorTable"');
    expect(migration).toContain('ON DELETE CASCADE');
    expect(migration).toContain(`ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'HALL'`);
  });
});
