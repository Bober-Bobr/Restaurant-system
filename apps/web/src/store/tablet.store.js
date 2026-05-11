import { create } from 'zustand';
import { defaultLocale } from '../utils/translate';
export const useTabletStore = create((set) => ({
    selectedItems: {},
    selectedHallId: undefined,
    selectedTableCategoryId: undefined,
    guestCount: 1,
    locale: defaultLocale,
    setQuantity: (menuItemId, quantity) => {
        set((state) => ({
            selectedItems: {
                ...state.selectedItems,
                [menuItemId]: Math.max(quantity, 0)
            }
        }));
    },
    setHall: (hallId) => {
        set({ selectedHallId: hallId });
    },
    setTableCategory: (tableCategoryId) => {
        set({ selectedTableCategoryId: tableCategoryId });
    },
    setGuestCount: (count) => {
        set({ guestCount: Math.max(count, 1) });
    },
    setLocale: (locale) => {
        set({ locale });
    },
    reset: () => {
        set({
            selectedItems: {},
            selectedHallId: undefined,
            selectedTableCategoryId: undefined,
            guestCount: 1,
            locale: defaultLocale
        });
    }
}));
