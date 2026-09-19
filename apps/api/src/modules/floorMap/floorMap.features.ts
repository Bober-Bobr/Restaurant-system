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

const coord = z.number().int().min(-5000).max(20000);
const extent = z.number().int().min(1).max(20000);

const common = {
  kind: z.enum(FEATURE_KINDS),
  label: z.string().trim().min(1).max(60).optional(),
  // Where the label goes, when the shape's centre is the wrong place for it.
  labelAt: z.tuple([coord, coord]).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
};

export const mapFeatureSchema = z.discriminatedUnion('shape', [
  z.object({ ...common, shape: z.literal('rect'), x: coord, y: coord, width: extent, height: extent }),
  // An ellipse is given by its bounding box, like a rect.
  z.object({ ...common, shape: z.literal('ellipse'), x: coord, y: coord, width: extent, height: extent }),
  z.object({ ...common, shape: z.literal('polygon'), points: z.array(z.tuple([coord, coord])).min(3).max(64) }),
  // A label with no shape of its own ("Центр сцена" names a spot, not a region).
  z.object({ ...common, shape: z.literal('point'), x: coord, y: coord }),
]);

export const mapFeaturesSchema = z.array(mapFeatureSchema).max(200);

export type MapFeature = z.infer<typeof mapFeatureSchema>;
