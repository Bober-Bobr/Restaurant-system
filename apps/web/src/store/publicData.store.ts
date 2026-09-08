import { create } from 'zustand';
import { useAuthStore } from './auth.store';
import { sectionOfRole } from '../utils/section';
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
      // Which SECTION's furniture the kiosk shows — Banquet or Small Banquets.
      // Derived here from the signed-in role rather than passed in by the two
      // pages that call this: there is exactly one right answer for a given
      // session, and a parameter is a thing one of the two call sites
      // eventually forgets. The kiosk requires a session, so there is always a
      // role to read; `sectionOfRole` falls back to Banquet regardless.
      //
      // The menu SCOPE moves with it (see utils/excludedCategories on the API):
      // each section reads the shared dish table through its own list of
      // switched-off categories.
      const section = sectionOfRole(useAuthStore.getState().role);
      const menuScope = section === 'SMALL_BANQUET' ? 'smallBanquet' : 'banquet';
      const [menuItems, halls, tableCategories, restaurant, extraServices] = await Promise.all([
        publicMenuService.listActive(restaurantId, menuScope),
        publicHallService.listActive(restaurantId, section),
        publicTableCategoryService.listActive(restaurantId, section),
        publicRestaurantService.get(restaurantId),
        publicExtraServiceService.listActive(restaurantId, section).catch(() => [] as ExtraService[]),
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
