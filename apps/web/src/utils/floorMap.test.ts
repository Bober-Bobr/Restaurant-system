import { describe, expect, it } from 'vitest';
import {
  AREA_PADDING, CHAIR_DEPTH, CHAIR_GAP, CHAIR_PITCH, CHAIR_WIDTH, DEFAULT_AREA, MAX_SEATS, MAX_TABLE, MIN_AREA, MIN_TABLE,
  areaSize, chairsFor, clampTable, featureLabelAt, featuresOf, fitTableSize, freeSpot, hitsBlockingFeature, minAreaSize,
  mergeTables, nextRotation, nextTableLabel, overlappingTables, rectSideCounts, seatCapacity, tableHalfExtents,
  tableSize,
  type MapArea, type MapTable,
} from './floorMap';

const SHAPES = ['RECT', 'ROUND'] as const;
const ALL_SEATS = Array.from({ length: MAX_SEATS }, (_, i) => i + 1);

const area = (over: Partial<MapArea> = {}): MapArea => ({
  id: 'a', name: 'Hall', kind: 'HALL', capacity: 50, isActive: true,
  mapWidth: null, mapHeight: null, mapFeatures: [], ...over,
});
const table = (over: Partial<MapTable> = {}): MapTable => ({
  id: 't', hallId: 'a', label: '1', seats: 4, shape: 'RECT', x: 100, y: 100, rotation: 0, ...over,
});

describe('chairs along the sides', () => {
  for (const shape of SHAPES) {
    it(`${shape}: exactly one chair per seat, for every seat count`, () => {
      for (const seats of ALL_SEATS) expect(chairsFor(shape, seats), `${seats} seats`).toHaveLength(seats);
    });

    it(`${shape}: no two chairs overlap`, () => {
      for (const seats of ALL_SEATS) {
        const chairs = chairsFor(shape, seats);
        for (let i = 0; i < chairs.length; i += 1) {
          for (let j = i + 1; j < chairs.length; j += 1) {
            const d = Math.hypot(chairs[i].x - chairs[j].x, chairs[i].y - chairs[j].y);
            // Two chairs side by side need a chair's width; a pitch short of
            // that draws them on top of one another.
            expect(d, `${seats} seats: chairs ${i} and ${j}`).toBeGreaterThanOrEqual(CHAIR_WIDTH - 0.5);
          }
        }
      }
    });

    it(`${shape}: every chair stands outside the tabletop, not on it`, () => {
      for (const seats of ALL_SEATS) {
        const { width, height } = tableSize(shape, seats);
        for (const c of chairsFor(shape, seats)) {
          if (shape === 'ROUND') {
            expect(Math.hypot(c.x, c.y)).toBeGreaterThan(width / 2 + CHAIR_DEPTH / 2 - 0.01);
          } else {
            const outside = Math.abs(c.x) >= width / 2 + CHAIR_DEPTH / 2 || Math.abs(c.y) >= height / 2 + CHAIR_DEPTH / 2;
            expect(outside, `${seats} seats: chair at ${c.x},${c.y}`).toBe(true);
          }
        }
      }
    });

    it(`${shape}: the table grows with its seats and never shrinks`, () => {
      let last = 0;
      for (const seats of ALL_SEATS) {
        const { width, height } = tableSize(shape, seats);
        expect(width * height, `${seats} seats`).toBeGreaterThanOrEqual(last);
        last = width * height;
      }
    });
  }

  it('a rectangular table seats its chairs on the long sides, and the long sides fit them', () => {
    for (const seats of ALL_SEATS) {
      const { width } = tableSize('RECT', seats);
      // The outermost chairs on either long edge stay within the table's length.
      for (const c of chairsFor('RECT', seats).filter((ch) => ch.angle === 0 || ch.angle === 180)) {
        expect(Math.abs(c.x) + CHAIR_WIDTH / 2, `${seats} seats`).toBeLessThanOrEqual(width / 2);
      }
    }
  });

  it('adding a chair never makes a rectangular table shorter — the end chairs arrive at six', () => {
    for (const seats of ALL_SEATS.slice(1)) {
      expect(tableSize('RECT', seats).width, `${seats} seats`).toBeGreaterThanOrEqual(tableSize('RECT', seats - 1).width);
    }
    // …and the chairs on a long side still get a full pitch each.
    for (const seats of ALL_SEATS) {
      const top = chairsFor('RECT', seats).filter((c) => c.angle === 0).map((c) => c.x);
      for (let i = 1; i < top.length; i += 1) expect(top[i] - top[i - 1]).toBeGreaterThanOrEqual(CHAIR_PITCH - 0.01);
    }
  });

  it('a rectangular table of six or more puts a chair at each end, facing in', () => {
    expect(chairsFor('RECT', 4).some((c) => c.angle === 90 || c.angle === 270)).toBe(false);
    const six = chairsFor('RECT', 6);
    expect(six.filter((c) => c.angle === 270)).toHaveLength(1);
    expect(six.filter((c) => c.angle === 90)).toHaveLength(1);
  });

  it('the two long sides differ by at most one chair', () => {
    for (const seats of ALL_SEATS) {
      const chairs = chairsFor('RECT', seats);
      const top = chairs.filter((c) => c.angle === 0).length;
      const bottom = chairs.filter((c) => c.angle === 180).length;
      expect(Math.abs(top - bottom), `${seats} seats`).toBeLessThanOrEqual(1);
    }
  });

  it('out-of-range seat counts are clamped rather than drawing nothing or a thousand chairs', () => {
    expect(chairsFor('RECT', 0)).toHaveLength(1);
    expect(chairsFor('ROUND', 500)).toHaveLength(MAX_SEATS);
    expect(chairsFor('RECT', Number.NaN)).toHaveLength(1);
  });

  it('rotation swaps a table\'s footprint at 90° and widens it at 45°', () => {
    const flat = tableHalfExtents({ shape: 'RECT', seats: 10, rotation: 0 });
    const upright = tableHalfExtents({ shape: 'RECT', seats: 10, rotation: 90 });
    const diagonal = tableHalfExtents({ shape: 'RECT', seats: 10, rotation: 45 });
    expect(upright.hx).toBe(flat.hy);
    expect(upright.hy).toBe(flat.hx);
    expect(diagonal.hy).toBeGreaterThan(flat.hy);
    expect(nextRotation(315)).toBe(0);
    expect(nextRotation(0)).toBe(45);
  });
});

