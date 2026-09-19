import { z } from 'zod';
import { mapFeaturesSchema } from './floorMap.features.js';

/**
 * Bounds are generous rather than tight: they exist so a bad client cannot
 * store a table at x = 2^31 and break the map for everybody, not to encode the
 * layout rules. Those live on the web (floorMap.ts), where the map is drawn.
 */
const coord = z.number().int().min(0).max(20000);
const extent = z.number().int().min(80).max(20000);

export const MAX_SEATS = 40;

export const areaKindSchema = z.enum(['HALL', 'OUTDOOR']);

/** The size of an area's own map. */
export const areaSizeSchema = z.object({
  mapWidth: extent,
  mapHeight: extent,
});

export const createAreaSchema = areaSizeSchema.extend({
  name: z.string().trim().min(1).max(100),
  kind: areaKindSchema,
  capacity: z.number().int().positive().max(5000),
});

export const updateAreaSchema = areaSizeSchema.partial().extend({
  name: z.string().trim().min(1).max(100).optional(),
  kind: areaKindSchema.optional(),
  // The drawing under the tables. Validated shape by shape, since it is
  // rendered straight into the page.
  mapFeatures: mapFeaturesSchema.optional(),
});

/** Null = sized from the seat count; a number = resized by hand. */
const tableExtent = z.number().int().min(30).max(2000).nullable();

export const createTableSchema = z.object({
  hallId: z.string().cuid(),
  label: z.string().trim().min(1).max(20),
  seats: z.number().int().min(1).max(MAX_SEATS),
  shape: z.enum(['RECT', 'ROUND']),
  x: coord,
  y: coord,
  rotation: z.number().int().min(0).max(359).default(0),
  width: tableExtent.optional(),
  height: tableExtent.optional(),
});

export const updateTableSchema = createTableSchema.partial().extend({
  // No default on update: an absent rotation means "leave it", not "reset to 0".
  rotation: z.number().int().min(0).max(359).optional(),
});

export const idSchema = z.object({ id: z.string().cuid() });
