import { create } from 'zustand';
import { Locale, defaultLocale } from '../utils/translate';

type SelectionState = {
  selectedItems: Record<string, number>;
  selectedHallId?: string;
  selectedTableCategoryId?: string;
  // First course: single-select (radio)
  selectedFirstCourseId?: string;
  // Second and third course: multi-select (checkboxes)
  selectedSecondCourseIds: string[];
  selectedThirdCourseIds: string[];
  // Free replacements: included package-item id → chosen FREE menu-item id.
  replacements: Record<string, string>;
  guestCount: number;
  locale: Locale;
  setQuantity: (menuItemId: string, quantity: number) => void;
  setHall: (hallId: string) => void;
  setTableCategory: (tableCategoryId: string) => void;
  setFirstCourse: (menuItemId: string) => void;
  toggleSecondCourse: (menuItemId: string) => void;
  toggleThirdCourse: (menuItemId: string) => void;
  setReplacement: (packageItemId: string, menuItemId: string | null) => void;
  setGuestCount: (count: number) => void;
  setLocale: (locale: Locale) => void;
  reset: () => void;
};

export const useTabletStore = create<SelectionState>((set) => ({
  selectedItems: {},
  selectedHallId: undefined,
  selectedTableCategoryId: undefined,
  selectedFirstCourseId: undefined,
  selectedSecondCourseIds: [],
  selectedThirdCourseIds: [],
  replacements: {},
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
    set({
      selectedTableCategoryId: tableCategoryId,
      selectedFirstCourseId: undefined,
      selectedSecondCourseIds: [],
      selectedThirdCourseIds: [],
      replacements: {},
    });
  },
  setFirstCourse: (menuItemId) => {
    set({ selectedFirstCourseId: menuItemId });
  },
  toggleSecondCourse: (menuItemId) => {
    set((state) => {
      const ids = state.selectedSecondCourseIds;
      return {
        selectedSecondCourseIds: ids.includes(menuItemId)
          ? ids.filter((id) => id !== menuItemId)
          : [...ids, menuItemId],
      };
    });
  },
  toggleThirdCourse: (menuItemId) => {
    set((state) => {
      const ids = state.selectedThirdCourseIds;
      return {
        selectedThirdCourseIds: ids.includes(menuItemId)
          ? ids.filter((id) => id !== menuItemId)
          : [...ids, menuItemId],
      };
    });
  },
  setReplacement: (packageItemId, menuItemId) => {
    set((state) => {
      const next = { ...state.replacements };
      if (menuItemId === null) delete next[packageItemId];
      else next[packageItemId] = menuItemId;
      return { replacements: next };
    });
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
      selectedSecondCourseIds: [],
      selectedThirdCourseIds: [],
      replacements: {},
      guestCount: 0,
      locale: defaultLocale
    });
  }
}));
