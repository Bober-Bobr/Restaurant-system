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

/**
 * A day, as `YYYY-MM-DD`. The unit of occupancy — a booking holds its tables
 * for the whole day it falls on (see utils/floorBooking.ts) — and a plain
 * string rather than a datetime so a caller cannot ask about "half of
 * Tuesday" and be quietly given all of it.
 */
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected a date as YYYY-MM-DD');

export const daySchema = z.object({ date: day.optional() });

/**
 * A stretch of days for the schedule. Bounded at roughly two years so one
 * request cannot ask the database for every booking a restaurant has ever
 * taken; the page asks a month at a time.
 */
export const scheduleSchema = z.object({ from: day, to: day }).refine(
  (v) => v.from <= v.to && (Date.parse(v.to) - Date.parse(v.from)) <= 750 * 24 * 60 * 60 * 1000,
  { message: 'Ask for a range of up to about two years, earliest day first' },
);
