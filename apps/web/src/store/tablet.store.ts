import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { Locale, defaultLocale } from '../utils/translate';
import type { Event, EventMenuConfig } from '../types/domain';
import { TABLET_DRAFT_KEY } from './tabletDraft';

// Draft handed to the tablet when the admin Events page opens the menu flow for
// an event (new or existing). `config` restores the exact prior selections.
export type EventDraft = {
  editingEventId?: number;
  hallId?: string;
  tableCategoryId?: string;
  guestCount: number;
  customerName: string;
  customerPhone: string;
  secondCustomerName: string;
  secondCustomerPhone: string;
  eventDate: string;
  eventTime: string;
  depositCents?: number;
  childrenCount?: number;
  config?: EventMenuConfig | null;
};

type SelectionState = {
  selectedItems: Record<string, number>;
  selectedHallId?: string;
  selectedTableCategoryId?: string;
  // Hot appetizers: multi-select, capped at two (shown above the courses).
  selectedHotAppetizerIds: string[];
  // Courses: single-select (one dish each).
  selectedFirstCourseId?: string;
  selectedSecondCourseIds: string[];
  selectedThirdCourseIds: string[];
  // Free replacements: included package-item id → chosen FREE menu-item id.
  replacements: Record<string, string>;
  // Included package items the guest has taken OFF the table. Their price comes
  // off the per-person rate (see utils/tablePricing.ts), so this is priced state
  // and not only a display filter.
  removedPackageItemIds: string[];
  // Additional paid restaurant services the guest picked on the Summary page.
  selectedExtraServiceIds: string[];
  guestCount: number;
  // The event being edited via the menu flow (undefined = creating a new event).
  // When set, confirming on the Summary page UPDATES this event instead of creating.
  editingEventId?: number;
  // ── Event draft handed off from the admin Events page "Change Menu" button ──
  // Pre-fills the tablet flow; contact + date/time surface again on the Summary.
  customerName: string;
  customerPhone: string;
  secondCustomerName: string;
  secondCustomerPhone: string;
  eventDate: string;
  eventTime: string;
  // Prepaid deposit in tiyin, subtracted from the total on the summary + PDF.
  depositCents: number;
  // The rest of what the Summary page collects. They live here, not in that
  // page's useState, so a reload or a browser Back does not throw them away —
  // the store is persisted; component state is not.
  eventType: NonNullable<Event['eventType']>;
  eventNotes: string;
  birthdayPersonName: string;
  brideName: string;
  groomName: string;
  honoreePersonName: string;
  // Which restaurant's kiosk this draft belongs to. A draft restored on another
  // restaurant's kiosk names dishes and packages that do not exist there.
  restaurantId: string;
  // ── Optional children's table add-on (its own course selections, priced by childrenCount) ──
  childrenTableSelected: boolean;
  childrenCount: number;
  childHotAppetizerIds: string[];
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
  toggleHotAppetizer: (menuItemId: string, max?: number) => void;
  setReplacement: (packageItemId: string, menuItemId: string | null) => void;
  toggleRemovedPackageItem: (packageItemId: string) => void;
  toggleExtraService: (serviceId: string) => void;
  setChildrenTableSelected: (selected: boolean) => void;
  setChildrenCount: (count: number) => void;
  setChildFirstCourse: (menuItemId: string) => void;
  toggleChildSecondCourse: (menuItemId: string) => void;
  toggleChildThirdCourse: (menuItemId: string) => void;
  toggleChildHotAppetizer: (menuItemId: string, max?: number) => void;
  setChildReplacement: (packageItemId: string, menuItemId: string | null) => void;
  setGuestCount: (count: number) => void;
  setCustomerName: (value: string) => void;
  setCustomerPhone: (value: string) => void;
  setSecondCustomerName: (value: string) => void;
  setSecondCustomerPhone: (value: string) => void;
  setDepositCents: (value: number) => void;
  setEventType: (value: NonNullable<Event['eventType']>) => void;
  setEventNotes: (value: string) => void;
  setBirthdayPersonName: (value: string) => void;
  setBrideName: (value: string) => void;
  setGroomName: (value: string) => void;
  setHonoreePersonName: (value: string) => void;
  setRestaurantId: (value: string) => void;
  setEventDate: (value: string) => void;
  setEventTime: (value: string) => void;
  setLocale: (locale: Locale) => void;
  // Load a full event draft (meta + prior menu selections) in one atomic update.
  loadEventDraft: (draft: EventDraft) => void;
  reset: () => void;
};

