/**
 * A table's FOOTPRINT, server side — the one piece of the map's geometry the
 * printed sheet needs.
 *
 * This is a deliberate second copy of part of apps/web/src/utils/floorMap.ts,
 * for the reason `utils/invoice.ts` and `utils/slug.ts` are: the API cannot
 * import from the web app, and the printed map has to put the tables exactly
 * where the screen does or it is a map of somewhere else.
 * `floorGeometryAgreement.test.ts` imports **both** and runs every seat count
 * and shape through each.
 *
 * **Only the footprint is mirrored — not the chairs.** A printed plan is read
 * across a room at arm's length; what it has to show is where each table
 * stands, how big it is and who has it. Drawing the individual chairs would
 * mean mirroring `chairsFor`, `fitTableSize` and the whole resize rule as
 * well, and each of those is a further copy that can drift. The seat COUNT is
 * printed on the table instead, which is the thing a waiter actually reads.
 */

export const CHAIR_DEPTH = 16;
export const CHAIR_GAP = 6;
export const CHAIR_PITCH = 34;
const RECT_DEPTH = 56;
const RECT_END_PADDING = 16;
const ROUND_MIN_RADIUS = 28;

export const MIN_SEATS = 1;
export const MAX_SEATS = 40;

export const clampSeats = (seats: number) =>
  Math.min(MAX_SEATS, Math.max(MIN_SEATS, Math.round(Number.isFinite(seats) ? seats : MIN_SEATS)));

/** From six seats up a rectangular table puts one chair at each end. */
const endChairs = (seats: number) => (seats >= 6 ? 2 : 0);

function longSides(seats: number): { top: number; bottom: number } {
  const along = seats - endChairs(seats);
  return { top: Math.ceil(along / 2), bottom: Math.floor(along / 2) };
}

/**
 * A running maximum over every smaller seat count, not just this one: the end
 * chairs take two seats off the long sides, so a six-seat table computed on
 * its own comes out SHORTER than a five-seat one.
 */
function rectLength(seats: number): number {
  let length = 1;
  for (let k = 1; k <= seats; k += 1) length = Math.max(length, longSides(k).top);
  return length;
}

function roundRadius(seats: number): number {
  const ring = (seats * CHAIR_PITCH) / (2 * Math.PI);
  return Math.max(ROUND_MIN_RADIUS, Math.ceil(ring - CHAIR_GAP - CHAIR_DEPTH / 2));
}

/** Mirrors DEFAULT_AREA in the web copy — an outdoor venue starts bigger. */
export const DEFAULT_AREA = {
  HALL: { width: 1200, height: 800 },
  OUTDOOR: { width: 1600, height: 1000 },
} as const;

export type ExplicitSize = { width?: number | null; height?: number | null };

const isExplicit = (size?: ExplicitSize): size is { width: number; height: number } =>
  !!size && size.width != null && size.height != null;

/** The table's width and height in map units — its seats', or the one it was given. */
export function tableSize(
  shape: string,
  rawSeats: number,
  size?: ExplicitSize,
): { width: number; height: number } {
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

/** The default size of an area's own map, when it has never been given one. */
export function areaSize(
  area: { kind: string; mapWidth: number | null; mapHeight: number | null },
): { width: number; height: number } {
  if (area.mapWidth != null && area.mapHeight != null) {
    return { width: area.mapWidth, height: area.mapHeight };
  }
  return area.kind === 'OUTDOOR' ? DEFAULT_AREA.OUTDOOR : DEFAULT_AREA.HALL;
}