describe('an area\'s own map', () => {
  it('keeps the size it was given', () => {
    expect(areaSize(area({ mapWidth: 2620, mapHeight: 1780 }), [])).toEqual({ width: 2620, height: 1780 });
  });

  it('a hall that predates the map gets the default for its kind — an outdoor venue the bigger', () => {
    expect(areaSize(area(), [])).toEqual(DEFAULT_AREA.HALL);
    expect(areaSize(area({ kind: 'OUTDOOR' }), [])).toEqual(DEFAULT_AREA.OUTDOOR);
    expect(DEFAULT_AREA.OUTDOOR.width * DEFAULT_AREA.OUTDOOR.height).toBeGreaterThan(DEFAULT_AREA.HALL.width * DEFAULT_AREA.HALL.height);
  });

  it('is never smaller than the tables standing in it, whatever is stored', () => {
    const far = table({ x: 1500, y: 900, seats: 12 });
    const size = areaSize(area({ mapWidth: 600, mapHeight: 400 }), [far]);
    expect(size.width).toBeGreaterThan(1500);
    expect(size.height).toBeGreaterThan(900);
  });

  it('cannot be shrunk past the tables standing in it', () => {
    expect(minAreaSize([])).toEqual(MIN_AREA);
    const t = table({ x: 600, y: 400, seats: 8 });
    const min = minAreaSize([t]);
    const { hx, hy } = tableHalfExtents(t);
    expect(min.width).toBeGreaterThanOrEqual(600 + hx);
    expect(min.height).toBeGreaterThanOrEqual(400 + hy);
  });

  it('reads the drawing defensively — a malformed column draws nothing rather than breaking the page', () => {
    expect(featuresOf(area({ mapFeatures: null }))).toEqual([]);
    expect(featuresOf({ mapFeatures: 'x' as never })).toEqual([]);
    expect(featuresOf({ mapFeatures: [null, 4, { kind: 'label', shape: 'point', x: 1, y: 2 }] as never })).toHaveLength(1);
  });

  it('writes a feature\'s name where it was told to, else in its middle', () => {
    expect(featureLabelAt({ kind: 'zone', shape: 'rect', x: 0, y: 0, width: 100, height: 50 })).toEqual([50, 25]);
    expect(featureLabelAt({ kind: 'zone', shape: 'polygon', points: [[0, 0], [30, 0], [0, 30]] })).toEqual([10, 10]);
    expect(featureLabelAt({ kind: 'zone', shape: 'rect', x: 0, y: 0, width: 100, height: 50, labelAt: [7, 8] })).toEqual([7, 8]);
  });
});

