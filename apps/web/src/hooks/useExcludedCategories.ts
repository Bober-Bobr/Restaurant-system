import { useQuery } from '@tanstack/react-query';
import { menuService } from '../services/menu.service';
import type { MenuItem } from '../types/domain';

export type MenuCategory = MenuItem['category'];

// Shared query key so the Settings page can invalidate it after saving.
export const EXCLUDED_CATEGORIES_KEY = ['menu-settings'] as const;

// Categories the restaurant has hidden everywhere (menus, table categories, photos).
// Returns a Set for cheap membership checks; empty while loading.
export function useExcludedCategories(): Set<MenuCategory> {
  const { data } = useQuery({
    queryKey: EXCLUDED_CATEGORIES_KEY,
    queryFn: () => menuService.getSettings(),
    staleTime: 60_000,
  });
  return new Set(data?.excludedCategories ?? []);
}

// Master switch: when true, subcategories are disabled everywhere for the
// restaurant (menu Subcategory column + catering-site subcategory headers).
export function useHideSubcategories(): boolean {
  const { data } = useQuery({
    queryKey: EXCLUDED_CATEGORIES_KEY,
    queryFn: () => menuService.getSettings(),
    staleTime: 60_000,
  });
  return data?.hideSubcategories ?? false;
}
