import { MenuCategory } from '@prisma/client';
import { prisma } from '../db/prisma.js';

/**
 * The products sell from one dish table, and each switches off the categories it
 * has no use for. A banquet package has no place for energy drinks; a public
 * catering menu has no place for the tablet's FIRST/SECOND/THIRD_COURSE
 * groupings; a small banquet wants neither the same packages nor the same
 * groupings as a 200-guest one. The lists are therefore separate, and every read
 * of the menu has to say which product it is reading for.
 *
 * Not the same axis as `Section` in section.ts, though 'banquet' and
 * 'smallBanquet' appear in both: a MenuScope says *which product is reading the
 * shared dish table*, a Section says *whose halls, packages and bookings these
 * are*. 'catering' is a scope with no section — the food-service side takes no
 * bookings — which is why the two lists cannot simply be merged.
 */
export type MenuScope = 'banquet' | 'catering' | 'smallBanquet';

export const MENU_SCOPES: MenuScope[] = ['banquet', 'catering', 'smallBanquet'];

export function isMenuScope(value: unknown): value is MenuScope {
  return MENU_SCOPES.includes(value as MenuScope);
}

/**
 * A `?scope=` query value, with the product the endpoint serves by default.
 * Anything unrecognised falls back rather than 400ing: the parameter is new,
 * and a cached bundle from before this deploy sends none at all. Both lists
 * start out identical, so a fallback is the pre-split behaviour.
 */
export function resolveMenuScope(raw: unknown, fallback: MenuScope): MenuScope {
  return isMenuScope(raw) ? raw : fallback;
}

// Stored on Restaurant as a JSON array of MenuCategory names
// (e.g. ["SUSHI_ROLLS","ALCOHOL"]). Parse defensively.
export function parseExcludedCategories(raw: string | null | undefined): MenuCategory[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const valid = new Set(Object.values(MenuCategory) as string[]);
    return parsed.filter((c): c is MenuCategory => typeof c === 'string' && valid.has(c));
  } catch {
    return [];
  }
}

export type ExcludedCategories = Record<MenuScope, MenuCategory[]>;

export async function getExcludedCategoriesBoth(restaurantId: string): Promise<ExcludedCategories> {
  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    select: {
      excludedCategoriesBanquet: true,
      excludedCategoriesCatering: true,
      excludedCategoriesSmallBanquet: true,
    },
  });
  return {
    banquet: parseExcludedCategories(restaurant?.excludedCategoriesBanquet),
    catering: parseExcludedCategories(restaurant?.excludedCategoriesCatering),
    smallBanquet: parseExcludedCategories(restaurant?.excludedCategoriesSmallBanquet),
  };
}

export async function getExcludedCategories(
  restaurantId: string,
  scope: MenuScope,
): Promise<MenuCategory[]> {
  return (await getExcludedCategoriesBoth(restaurantId))[scope];
}

/**
 * Categories switched off in EVERY product — the only ones safe to hide from a
 * management screen. A category kept on the catering menu must stay editable
 * even when the banquet side has dropped it, or its dishes become unreachable:
 * invisible to edit, still on sale.
 */
export function excludedEverywhere(excluded: ExcludedCategories): MenuCategory[] {
  // The intersection across EVERY scope, not just two. A scope added to
  // MENU_SCOPES and forgotten here would widen what the management screens hide,
  // which is the failure direction that loses dishes, so it is derived from the
  // list rather than written out.
  const [first, ...rest] = MENU_SCOPES.map((scope) => excluded[scope]);
  return (first ?? []).filter((c) => rest.every((list) => list.includes(c)));
}

export async function getExcludedEverywhere(restaurantId: string): Promise<MenuCategory[]> {
  return excludedEverywhere(await getExcludedCategoriesBoth(restaurantId));
}
