import { create } from 'zustand';
import { Locale, defaultLocale } from '../utils/translate';

type SelectionState = {
  selectedItems: Record<string, number>;
  selectedHallId?: string;
  selectedTableCategoryId?: string;
  selectedFirstCourseId?: string;
  selectedSecondCourseId?: string;
  selectedThirdCourseId?: string;
  guestCount: number;
  locale: Locale;
  setQuantity: (menuItemId: string, quantity: number) => void;
  setHall: (hallId: string) => void;
  setTableCategory: (tableCategoryId: string) => void;
  setFirstCourse: (menuItemId: string) => void;
  setSecondCourse: (menuItemId: string) => void;
  setThirdCourse: (menuItemId: string) => void;
  setGuestCount: (count: number) => void;
  setLocale: (locale: Locale) => void;
  reset: () => void;
};

export const useTabletStore = create<SelectionState>((set) => ({
  selectedItems: {},
  selectedHallId: undefined,
  selectedTableCategoryId: undefined,
  selectedFirstCourseId: undefined,
  selectedSecondCourseId: undefined,
  selectedThirdCourseId: undefined,
  guestCount: 0,
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
    set({ selectedTableCategoryId: tableCategoryId, selectedFirstCourseId: undefined, selectedSecondCourseId: undefined, selectedThirdCourseId: undefined });
  },
  setFirstCourse: (menuItemId) => {
    set({ selectedFirstCourseId: menuItemId });
  },
  setSecondCourse: (menuItemId) => {
    set({ selectedSecondCourseId: menuItemId });
  },
  setThirdCourse: (menuItemId) => {
    set({ selectedThirdCourseId: menuItemId });
  },
  setGuestCount: (count) => {
    set({ guestCount: Math.max(count, 0) });
  },
  setLocale: (locale) => {
    set({ locale });
  },
  reset: () => {
    set({
      selectedItems: {},
      selectedHallId: undefined,
      selectedTableCategoryId: undefined,
      selectedFirstCourseId: undefined,
      selectedSecondCourseId: undefined,
      selectedThirdCourseId: undefined,
      guestCount: 0,
      locale: defaultLocale
    });
  }
}));
