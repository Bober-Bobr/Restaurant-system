import { create } from 'zustand';
export const useTabletStore = create((set) => ({
    selectedItems: {},
    selectedHallId: undefined,
    selectedTableCategoryId: undefined,
    guestCount: 1,
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
    reset: () => {
        set({
            selectedItems: {},
            selectedHallId: undefined,
            selectedTableCategoryId: undefined,
            guestCount: 1
        });
    }
}));