describe('the pool and the stage', () => {
  const pool = { kind: 'water' as const, shape: 'ellipse' as const, x: 0, y: 0, width: 400, height: 400 };
  const lawn = { kind: 'zone' as const, shape: 'rect' as const, x: 0, y: 0, width: 400, height: 400 };

  it('a table on the water is caught, one on the ground round it is not — the ellipse is tested exactly', () => {
    expect(hitsBlockingFeature({ x: 200, y: 200, hx: 40, hy: 40 }, [pool])).toBe(true);
    // In the pool's bounding box, but on the dry corner outside the circle.
    expect(hitsBlockingFeature({ x: 30, y: 30, hx: 20, hy: 20 }, [pool])).toBe(false);
  });

  it('a zone is where tables go, not where they may not', () => {
    expect(hitsBlockingFeature({ x: 200, y: 200, hx: 40, hy: 40 }, [lawn])).toBe(false);
  });

  it('a new table is never put in the pool', () => {
    // The pool fills the left half; the first free spot reading left to right
    // would be ON it if the pool were not an obstacle.
    const spot = freeSpot({ shape: 'RECT', seats: 4, rotation: 0 }, { width: 800, height: 400 }, [], [pool]);
    expect(spot).not.toBeNull();
    expect(freeSpot({ shape: 'RECT', seats: 4, rotation: 0 }, { width: 800, height: 400 }, [])!.x).toBeLessThan(spot!.x);
    expect(hitsBlockingFeature({ ...spot!, ...tableHalfExtents({ shape: 'RECT', seats: 4, rotation: 0 }) }, [pool])).toBe(false);
  });
});

