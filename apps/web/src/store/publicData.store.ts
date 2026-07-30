import { create } from 'zustand';
import { publicHallService } from '../services/publicHall.service';
import { publicMenuService } from '../services/publicMenu.service';
import { publicTableCategoryService } from '../services/publicTableCategory.service';
import { publicRestaurantService } from '../services/publicRestaurant.service';
import { publicExtraServiceService } from '../services/publicExtraService.service';
import type { ExtraService, Hall, MenuItem, TableCategory } from '../types/domain';

type PublicDataState = {
  menuItems: MenuItem[];
  halls: Hall[];
  tableCategories: TableCategory[];
  extraServices: ExtraService[];
  restaurantName: string | null;
  restaurantLogoUrl: string | null;
  tabletAccentColor: string | null;
  tabletBgColor: string | null;
  tabletParticles: string | null;
  tabletParticlesColor: string | null;
  tabletParticlesImageUrl: string | null;
  tabletTrailTemplate: string | null;
  tabletTrailColor: string | null;
  tabletTrailImageUrl: string | null;
  // Whether this restaurant bought the Additional Services module — drives the
  // button on the booking-confirmed screen.
  moduleAddons: boolean;
  isLoading: boolean;
  error?: string;
  isLoaded: boolean;
  loadPublicData: (restaurantId: string) => Promise<void>;
};

export const usePublicDataStore = create<PublicDataState>((set, get) => ({
  menuItems: [],
  halls: [],
  tableCategories: [],
  extraServices: [],
  restaurantName: null,
  restaurantLogoUrl: null,
  tabletAccentColor: null,
  tabletBgColor: null,
  tabletParticles: null,
  tabletParticlesColor: null,
  tabletParticlesImageUrl: null,
  tabletTrailTemplate: null,
  tabletTrailColor: null,
  tabletTrailImageUrl: null,
  moduleAddons: false,
  isLoading: false,
  error: undefined,
  isLoaded: false,
  loadPublicData: async (restaurantId: string) => {
    if (!restaurantId) {
      set({ menuItems: [], halls: [], tableCategories: [], extraServices: [], restaurantName: null, restaurantLogoUrl: null, tabletAccentColor: null, tabletBgColor: null, tabletParticles: null, tabletParticlesColor: null, tabletParticlesImageUrl: null, tabletTrailTemplate: null, tabletTrailColor: null, tabletTrailImageUrl: null, moduleAddons: false, isLoaded: true, isLoading: false });
      return;
    }
    if (get().isLoading) return;
    set({ isLoading: true, error: undefined });

    try {
      const [menuItems, halls, tableCategories, restaurant, extraServices] = await Promise.all([
        publicMenuService.listActive(restaurantId),
        publicHallService.listActive(restaurantId),
        publicTableCategoryService.listActive(restaurantId),
        publicRestaurantService.get(restaurantId),
        publicExtraServiceService.listActive(restaurantId).catch(() => [] as ExtraService[]),
      ]);

      set({
        menuItems,
        halls,
        tableCategories,
        extraServices,
        restaurantName: restaurant.name,
        restaurantLogoUrl: restaurant.logoUrl,
        tabletAccentColor: restaurant.tabletAccentColor ?? null,
        tabletBgColor: restaurant.tabletBgColor ?? null,
        tabletParticles: restaurant.tabletParticles ?? null,
        tabletParticlesColor: restaurant.tabletParticlesColor ?? null,
        tabletParticlesImageUrl: restaurant.tabletParticlesImageUrl ?? null,
        tabletTrailTemplate: restaurant.tabletTrailTemplate ?? null,
        tabletTrailColor: restaurant.tabletTrailColor ?? null,
        tabletTrailImageUrl: restaurant.tabletTrailImageUrl ?? null,
        moduleAddons: !!restaurant.moduleAddons,
        isLoaded: true
      });
    } catch (error) {
      set({ error: 'Failed to load public data' });
    } finally {
      set({ isLoading: false });
    }
  }
}));
