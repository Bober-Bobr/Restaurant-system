/**
 * The floor map's geometry — the pure half of FloorMapPage.
 *
 * Everything is in MAP UNITS, which the SVG scales to the screen, so a phone
 * and a wall display show the same plan. Each area (a hall or an outdoor venue)
 * has a map of its OWN — the page switches between them — and a table's
 * position is its CENTRE within its area's map.
 *
 * A table's size comes one of two ways. Left alone, it FOLLOWS FROM ITS SEATS:
 * add a chair and the table grows to make room for it. Resized by hand, it
 * keeps the size it was given and the chairs spread round it — but it can
 * never be made too small for its chairs (`fitTableSize`), which is what keeps
 * the chairs drawn along the sides honest.
 */

export type AreaKind = 'HALL' | 'OUTDOOR';
export type TableShape = 'RECT' | 'ROUND';


/** The size of an area's own map. */
export type AreaSize = { mapWidth: number; mapHeight: number };

/**
 * The drawing under an area's tables — mirrors floorMap.features.ts on the API,
 * which validates it. `water` and `stage` are where nobody is seated.
 */
export type FeatureKind = 'zone' | 'water' | 'stage' | 'path' | 'label';
type FeatureCommon = { kind: FeatureKind; label?: string; labelAt?: [number, number]; color?: string };
export type MapFeature = FeatureCommon & (
  | { shape: 'rect' | 'ellipse'; x: number; y: number; width: number; height: number }
  | { shape: 'polygon'; points: [number, number][] }
  | { shape: 'point'; x: number; y: number }
);

export type MapArea = {
  id: string;
  name: string;
  kind: AreaKind | string;
  capacity: number;
  isActive: boolean;
  mapWidth: number | null;
  mapHeight: number | null;
  mapFeatures?: MapFeature[] | null;
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
  /** Null = sized from the seats; set = resized by hand. */
  width?: number | null;
  height?: number | null;
};

/** What decides a table's footprint. */
export type TableGeometry = Pick<MapTable, 'shape' | 'seats' | 'rotation' | 'width' | 'height'>;

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

/** Smallest and largest a table may be resized to (mirrors the API's bounds). */
export const MIN_TABLE = 30;
export const MAX_TABLE = 2000;

type ExplicitSize = { width?: number | null; height?: number | null } | null | undefined;

const isExplicit = (size: ExplicitSize): size is { width: number; height: number } =>
  size != null && size.width != null && size.height != null;

/**
 * The tabletop's size, before rotation: the size it was given, or the one its
 * seats call for. A round table is always a circle — the larger side wins.
 */
