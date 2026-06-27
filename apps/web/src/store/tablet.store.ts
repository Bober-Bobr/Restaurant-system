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
  // ── Event draft handed off from the admin Events page "Change Menu" button ──
  // Pre-fills the tablet flow; contact + date/time surface again on the Summary.
  customerName: string;
  customerPhone: string;
  eventDate: string;
  eventTime: string;
  // ── Optional children's table add-on (its own course selections, priced by childrenCount) ──
  childrenTableSelected: boolean;
  childrenCount: number;
  childFirstCourseId?: string;
  childSecondCourseIds: string[];
  childThirdCourseIds: string[];
  childReplacements: Record<string, string>;
  locale: Locale;
  setQuantity: (menuItemId: string, quantity: number) => void;
  setHall: (hallId: string) => void;
  setTableCategory: (tableCategoryId: string) => void;
  setFirstCourse: (menuItemId: string) => void;
  toggleSecondCourse: (menuItemId: string) => void;
  toggleThirdCourse: (menuItemId: string) => void;
  setReplacement: (packageItemId: string, menuItemId: string | null) => void;
  setChildrenTableSelected: (selected: boolean) => void;
  setChildrenCount: (count: number) => void;
  setChildFirstCourse: (menuItemId: string) => void;
  toggleChildSecondCourse: (menuItemId: string) => void;
  toggleChildThirdCourse: (menuItemId: string) => void;
  setChildReplacement: (packageItemId: string, menuItemId: string | null) => void;
  setGuestCount: (count: number) => void;
  setCustomerName: (value: string) => void;
  setCustomerPhone: (value: string) => void;
  setEventDate: (value: string) => void;
  setEventTime: (value: string) => void;
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
  customerName: '',
  customerPhone: '',
  eventDate: '',
  eventTime: '',
  childrenTableSelected: false,
  childrenCount: 0,
  childFirstCourseId: undefined,
  childSecondCourseIds: [],
  childThirdCourseIds: [],
  childReplacements: {},
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
      // Reset the children's-table add-on whenever the main table changes.
      childrenTableSelected: false,
      childrenCount: 0,
      childFirstCourseId: undefined,
      childSecondCourseIds: [],
      childThirdCourseIds: [],
      childReplacements: {},
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
  setChildrenTableSelected: (selected) => {
    // Deselecting clears the children's course/count selections too.
    if (selected) {
      set({ childrenTableSelected: true });
    } else {
      set({
        childrenTableSelected: false,
        childrenCount: 0,
        childFirstCourseId: undefined,
        childSecondCourseIds: [],
        childThirdCourseIds: [],
        childReplacements: {},
      });
    }
  },
  setChildrenCount: (count) => {
    set({ childrenCount: Math.max(count, 0) });
  },
  setChildFirstCourse: (menuItemId) => {
    set({ childFirstCourseId: menuItemId });
  },
  toggleChildSecondCourse: (menuItemId) => {
    set((state) => {
      const ids = state.childSecondCourseIds;
      return {
        childSecondCourseIds: ids.includes(menuItemId)
          ? ids.filter((id) => id !== menuItemId)
          : [...ids, menuItemId],
      };
    });
  },
  toggleChildThirdCourse: (menuItemId) => {
    set((state) => {
      const ids = state.childThirdCourseIds;
      return {
        childThirdCourseIds: ids.includes(menuItemId)
          ? ids.filter((id) => id !== menuItemId)
          : [...ids, menuItemId],
      };
    });
  },
  setChildReplacement: (packageItemId, menuItemId) => {
    set((state) => {
      const next = { ...state.childReplacements };
      if (menuItemId === null) delete next[packageItemId];
      else next[packageItemId] = menuItemId;
      return { childReplacements: next };
    });
  },
  setGuestCount: (count) => {
    set({ guestCount: Math.max(count, 0) });
  },
  setCustomerName: (value) => {
    set({ customerName: value });
  },
  setCustomerPhone: (value) => {
    set({ customerPhone: value });
  },
  setEventDate: (value) => {
    set({ eventDate: value });
  },
  setEventTime: (value) => {
    set({ eventTime: value });
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
      customerName: '',
      customerPhone: '',
      eventDate: '',
      eventTime: '',
      childrenTableSelected: false,
      childrenCount: 0,
      childFirstCourseId: undefined,
      childSecondCourseIds: [],
      childThirdCourseIds: [],
      childReplacements: {},
      locale: defaultLocale
    });
  }
}));
