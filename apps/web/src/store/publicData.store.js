import { create } from 'zustand';
import { publicHallService } from '../services/publicHall.service';
import { publicMenuService } from '../services/publicMenu.service';
import { publicTableCategoryService } from '../services/publicTableCategory.service';
import { publicRestaurantService } from '../services/publicRestaurant.service';
export const usePublicDataStore = create((set, get) => ({
    menuItems: [],
    halls: [],
    tableCategories: [],
    restaurantName: null,
    restaurantLogoUrl: null,
    isLoading: false,
    error: undefined,
    isLoaded: false,
    loadPublicData: async (restaurantId) => {
        if (!restaurantId) {
            set({ menuItems: [], halls: [], tableCategories: [], restaurantName: null, restaurantLogoUrl: null, isLoaded: true, isLoading: false });
            return;
        }
        if (get().isLoading)
            return;
        set({ isLoading: true, error: undefined });
        try {
            const [menuItems, halls, tableCategories, restaurant] = await Promise.all([
                publicMenuService.listActive(restaurantId),
                publicHallService.listActive(restaurantId),
                publicTableCategoryService.listActive(restaurantId),
                publicRestaurantService.get(restaurantId),
            ]);
            set({
                menuItems,
                halls,
                tableCategories,
                restaurantName: restaurant.name,
                restaurantLogoUrl: restaurant.logoUrl,
                isLoaded: true
            });
        }
        catch (error) {
            set({ error: 'Failed to load public data' });
        }
        finally {
            set({ isLoading: false });
        }
    }
}));
