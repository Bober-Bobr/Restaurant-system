import { useQuery } from '@tanstack/react-query';
import { menuService, type MenuSettings } from '../services/menu.service';
import type { ExcludedCategories, MenuItem, MenuScope } from '../types/domain';

export type MenuCategory = MenuItem['category'];

// Shared query key so the Settings page can invalidate it after saving.
export const EXCLUDED_CATEGORIES_KEY = ['menu-settings'] as const;

const EMPTY: ExcludedCategories = { banquet: [], catering: [] };

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

// Switched off in every product — the only categories safe to hide from a
// screen that manages the dish table itself.
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
