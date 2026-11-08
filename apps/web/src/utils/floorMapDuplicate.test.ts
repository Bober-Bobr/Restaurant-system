import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { footprintsOverlap, spotNear, tableHalfExtents, type MapFeature, type MapTable } from './floorMap';

/**
 * "Duplicate table" in the layout editor: another table like this one, right
 * beside it. The placement rule is `spotNear`; the page wiring is read from
 * the source, the house style where there is no DOM.
 */
const AREA = { width: 1200, height: 800 };
const table = (over: Partial<MapTable> = {}): MapTable => ({
  id: 't1', hallId: 'h1', label: '1', seats: 4, shape: 'RECT', x: 200, y: 200, rotation: 0, width: null, height: null, ...over,
});

describe('where the copy goes', () => {
  it('right beside the original, to its right, clear of its chairs', () => {
    const original = table();
    const spot = spotNear(original, AREA, [original])!;
    expect(spot.y).toBe(original.y);
    expect(spot.x).toBeGreaterThan(original.x);
    const copy = { ...original, id: 'copy', ...spot };
    expect(footprintsOverlap(original, copy)).toBe(false);
    // Close — one table's width and a gap, not across the room.
    expect(spot.x - original.x).toBeLessThanOrEqual(2 * tableHalfExtents(original).hx + 24);
  });

  it('below when the right is taken, then left, then above', () => {
    const original = table({ x: 400, y: 300 });
    const right = spotNear(original, AREA, [original])!;
    const blockRight = table({ id: 'r', label: '2', ...right });
    const below = spotNear(original, AREA, [original, blockRight])!;
    expect(below.x).toBe(original.x);
    expect(below.y).toBeGreaterThan(original.y);
    const blockBelow = table({ id: 'b', label: '3', ...below });
    const left = spotNear(original, AREA, [original, blockRight, blockBelow])!;
    expect(left.y).toBe(original.y);
    expect(left.x).toBeLessThan(original.x);
  });

  it('at the edge of the map it goes the other way rather than off the map', () => {
    const original = table({ x: AREA.width - 60, y: 200 });
    const spot = spotNear(original, AREA, [original])!;
    const { hx } = tableHalfExtents(original);
    expect(spot.x + hx).toBeLessThanOrEqual(AREA.width);
  });

  it('never into the pool or onto the stage', () => {
    const original = table({ x: 200, y: 200 });
    const right = spotNear(original, AREA, [original])!;
    const pool: MapFeature = { kind: 'water', shape: 'rect', x: right.x - 60, y: right.y - 60, width: 120, height: 120 } as MapFeature;
    const spot = spotNear(original, AREA, [original], [pool])!;
    expect(spot).not.toEqual(right);
  });

  it('keeps the original\'s shape, size and angle — a turned table stays turned', () => {
    const original = table({ rotation: 60, seats: 6, width: 200, height: 80 });
    const spot = spotNear(original, AREA, [original])!;
    expect(footprintsOverlap(original, { ...original, id: 'copy', ...spot })).toBe(false);
  });

  it('null when the map is full — the caller decides then', () => {
    const tiny = { width: 120, height: 100 };
    expect(spotNear(table({ x: 60, y: 50 }), tiny, [table({ x: 60, y: 50 })])).toBeNull();
  });
});

describe('the button', () => {
  const page = readFileSync(join(__dirname, '..', 'pages/FloorMapPage.tsx'), 'utf8');
  const fn = page.slice(page.indexOf('const duplicateTable = async'), page.indexOf('const deleteTable = async'));

  it('is in the table\'s own form, beside Delete', () => {
    const form = page.slice(page.indexOf('const tablePanel'), page.indexOf('const mergeForm'));
    expect(form).toContain("onClick={() => void duplicateTable(table)}");
    expect(form.indexOf('duplicateTable(table)')).toBeLessThan(form.indexOf('deleteTable(table)'));
  });

  it('copies seats, shape, size and angle, under the next free number, beside the original', () => {
    expect(fn).toContain('shape: table.shape as TableShape, seats: table.seats, rotation: table.rotation');
    expect(fn).toContain('width: table.width ?? null, height: table.height ?? null');
    expect(fn).toContain('nextTableLabel(areaTables.map((x) => x.label))');
    expect(fn).toContain('spotNear({ ...like, x: table.x, y: table.y }, stored, areaTables, features)');
  });

  it('lands in the layout on screen — the default in the editor, the day\'s elsewhere', () => {
    expect(fn).toContain('await ownLayout(current.id)');
    expect(fn).toContain('...(editing ? {} : { day })');
  });

  it('selects the copy, so it can be moved or duplicated again at once', () => {
    expect(fn).toContain('setSelectedId(row.id)');
  });
});
