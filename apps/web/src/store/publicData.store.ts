import { create } from 'zustand';
import { publicHallService } from '../services/publicHall.service';
import { publicMenuService } from '../services/publicMenu.service';
import { publicTableCategoryService } from '../services/publicTableCategory.service';
import type { Hall, MenuItem, TableCategory } from '../types/domain';

type PublicDataState = {
  menuItems: MenuItem[];
  halls: Hall[];
  tableCategories: TableCategory[];
  isLoading: boolean;
  error?: string;
  isLoaded: boolean;
  loadPublicData: () => Promise<void>;
};

export const usePublicDataStore = create<PublicDataState>((set, get) => ({
  menuItems: [],
  halls: [],
  tableCategories: [],
  isLoading: false,
  error: undefined,
  isLoaded: false,
  loadPublicData: async () => {
    if (get().isLoaded || get().isLoading) return;
    set({ isLoading: true, error: undefined });

    try {
      const [menuItems, halls, tableCategories] = await Promise.all([
        publicMenuService.listActive(),
        publicHallService.listActive(),
        publicTableCategoryService.listActive()
      ]);

      set({
        menuItems,
        halls,
        tableCategories,
        isLoaded: true
      });
    } catch (error) {
      set({ error: 'Failed to load public data' });
    } finally {
      set({ isLoading: false });
    }
  }
}));
