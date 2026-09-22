import { z } from 'zod';
import { mapFeaturesSchema } from './floorMap.features.js';
import type { AreaRow, TableRow } from './floorMap.repository.js';

/**
 * An area's SAVED DEFAULT layout — how the room is meant to stand.
 *
 * A hall is rearranged for an evening: tables pushed together for a party of
 * twelve, a row moved off the dance floor. Putting it back afterwards used to
 * mean dragging every table by hand. `snapshotOf` takes the room as it stands
 * now; restoring lays it out again exactly so.
 *
 * Three things are in a snapshot, because all three are "how the room stands":
 * the tables, the size of the area's own map, and the drawing under them (the
 * pool, the stage, the zones). It is stored as ONE JSON column on the hall
 * (`Hall.defaultLayout`) since it is restored as a unit — a half-applied
 * layout is not a layout — and because a layout is not something anything
 * queries across rooms.
 *
 * **A snapshot holds no table ids.** Restoring makes fresh rows rather than
 * resurrecting the old ones: an id in the snapshot may by then belong to a
 * table the supervisor MOVED to another area, and honouring it would have one
 * room's restore reach into another. Nothing refers to a `FloorTable` by id
 * except the map itself, which reloads after a restore.
 *
 * It is validated on the way back in even though the API is what wrote it: the
 * column is JSON in a database people reach with psql, and a bad row must be a
 * refusal ("no usable default"), never a broken map.
 */

const coord = z.number().int().min(0).max(20000);
const extent = z.number().int().min(80).max(20000);
const tableExtent = z.number().int().min(30).max(2000).nullable();

/** A table as a layout remembers it: everything but its id and its hall. */
const layoutTableSchema = z.object({
  label: z.string().trim().min(1).max(20),
  seats: z.number().int().min(1).max(40),
  shape: z.enum(['RECT', 'ROUND']),
  x: coord,
  y: coord,
  rotation: z.number().int().min(0).max(359),
  width: tableExtent,
  height: tableExtent,
});

export const layoutSchema = z.object({
  // Present so a later shape can be told from this one rather than guessed at.
  version: z.literal(1),
  // Null where the area had no size of its own: the map picks one from the
  // kind and the tables, and a restore must not invent a number it never had.
  mapWidth: extent.nullable(),
  mapHeight: extent.nullable(),
  mapFeatures: mapFeaturesSchema,
  // An area of 73 tables is a real one (Sangizar's "Street"); the cap is only
  // so a snapshot cannot grow without bound.
  tables: z.array(layoutTableSchema).max(500),
});

export type Layout = z.infer<typeof layoutSchema>;
export type LayoutTable = z.infer<typeof layoutTableSchema>;

/** The area as it stands now, ready to be stored as its default. */
export function snapshotOf(area: AreaRow, tables: TableRow[]): Layout {
  return {
    version: 1,
    mapWidth: area.mapWidth,
    mapHeight: area.mapHeight,
    mapFeatures: mapFeaturesSchema.parse(Array.isArray(area.mapFeatures) ? area.mapFeatures : []),
    tables: tables.map((t) => ({
      label: t.label,
      seats: t.seats,
      shape: t.shape === 'ROUND' ? 'ROUND' : 'RECT',
      x: t.x,
      y: t.y,
      rotation: t.rotation,
      width: t.width,
      height: t.height,
    })),
  };
}

/** A stored layout, or null when there is none or the stored one is unusable. */
export function readLayout(stored: unknown): Layout | null {
  if (stored == null) return null;
  const parsed = layoutSchema.safeParse(stored);
  return parsed.success ? parsed.data : null;
}
