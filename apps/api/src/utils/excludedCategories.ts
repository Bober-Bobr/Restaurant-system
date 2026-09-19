import { AdminRole, MenuCategory } from '@prisma/client';
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

// ── One system per role: prices and per-dish switches ────────────────────────
//
// The golden rule for the dish table: a change made in one system never
// reaches another. Categories were already split (the three lists above);
// prices and single dishes are split the same way, one column per scope.
//
// And, as with sections, WHICH system a request is for comes from the caller's
// ROLE: a banquet admin sending `?scope=catering` still reads and writes the
// banquet columns. Only the platform roles, who run every product, may name
// one.

export const PRICE_COLUMN = {
  banquet: 'priceCents',
  smallBanquet: 'priceCentsSmallBanquet',
  catering: 'priceCentsCatering',
} as const satisfies Record<MenuScope, string>;

export const DISABLED_COLUMN = {
  banquet: 'disabledBanquet',
  smallBanquet: 'disabledSmallBanquet',
  catering: 'disabledCatering',
} as const satisfies Record<MenuScope, string>;

const SCOPE_BY_ROLE: Partial<Record<AdminRole, MenuScope>> = {
  [AdminRole.ADMIN]: 'banquet',
  [AdminRole.EMPLOYEE]: 'banquet',
  [AdminRole.KITCHEN]: 'banquet',
  [AdminRole.SUPERVISOR]: 'smallBanquet',
  [AdminRole.SMALL_KITCHEN]: 'smallBanquet',
  [AdminRole.CATERING_ADMIN]: 'catering',
  [AdminRole.CATERING_EMPLOYEE]: 'catering',
};

/** The system a role belongs to, or null for a platform role (who may choose). */
export function menuScopeForRole(role: AdminRole | undefined | null): MenuScope | null {
  return (role && SCOPE_BY_ROLE[role]) || null;
}

/** The system of a request: the role's own, else what a platform role asked for, else the fallback. */
export function resolveRoleMenuScope(role: AdminRole | undefined | null, requested: unknown, fallback: MenuScope): MenuScope {
  return menuScopeForRole(role) ?? resolveMenuScope(requested, fallback);
}

type ScopedColumns = (typeof PRICE_COLUMN)[MenuScope] | (typeof DISABLED_COLUMN)[MenuScope];
type ScopedRow = { priceCents: number; priceCentsSmallBanquet: number; priceCentsCatering: number;
  disabledBanquet: boolean; disabledSmallBanquet: boolean; disabledCatering: boolean };

/**
 * A dish as ONE system sees it: `priceCents` is that system's price, `disabled`
 * its own switch, and the other systems' prices and switches are not in the
 * object at all — so no page can display, or send back, a value that is not
 * its own. Every read of the dish table that leaves the API goes through this.
 */
export function presentForScope<T extends ScopedRow>(item: T, scope: MenuScope): Omit<T, ScopedColumns> & { priceCents: number; disabled: boolean } {
  const {
    priceCents, priceCentsSmallBanquet, priceCentsCatering,
    disabledBanquet, disabledSmallBanquet, disabledCatering, ...rest
  } = item;
  const prices = { priceCents, priceCentsSmallBanquet, priceCentsCatering };
  const disabled = { disabledBanquet, disabledSmallBanquet, disabledCatering };
  return { ...rest, priceCents: prices[PRICE_COLUMN[scope]], disabled: disabled[DISABLED_COLUMN[scope]] };
}
