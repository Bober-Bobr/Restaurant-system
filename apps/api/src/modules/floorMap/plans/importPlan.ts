import { mapFeaturesSchema } from '../floorMap.features.js';
import { createTableSchema } from '../floorMap.schema.js';
import type { FloorPlan } from './types.js';

/**
 * The testable half of `npm run import:floor-plan` — choosing the restaurant
 * and checking the plan. The script itself only talks to the database.
 */

export type RestaurantCandidate = { id: string; name: string };

export type RestaurantMatch =
  | { ok: true; restaurant: RestaurantCandidate }
  | { ok: false; reason: 'none' | 'ambiguous'; candidates: RestaurantCandidate[] };

const fold = (s: string) => s.trim().toLowerCase();

/**
 * The one restaurant `query` names: an exact id, else an exact name (case
 * folded), else a single name containing it.
 *
 * Never a guess. Loading a plan into the wrong restaurant puts eighty tables on
 * somebody else's map, so two partial matches is a refusal that lists both,
 * and no match lists every restaurant so the right spelling can be copied.
 */
export function matchRestaurant(all: RestaurantCandidate[], query: string): RestaurantMatch {
  const q = fold(query);
  const byId = all.find((r) => r.id === query.trim());
  if (byId) return { ok: true, restaurant: byId };
  const exact = all.filter((r) => fold(r.name) === q);
  if (exact.length === 1) return { ok: true, restaurant: exact[0] };
  if (exact.length > 1) return { ok: false, reason: 'ambiguous', candidates: exact };
  const partial = q ? all.filter((r) => fold(r.name).includes(q)) : [];
  if (partial.length === 1) return { ok: true, restaurant: partial[0] };
  if (partial.length > 1) return { ok: false, reason: 'ambiguous', candidates: partial };
  return { ok: false, reason: 'none', candidates: all };
}

/**
 * Every problem with a plan, as sentences — empty when it may be loaded. The
 * same rules the API applies to a supervisor's own edits, so a plan cannot put
 * into the database what the map itself would refuse.
 */
export function planProblems(plan: FloorPlan): string[] {
  const problems: string[] = [];
  const features = mapFeaturesSchema.safeParse(plan.features);
  if (!features.success) problems.push(`features: ${features.error.issues[0]?.message ?? 'invalid'}`);

  const tableSchema = createTableSchema.omit({ hallId: true });
  const seen = new Set<string>();
  plan.tables.forEach((table, i) => {
    const parsed = tableSchema.safeParse(table);
    if (!parsed.success) problems.push(`table ${i + 1} (${table.label}): ${parsed.error.issues[0]?.message ?? 'invalid'}`);
    const key = table.label.trim().toLowerCase();
    if (seen.has(key)) problems.push(`table number "${table.label}" is used twice`);
    seen.add(key);
    if (table.x < 0 || table.y < 0 || table.x > plan.mapWidth || table.y > plan.mapHeight) {
      problems.push(`table ${table.label} stands outside the map`);
    }
  });
  return problems;
}

/** The area's capacity when the plan creates it: the seats it sets out. */
export const planSeats = (plan: FloorPlan) => plan.tables.reduce((sum, t) => sum + t.seats, 0);
