/**
 * The floor map's geometry — the pure half of FloorMapPage.
 *
 * Everything is in MAP UNITS, one coordinate space the SVG scales to the
 * screen, so a phone and a wall display show the same plan. An area (a hall or
 * an outdoor area) is a rectangle in that space; a table's position is its
 * CENTRE, relative to its area's top-left corner, so moving an area carries its
 * tables along with nothing to recompute.
 *
 * A table has no width or height of its own. Its size FOLLOWS FROM ITS SEATS:
 * add a chair and the table grows to make room for it. That is what keeps the
 * chairs drawn along the sides honest — a free-sized table could be given
 * twelve chairs and the length of four.
 */

export type AreaKind = 'HALL' | 'OUTDOOR';
export type TableShape = 'RECT' | 'ROUND';

export type AreaLayout = { mapX: number; mapY: number; mapWidth: number; mapHeight: number };

export type MapArea = {
  id: string;
  name: string;
  kind: AreaKind | string;
  capacity: number;
  isActive: boolean;
  mapX: number | null;
  mapY: number | null;
  mapWidth: number | null;
  mapHeight: number | null;
};

export type MapTable = {
  id: string;
  hallId: string;
  label: string;
  seats: number;
  shape: TableShape | string;
  x: number;
  y: number;
  rotation: number;
};

export type FloorMap = { areas: MapArea[]; tables: MapTable[] };

export type Chair = { x: number; y: number; angle: number };

// ── Furniture ───────────────────────────────────────────────────────────────

export const MIN_SEATS = 1;
export const MAX_SEATS = 40; // mirrors floorMap.schema.ts on the API

/** A chair: its width runs along the table edge, its depth away from it. */
export const CHAIR_WIDTH = 22;
export const CHAIR_DEPTH = 16;
/** Between the table's edge and the chair. */
export const CHAIR_GAP = 6;
/** Centre-to-centre spacing of neighbouring chairs — a seat's elbow room. */
export const CHAIR_PITCH = 34;
const RECT_DEPTH = 56;
const RECT_END_PADDING = 16;
const ROUND_MIN_RADIUS = 28;

/** From six seats up a rectangular table puts one chair at each end. */
const endChairs = (seats: number) => (seats >= 6 ? 2 : 0);

export const clampSeats = (seats: number) =>
  Math.min(MAX_SEATS, Math.max(MIN_SEATS, Math.round(Number.isFinite(seats) ? seats : MIN_SEATS)));

/** Chairs on the top and bottom edges of a rectangular table. */
function longSides(seats: number): { top: number; bottom: number } {
  const along = seats - endChairs(seats);
  return { top: Math.ceil(along / 2), bottom: Math.floor(along / 2) };
}

/**
 * How many chair-pitches long a rectangular table is. The running maximum over
 * every smaller seat count, because the end chairs arrive at six and take two
 * seats off the long sides: without this, adding a sixth chair would make the
 * table SHORTER than it was at five, which reads as a drawing bug.
 */
function rectLength(seats: number): number {
  let length = 1;
  for (let k = 1; k <= seats; k += 1) length = Math.max(length, longSides(k).top);
  return length;
}

/** Radius of a round table big enough for its chairs not to overlap. */
function roundRadius(seats: number): number {
  // The chairs' centres sit on a ring; the ring's circumference must give each
  // chair a full pitch.
  const ring = (seats * CHAIR_PITCH) / (2 * Math.PI);
  return Math.max(ROUND_MIN_RADIUS, Math.ceil(ring - CHAIR_GAP - CHAIR_DEPTH / 2));
}

/** The tabletop's size, before rotation. */
export function tableSize(shape: TableShape | string, rawSeats: number): { width: number; height: number } {
  const seats = clampSeats(rawSeats);
  if (shape === 'ROUND') {
    const d = roundRadius(seats) * 2;
    return { width: d, height: d };
  }
  return { width: rectLength(seats) * CHAIR_PITCH + RECT_END_PADDING, height: RECT_DEPTH };
}

