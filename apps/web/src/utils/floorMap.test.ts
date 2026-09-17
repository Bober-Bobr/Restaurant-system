import { describe, expect, it } from 'vitest';
import {
  AREA_HEADER, CHAIR_DEPTH, CHAIR_PITCH, CHAIR_WIDTH, MAX_SEATS, MIN_AREA, areaAt, chairsFor, clampTable,
  freeSpot, isPlaced, minAreaSize, nextRotation, nextTableLabel, overlappingTables, placeNewArea, resolveLayouts, tableHalfExtents,
  tableSize, worldSize, type MapArea, type MapTable,
} from './floorMap';

const SHAPES = ['RECT', 'ROUND'] as const;
const ALL_SEATS = Array.from({ length: MAX_SEATS }, (_, i) => i + 1);

const area = (over: Partial<MapArea> = {}): MapArea => ({
  id: 'a', name: 'Hall', kind: 'HALL', capacity: 50, isActive: true,
  mapX: null, mapY: null, mapWidth: null, mapHeight: null, ...over,
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

describe('areas on the map', () => {
  it('a placed area keeps exactly the rectangle it was given', () => {
    const placed = area({ id: 'p', mapX: 300, mapY: 200, mapWidth: 500, mapHeight: 400 });
    expect(resolveLayouts([placed], []).get('p')).toEqual({ mapX: 300, mapY: 200, mapWidth: 500, mapHeight: 400 });
  });

  it('every hall that predates the map still appears, laid out below anything placed by hand', () => {
    const placed = area({ id: 'p', mapX: 40, mapY: 40, mapWidth: 900, mapHeight: 600 });
    const layouts = resolveLayouts([area({ id: 'u1' }), placed, area({ id: 'u2', kind: 'OUTDOOR' })], []);
    expect(layouts.size).toBe(3);
    for (const id of ['u1', 'u2']) expect(layouts.get(id)!.mapY).toBeGreaterThanOrEqual(640);
  });

  it('auto-placed areas never overlap one another or a placed one', () => {
    const areas = [
      area({ id: 'p', mapX: 40, mapY: 40, mapWidth: 1200, mapHeight: 500 }),
      ...Array.from({ length: 7 }, (_, i) => area({ id: `u${i}`, kind: i % 2 ? 'OUTDOOR' : 'HALL' })),
    ];
    const rects = [...resolveLayouts(areas, []).values()];
    for (let i = 0; i < rects.length; i += 1) {
      for (let j = i + 1; j < rects.length; j += 1) {
        const a = rects[i]; const b = rects[j];
        const apart = a.mapX + a.mapWidth <= b.mapX || b.mapX + b.mapWidth <= a.mapX
          || a.mapY + a.mapHeight <= b.mapY || b.mapY + b.mapHeight <= a.mapY;
        expect(apart, `${i} and ${j} overlap`).toBe(true);
      }
    }
  });

  it('an unplaced area is drawn big enough for the tables already in it', () => {
    const far = table({ x: 1500, y: 900, seats: 12 });
    const layout = resolveLayouts([area()], [far]).get('a')!;
    expect(layout.mapWidth).toBeGreaterThan(1500);
    expect(layout.mapHeight).toBeGreaterThan(900);
  });

  it('a new area lands clear of every existing one, placed or not', () => {
    const areas = [area({ id: 'p', mapX: 40, mapY: 40, mapWidth: 700, mapHeight: 400 }), area({ id: 'u' })];
    const existing = [...resolveLayouts(areas, []).values()];
    const fresh = placeNewArea(areas, [], 'OUTDOOR');
    for (const e of existing) {
      const apart = fresh.mapX >= e.mapX + e.mapWidth || e.mapX >= fresh.mapX + fresh.mapWidth
        || fresh.mapY >= e.mapY + e.mapHeight || e.mapY >= fresh.mapY + fresh.mapHeight;
      expect(apart).toBe(true);
    }
    expect(isPlaced(fresh)).toBe(true);
  });

  it('an area cannot be shrunk past the tables standing in it', () => {
    expect(minAreaSize([])).toEqual(MIN_AREA);
    const t = table({ x: 600, y: 400, seats: 8 });
    const min = minAreaSize([t]);
    const { hx, hy } = tableHalfExtents(t);
    expect(min.width).toBeGreaterThanOrEqual(600 + hx);
    expect(min.height).toBeGreaterThanOrEqual(400 + hy);
  });

  it('the drawing grows to hold everything on it', () => {
    expect(worldSize([{ mapX: 2000, mapY: 1500, mapWidth: 800, mapHeight: 400 }])).toEqual({ width: 2840, height: 1940 });
    expect(worldSize([]).width).toBeGreaterThan(0);
  });

  it('a point finds the area under it, and the one drawn last wins where they overlap', () => {
    const layouts = new Map([
      ['under', { mapX: 0, mapY: 0, mapWidth: 500, mapHeight: 500 }],
      ['over', { mapX: 400, mapY: 400, mapWidth: 300, mapHeight: 300 }],
    ]);
    expect(areaAt({ x: 100, y: 100 }, layouts)).toBe('under');
    expect(areaAt({ x: 450, y: 450 }, layouts)).toBe('over');
    expect(areaAt({ x: 900, y: 900 }, layouts)).toBeNull();
  });
});

describe('tables inside an area', () => {
  const room = { width: 600, height: 400 };

  it('a dragged table stays wholly inside its area, chairs included, and below the name strip', () => {
    const t = { shape: 'RECT', seats: 8, rotation: 0 };
    const { hx, hy } = tableHalfExtents(t);
    for (const pos of [{ x: -500, y: -500 }, { x: 5000, y: 5000 }, { x: 300, y: 0 }]) {
      const c = clampTable(pos, t, room);
      expect(c.x - hx).toBeGreaterThanOrEqual(0);
      expect(c.x + hx).toBeLessThanOrEqual(room.width);
      expect(c.y - hy).toBeGreaterThanOrEqual(AREA_HEADER);
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

  it('table numbers fill a gap before counting upwards', () => {
    expect(nextTableLabel([])).toBe('1');
    expect(nextTableLabel(['1', '2', '4'])).toBe('3');
    expect(nextTableLabel(['1', '2', 'VIP'])).toBe('3');
    expect(nextTableLabel([' 1 ', '2'])).toBe('3');
  });
});