describe('a table resized by hand', () => {
  it('keeps exactly the size it was given, and a round one stays round', () => {
    expect(tableSize('RECT', 4, { width: 120, height: 70 })).toEqual({ width: 120, height: 70 });
    expect(tableSize('ROUND', 4, { width: 90, height: 70 })).toEqual({ width: 90, height: 90 });
    // No size, or half a size, is the automatic one.
    expect(tableSize('RECT', 4, { width: 120, height: null })).toEqual(tableSize('RECT', 4));
  });

  it('still seats exactly its chairs, none overlapping, none on the tabletop', () => {
    for (const [w, h] of [[64, 64], [150, 80], [300, 60], [60, 300], [200, 200]] as const) {
      for (const seats of [1, 2, 4, 6, 9, 12]) {
        const size = fitTableSize('RECT', seats, w, h);
        const chairs = chairsFor('RECT', seats, size);
        expect(chairs, `${w}×${h}, ${seats}`).toHaveLength(seats);
        for (let i = 0; i < chairs.length; i += 1) {
          const c = chairs[i];
          const outside = Math.abs(c.x) >= size.width / 2 + CHAIR_DEPTH / 2 || Math.abs(c.y) >= size.height / 2 + CHAIR_DEPTH / 2;
          expect(outside, `${w}×${h}, ${seats}: chair ${i}`).toBe(true);
          for (let j = i + 1; j < chairs.length; j += 1) {
            const d = Math.hypot(c.x - chairs[j].x, c.y - chairs[j].y);
            expect(d, `${w}×${h}, ${seats}: chairs ${i}/${j}`).toBeGreaterThanOrEqual(CHAIR_WIDTH - 0.5);
          }
        }
      }
    }
  });

  it('fills the long sides before the ends, as a table is laid in a room', () => {
    expect(rectSideCounts(4, 84, 56)).toEqual({ top: 2, bottom: 2, left: 0, right: 0 });
    expect(rectSideCounts(4, 64, 64)).toEqual({ top: 1, bottom: 1, left: 1, right: 1 });
    // Upright, the long sides are left and right.
    expect(rectSideCounts(4, 56, 84)).toEqual({ top: 0, bottom: 0, left: 2, right: 2 });
    expect(rectSideCounts(6, 150, 80)).toEqual({ top: 3, bottom: 3, left: 0, right: 0 });
  });

  it('a slight resize of an automatic table keeps its chairs where they were', () => {
    // An automatic four-top seats two a side; nudged a few units, it must not
    // suddenly put a chair on each end.
    const auto = tableSize('RECT', 4);
    const nudged = { width: auto.width + 6, height: auto.height + 2 };
    const sides = (chairs: { angle: number }[]) => [0, 90, 180, 270].map((a) => chairs.filter((c) => c.angle === a).length);
    expect(sides(chairsFor('RECT', 4, nudged))).toEqual(sides(chairsFor('RECT', 4)));
  });

  it('cannot be made too small for its chairs — it grows back along its longer side', () => {
    for (const seats of [1, 4, 8, 12, 20, MAX_SEATS]) {
      for (const shape of SHAPES) {
        const size = fitTableSize(shape, seats, 10, 10);
        expect(seatCapacity(shape, size.width, size.height), `${shape} ${seats}`).toBeGreaterThanOrEqual(seats);
        expect(size.width).toBeGreaterThanOrEqual(MIN_TABLE);
        expect(size.height).toBeGreaterThanOrEqual(MIN_TABLE);
      }
    }
    expect(fitTableSize('RECT', 4, 64, 64)).toEqual({ width: 64, height: 64 });
    expect(fitTableSize('RECT', 4, 5000, 5000)).toEqual({ width: MAX_TABLE, height: MAX_TABLE });
    expect(fitTableSize('ROUND', 4, 90, 60)).toEqual({ width: 90, height: 90 });
  });

  it('its footprint follows its size and where its chairs actually are', () => {
    const long = tableHalfExtents({ shape: 'RECT', seats: 4, rotation: 0, width: 300, height: 60 });
    // Four chairs on a 300-long table all go on the long sides: no end chairs.
    expect(long.hx).toBe(150);
    expect(long.hy).toBe(30 + CHAIR_GAP + CHAIR_DEPTH);
  });
});

