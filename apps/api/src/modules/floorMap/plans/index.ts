import { sangizarStreet } from './sangizarStreet.js';
import type { FloorPlan } from './types.js';

export type { FloorPlan, PlanTable } from './types.js';

/** Every ready-made plan, by id. The import script takes one of these ids. */
export const FLOOR_PLANS: Record<string, FloorPlan> = {
  [sangizarStreet.id]: sangizarStreet,
};