export const useTabletStore = create<SelectionState>()(persist((set) => ({
  selectedItems: {},
  selectedHallId: undefined,
  selectedTableCategoryId: undefined,
  selectedHotAppetizerIds: [],
  selectedFirstCourseId: undefined,
  selectedSecondCourseIds: [],
  selectedThirdCourseIds: [],
  replacements: {},
  removedPackageItemIds: [],
  selectedExtraServiceIds: [],
  guestCount: 0,
  editingEventId: undefined,
  customerName: '',
  customerPhone: '',
  secondCustomerName: '',
  secondCustomerPhone: '',
  eventDate: '',
  eventTime: '',
  depositCents: 0,
  eventType: 'RESERVATION',
  eventNotes: '',
  birthdayPersonName: '',
  brideName: '',
  groomName: '',
  honoreePersonName: '',
  restaurantId: '',
  childrenTableSelected: false,
  childrenCount: 0,
  childHotAppetizerIds: [],
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
      selectedHotAppetizerIds: [],
      selectedFirstCourseId: undefined,
      selectedSecondCourseIds: [],
      selectedThirdCourseIds: [],
      replacements: {},
      removedPackageItemIds: [],
      selectedExtraServiceIds: [],
      // Reset the children's-table add-on whenever the main table changes.
      childrenTableSelected: false,
      childrenCount: 0,
      childHotAppetizerIds: [],
      childFirstCourseId: undefined,
      childSecondCourseIds: [],
      childThirdCourseIds: [],
      childReplacements: {},
    });
  },
  setFirstCourse: (menuItemId) => {
    set({ selectedFirstCourseId: menuItemId });
  },
  // Second/third courses are single-select (like the first): picking one
  // replaces any previous choice; picking the current one clears it.
  toggleSecondCourse: (menuItemId) => {
    set((state) => ({
      selectedSecondCourseIds: state.selectedSecondCourseIds.includes(menuItemId) ? [] : [menuItemId],
    }));
  },
  toggleThirdCourse: (menuItemId) => {
    set((state) => ({
      selectedThirdCourseIds: state.selectedThirdCourseIds.includes(menuItemId) ? [] : [menuItemId],
    }));
  },
  // Hot appetizers: capped at the table's configured count (default 3). Re-tapping
  // a chosen one removes it; adding beyond the cap drops the oldest so only the
  // latest `max` picks are kept.
  toggleHotAppetizer: (menuItemId, max = 3) => {
    set((state) => ({
      selectedHotAppetizerIds: state.selectedHotAppetizerIds.includes(menuItemId)
        ? state.selectedHotAppetizerIds.filter((id) => id !== menuItemId)
        : [...state.selectedHotAppetizerIds, menuItemId].slice(-Math.max(1, max)),
    }));
  },
  setReplacement: (packageItemId, menuItemId) => {
    set((state) => {
      const next = { ...state.replacements };
      if (menuItemId === null) delete next[packageItemId];
      else next[packageItemId] = menuItemId;
      return { replacements: next };
    });
  },
  // Taking a dish off the table, or putting it back. Removing also drops any
  // free swap made on that slot: the swap is a choice about a dish that is no
  // longer being served, and leaving it would price a replacement for nothing.
  toggleRemovedPackageItem: (packageItemId) => {
    set((state) => {
      const removing = !state.removedPackageItemIds.includes(packageItemId);
      const replacements = { ...state.replacements };
      if (removing) delete replacements[packageItemId];
      return {
        removedPackageItemIds: removing
          ? [...state.removedPackageItemIds, packageItemId]
          : state.removedPackageItemIds.filter((id) => id !== packageItemId),
        replacements,
      };
    });
  },
  toggleExtraService: (serviceId) => {
    set((state) => ({
      selectedExtraServiceIds: state.selectedExtraServiceIds.includes(serviceId)
        ? state.selectedExtraServiceIds.filter((id) => id !== serviceId)
        : [...state.selectedExtraServiceIds, serviceId],
    }));
  },
  setChildrenTableSelected: (selected) => {
    // Deselecting clears the children's course/count selections too.
    if (selected) {
      set({ childrenTableSelected: true });
    } else {
      set({
        childrenTableSelected: false,
        childrenCount: 0,
        childHotAppetizerIds: [],
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
    set((state) => ({
      childSecondCourseIds: state.childSecondCourseIds.includes(menuItemId) ? [] : [menuItemId],
    }));
  },
  toggleChildThirdCourse: (menuItemId) => {
    set((state) => ({
      childThirdCourseIds: state.childThirdCourseIds.includes(menuItemId) ? [] : [menuItemId],
    }));
  },
  toggleChildHotAppetizer: (menuItemId, max = 3) => {
    set((state) => ({
      childHotAppetizerIds: state.childHotAppetizerIds.includes(menuItemId)
        ? state.childHotAppetizerIds.filter((id) => id !== menuItemId)
        : [...state.childHotAppetizerIds, menuItemId].slice(-Math.max(1, max)),
    }));
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
  setSecondCustomerName: (value) => {
    set({ secondCustomerName: value });
  },
  setSecondCustomerPhone: (value) => {
    set({ secondCustomerPhone: value });
  },
  setDepositCents: (value) => {
    set({ depositCents: Math.max(value, 0) });
  },
  setEventType: (value) => { set({ eventType: value }); },
  setEventNotes: (value) => { set({ eventNotes: value }); },
  setBirthdayPersonName: (value) => { set({ birthdayPersonName: value }); },
  setBrideName: (value) => { set({ brideName: value }); },
  setGroomName: (value) => { set({ groomName: value }); },
  setHonoreePersonName: (value) => { set({ honoreePersonName: value }); },
  setRestaurantId: (value) => { set((s) => (s.restaurantId === value ? {} : { restaurantId: value })); },
  setEventDate: (value) => {
    set({ eventDate: value });
  },
  setEventTime: (value) => {
    set({ eventTime: value });
  },
  setLocale: (locale) => {
    set({ locale });
  },
  loadEventDraft: (d) => {
    const cfg = d.config;
    const childrenSelected =
      (d.childrenCount ?? 0) > 0 ||
      !!cfg?.childFirstCourseId ||
      (cfg?.childSecondCourseIds?.length ?? 0) > 0 ||
      (cfg?.childThirdCourseIds?.length ?? 0) > 0 ||
      (cfg?.childHotAppetizerIds?.length ?? 0) > 0 ||
      Object.keys(cfg?.childReplacements ?? {}).length > 0;
    set({
      editingEventId: d.editingEventId,
      selectedHallId: d.hallId || undefined,
      selectedTableCategoryId: d.tableCategoryId || undefined,
      guestCount: Math.max(d.guestCount, 0),
      customerName: d.customerName,
      customerPhone: d.customerPhone,
      secondCustomerName: d.secondCustomerName,
      secondCustomerPhone: d.secondCustomerPhone,
      eventDate: d.eventDate,
      eventTime: d.eventTime,
      depositCents: d.depositCents ?? 0,
      // Prior adult selections (empty for a brand-new event).
      selectedHotAppetizerIds: cfg?.hotAppetizerIds ?? [],
      selectedFirstCourseId: cfg?.firstCourseId,
      selectedSecondCourseIds: cfg?.secondCourseIds ?? [],
      selectedThirdCourseIds: cfg?.thirdCourseIds ?? [],
      replacements: cfg?.replacements ?? {},
      removedPackageItemIds: cfg?.removedPackageItemIds ?? [],
      selectedItems: cfg?.extras ?? {},
      selectedExtraServiceIds: cfg?.extraServiceIds ?? [],
      // Children's table.
      childrenTableSelected: childrenSelected,
      childrenCount: d.childrenCount ?? 0,
      childHotAppetizerIds: cfg?.childHotAppetizerIds ?? [],
      childFirstCourseId: cfg?.childFirstCourseId,
      childSecondCourseIds: cfg?.childSecondCourseIds ?? [],
      childThirdCourseIds: cfg?.childThirdCourseIds ?? [],
      childReplacements: cfg?.childReplacements ?? {},
    });
  },
  reset: () => {
    set({
      selectedItems: {},
      selectedHallId: undefined,
      selectedTableCategoryId: undefined,
      selectedHotAppetizerIds: [],
      selectedFirstCourseId: undefined,
      selectedSecondCourseIds: [],
      selectedThirdCourseIds: [],
      replacements: {},
      removedPackageItemIds: [],
      selectedExtraServiceIds: [],
      guestCount: 0,
      editingEventId: undefined,
      customerName: '',
      customerPhone: '',
      secondCustomerName: '',
      secondCustomerPhone: '',
      eventDate: '',
      eventTime: '',
      depositCents: 0,
      eventType: 'RESERVATION',
      eventNotes: '',
      birthdayPersonName: '',
      brideName: '',
      groomName: '',
      honoreePersonName: '',
      childrenTableSelected: false,
      childrenCount: 0,
      childHotAppetizerIds: [],
      childFirstCourseId: undefined,
      childSecondCourseIds: [],
      childThirdCourseIds: [],
      childReplacements: {},
      locale: defaultLocale
    });
  }
}), {
  /**
   * The kiosk booking survives a reload and a browser Back.
   *
   * SESSION storage on purpose. The tablet is a shared device, so a draft that
   * outlived the tab would greet the next guest with somebody else's order;
   * session storage dies with the tab, and nothing has to remember to clear it.
   * Within one visit it is exactly what a reload needs. See store/tabletDraft.ts
   * for the rule that decides whether a restored draft is resumed.
   *
   * `locale` is left out: it is a preference of the person standing there, not
   * part of the booking, and it is already re-chosen from the header.
   */
  name: TABLET_DRAFT_KEY,
  storage: createJSONStorage(() => sessionStorage),
  partialize: ({ locale, ...draft }) => draft,
}));
