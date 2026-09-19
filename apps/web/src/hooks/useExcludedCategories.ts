import { useQuery } from '@tanstack/react-query';
import { menuService, type MenuSettings } from '../services/menu.service';
import type { ExcludedCategories, MenuItem, MenuScope } from '../types/domain';
import { useAuthStore } from '../store/auth.store';
import { menuScopeOfRole } from '../utils/menuScope';

export type MenuCategory = MenuItem['category'];

// Shared query key so the Settings page can invalidate it after saving.
export const EXCLUDED_CATEGORIES_KEY = ['menu-settings'] as const;

const EMPTY: ExcludedCategories = { banquet: [], catering: [], smallBanquet: [] };

function useSettings(): MenuSettings | undefined {
  const { data } = useQuery({
    queryKey: EXCLUDED_CATEGORIES_KEY,
    queryFn: () => menuService.getSettings(),
    staleTime: 60_000,
  });
  return data;
}

export function useMenuSettings(): MenuSettings | undefined {
  return useSettings();
}

/**
 * Categories the restaurant has switched off for one product. Returns a Set for
 * cheap membership checks; empty while loading.
 *
 * Pass the product the screen belongs to. A management screen that edits the
 * shared dish table wants `useExcludedEverywhere()` instead — hiding a category
 * there because ONE product dropped it would make dishes that are still on sale
 * uneditable.
 */
export function useExcludedCategories(scope: MenuScope): Set<MenuCategory> {
  const data = useSettings();
  return new Set((data?.excludedCategories ?? EMPTY)[scope]);
}

/**
 * The categories switched off in the SIGNED-IN role's own system — what the
 * Menu, Photos, Subcategories and Table categories pages hide. It used to be
 * the intersection across every system (`useExcludedEverywhere`), so a
 * category switched off for banquets stayed on the banquet pages, which is
 * what made the switch look broken. The server's lists now hide by the same
 * rule. A platform role, which belongs to no one system, keeps the
 * intersection.
 */
export function useOwnExcludedCategories(): Set<MenuCategory> {
  const role = useAuthStore((s) => s.role);
  const data = useSettings();
  const scope = menuScopeOfRole(role);
  const excluded = data?.excludedCategories ?? EMPTY;
  if (scope) return new Set(excluded[scope] ?? []);
  const [first, ...rest] = (['banquet', 'catering', 'smallBanquet'] as MenuScope[]).map((s) => excluded[s] ?? []);
  return new Set(first.filter((c) => rest.every((list) => list.includes(c))));
}

// Switched off in every product. Kept for callers that manage something truly
// shared across every system; the menu pages use `useOwnExcludedCategories`.
export function useExcludedEverywhere(): Set<MenuCategory> {
  const excluded = useSettings()?.excludedCategories ?? EMPTY;
  const others = new Set(excluded.catering);
  return new Set(excluded.banquet.filter((c) => others.has(c)));
}

// Master switch: when true, subcategories are disabled everywhere for the
// restaurant (menu Subcategory column + catering-site subcategory headers).
export function useHideSubcategories(): boolean {
  return useSettings()?.hideSubcategories ?? false;
}
