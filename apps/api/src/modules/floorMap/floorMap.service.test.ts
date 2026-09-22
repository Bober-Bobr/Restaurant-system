import { beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { FloorMapService } from './floorMap.service.js';
import type { AreaRow, FloorMapRepository, TableData, TableRow } from './floorMap.repository.js';
import { createTableSchema, updateAreaSchema, updateTableSchema } from './floorMap.schema.js';
import { layoutSchema } from './floorMap.layout.js';

type Repo = Pick<FloorMapRepository, keyof FloorMapRepository>;

/** An in-memory repository with the same scoping the Prisma one applies. */
function fakeRepo() {
  const areas: AreaRow[] = [];
  const tables: TableRow[] = [];
  /** `Hall.defaultLayout`, kept out of AreaRow exactly as the column is. */
  const defaults = new Map<string, unknown>();
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
      const row: AreaRow = { id: `a${++seq}`, isActive: true, restaurantId, section, mapFeatures: [], defaultLayoutAt: null, ...data };
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
    async tablesInArea(hallId) { return tables.filter((t) => t.hallId === hallId); },
    async readDefaultLayout(id) { return defaults.get(id) ?? null; },
    async saveDefaultLayout(id, layout, at) {
      defaults.set(id, JSON.parse(JSON.stringify(layout)));
      const row = areas.find((a) => a.id === id)!;
      row.defaultLayoutAt = at;
      return row;
    },
    async restoreLayout(hallId, layout) {
      // Like the transaction: the area's tables are replaced, not merged.
      for (let i = tables.length - 1; i >= 0; i -= 1) if (tables[i].hallId === hallId) tables.splice(i, 1);
      for (const t of layout.tables) tables.push({ id: `t${++seq}`, hallId, width: null, height: null, ...t });
      const area = areas.find((a) => a.id === hallId)!;
      Object.assign(area, { mapWidth: layout.mapWidth, mapHeight: layout.mapHeight, mapFeatures: layout.mapFeatures });
      return { area, tables: tables.filter((t) => t.hallId === hallId) };
    },
    async labelsInArea(hallId) { return tables.filter((t) => t.hallId === hallId).map(({ id, label }) => ({ id, label })); },
    async createTable(data: TableData) {
      const row: TableRow = { id: `t${++seq}`, width: null, height: null, ...data };
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
  return { repo, areas, tables, defaults };
}

async function statusOf(run: () => Promise<unknown>): Promise<number> {
  try {
    await run();
  } catch (error) {
    return (error as { status?: number }).status ?? 0;
  }
  throw new Error('expected the call to be refused, but it succeeded');
}

const LAYOUT = { mapWidth: 600, mapHeight: 400 };
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
    expect(await statusOf(() => service.updateArea('r1', 'SMALL_BANQUET', banquet.id, { mapWidth: 900 }))).toBe(404);
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

describe('an area\'s saved default layout', () => {
  /** The room as it is meant to stand: three tables, one of them resized. */
  const arrange = async (hallId: string) => {
    await service.createTable('r1', 'SMALL_BANQUET', { ...TABLE, hallId, label: '1', x: 100, y: 100 });
    await service.createTable('r1', 'SMALL_BANQUET', { ...TABLE, hallId, label: '2', x: 300, y: 100, seats: 4 });
    await service.createTable('r1', 'SMALL_BANQUET', {
      ...TABLE, hallId, label: '3', x: 300, y: 250, shape: 'ROUND', rotation: 0, width: 140, height: 140,
    });
  };

  it('remembers the tables, the map size and the drawing, and says when', async () => {
    await arrange(mine.id);
    await service.updateArea('r1', 'SMALL_BANQUET', mine.id, {
      mapWidth: 900, mapHeight: 700,
      mapFeatures: [{ kind: 'stage', shape: 'rect', x: 0, y: 0, width: 200, height: 100, label: 'Сцена' }],
    });

    const saved = await service.saveDefaultLayout('r1', 'SMALL_BANQUET', mine.id);
    expect(saved.defaultLayoutAt).toBeInstanceOf(Date);

    const layout = layoutSchema.parse(store.defaults.get(mine.id));
    expect(layout.tables.map((t) => t.label).sort()).toEqual(['1', '2', '3']);
    expect(layout.tables.find((t) => t.label === '3')).toMatchObject({ shape: 'ROUND', width: 140, height: 140 });
    expect(layout).toMatchObject({ version: 1, mapWidth: 900, mapHeight: 700 });
    expect(layout.mapFeatures).toHaveLength(1);
    // No table ids: a restore makes fresh rows, because an id in the snapshot
    // may by then belong to a table moved into ANOTHER area. Read from what
    // was STORED, not from the parsed copy — zod strips unknown keys, so a
    // snapshot full of ids would come back through the schema looking clean.
    expect(JSON.stringify(store.defaults.get(mine.id))).not.toContain('"id"');
  });

  it('puts the room back: tables moved, resized, added and deleted all return', async () => {
    await arrange(mine.id);
    await service.saveDefaultLayout('r1', 'SMALL_BANQUET', mine.id);

    // An evening: table 2 shoved across the room and given two more seats,
    // table 3 deleted, a table 9 dragged in from somewhere.
    const two = store.tables.find((t) => t.label === '2')!;
    const three = store.tables.find((t) => t.label === '3')!;
    await service.updateTable('r1', 'SMALL_BANQUET', two.id, { x: 500, y: 380, seats: 6 });
    await service.deleteTable('r1', 'SMALL_BANQUET', three.id);
    await service.createTable('r1', 'SMALL_BANQUET', { ...TABLE, hallId: mine.id, label: '9', x: 420, y: 60 });

    const { tables } = await service.restoreDefaultLayout('r1', 'SMALL_BANQUET', mine.id);
    expect(tables.map((t) => t.label).sort()).toEqual(['1', '2', '3']);
    expect(tables.find((t) => t.label === '2')).toMatchObject({ x: 300, y: 100, seats: 4 });
    expect(tables.find((t) => t.label === '3')).toMatchObject({ shape: 'ROUND', width: 140, height: 140 });
    // The table added during the evening is gone — that is what reverting means.
    expect(store.tables.some((t) => t.label === '9')).toBe(false);
  });

  it('restores the map size and the drawing too — they are part of how the room stands', async () => {
    await service.updateArea('r1', 'SMALL_BANQUET', mine.id, {
      mapWidth: 900, mapHeight: 700,
      mapFeatures: [{ kind: 'water', shape: 'ellipse', x: 100, y: 100, width: 200, height: 120 }],
    });
    await service.saveDefaultLayout('r1', 'SMALL_BANQUET', mine.id);
    await service.updateArea('r1', 'SMALL_BANQUET', mine.id, { mapWidth: 1400, mapHeight: 1200, mapFeatures: [] });

    const { area } = await service.restoreDefaultLayout('r1', 'SMALL_BANQUET', mine.id);
    expect(area).toMatchObject({ mapWidth: 900, mapHeight: 700 });
    expect(area.mapFeatures).toHaveLength(1);
  });

  it('an area with no default saved refuses to revert — it does not empty the room', async () => {
    await arrange(mine.id);
    expect(await statusOf(() => service.restoreDefaultLayout('r1', 'SMALL_BANQUET', mine.id))).toBe(409);
    expect(store.tables).toHaveLength(3);
  });

  it('a stored layout that is not a usable one is refused, never applied', async () => {
    await arrange(mine.id);
    await service.saveDefaultLayout('r1', 'SMALL_BANQUET', mine.id);
    // Somebody reached the JSON column with psql. A broken snapshot must read
    // as "no usable default", not as a map wiped by a restore.
    store.defaults.set(mine.id, { version: 1, tables: [{ label: '1', seats: 'lots' }] });
    expect(await statusOf(() => service.restoreDefaultLayout('r1', 'SMALL_BANQUET', mine.id))).toBe(409);
    expect(store.tables).toHaveLength(3);
  });

  it('saving again replaces the default — there is one per area', async () => {
    await service.createTable('r1', 'SMALL_BANQUET', { ...TABLE, hallId: mine.id, label: '1' });
    await service.saveDefaultLayout('r1', 'SMALL_BANQUET', mine.id);
    await service.createTable('r1', 'SMALL_BANQUET', { ...TABLE, hallId: mine.id, label: '2', x: 300 });
    await service.saveDefaultLayout('r1', 'SMALL_BANQUET', mine.id);

    await service.deleteTable('r1', 'SMALL_BANQUET', store.tables.find((t) => t.label === '2')!.id);
    const { tables } = await service.restoreDefaultLayout('r1', 'SMALL_BANQUET', mine.id);
    expect(tables.map((t) => t.label).sort()).toEqual(['1', '2']);
  });

  it('one area\'s default says nothing about another\'s, and a restore touches only its own room', async () => {
    const terrace = await service.createArea('r1', 'SMALL_BANQUET', { name: 'Terrace', kind: 'OUTDOOR', capacity: 40, ...LAYOUT });
    await service.createTable('r1', 'SMALL_BANQUET', { ...TABLE, hallId: mine.id, label: '1' });
    await service.createTable('r1', 'SMALL_BANQUET', { ...TABLE, hallId: terrace.id, label: 'T1' });
    await service.saveDefaultLayout('r1', 'SMALL_BANQUET', mine.id);

    expect(store.defaults.has(terrace.id)).toBe(false);
    expect(await statusOf(() => service.restoreDefaultLayout('r1', 'SMALL_BANQUET', terrace.id))).toBe(409);

    await service.updateTable('r1', 'SMALL_BANQUET', store.tables.find((t) => t.label === 'T1')!.id, { x: 500 });
    await service.restoreDefaultLayout('r1', 'SMALL_BANQUET', mine.id);
    // The terrace's own table was neither moved back nor deleted.
    expect(store.tables.find((t) => t.hallId === terrace.id)).toMatchObject({ label: 'T1', x: 500 });
  });

  it('is scoped like every other id: the other section\'s area and another restaurant\'s are 404', async () => {
    for (const id of [banquet.id, foreign.id]) {
      expect(await statusOf(() => service.saveDefaultLayout('r1', 'SMALL_BANQUET', id))).toBe(404);
      expect(await statusOf(() => service.restoreDefaultLayout('r1', 'SMALL_BANQUET', id))).toBe(404);
    }
    expect(store.defaults.size).toBe(0);
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

  it('a table size is a number when resized and null when sized from its seats', () => {
    expect(updateTableSchema.parse({ width: 120, height: 80 })).toEqual({ width: 120, height: 80 });
    expect(updateTableSchema.parse({ width: null, height: null })).toEqual({ width: null, height: null });
    expect(updateTableSchema.safeParse({ width: 5 }).success).toBe(false);
    expect(updateTableSchema.safeParse({ width: 5000 }).success).toBe(false);
  });

  it('the drawing is validated shape by shape', () => {
    const ok = [
      { kind: 'zone', shape: 'rect', x: 0, y: 0, width: 100, height: 50, label: 'Терраса', color: '#9c9a4f' },
      { kind: 'water', shape: 'ellipse', x: 10, y: 10, width: 40, height: 40 },
      { kind: 'path', shape: 'polygon', points: [[0, 0], [10, 0], [10, 10]] },
      { kind: 'label', shape: 'point', x: 5, y: 5, label: 'Центр сцена' },
    ];
    expect(updateAreaSchema.safeParse({ mapFeatures: ok }).success).toBe(true);
    for (const bad of [
      { kind: 'zone', shape: 'rect', x: 0, y: 0, width: 100, height: 50, color: 'red; fill: url(x)' },
      { kind: 'lava', shape: 'rect', x: 0, y: 0, width: 1, height: 1 },
      { kind: 'path', shape: 'polygon', points: [[0, 0], [1, 1]] },
      { kind: 'zone', shape: 'circle', x: 0, y: 0 },
    ]) {
      expect(updateAreaSchema.safeParse({ mapFeatures: [bad] }).success, JSON.stringify(bad)).toBe(false);
    }
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

  it('a restore replaces the area\'s tables in ONE transaction, and the snapshot never leaves the server', () => {
    const repo = read('src/modules/floorMap/floorMap.repository.ts');
    const restore = repo.slice(repo.indexOf('async restoreLayout('), repo.indexOf('async labelsInArea('));
    // Half a layout is not a layout: the delete, the writes and the area's own
    // size and drawing either all land or none do.
    expect(restore).toContain('prisma.$transaction');
    expect(restore).toMatch(/tx\.floorTable\.deleteMany\(\{\s*where:\s*\{\s*hallId\s*\}/);
    expect(restore).toContain('tx.floorTable.createMany');
    // The map is told a default exists and when — never handed the layout.
    const select = repo.slice(repo.indexOf('const AREA_SELECT'), repo.indexOf('const TABLE_SELECT'));
    expect(select).toContain('defaultLayoutAt: true');
    expect(select).not.toContain('defaultLayout: true');
  });

  it('the migration adds both columns nullable, so nothing has a default until one is saved', () => {
    const sql = fs.readFileSync(
      path.join(API_ROOT, 'prisma/migrations/20260922100000_floor_map_default_layout/migration.sql'), 'utf8',
    );
    expect(sql).toContain('ADD COLUMN "defaultLayout" JSONB;');
    expect(sql).toContain('ADD COLUMN "defaultLayoutAt" TIMESTAMP(3);');
    expect(sql).not.toMatch(/defaultLayout[^;]*NOT NULL/);
    const schema = read('prisma/schema.prisma');
    const hall = schema.slice(schema.indexOf('model Hall {'), schema.indexOf('model FloorTable {'));
    expect(hall).toMatch(/defaultLayout\s+Json\?/);
    expect(hall).toMatch(/defaultLayoutAt\s+DateTime\?/);
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
    // One map per area: the shared-canvas position goes, the drawing and the
    // table sizes arrive — nullable, so every existing table keeps its look.
    const perArea = fs.readFileSync(path.join(API_ROOT, 'prisma/migrations/20260919100000_floor_map_per_area/migration.sql'), 'utf8');
    expect(perArea).toContain('DROP COLUMN "mapX"');
    expect(perArea).toContain(`ADD COLUMN "mapFeatures" JSONB NOT NULL DEFAULT '[]'`);
    expect(perArea).toMatch(/ADD COLUMN "width" INTEGER;/);
    expect(model).toMatch(/width\s+Int\?/);
    expect(schema).not.toMatch(/^\s*mapX\s/m);
  });
});