describe('tables inside an area', () => {
  const room = { width: 600, height: 400 };

  it('a dragged table stays wholly on its area\'s map, chairs included', () => {
    const t = { shape: 'RECT', seats: 8, rotation: 0 };
    const { hx, hy } = tableHalfExtents(t);
    for (const pos of [{ x: -500, y: -500 }, { x: 5000, y: 5000 }, { x: 300, y: 0 }]) {
      const c = clampTable(pos, t, room);
      expect(c.x - hx).toBeGreaterThanOrEqual(AREA_PADDING);
      expect(c.x - hx).toBeGreaterThanOrEqual(0);
      expect(c.x + hx).toBeLessThanOrEqual(room.width);
      expect(c.y - hy).toBeGreaterThanOrEqual(AREA_PADDING);
      expect(c.y + hy).toBeLessThanOrEqual(room.height);
    }
  });

  it('a free spot does not touch any table already there', () => {
    const others = [table({ id: '1', x: 80, y: 120 }), table({ id: '2', x: 220, y: 120, seats: 8 })];
    const t = { shape: 'ROUND', seats: 6, rotation: 0 };
    const spot = freeSpot(t, room, others)!;
    expect(spot).not.toBeNull();
    const me = { ...spot, ...tableHalfExtents(t) };
    for (const o of others) {
      const b = tableHalfExtents(o);
      const apart = Math.abs(me.x - o.x) >= me.hx + b.hx || Math.abs(me.y - o.y) >= me.hy + b.hy;
      expect(apart).toBe(true);
    }
  });

  it('and says so when the area is full, rather than stacking tables', () => {
    const tiny = { width: 120, height: 120 };
    expect(freeSpot({ shape: 'RECT', seats: 20, rotation: 0 }, tiny, [])).toBeNull();
  });

  it('tables that overlap are flagged — both of them, and only within one area', () => {
    const a = table({ id: 'a1', x: 100, y: 100 });
    const b = table({ id: 'b1', x: 130, y: 110 });
    const far = table({ id: 'far', x: 500, y: 300 });
    const elsewhere = table({ id: 'other', hallId: 'b', x: 100, y: 100 });
    expect([...overlappingTables([a, b, far, elsewhere])].sort()).toEqual(['a1', 'b1']);
    // A chair counts: two tables whose tops are apart but whose chairs collide overlap.
    const { hy } = tableHalfExtents(a);
    expect(overlappingTables([a, table({ id: 'c', x: 100, y: 100 + 2 * hy - 2 })]).size).toBe(2);
    expect(overlappingTables([a, table({ id: 'c', x: 100, y: 100 + 2 * hy + 1 })]).size).toBe(0);
  });

  it('a turned table is judged by its real outline, not its upright box', () => {
    // A row of squares turned along a diagonal, as along Sangizar's Bungalow:
    // their upright boxes overlap, the tables do not.
    const along = (i: number) => table({ id: `d${i}`, x: 100 + i * 60, y: 100 + i * 104, rotation: 60, width: 64, height: 64 });
    const row = [0, 1, 2].map(along);
    const box = tableHalfExtents(row[0]);
    expect(Math.abs(row[0].x - row[1].x)).toBeLessThan(2 * box.hx); // the upright boxes DO overlap
    expect(overlappingTables(row).size).toBe(0);
    // …and pushed together along the row, they are caught.
    const squeezed = [0, 1].map((i) => table({ id: `s${i}`, x: 100 + i * 30, y: 100 + i * 52, rotation: 60, width: 64, height: 64 }));
    expect(overlappingTables(squeezed).size).toBe(2);
  });

  it('table numbers fill a gap before counting upwards', () => {
    expect(nextTableLabel([])).toBe('1');
    expect(nextTableLabel(['1', '2', '4'])).toBe('3');
    expect(nextTableLabel(['1', '2', 'VIP'])).toBe('3');
    expect(nextTableLabel([' 1 ', '2'])).toBe('3');
  });
});

