import type { MenuItem } from '../types/domain';
import type { translate } from './translate';

// ── Shared menu-category tables ─────────────────────────────────────────────
// Extracted from CateringSite.tsx so the live catering site (v-menu.uz/<slug>)
// and the new food-service site (test.v-menu.uz/<slug>) read one copy. A
// 35-entry label map duplicated across two sites would drift within a month.

export type MenuCategory = MenuItem['category'];

export const CATEGORY_ORDER: MenuCategory[] = [
  'SOUPS', 'PIZZA', 'COLD_APPETIZERS', 'GRILL', 'PASTRY', 'HOT_APPETIZERS',
  'BEER_SNACKS', 'DESSERT', 'LAMB_DISHES', 'BEEF_DISHES', 'CHICKEN_DISHES',
  'SIDE_DISHES', 'PASTA', 'SOFT_DRINKS', 'STEAKS', 'ENERGY_DRINKS',
  'SALADS_OIL', 'SALADS_MAYO', 'COFFEE', 'SUSHI_ROLLS', 'DRIED_FRUITS', 'CANDIES',
  'FIRST_COURSE', 'SECOND_COURSE', 'THIRD_COURSE', 'SWEETS', 'FRUITS',
  'ALCOHOL', 'LEMONADES', 'NON_ALCOHOLIC_COCKTAILS', 'ALCOHOLIC_COCKTAILS',
  'MILKSHAKES', 'TEA_MENU', 'FRESH_JUICES', 'LIQUEURS',
];

export const CATEGORY_LABEL_KEY: Record<MenuCategory, Parameters<typeof translate>[0]> = {
  SOUPS: 'soups',
  PIZZA: 'pizza',
  COLD_APPETIZERS: 'cold_appetizers',
  GRILL: 'grill',
  PASTRY: 'pastry',
  HOT_APPETIZERS: 'hot_appetizers',
  BEER_SNACKS: 'beer_snacks',
  DESSERT: 'dessert',
  LAMB_DISHES: 'lamb_dishes',
  BEEF_DISHES: 'beef_dishes',
  CHICKEN_DISHES: 'chicken_dishes',
  SIDE_DISHES: 'side_dishes',
  PASTA: 'pasta',
  SOFT_DRINKS: 'soft_drinks',
  STEAKS: 'steaks',
  ENERGY_DRINKS: 'energy_drinks',
  SALADS_OIL: 'salads_oil',
  SALADS_MAYO: 'salads_mayo',
  COFFEE: 'coffee',
  SUSHI_ROLLS: 'sushi_rolls',
  DRIED_FRUITS: 'dried_fruits',
  CANDIES: 'candies',
  FIRST_COURSE: 'first_course',
  SECOND_COURSE: 'second_course',
  THIRD_COURSE: 'third_course',
  SWEETS: 'sweets',
  FRUITS: 'fruits',
  ALCOHOL: 'alcohol',
  LEMONADES: 'lemonades',
  NON_ALCOHOLIC_COCKTAILS: 'non_alcoholic_cocktails',
  ALCOHOLIC_COCKTAILS: 'alcoholic_cocktails',
  MILKSHAKES: 'milkshakes',
  TEA_MENU: 'tea_menu',
  FRESH_JUICES: 'fresh_juices',
  LIQUEURS: 'liqueurs',
};

// Apply the restaurant's saved category order, then append any categories it
// doesn't mention (e.g. newly added ones) in the default order.
export function orderCategories(saved: string[] | null | undefined): MenuCategory[] {
  const known = CATEGORY_ORDER as string[];
  // De-duplicated on the way in: the stored arrangement is free-form JSON and
  // nothing upstream forbids a repeated entry, which would render the whole
  // category — heading, rail chip and every dish — twice on the menu.
  const valid = [...new Set((saved ?? []).filter((c): c is MenuCategory => known.includes(c)))];
  const remaining = CATEGORY_ORDER.filter((c) => !valid.includes(c));
  return [...valid, ...remaining];
}
