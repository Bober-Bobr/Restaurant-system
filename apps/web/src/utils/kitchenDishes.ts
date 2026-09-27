import { CATEGORY_ORDER, type MenuCategory } from './menuCategories';

/**
 * A booking's dishes, as a kitchen reads them.
 *
 * The cards used to list every dish in one flat column in whatever order the
 * package and the selections came back in, which on a wedding is forty lines a
 * cook has to scan for the four things that actually go out during the evening.
 * Grouping them is what makes the card readable; the groups collapse so a long
 * booking can be skimmed.
 *
 * **The order is the PRINTED SHEET's order**, not the category table's: the
 * four served courses first, in serving order, then everything else. The cook
 * reads both documents — the page has a "Download PDF" button on every card —
 * and two different orders for the same booking is worse than either.
 *
 * `SERVED_CATEGORIES` and `servedPortions` are mirrored from the API's
 * pdf.service.ts (the API cannot be imported from the web app) and
 * `floorBookingAgreement.test.ts` runs one set of cases through both.
 */

/** The four courses that go OUT during the evening, in serving order. */
export const SERVED_CATEGORIES = ['HOT_APPETIZERS', 'FIRST_COURSE', 'SECOND_COURSE', 'THIRD_COURSE'] as const;

export type ServedCategory = (typeof SERVED_CATEGORIES)[number];

export const isServedCategory = (category: string): category is ServedCategory =>
  (SERVED_CATEGORIES as readonly string[]).includes(category);

/**
 * How many portions of an included dish the kitchen is asked for.
 *
 * A hot appetizer is one per guest — it is the only included dish that is, and
 * the package item's `servings` is not the head count, so a banquet for 200 was
 * asking the kitchen for a single portion. Every other dish keeps the servings
 * the package declares: a salad shared by a table of ten is one bowl, not ten.
 */
export function servedPortions(dish: { category: string; servings?: number }, guests: number): number {
  if (dish.category === 'HOT_APPETIZERS') return Math.max(guests, 0);
  return dish.servings ?? 1;
}

export type KitchenDish = {
  /** Unique within its group, for the React key. */
  id: string;
  name: string;
  portions: number;
};

export type DishGroup = {
  category: string;
  dishes: KitchenDish[];
  /** How many different dishes, which is what the collapsed row says. */
  dishCount: number;
  /** How many plates in total — the number that decides the prep. */
  portions: number;
  /** Goes out during the evening, so it is drawn first and marked. */
  served: boolean;
};

/**
 * Served courses first, then the rest of the category table.
 *
 * The four served categories are IN `CATEGORY_ORDER` as well, so this cannot be
 * one `new Map([...served, ...all])`: a later duplicate key overwrites the
 * earlier one, which silently gave the served courses their ordinary places back
 * and undid the whole point of the list.
 */
const RANK = new Map<string, number>([
  ...SERVED_CATEGORIES.map((c, i) => [c, i] as [string, number]),
  ...CATEGORY_ORDER
    .filter((c) => !isServedCategory(c))
    .map((c, i) => [c, SERVED_CATEGORIES.length + i] as [string, number]),
]);

/**
 * Group a booking's dishes by category, served courses first.
 *
 * A category is only in the result when it has a dish in it — an empty group is
 * a heading that says nothing. Two dishes with the same name in one category
 * are kept apart rather than merged: they are separate rows on the package and
 * the kitchen may well have been asked for both.
 */
export function groupKitchenDishes(
  rows: { id: string; name: string; category: string; portions: number }[],
): DishGroup[] {
  const byCategory = new Map<string, DishGroup>();
  for (const row of rows) {
    let group = byCategory.get(row.category);
    if (!group) {
      group = {
        category: row.category,
        dishes: [],
        dishCount: 0,
        portions: 0,
        served: isServedCategory(row.category),
      };
      byCategory.set(row.category, group);
    }
    group.dishes.push({ id: row.id, name: row.name, portions: row.portions });
    group.dishCount += 1;
    group.portions += Math.max(0, row.portions);
  }
  // Unknown categories sort last rather than first, which is what a missing
  // rank would do with a plain `?? 0`.
  const rank = (category: string) => RANK.get(category) ?? Number.MAX_SAFE_INTEGER;
  return [...byCategory.values()].sort((a, b) => rank(a.category) - rank(b.category));
}

/** Every category in these groups, for the "expand all" toggle's key set. */
export function groupKeys(groups: DishGroup[]): string[] {
  return groups.map((g) => g.category);
}

/** The label a category is shown under; `MenuCategory` where it is a known one. */
export function asMenuCategory(category: string): MenuCategory | null {
  return (CATEGORY_ORDER as string[]).includes(category) ? (category as MenuCategory) : null;
}