describe('merging tables into one', () => {
  it('the merged table seats the SUM of what was merged', () => {
    const merged = mergeTables([table({ id: 'a', seats: 4 }), table({ id: 'b', seats: 6, x: 300 })]);
    expect(merged?.seats).toBe(10);
    expect(merged?.dropped).toBe(0);
  });

  it('and says how many seats the cap would not take, rather than losing them', () => {
    // Four tens is 40, the cap; a fifth table's seats cannot be stored, and a
    // merged table silently reporting 40 is a figure an evening gets priced on.
    const row = [0, 1, 2, 3, 4].map((i) => table({ id: `t${i}`, seats: 10, x: 200 + i * 400 }));
    const merged = mergeTables(row);
    expect(merged?.seats).toBe(MAX_SEATS);
    expect(merged?.dropped).toBe(50 - MAX_SEATS);
  });

  it('nothing to merge: fewer than two tables is null, never a quiet resize', () => {
    expect(mergeTables([])).toBeNull();
    expect(mergeTables([table()])).toBeNull();
  });

  it('it stands where the group did, covering all of their tops', () => {
    const a = table({ id: 'a', seats: 4, x: 200, y: 300 });
    const b = table({ id: 'b', seats: 4, x: 400, y: 300 });
    const merged = mergeTables([a, b])!;
    expect(merged.x).toBe(300);
    expect(merged.y).toBe(300);
    const topA = tableSize(a.shape, a.seats, a);
    const topB = tableSize(b.shape, b.seats, b);
    // At least as wide as the span of the two tops, and no taller than needed.
    expect(merged.width).toBeGreaterThanOrEqual((b.x + topB.width / 2) - (a.x - topA.width / 2));
    expect(merged.height).toBeGreaterThanOrEqual(topA.height);
  });

  it('it is always a rectangle — that is what pushing tables together makes', () => {
    const merged = mergeTables([
      table({ id: 'a', shape: 'ROUND', seats: 6 }),
      table({ id: 'b', shape: 'ROUND', seats: 6, x: 300 }),
    ]);
    expect(merged?.shape).toBe('RECT');
  });

  it('it is big enough for all those chairs, even when the tops were not', () => {
    // Two TENS standing on top of each other — which the map already flags as
    // overlapping, and is exactly what somebody merges. Their union is one
    // ten-top's outline, which seats nowhere near twenty, so the merged table
    // has to grow: without that it would carry a seat count its own geometry
    // cannot draw.
    const stacked = [table({ id: 'a', seats: 10 }), table({ id: 'b', seats: 10 })];
    const union = tableSize('RECT', 10);
    expect(seatCapacity('RECT', union.width, union.height)).toBeLessThan(20);
    const merged = mergeTables(stacked)!;
    expect(merged.seats).toBe(20);
    expect(seatCapacity('RECT', merged.width, merged.height)).toBeGreaterThanOrEqual(20);
    expect(chairsFor('RECT', merged.seats, merged)).toHaveLength(merged.seats);

    // And a row that is long enough already is left the length it is.
    const row = mergeTables([table({ id: 'a', y: 100 }), table({ id: 'b', y: 180 })])!;
    expect(seatCapacity('RECT', row.width, row.height)).toBeGreaterThanOrEqual(row.seats);
    expect(chairsFor('RECT', row.seats, row)).toHaveLength(row.seats);
  });

  it('a row all turned the same way keeps its angle, and is measured along itself', () => {
    // Sangizar's diagonal row: a merge that came back upright would be a table
    // lying across the walkway.
    const row = [0, 1, 2].map((i) => table({
      id: `d${i}`, seats: 4, rotation: 60,
      x: Math.round(300 + i * 190 * Math.cos(Math.PI / 3)),
      y: Math.round(300 + i * 190 * Math.sin(Math.PI / 3)),
    }));
    const merged = mergeTables(row)!;
    expect(merged.rotation).toBe(60);
    // Along the row, not across it: the length is the span of three tables.
    expect(merged.width).toBeGreaterThan(merged.height * 2);
    // Its centre is the middle table's, because the row is evenly spaced.
    expect(Math.hypot(merged.x - row[1].x, merged.y - row[1].y)).toBeLessThan(3);
  });

  it('mixed angles come back upright, measured upright', () => {
    const merged = mergeTables([
      table({ id: 'a', rotation: 0, x: 300, y: 300 }),
      table({ id: 'b', rotation: 90, x: 500, y: 300 }),
    ])!;
    expect(merged.rotation).toBe(0);
    expect(merged.x).toBeGreaterThan(300);
    expect(merged.x).toBeLessThan(500);
  });

  it('every number it produces is a whole one the column can hold', () => {
    const merged = mergeTables([
      table({ id: 'a', seats: 5, rotation: 45, x: 211, y: 307 }),
      table({ id: 'b', seats: 7, rotation: 45, x: 404, y: 489 }),
    ])!;
    for (const v of [merged.x, merged.y, merged.width, merged.height, merged.seats, merged.rotation]) {
      expect(Number.isInteger(v), String(v)).toBe(true);
    }
    expect(merged.width).toBeLessThanOrEqual(MAX_TABLE);
    expect(merged.height).toBeLessThanOrEqual(MAX_TABLE);
    expect(merged.width).toBeGreaterThanOrEqual(MIN_TABLE);
  });

  it('a hand-resized table is merged by the size it was GIVEN', () => {
    const wide = table({ id: 'a', seats: 4, width: 400, height: 60, x: 400, y: 300 });
    const merged = mergeTables([wide, table({ id: 'b', seats: 4, x: 900, y: 300 })])!;
    expect(merged.width).toBeGreaterThanOrEqual(400);
  });
});
