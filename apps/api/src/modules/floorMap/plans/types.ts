import type { MapFeature } from '../floorMap.features.js';
import type { AreaKind, TableShape } from '../floorMap.repository.js';

/** One table in a ready-made plan: a FloorTable row without its hall. */
export type PlanTable = {
  label: string;
  seats: number;
  shape: TableShape;
  x: number;
  y: number;
  rotation: number;
  width: number | null;
  height: number | null;
};

/**
 * A ready-made venue plan: the drawing and the tables, loaded into one
 * restaurant's area by `npm run import:floor-plan` (src/scripts). A plan is
 * code because it is redrawn once, by hand, from the restaurant's own sheet;
 * after loading it is ordinary data the supervisor edits on the map.
 */
export type FloorPlan = {
  id: string;
  /** The area's default name — the script can override it. */
  name: string;
  kind: AreaKind;
  mapWidth: number;
  mapHeight: number;
  features: MapFeature[];
  tables: PlanTable[];
};
