import { z } from 'zod';

/**
 * The drawing under a floor map's tables — zones, the pool, the stage, paths
 * and labels — stored on `Hall.mapFeatures`.
 *
 * It is data rather than code because a plan belongs to one restaurant's venue:
 * Sangizar's "Street" is the first, and the next venue should need a row, not
 * a release. The web copy of these types is in apps/web/src/utils/floorMap.ts.
 *
 * `kind` says what a feature IS, which decides how it is drawn and whether a
 * table may stand on it: nobody seats guests in the pool or on the stage
 * (`BLOCKING_KINDS`). A zone is only a coloured region with a name — tables
 * stand in zones all the time.
 */
export const FEATURE_KINDS = ['zone', 'water', 'stage', 'path', 'label'] as const;
export type FeatureKind = (typeof FEATURE_KINDS)[number];

export const BLOCKING_KINDS: readonly FeatureKind[] = ['water', 'stage'];

/**
 * The bounds, as numbers rather than only as zod.
 *
 * There is a drawing EDITOR on the map now, so these are no longer only a
 * guard against a bad client — they are what the editor has to stop at. A
 * supervisor who drags a zone past a bound and loses the whole drawing to a
 * 400 is a worse outcome than a bound that cannot be reached, so the web
 * mirrors this object (`utils/floorFeatures.ts`) and `floorFeatures.test.ts`
 * imports both. The schema below is BUILT from it, so the numbers the editor
 * clamps to cannot drift from the numbers the server refuses at.
 *
 * Coordinates may be NEGATIVE on purpose: Sangizar's stage sits at y = −180,
 * half off the top of the plan, and the drawing is clipped to the map when it
 * is drawn rather than being confined to it.
 */
export const FEATURE_LIMITS = {
  maxFeatures: 200,
  coordMin: -5000,
  coordMax: 20000,
  extentMin: 1,
  extentMax: 20000,
  labelMax: 60,
  polygonMin: 3,
  polygonMax: 64,
} as const;

/** A colour is written into the page, so it is a six-digit hex and nothing else. */
export const COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;

const coord = z.number().int().min(FEATURE_LIMITS.coordMin).max(FEATURE_LIMITS.coordMax);
const extent = z.number().int().min(FEATURE_LIMITS.extentMin).max(FEATURE_LIMITS.extentMax);

const common = {
  kind: z.enum(FEATURE_KINDS),
  label: z.string().trim().min(1).max(FEATURE_LIMITS.labelMax).optional(),
  // Where the label goes, when the shape's centre is the wrong place for it.
  labelAt: z.tuple([coord, coord]).optional(),
  color: z.string().regex(COLOR_PATTERN).optional(),
};

export const mapFeatureSchema = z.discriminatedUnion('shape', [
  z.object({ ...common, shape: z.literal('rect'), x: coord, y: coord, width: extent, height: extent }),
  // An ellipse is given by its bounding box, like a rect.
  z.object({ ...common, shape: z.literal('ellipse'), x: coord, y: coord, width: extent, height: extent }),
  z.object({
    ...common,
    shape: z.literal('polygon'),
    points: z.array(z.tuple([coord, coord])).min(FEATURE_LIMITS.polygonMin).max(FEATURE_LIMITS.polygonMax),
  }),
  // A label with no shape of its own ("Центр сцена" names a spot, not a region).
  z.object({ ...common, shape: z.literal('point'), x: coord, y: coord }),
]);

export const mapFeaturesSchema = z.array(mapFeatureSchema).max(FEATURE_LIMITS.maxFeatures);

export type MapFeature = z.infer<typeof mapFeatureSchema>;
