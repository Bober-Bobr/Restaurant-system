import { create } from 'zustand';

type SelectionState = {
  selectedItems: Record<string, number>;
  selectedHallId?: string;
  selectedTableCategoryId?: string;
  guestCount: number;
  setQuantity: (menuItemId: string, quantity: number) => void;
  setHall: (hallId: string) => void;
  setTableCategory: (tableCategoryId: string) => void;
  setGuestCount: (count: number) => void;
  reset: () => void;
};

export const useTabletStore = create<SelectionState>((set) => ({
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
