import { describe, expect, it } from 'vitest';
import { FLOOR_PLANS } from '../../../api/src/modules/floorMap/plans/index';
import {
  AREA_PADDING, featuresOf, hitsBlockingFeature, overlappingTables, tableHalfExtents, type MapTable,
} from './floorMap';

/**
 * The ready-made venue plans (apps/api/src/modules/floorMap/plans), checked
 * with the geometry the MAP draws them with — which is why this lives in the
 * web suite, reading the API's file, the same arrangement as the slug and
 * invoice agreements.
 *
 * A plan is redrawn by hand from a restaurant's paper sheet, where squares
 * touch and nobody measures. Loaded as-is, a plan with two tables' chairs
 * through each other opens as a map full of red warnings on its first day, so
 * every plan has to arrive clean.
 */
for (const plan of Object.values(FLOOR_PLANS)) {
  describe(`the ${plan.id} plan`, () => {
    const tables: MapTable[] = plan.tables.map((t, i) => ({ ...t, id: `t${i}`, hallId: 'plan' }));
    const features = featuresOf({ mapFeatures: plan.features });

    it('has no two tables whose chairs collide', () => {
      const clash = [...overlappingTables(tables)].map((id) => tables.find((t) => t.id === id)!.label);
      expect(clash, `overlapping: ${clash.join(', ')}`).toEqual([]);
    });

    it('draws every table wholly on the map, chairs included', () => {
      for (const t of tables) {
        const { hx, hy } = tableHalfExtents(t);
        expect(t.x - hx, `table ${t.label}`).toBeGreaterThanOrEqual(AREA_PADDING);
        expect(t.y - hy, `table ${t.label}`).toBeGreaterThanOrEqual(AREA_PADDING);
        expect(t.x + hx, `table ${t.label}`).toBeLessThanOrEqual(plan.mapWidth - AREA_PADDING);
        expect(t.y + hy, `table ${t.label}`).toBeLessThanOrEqual(plan.mapHeight - AREA_PADDING);
      }
    });

    it('seats nobody in the pool or on the stage', () => {
      for (const t of tables) {
        expect(hitsBlockingFeature({ x: t.x, y: t.y, ...tableHalfExtents(t) }, features), `table ${t.label}`).toBe(false);
      }
    });

    it('keeps every feature it declares', () => {
      // featuresOf drops anything malformed; a plan must not lose a zone to it.
      expect(features).toHaveLength(plan.features.length);
    });
  });
}