/**
 * Where each chair stands, relative to the table's centre, before rotation.
 * `angle` turns the chair so its back faces away from the table: 0 is a chair
 * above the table, 180 below, 90 to the right, 270 to the left.
 *
 * Always exactly `seats` chairs — the test suite holds that for every count.
 */
export function chairsFor(shape: TableShape | string, rawSeats: number): Chair[] {
  const seats = clampSeats(rawSeats);
  const { width, height } = tableSize(shape, seats);
  const offset = CHAIR_GAP + CHAIR_DEPTH / 2;

  if (shape === 'ROUND') {
    const ring = width / 2 + offset;
    return Array.from({ length: seats }, (_, i) => {
      const angle = (360 / seats) * i;
      const rad = (angle * Math.PI) / 180;
      return { x: round2(ring * Math.sin(rad)), y: round2(-ring * Math.cos(rad)), angle };
    });
  }

  const { top, bottom } = longSides(seats);
  // Spread evenly along the table's length rather than packed at a fixed pitch,
  // so a table that is longer than its chairs strictly need (see rectLength)
  // does not seat everyone in the middle of it.
  const row = (count: number, y: number, angle: number): Chair[] =>
    Array.from({ length: count }, (_, i) => ({ x: round2((i + 0.5) * (width / count) - width / 2), y, angle }));
  const chairs = [
    ...row(top, -(height / 2 + offset), 0),
    ...row(bottom, height / 2 + offset, 180),
  ];
  if (endChairs(seats)) {
    chairs.push({ x: -(width / 2 + offset), y: 0, angle: 270 }, { x: width / 2 + offset, y: 0, angle: 90 });
  }
  return chairs;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Half the width and height of the box a table occupies ON THE MAP — tabletop
 * plus chairs, after rotation. Used for keeping tables inside their area and
 * off each other.
 */
export function tableHalfExtents(table: Pick<MapTable, 'shape' | 'seats' | 'rotation'>): { hx: number; hy: number } {
  const { width, height } = tableSize(table.shape, table.seats);
  const reach = CHAIR_GAP + CHAIR_DEPTH;
  const seats = clampSeats(table.seats);
  const fw = table.shape === 'ROUND' ? width + 2 * reach : width + (endChairs(seats) ? 2 * reach : 0);
  const fh = table.shape === 'ROUND' ? height + 2 * reach : height + 2 * reach;
  const rad = ((table.rotation % 360) * Math.PI) / 180;
  // Rounded, because cos(90°) is 6e-17 rather than 0 and the ceil below would
  // then grow a table turned upright by a unit.
  const c = Math.abs(Math.round(Math.cos(rad) * 1e6) / 1e6);
  const s = Math.abs(Math.round(Math.sin(rad) * 1e6) / 1e6);
  return { hx: Math.ceil((c * fw + s * fh) / 2), hy: Math.ceil((s * fw + c * fh) / 2) };
}

export const nextRotation = (rotation: number) => (((rotation + 45) % 360) + 360) % 360;

// ── Areas ───────────────────────────────────────────────────────────────────

/** The strip across the top of an area that carries its name. Tables stay below it. */
export const AREA_HEADER = 44;
export const AREA_PADDING = 12;
export const MIN_AREA = { width: 240, height: 180 };
const DEFAULT_AREA: Record<AreaKind, { width: number; height: number }> = {
  HALL: { width: 720, height: 480 },
  OUTDOOR: { width: 720, height: 360 },
};
/** Space between auto-placed areas and around the map's edge. */
export const MAP_GAP = 40;
/** Auto-placement wraps to a new row past this width. */
export const MAP_WRAP_WIDTH = 2400;
const MIN_WORLD = { width: 1200, height: 700 };

export const isPlaced = (a: Pick<MapArea, 'mapX' | 'mapY' | 'mapWidth' | 'mapHeight'>) =>
  a.mapX != null && a.mapY != null && a.mapWidth != null && a.mapHeight != null;

/** The smallest an area may be while still holding every table standing in it. */
export function minAreaSize(tables: MapTable[]): { width: number; height: number } {
  let width = MIN_AREA.width;
  let height = MIN_AREA.height;
  for (const t of tables) {
    const { hx, hy } = tableHalfExtents(t);
    width = Math.max(width, Math.ceil(t.x + hx + AREA_PADDING));
    height = Math.max(height, Math.ceil(t.y + hy + AREA_PADDING));
  }
  return { width, height };
}

/**
 * Every area's rectangle: the stored one where it has been placed, otherwise a
 * spot found for it.
 *
 * Unplaced areas are every hall that existed before the map did, and every
 * hall created from the Halls page since. They go in a row-wrapping grid BELOW
 * everything already placed, in the order given, so placing them never
 * overlaps a room somebody positioned by hand.
 */
export function resolveLayouts(areas: MapArea[], tables: MapTable[]): Map<string, AreaLayout> {
  const out = new Map<string, AreaLayout>();
  let top = MAP_GAP;
  for (const a of areas) {
    if (!isPlaced(a)) continue;
    const layout = { mapX: a.mapX!, mapY: a.mapY!, mapWidth: a.mapWidth!, mapHeight: a.mapHeight! };
    out.set(a.id, layout);
    top = Math.max(top, layout.mapY + layout.mapHeight + MAP_GAP);
  }

  let x = MAP_GAP;
  let y = top;
  let rowHeight = 0;
  for (const a of areas) {
    if (isPlaced(a)) continue;
    const base = DEFAULT_AREA[a.kind === 'OUTDOOR' ? 'OUTDOOR' : 'HALL'];
    const fit = minAreaSize(tables.filter((t) => t.hallId === a.id));
    const width = Math.max(base.width, fit.width);
    const height = Math.max(base.height, fit.height);
    if (x > MAP_GAP && x + width > MAP_WRAP_WIDTH) {
      x = MAP_GAP;
      y += rowHeight + MAP_GAP;
      rowHeight = 0;
    }
    out.set(a.id, { mapX: x, mapY: y, mapWidth: width, mapHeight: height });
    x += width + MAP_GAP;
    rowHeight = Math.max(rowHeight, height);
  }
  return out;
}

/** Where a NEW area goes: exactly where the auto-placement would put it. */
export function placeNewArea(areas: MapArea[], tables: MapTable[], kind: AreaKind): AreaLayout {
  const probe: MapArea = {
    id: ' new', name: '', kind, capacity: 0, isActive: true, mapX: null, mapY: null, mapWidth: null, mapHeight: null,
  };
  // Pin every existing area first, so the new one lands after all of them
  // rather than in the unplaced grid alongside them.
  const pinned = [...resolveLayouts(areas, tables)].map(([id, l]) => ({ ...probe, id, ...l }));
  return resolveLayouts([...pinned, probe], tables).get(probe.id)!;
}

/** The size of the drawing: everything on it, plus a margin, never smaller than a floor. */
export function worldSize(layouts: Iterable<AreaLayout>): { width: number; height: number } {
  let width = MIN_WORLD.width;
  let height = MIN_WORLD.height;
  for (const l of layouts) {
    width = Math.max(width, l.mapX + l.mapWidth + MAP_GAP);
    height = Math.max(height, l.mapY + l.mapHeight + MAP_GAP);
  }
  return { width, height };
}

/** The area under a point on the map. Later areas are drawn on top, so they win. */
export function areaAt(point: { x: number; y: number }, layouts: Map<string, AreaLayout>): string | null {
  let hit: string | null = null;
  for (const [id, l] of layouts) {
    if (point.x >= l.mapX && point.x <= l.mapX + l.mapWidth && point.y >= l.mapY && point.y <= l.mapY + l.mapHeight) hit = id;
  }
  return hit;
}

// ── Tables in an area ───────────────────────────────────────────────────────

/** A table centre moved as far as needed to keep the whole table inside its area, below the header. */
export function clampTable(
  pos: { x: number; y: number },
  table: Pick<MapTable, 'shape' | 'seats' | 'rotation'>,
  area: { width: number; height: number },
): { x: number; y: number } {
  const { hx, hy } = tableHalfExtents(table);
  const clampAxis = (v: number, lo: number, hi: number) => (hi < lo ? Math.round((lo + hi) / 2) : Math.round(Math.min(hi, Math.max(lo, v))));
  return {
    x: clampAxis(pos.x, hx + AREA_PADDING, area.width - hx - AREA_PADDING),
    y: clampAxis(pos.y, AREA_HEADER + hy, area.height - hy - AREA_PADDING),
  };
}

const overlaps = (
  a: { x: number; y: number; hx: number; hy: number },
  b: { x: number; y: number; hx: number; hy: number },
  margin: number,
) => Math.abs(a.x - b.x) < a.hx + b.hx + margin && Math.abs(a.y - b.y) < a.hy + b.hy + margin;

/**
 * The first spot, reading left to right and top to bottom, where a new table
 * fits inside the area without touching another. Null when the area is full —
 * the caller decides what to do then, rather than this silently stacking
 * tables on top of each other.
 */
export function freeSpot(
  table: Pick<MapTable, 'shape' | 'seats' | 'rotation'>,
  area: { width: number; height: number },
  others: MapTable[],
): { x: number; y: number } | null {
  const { hx, hy } = tableHalfExtents(table);
  const boxes = others.map((o) => ({ x: o.x, y: o.y, ...tableHalfExtents(o) }));
  const STEP = 10;
  const MARGIN = 12;
  for (let y = AREA_HEADER + hy; y <= area.height - hy - AREA_PADDING; y += STEP) {
    for (let x = hx + AREA_PADDING; x <= area.width - hx - AREA_PADDING; x += STEP) {
      if (!boxes.some((b) => overlaps({ x, y, hx, hy }, b, MARGIN))) return { x, y };
    }
  }
  return null;
}

/**
 * Tables whose footprints — chairs included — overlap another table in the
 * same area.
 *
 * Shown, not prevented. A drop could be refused, but adding a seat grows a
 * table into its neighbour just as surely, and "you may not add a chair" is not
 * a rule anyone wants. So the map marks the clash and leaves the fix to the
 * person who can see the room.
 */
export function overlappingTables(tables: MapTable[]): Set<string> {
  const out = new Set<string>();
  const boxes = tables.map((t) => ({ t, ...tableHalfExtents(t) }));
  for (let i = 0; i < boxes.length; i += 1) {
    for (let j = i + 1; j < boxes.length; j += 1) {
      const a = boxes[i]; const b = boxes[j];
      if (a.t.hallId !== b.t.hallId) continue;
      if (overlaps({ x: a.t.x, y: a.t.y, hx: a.hx, hy: a.hy }, { x: b.t.x, y: b.t.y, hx: b.hx, hy: b.hy }, 0)) {
        out.add(a.t.id);
        out.add(b.t.id);
      }
    }
  }
  return out;
}

/**
 * The next table number in an area: the smallest positive whole number not
 * already used. Fills a gap left by a deleted table before counting upwards,
 * because a room numbered 1, 2, 4, 5 invites somebody to look for table 3.
 */
export function nextTableLabel(labels: string[]): string {
  const used = new Set(labels.map((l) => l.trim().toLowerCase()));
  let n = 1;
  while (used.has(String(n))) n += 1;
  return String(n);
}

/** Seats already set out in an area — shown beside its name. */
export function seatsIn(tables: MapTable[]): number {
  return tables.reduce((sum, t) => sum + clampSeats(t.seats), 0);
}