export function tableSize(shape: TableShape | string, rawSeats: number, size?: ExplicitSize): { width: number; height: number } {
  const seats = clampSeats(rawSeats);
  if (isExplicit(size)) {
    if (shape === 'ROUND') {
      const d = Math.max(size.width, size.height);
      return { width: d, height: d };
    }
    return { width: size.width, height: size.height };
  }
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
export function chairsFor(shape: TableShape | string, rawSeats: number, size?: ExplicitSize): Chair[] {
  const seats = clampSeats(rawSeats);
  const { width, height } = tableSize(shape, seats, size);
  const offset = CHAIR_GAP + CHAIR_DEPTH / 2;

  if (shape !== 'ROUND' && isExplicit(size)) return rectChairs(seats, width, height);

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

/** How many chairs a side of this length seats, each with a full pitch. */
const sideCapacity = (length: number) => Math.max(0, Math.floor(length / CHAIR_PITCH));

/**
 * Chairs per side of a resized rectangular table: the two LONGER sides first,
 * alternately, then the two ends — which is how a table is laid in a room, and
 * what makes a slight resize of an automatic table keep its chairs where they
 * were rather than jumping one onto each end.
 *
 * Past the table's capacity (only from data written round the map; the map's
 * own resizing never allows it) the remainder goes round all four sides, so
 * the count drawn is still the count stored.
 */
export function rectSideCounts(seats: number, width: number, height: number): { top: number; bottom: number; left: number; right: number } {
  const counts = { top: 0, bottom: 0, left: 0, right: 0 };
  const longPair: (keyof typeof counts)[] = width >= height ? ['top', 'bottom'] : ['left', 'right'];
  const endPair: (keyof typeof counts)[] = width >= height ? ['left', 'right'] : ['top', 'bottom'];
  const cap = (side: keyof typeof counts) => sideCapacity(side === 'top' || side === 'bottom' ? width : height);
  let left = seats;
  for (const pair of [longPair, endPair]) {
    let placed = true;
    while (left > 0 && placed) {
      placed = false;
      for (const side of pair) {
        if (left > 0 && counts[side] < cap(side)) { counts[side] += 1; left -= 1; placed = true; }
      }
    }
  }
  const all = [...longPair, ...endPair];
  for (let i = 0; left > 0; i += 1, left -= 1) counts[all[i % 4]] += 1;
  return counts;
}

function rectChairs(seats: number, width: number, height: number): Chair[] {
  const offset = CHAIR_GAP + CHAIR_DEPTH / 2;
  const { top, bottom, left, right } = rectSideCounts(seats, width, height);
  const along = (count: number, length: number) =>
    Array.from({ length: count }, (_, i) => round2((i + 0.5) * (length / count) - length / 2));
  return [
    ...along(top, width).map((x) => ({ x, y: -(height / 2 + offset), angle: 0 })),
    ...along(bottom, width).map((x) => ({ x, y: height / 2 + offset, angle: 180 })),
    ...along(left, height).map((y) => ({ x: -(width / 2 + offset), y, angle: 270 })),
    ...along(right, height).map((y) => ({ x: width / 2 + offset, y, angle: 90 })),
  ];
}

/** How many chairs a table of this size seats without any two touching. */
export function seatCapacity(shape: TableShape | string, width: number, height: number): number {
  if (shape === 'ROUND') {
    const ring = Math.max(width, height) / 2 + CHAIR_GAP + CHAIR_DEPTH / 2;
    return Math.floor((2 * Math.PI * ring) / CHAIR_PITCH);
  }
  return 2 * sideCapacity(width) + 2 * sideCapacity(height);
}

/**
 * A size asked for — by a resize handle, or by adding a seat to a resized
 * table — made legal: within MIN/MAX_TABLE, and big enough for its chairs. A
 * table too small for its seats grows along its longer side, a chair's pitch
 * at a time; a round one grows its diameter.
 */
export function fitTableSize(shape: TableShape | string, rawSeats: number, width: number, height: number): { width: number; height: number } {
  const seats = clampSeats(rawSeats);
  const clamp = (v: number) => Math.round(Math.min(MAX_TABLE, Math.max(MIN_TABLE, Number.isFinite(v) ? v : MIN_TABLE)));
  let w = clamp(width);
  let h = clamp(height);
  if (shape === 'ROUND') {
    let d = Math.max(w, h);
    while (seatCapacity('ROUND', d, d) < seats && d < MAX_TABLE) d = Math.min(MAX_TABLE, d + 2);
    return { width: d, height: d };
  }
  while (seatCapacity('RECT', w, h) < seats && (w < MAX_TABLE || h < MAX_TABLE)) {
    if ((w >= h && w < MAX_TABLE) || h >= MAX_TABLE) w = Math.min(MAX_TABLE, w + CHAIR_PITCH);
    else h = Math.min(MAX_TABLE, h + CHAIR_PITCH);
  }
  return { width: w, height: h };
}

/**
 * Half the width and height of the box a table occupies ON THE MAP — tabletop
 * plus chairs, after rotation. Used for keeping tables inside their area and
 * off each other.
 */
export function tableHalfExtents(table: Pick<TableGeometry, 'shape' | 'seats' | 'rotation'> & Partial<TableGeometry>): { hx: number; hy: number } {
  const { ax, ay } = footprintHalf(table);
  const rad = ((table.rotation % 360) * Math.PI) / 180;
  // Rounded, because cos(90°) is 6e-17 rather than 0 and the ceil below would
  // then grow a table turned upright by a unit.
  const c = Math.abs(Math.round(Math.cos(rad) * 1e6) / 1e6);
  const s = Math.abs(Math.round(Math.sin(rad) * 1e6) / 1e6);
  return { hx: Math.ceil(c * ax + s * ay), hy: Math.ceil(s * ax + c * ay) };
}

/**
 * Half the footprint — tabletop plus chairs — in the table's OWN axes, before
 * it is turned. `tableHalfExtents` is the upright box round it; the overlap
 * test uses this directly, because the upright box of a table turned 60° is far
 * wider than the table.
 */
export function footprintHalf(table: Pick<TableGeometry, 'shape' | 'seats'> & Partial<TableGeometry>): { ax: number; ay: number } {
  const { width, height } = tableSize(table.shape, table.seats, table);
  const reach = CHAIR_GAP + CHAIR_DEPTH;
  const seats = clampSeats(table.seats);
  let fw: number;
  let fh: number;
  if (table.shape === 'ROUND') {
    fw = width + 2 * reach;
    fh = height + 2 * reach;
  } else if (isExplicit(table)) {
    // Kept symmetric about the centre: a side with a chair reaches out on both.
    const c = rectSideCounts(seats, width, height);
    fw = width + (c.left || c.right ? 2 * reach : 0);
    fh = height + (c.top || c.bottom ? 2 * reach : 0);
  } else {
    fw = width + (endChairs(seats) ? 2 * reach : 0);
    fh = height + 2 * reach;
  }
  return { ax: fw / 2, ay: fh / 2 };
}

/**
 * Whether two tables' footprints overlap, exactly, however each is turned — the
 * separating-axis test on two rectangles. A round table is its footprint's
 * square, which is what its chairs sweep anyway.
 */
export function footprintsOverlap(a: MapTable, b: MapTable): boolean {
  const boxOf = (t: MapTable) => {
    const { ax, ay } = footprintHalf(t);
    const rad = (((t.shape === 'ROUND' ? 0 : t.rotation) % 360) * Math.PI) / 180;
    return { cx: t.x, cy: t.y, ax, ay, u: [Math.cos(rad), Math.sin(rad)], v: [-Math.sin(rad), Math.cos(rad)] };
  };
  const A = boxOf(a);
  const B = boxOf(b);
  const d = [B.cx - A.cx, B.cy - A.cy];
  const dot = (p: number[], q: number[]) => p[0] * q[0] + p[1] * q[1];
  // 1e-6: two tables exactly edge to edge touch, they do not overlap.
  return [A.u, A.v, B.u, B.v].every((n) => {
    const ra = A.ax * Math.abs(dot(A.u, n)) + A.ay * Math.abs(dot(A.v, n));
    const rb = B.ax * Math.abs(dot(B.u, n)) + B.ay * Math.abs(dot(B.v, n));
    return Math.abs(dot(d, n)) < ra + rb - 1e-6;
  });
}

export const nextRotation = (rotation: number) => (((rotation + 45) % 360) + 360) % 360;

// ── Areas ───────────────────────────────────────────────────────────────────

export const AREA_PADDING = 12;
export const MIN_AREA = { width: 400, height: 300 };
/** A new area's map before anybody sizes it. An outdoor venue is usually the bigger. */
export const DEFAULT_AREA: Record<AreaKind, { width: number; height: number }> = {
  HALL: { width: 1200, height: 800 },
  OUTDOOR: { width: 1600, height: 1000 },
};

export const defaultAreaSize = (kind: AreaKind | string) => DEFAULT_AREA[kind === 'OUTDOOR' ? 'OUTDOOR' : 'HALL'];

/** The smallest an area's map may be while still holding every table standing in it. */
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
 * The size of an area's map: the one stored, or — for every hall made before
 * the map, or on the Halls page since — the default for its kind. Either way
 * never too small for the tables in it, so nothing is ever drawn off the edge.
 */
export function areaSize(area: Pick<MapArea, 'kind' | 'mapWidth' | 'mapHeight'>, tables: MapTable[]): { width: number; height: number } {
  const base = area.mapWidth != null && area.mapHeight != null
    ? { width: area.mapWidth, height: area.mapHeight }
    : defaultAreaSize(area.kind);
  const fit = minAreaSize(tables);
  return { width: Math.max(base.width, fit.width), height: Math.max(base.height, fit.height) };
}

// ── The drawing ─────────────────────────────────────────────────────────────

export const BLOCKING_KINDS: readonly FeatureKind[] = ['water', 'stage'];

/** A feature as the list the page reads: whatever the column holds, only well-formed features survive. */
export function featuresOf(area: Pick<MapArea, 'mapFeatures'>): MapFeature[] {
  const raw = Array.isArray(area.mapFeatures) ? area.mapFeatures : [];
  return raw.filter((f): f is MapFeature => !!f && typeof f === 'object' && typeof (f as MapFeature).shape === 'string');
}

/** Where a feature's name is written. */
export function featureLabelAt(f: MapFeature): [number, number] {
  if (f.labelAt) return f.labelAt;
  if (f.shape === 'polygon') {
    const n = f.points.length || 1;
    return [f.points.reduce((s, p) => s + p[0], 0) / n, f.points.reduce((s, p) => s + p[1], 0) / n];
  }
  if (f.shape === 'point') return [f.x, f.y];
  return [f.x + f.width / 2, f.y + f.height / 2];
}

type Box = { x: number; y: number; hx: number; hy: number };

/**
 * Whether a table's footprint, centred at (x, y), reaches onto a feature where
 * nobody is seated. An ellipse is tested exactly — scaled to a unit circle, the
 * box's nearest point must stay outside it — because its bounding box would
 * wrongly keep tables off the ground round a pool, which is where they go.
 */
export function hitsBlockingFeature(box: Box, features: MapFeature[]): boolean {
  return features.some((f) => {
    if (!BLOCKING_KINDS.includes(f.kind)) return false;
    if (f.shape === 'ellipse') {
      const rx = f.width / 2; const ry = f.height / 2;
      const cx = f.x + rx; const cy = f.y + ry;
      const nx = Math.min(Math.max(cx, box.x - box.hx), box.x + box.hx);
      const ny = Math.min(Math.max(cy, box.y - box.hy), box.y + box.hy);
      return ((nx - cx) / rx) ** 2 + ((ny - cy) / ry) ** 2 < 1;
    }
    let minX: number; let minY: number; let maxX: number; let maxY: number;
    if (f.shape === 'polygon') {
      minX = Math.min(...f.points.map((p) => p[0])); maxX = Math.max(...f.points.map((p) => p[0]));
      minY = Math.min(...f.points.map((p) => p[1])); maxY = Math.max(...f.points.map((p) => p[1]));
    } else if (f.shape === 'rect') {
      minX = f.x; minY = f.y; maxX = f.x + f.width; maxY = f.y + f.height;
    } else {
      return false;
    }
    return box.x + box.hx > minX && box.x - box.hx < maxX && box.y + box.hy > minY && box.y - box.hy < maxY;
  });
}

// ── Tables in an area ───────────────────────────────────────────────────────

/** A table centre moved as far as needed to keep the whole table, chairs included, on its area's map. */
export function clampTable(
  pos: { x: number; y: number },
  table: Pick<TableGeometry, 'shape' | 'seats' | 'rotation'> & Partial<TableGeometry>,
  area: { width: number; height: number },
): { x: number; y: number } {
  const { hx, hy } = tableHalfExtents(table);
  const clampAxis = (v: number, lo: number, hi: number) => (hi < lo ? Math.round((lo + hi) / 2) : Math.round(Math.min(hi, Math.max(lo, v))));
  return {
    x: clampAxis(pos.x, hx + AREA_PADDING, area.width - hx - AREA_PADDING),
    y: clampAxis(pos.y, hy + AREA_PADDING, area.height - hy - AREA_PADDING),
  };
}

const overlaps = (a: Box, b: Box, margin: number) =>
  Math.abs(a.x - b.x) < a.hx + b.hx + margin && Math.abs(a.y - b.y) < a.hy + b.hy + margin;

/**
 * The first spot, reading left to right and top to bottom, where a new table
 * fits on the area's map without touching another table — or the pool, or the
 * stage. Null when there is none: the caller decides what to do then, rather
 * than this silently stacking tables on top of each other.
 */
export function freeSpot(
  table: Pick<TableGeometry, 'shape' | 'seats' | 'rotation'> & Partial<TableGeometry>,
  area: { width: number; height: number },
  others: MapTable[],
  features: MapFeature[] = [],
): { x: number; y: number } | null {
  const { hx, hy } = tableHalfExtents(table);
  const boxes = others.map((o) => ({ x: o.x, y: o.y, ...tableHalfExtents(o) }));
  // A step in proportion to the map, so a venue-sized plan is not 50 000 probes.
  const STEP = Math.max(10, Math.round(Math.max(area.width, area.height) / 160));
  const MARGIN = 12;
  for (let y = hy + AREA_PADDING; y <= area.height - hy - AREA_PADDING; y += STEP) {
    for (let x = hx + AREA_PADDING; x <= area.width - hx - AREA_PADDING; x += STEP) {
      const me = { x, y, hx, hy };
      if (!boxes.some((b) => overlaps(me, b, MARGIN)) && !hitsBlockingFeature(me, features)) return { x, y };
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
  for (let i = 0; i < tables.length; i += 1) {
    for (let j = i + 1; j < tables.length; j += 1) {
      const a = tables[i]; const b = tables[j];
      if (a.hallId !== b.hallId) continue;
      if (footprintsOverlap(a, b)) {
        out.add(a.id);
        out.add(b.id);
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

/** Seats already set out in an area — shown on its tab and in the panel. */
export function seatsIn(tables: MapTable[]): number {
  return tables.reduce((sum, t) => sum + clampSeats(t.seats), 0);
}
