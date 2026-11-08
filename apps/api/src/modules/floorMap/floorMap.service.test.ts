import { beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { FloorMapService } from './floorMap.service.js';
import type { AreaRow, FloorMapRepository, TableData, TableRow } from './floorMap.repository.js';
import { createTableSchema, mergeTablesSchema, updateAreaSchema, updateTableSchema } from './floorMap.schema.js';

type Repo = Pick<FloorMapRepository, keyof FloorMapRepository>;

/** An in-memory repository with the same scoping the Prisma one applies. */
function fakeRepo() {
  const areas: AreaRow[] = [];
  const tables: TableRow[] = [];
  /** `FloorAreaDay` rows, as `${hallId}|${day}`. */
  const ownDays = new Set<string>();
  /** Table ids a booking from today onward holds — what `protectFrom` guards. */
  const bookedTables = new Set<string>();
  /** A booking's held table and the day it is on — what a fork must move. */
  const holds: { eventDay: string; floorTableId: string }[] = [];
  let seq = 0;
  const inScope = (restaurantId: string | null, section: string) =>
    new Set(areas.filter((a) => a.restaurantId === restaurantId && a.section === section).map((a) => a.id));
  /** The same rule as the repository's `effectiveWhere`. */
  const effective = (t: TableRow, day?: string | null) =>
    (!day ? t.day === null : ownDays.has(`${t.hallId}|${day}`) ? t.day === day : t.day === null);
  const repo: Repo = {
    async listAreas(restaurantId, section) {
      return areas.filter((a) => a.restaurantId === restaurantId && a.section === section);
    },
    async dayLayoutHalls(restaurantId, section, day) {
      const ids = inScope(restaurantId, section);
      return [...ownDays].map((k) => k.split('|')).filter(([h, d]) => d === day && ids.has(h)).map(([h]) => h);
    },
    async listTables(restaurantId, section, day) {
      const ids = inScope(restaurantId, section);
      return tables.filter((t) => ids.has(t.hallId) && effective(t, day));
    },
    async getArea(id) { return areas.find((a) => a.id === id) ?? null; },
    async areaNameTaken(restaurantId, section, name, exceptId) {
      return areas.some((a) => a.restaurantId === restaurantId && a.section === section && a.name === name && a.id !== exceptId);
    },
    async createArea(restaurantId, section, data) {
      const row: AreaRow = { id: `a${++seq}`, isActive: true, restaurantId, section, mapFeatures: [], ...data };
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
    async bookingsOnDay() { return []; },
    async bookingsBetween() { return []; },
    async restaurantName() { return null; },
    async tableIdsByHall(restaurantId, section, day) {
      const byHall = new Map<string, string[]>();
      for (const t of await repo.listTables(restaurantId, section, day)) {
        byHall.set(t.hallId, [...(byHall.get(t.hallId) ?? []), t.id]);
      }
      return byHall;
    },
    async tablesInArea(hallId, day) { return tables.filter((t) => t.hallId === hallId && effective(t, day)); },
    async hasDayLayout(hallId, day) { return ownDays.has(`${hallId}|${day}`); },
    async forkDay(hallId, day) {
      const mapping: Record<string, string> = {};
      if (!ownDays.has(`${hallId}|${day}`)) {
        ownDays.add(`${hallId}|${day}`);
        for (const t of tables.filter((x) => x.hallId === hallId && x.day === null)) {
          const copy = { ...t, id: `t${++seq}`, day };
          tables.push(copy);
          mapping[t.id] = copy.id;
        }
        for (const h of holds) if (h.eventDay === day && mapping[h.floorTableId]) h.floorTableId = mapping[h.floorTableId];
      }
      return { tables: tables.filter((t) => t.hallId === hallId && t.day === day), mapping };
    },
    async labelsInArea(hallId, day = null) {
      return tables.filter((t) => t.hallId === hallId && t.day === day).map(({ id, label }) => ({ id, label }));
    },
    async createTable(data: TableData) {
      const row: TableRow = { id: `t${++seq}`, width: null, height: null, ...data, day: data.day ?? null };
      tables.push(row);
      return row;
    },
    async updateTable(id, data) {
      const row = tables.find((t) => t.id === id)!;
      Object.assign(row, data);
      return row;
    },
    async deleteTable(id) { tables.splice(tables.findIndex((t) => t.id === id), 1); },
    async mergeTables(keepId, removeIds, data, protectFrom) {
      // The booking check the real one does inside its transaction: a table a
      // booking still holds blocks the merge, and NOTHING is written.
      const held = removeIds.filter((id) => protectFrom && bookedTables.has(id));
      if (held.length > 0) {
        return { table: null, blocked: held.map((id) => tables.find((t) => t.id === id)!.label).sort() };
      }
      const row = tables.find((t) => t.id === keepId)!;
      Object.assign(row, data);
      for (const id of removeIds) tables.splice(tables.findIndex((t) => t.id === id), 1);
      return { table: row, blocked: [] };
    },
  };
  return { repo, areas, tables, ownDays, bookedTables, holds };
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

describe('a booking\'s rearrangement belongs to its DAY', () => {
  const D = '2026-11-20';
  const OTHER = '2026-11-21';
  let one: TableRow; let two: TableRow;
  beforeEach(async () => {
    one = await service.createTable('r1', 'SMALL_BANQUET', { hallId: mine.id, ...TABLE, label: '1' });
    two = await service.createTable('r1', 'SMALL_BANQUET', { hallId: mine.id, ...TABLE, label: '2', x: 300 });
  });

  it('with no day the map is the STANDING layout — the default every day shows', async () => {
    const map = await service.getMap('r1', 'SMALL_BANQUET');
    expect(map.tables.map((t) => t.id).sort()).toEqual([one.id, two.id].sort());
    expect(map.dayLayouts).toEqual([]);
  });

  it('the first change copies the area\'s tables for that day, and maps old ids to new', async () => {
    const { tables, mapping } = await service.forkDay('r1', 'SMALL_BANQUET', mine.id, D);
    expect(tables).toHaveLength(2);
    expect(tables.every((t) => t.day === D)).toBe(true);
    expect(Object.keys(mapping).sort()).toEqual([one.id, two.id].sort());
    expect(Object.values(mapping)).not.toContain(one.id);
  });

  it('a change on that day is seen on that day only — every other day keeps the default', async () => {
    const { mapping } = await service.forkDay('r1', 'SMALL_BANQUET', mine.id, D);
    await service.updateTable('r1', 'SMALL_BANQUET', mapping[one.id], { x: 900, seats: 10 });
    await service.deleteTable('r1', 'SMALL_BANQUET', mapping[two.id]);

    const onDay = await service.getMap('r1', 'SMALL_BANQUET', D);
    expect(onDay.dayLayouts).toEqual([mine.id]);
    expect(onDay.tables.map((t) => [t.label, t.x, t.seats])).toEqual([['1', 900, 10]]);

    const otherDay = await service.getMap('r1', 'SMALL_BANQUET', OTHER);
    expect(otherDay.dayLayouts).toEqual([]);
    expect(otherDay.tables.map((t) => [t.label, t.x, t.seats]).sort()).toEqual([['1', 100, 6], ['2', 300, 6]]);
    // And the standing layout itself is untouched.
    expect((await service.getMap('r1', 'SMALL_BANQUET')).tables).toHaveLength(2);
  });

  it('a table ADDED on that day joins that day\'s layout, not the default', async () => {
    await service.createTable('r1', 'SMALL_BANQUET', { hallId: mine.id, ...TABLE, label: '3', day: D });
    expect((await service.getMap('r1', 'SMALL_BANQUET', D)).tables.map((t) => t.label).sort()).toEqual(['1', '2', '3']);
    expect((await service.getMap('r1', 'SMALL_BANQUET', OTHER)).tables.map((t) => t.label).sort()).toEqual(['1', '2']);
    expect((await service.getMap('r1', 'SMALL_BANQUET')).tables.map((t) => t.label).sort()).toEqual(['1', '2']);
  });

  it('a table number is unique within ONE layout — the day\'s copy of table 1 does not clash with the default\'s', async () => {
    await service.forkDay('r1', 'SMALL_BANQUET', mine.id, D);
    // Table 3 on the day, then table 3 in the standing layout: two layouts.
    await service.createTable('r1', 'SMALL_BANQUET', { hallId: mine.id, ...TABLE, label: '3', day: D });
    await service.createTable('r1', 'SMALL_BANQUET', { hallId: mine.id, ...TABLE, label: '3' });
    // But a second table 1 on the day is still refused.
    expect(await statusOf(() => service.createTable('r1', 'SMALL_BANQUET', { hallId: mine.id, ...TABLE, label: '1', day: D }))).toBe(409);
  });

  it('the bookings already on that day move onto the copies; other days\' stay put', async () => {
    store.holds.push({ eventDay: D, floorTableId: one.id }, { eventDay: OTHER, floorTableId: one.id });
    const { mapping } = await service.forkDay('r1', 'SMALL_BANQUET', mine.id, D);
    expect(store.holds).toEqual([
      { eventDay: D, floorTableId: mapping[one.id] },
      { eventDay: OTHER, floorTableId: one.id },
    ]);
  });

  it('asking again for the same day copies nothing twice', async () => {
    await service.forkDay('r1', 'SMALL_BANQUET', mine.id, D);
    const again = await service.forkDay('r1', 'SMALL_BANQUET', mine.id, D);
    expect(again.mapping).toEqual({});
    expect(store.tables.filter((t) => t.day === D)).toHaveLength(2);
  });

  it('a day\'s table cannot walk into another area, and is merged only with its own day\'s', async () => {
    const terrace = await service.createArea('r1', 'SMALL_BANQUET', { name: 'Terrace', kind: 'OUTDOOR', capacity: 40, ...LAYOUT });
    const { mapping } = await service.forkDay('r1', 'SMALL_BANQUET', mine.id, D);
    expect(await statusOf(() => service.updateTable('r1', 'SMALL_BANQUET', mapping[one.id], { hallId: terrace.id }))).toBe(400);
    const mixed = { tableIds: [mapping[one.id], two.id], seats: 12, x: 200, y: 100, width: 300, height: 60, rotation: 0 };
    expect(await statusOf(() => service.mergeTables('r1', 'SMALL_BANQUET', mixed))).toBe(400);
  });

  it('is scoped like every other id: another section\'s or restaurant\'s area is 404', async () => {
    expect(await statusOf(() => service.forkDay('r1', 'SMALL_BANQUET', banquet.id, D))).toBe(404);
    expect(await statusOf(() => service.forkDay('r1', 'SMALL_BANQUET', foreign.id, D))).toBe(404);
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

  it('the default layout and its nightly reset are gone — the standing tables ARE the default', () => {
    const repo = read('src/modules/floorMap/floorMap.repository.ts');
    for (const gone of ['restoreLayout', 'saveDefaultLayout', 'readDefaultLayout', 'defaultLayoutAt']) {
      expect(repo, gone).not.toContain(gone);
    }
    expect(read('src/server.ts')).not.toContain('startFloorLayoutResetSweep');
    expect(fs.existsSync(path.join(API_ROOT, 'src/modules/floorMap/floorMap.dailyReset.ts'))).toBe(false);
    const routes = read('src/modules/floorMap/floorMap.routes.ts');
    expect(routes).not.toContain('/default');
    expect(routes).not.toContain('/restore');
    expect(routes).toContain("'/areas/:id/day-layout'");
  });

  it('copying a day\'s layout is ONE transaction that also moves that day\'s bookings', () => {
    const repo = read('src/modules/floorMap/floorMap.repository.ts');
    const fork = repo.slice(repo.indexOf('async forkDay('), repo.indexOf('async labelsInArea('));
    expect(fork).toContain('prisma.$transaction');
    expect(fork).toContain('tx.floorAreaDay.create(');
    // Only that day's bookings: the others stay on the standing tables.
    expect(fork).toContain('event: { eventDate: dayRange(day) }');
    expect(fork).toContain('tx.eventFloorTable.update(');
  });

  it('the migration adds the day, makes labels unique per LAYOUT, and drops the default layout', () => {
    const sql = fs.readFileSync(
      path.join(API_ROOT, 'prisma/migrations/20261108100000_floor_day_layouts/migration.sql'), 'utf8',
    );
    expect(sql).toContain('ADD COLUMN "day" TEXT;');
    expect(sql).toContain('DROP INDEX IF EXISTS "FloorTable_hallId_label_key";');
    expect(sql).toContain('("hallId", COALESCE("day", \'\'), "label")');
    expect(sql).toContain('CREATE TABLE "FloorAreaDay"');
    expect(sql).toContain('DROP COLUMN IF EXISTS "defaultLayout"');
    const schema = read('prisma/schema.prisma');
    const hall = schema.slice(schema.indexOf('model Hall {'), schema.indexOf('model FloorTable {'));
    expect(hall).not.toMatch(/defaultLayout/);
  });

  it('a booking may hold only tables on its own day\'s map', () => {
    const src = read('src/modules/events/event.floorTables.ts');
    expect(src).toContain('new FloorMapRepository().tableIdsByHall(restaurantId, section, day)');
    expect(src).toContain('ids.some((id) => !onTheDay.has(id))');
    // And one moved to another day lets go of its old day's own tables.
    expect(read('src/modules/events/event.service.ts')).toContain('releaseDayLayoutTables(existingEvent.id, dayKey(payload.eventDate))');
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

  it('the schema cascades a hall\'s tables, and the table carries no scope of its own', () => {
    const schema = read('prisma/schema.prisma');
    const model = schema.slice(schema.indexOf('model FloorTable {'), schema.indexOf('model MenuItem {'));
    expect(model).toContain('onDelete: Cascade');
    // Unique per LAYOUT now — an expression index the migration creates.
    expect(model).toMatch(/day\s+String\?/);
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

describe('merging tables into one', () => {
  /** Three four-tops in a row in R1's Small Banquets hall. */
  const row = async () => Promise.all([1, 2, 3].map((n) => service.createTable('r1', 'SMALL_BANQUET', {
    ...TABLE, hallId: mine.id, label: String(n), seats: 4, x: 100 + n * 180, y: 200,
  })));
  const MERGED = { seats: 12, x: 460, y: 200, width: 540, height: 56, rotation: 0 };

  it('the FIRST table stays, keeps its number, and the others go', async () => {
    const [a, b, c] = await row();
    const merged = await service.mergeTables('r1', 'SMALL_BANQUET', { tableIds: [a.id, b.id, c.id], ...MERGED });
    expect(merged.id).toBe(a.id);
    // The number staff have been saying out loud is the one that survives.
    expect(merged.label).toBe('1');
    expect(merged.seats).toBe(12);
    expect(store.tables.map((t) => t.id)).toEqual([a.id]);
  });

  it('it takes the size the map worked out, and is always a RECTANGLE', async () => {
    const [a, b] = await row();
    // Round tables pushed together are one long table; the shape is pinned
    // server-side so the two sides cannot hold that fact differently.
    await service.updateTable('r1', 'SMALL_BANQUET', a.id, { shape: 'ROUND' });
    const merged = await service.mergeTables('r1', 'SMALL_BANQUET', { tableIds: [a.id, b.id], ...MERGED, seats: 8 });
    expect(merged.shape).toBe('RECT');
    expect({ x: merged.x, y: merged.y, width: merged.width, height: merged.height })
      .toEqual({ x: MERGED.x, y: MERGED.y, width: MERGED.width, height: MERGED.height });
  });

  it('a table from another section or another restaurant is 404, wherever it sits in the list', async () => {
    const [a, b] = await row();
    const next = await service.createTable('r1', 'BANQUET', { ...TABLE, hallId: banquet.id, label: '9' });
    const other = await service.createTable('r2', 'SMALL_BANQUET', { ...TABLE, hallId: foreign.id, label: '9' });
    for (const id of [next.id, other.id]) {
      expect(await statusOf(() => service.mergeTables('r1', 'SMALL_BANQUET', { tableIds: [a.id, id], ...MERGED }))).toBe(404);
      // And last as well as second: a list is as long as the caller likes.
      expect(await statusOf(() => service.mergeTables('r1', 'SMALL_BANQUET', { tableIds: [a.id, b.id, id], ...MERGED }))).toBe(404);
    }
    // Nothing was merged by any of the refused calls.
    expect(store.tables.filter((t) => t.hallId === mine.id)).toHaveLength(3);
  });

  it('tables in different AREAS are refused — that is a table teleporting', async () => {
    const [a] = await row();
    const elsewhere = await service.createArea('r1', 'SMALL_BANQUET', { name: 'Terrace', kind: 'OUTDOOR', ...LAYOUT, capacity: 40 });
    const far = await service.createTable('r1', 'SMALL_BANQUET', { ...TABLE, hallId: elsewhere.id, label: '1' });
    expect(await statusOf(() => service.mergeTables('r1', 'SMALL_BANQUET', { tableIds: [a.id, far.id], ...MERGED }))).toBe(400);
    expect(store.tables).toHaveLength(4);
  });

  it('a table a booking still holds cannot be merged AWAY, and is named', async () => {
    const [a, b, c] = await row();
    store.bookedTables.add(c.id);
    let message = '';
    try {
      await service.mergeTables('r1', 'SMALL_BANQUET', { tableIds: [a.id, b.id, c.id], ...MERGED });
    } catch (error) {
      message = (error as Error).message;
      expect((error as { status?: number }).status).toBe(409);
    }
    // Named, like a booking clash: "unavailable" alone sends somebody away
    // from the desk to find out which table and whose evening.
    expect(message).toContain('3');
    // And nothing was written — not the merge, not the resize of the keeper.
    expect(store.tables).toHaveLength(3);
    expect(store.tables.find((t) => t.id === a.id)!.seats).toBe(4);
  });

  it('but the KEPT table may be booked — it keeps its row, so it keeps its booking', async () => {
    const [a, b] = await row();
    store.bookedTables.add(a.id);
    const merged = await service.mergeTables('r1', 'SMALL_BANQUET', { tableIds: [a.id, b.id], ...MERGED, seats: 8 });
    expect(merged.id).toBe(a.id);
    expect(merged.seats).toBe(8);
  });
});

describe('what the merge endpoint accepts', () => {
  const body = { tableIds: ['cl000000000000000000000a', 'cl000000000000000000000b'], seats: 8, x: 300, y: 200, width: 400, height: 56 };

  it('two tables at least — a "merge" of one is a resize wearing the wrong name', () => {
    expect(mergeTablesSchema.safeParse({ ...body, tableIds: [body.tableIds[0]] }).success).toBe(false);
    expect(mergeTablesSchema.safeParse(body).success).toBe(true);
  });

  it('and never the same table twice', () => {
    // Which would delete a row and then try to keep it.
    expect(mergeTablesSchema.safeParse({ ...body, tableIds: [body.tableIds[0], body.tableIds[0]] }).success).toBe(false);
  });

  it('no shape: the server decides that, so the two sides cannot disagree', () => {
    const parsed = mergeTablesSchema.parse({ ...body, shape: 'ROUND' });
    expect('shape' in parsed).toBe(false);
  });

  it('the seat count cannot exceed what the column holds', () => {
    expect(mergeTablesSchema.safeParse({ ...body, seats: 41 }).success).toBe(false);
    expect(mergeTablesSchema.safeParse({ ...body, seats: 40 }).success).toBe(true);
    expect(mergeTablesSchema.safeParse({ ...body, seats: 0 }).success).toBe(false);
  });

  it('the size is a real one, and null is not a size', () => {
    // A merged table is explicitly sized; "automatic" would throw away the
    // span the merge was measured from.
    expect(mergeTablesSchema.safeParse({ ...body, width: null }).success).toBe(false);
    expect(mergeTablesSchema.safeParse({ ...body, width: 10 }).success).toBe(false);
    expect(mergeTablesSchema.safeParse({ ...body, height: 2001 }).success).toBe(false);
  });
});

describe('the real merge, as the repository writes it', () => {
  // The fake above implements the booking check itself, which means breaking
  // the REAL one changes nothing any test above can see — the same trap the
  // report's `asDepartment` adapter fell into. There is no database here, so
  // the repository's own half is read.
  const API_ROOT = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '..', '..', '..');
  const read = (rel: string) => fs.readFileSync(path.join(API_ROOT, rel), 'utf8')
    .replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, '');
  const repo = read('src/modules/floorMap/floorMap.repository.ts');
  const merge = repo.slice(repo.indexOf('async mergeTables('), repo.indexOf('async mergeTables(') + 1800);

  it('refuses outright when a booking from the cutoff onward holds one of them', () => {
    // `EventFloorTable` cascades on the table, so deleting one releases every
    // booking sitting on it — silently, which is why this is a refusal and not
    // a warning.
    expect(merge).toMatch(/if \(held\.length > 0\) \{[\s\S]{0,200}return \{ table: null/);
  });

  it('and the check comes BEFORE either write', () => {
    expect(merge.indexOf('held.length > 0')).toBeLessThan(merge.indexOf('tx.floorTable.update'));
    expect(merge.indexOf('held.length > 0')).toBeLessThan(merge.indexOf('deleteMany'));
  });

  it('it is one transaction, so a failed delete cannot leave a resized keeper', () => {
    expect(merge).toContain('prisma.$transaction');
    expect(merge).toContain('tx.floorTable.update');
    expect(merge).toContain('tx.floorTable.deleteMany');
  });

  it('a cancelled booking holds nothing, and only the REMOVED tables are checked', () => {
    expect(merge).toMatch(/floorTableId: \{ in: removeIds \}/);
    expect(merge).toMatch(/status: \{ not: 'CANCELLED' \}/);
    expect(merge).toMatch(/eventDate: \{ gte: protectFrom \}/);
  });

  it('the blocked tables come back by LABEL, de-duplicated', () => {
    // The caller names them to the supervisor; an id would be useless and the
    // same table appears once per booking that holds it.
    expect(merge).toMatch(/new Set\(held\.map\(\(row\) => row\.floorTable\.label\)\)/);
  });

  it('and the service protects from the start of today', () => {
    const service = read('src/modules/floorMap/floorMap.service.ts');
    const fn = service.slice(service.indexOf('async mergeTables('));
    expect(fn).toContain('startOfDay(new Date())');
  });
});
