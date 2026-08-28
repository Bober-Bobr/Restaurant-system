/**
 * Which product a menu read is for. The two sell from one dish table and each
 * switches off the categories it has no use for, so a read of the menu — and a
 * save of the exclusions — has to name one.
 */
export type MenuScope = 'banquet' | 'catering';

// Both lists, as the settings endpoint returns them.
export type ExcludedCategories = Record<MenuScope, MenuItem['category'][]>;

export type EventMenuSelection = {
  id: string;
  menuItem: Pick<MenuItem, 'id' | 'name' | 'category'>;
  quantity: number;
  unitPriceCents: number;
};

// A partial (installment) payment towards the event invoice, in tiyin.
export type EventPayment = {
  id: string;
  amountCents: number;
  note?: string | null;
  createdAt: string;
};

// Full tablet menu-selection snapshot persisted on an event so it round-trips
// between the admin Events page and the Tablet page.
export type EventMenuConfig = {
  hotAppetizerIds?: string[];
  firstCourseId?: string;
  secondCourseIds: string[];
  thirdCourseIds: string[];
  replacements: Record<string, string>;
  childHotAppetizerIds?: string[];
  childFirstCourseId?: string;
  childSecondCourseIds: string[];
  childThirdCourseIds: string[];
  childReplacements: Record<string, string>;
  // Selected paid "Extras": menu-item id → quantity (per-guest handled elsewhere).
  extras: Record<string, number>;
  // Additional paid restaurant services chosen on the Summary page.
  extraServiceIds?: string[];
};

export type Event = {
  id: number;
  menuConfig?: EventMenuConfig | null;
  customerName: string;
  customerPhone?: string;
  secondCustomerName?: string;
  secondCustomerPhone?: string;
  eventDate: string;
  // Set when the event was rescheduled: the date it was moved FROM (old → new).
  originalEventDate?: string | null;
  guestCount: number;
  // Prepaid deposit in tiyin (1/100 so'm); subtracted from the event total.
  depositCents?: number;
  // Partial payments recorded against the invoice.
  payments?: EventPayment[];
  // Deadline for settling the debt (outstanding balance after the event starts).
  debtDeadline?: string | null;
  status: 'DRAFT' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED' | 'MENU_NOT_SELECTED';
  eventType?: 'RESERVATION' | 'BANQUET' | 'WEDDING' | 'BIRTHDAY' | 'PRIVATE_PARTY' | 'CORPORATE' | 'FOTIHA_TUI' | 'NACHOR_OSHI';
  birthdayPersonName?: string;
  brideName?: string;
  groomName?: string;
  honoreePersonName?: string;
  region?: 'US' | 'CA' | 'GB' | 'DE' | 'FR' | 'IT' | 'ES' | 'RU' | 'CN' | 'JP' | 'KR' | 'AU' | 'UZ' | 'EU';
  hallId?: string;
  tableCategoryId?: string;
  childrenTableCategoryId?: string;
  childrenCount?: number;
  hall?: Hall;
  tableCategory?: TableCategory;
  selections?: EventMenuSelection[];
  notes?: string;
};

export type Hall = {
  id: string;
  name: string;
  capacity: number;
  description?: string;
  photoUrl?: string;
  photos?: string[];
  isActive: boolean;
};

// An additional paid service the restaurant offers alongside the banquet
// (decor, photographer, live music…). Guests pick these on the Summary page.
export type ExtraService = {
  id: string;
  name: string;
  description?: string | null;
  // Price in tiyin (1/100 so'm).
  priceCents: number;
  // Photo/video URLs served from /uploads.
  media?: string[];
  isActive: boolean;
  sortOrder: number;
};

export type TableCategoryPackageItem = {
  id: string;
  servings: number;
  menuItem: Pick<MenuItem, 'id' | 'name' | 'description' | 'nameI18n' | 'descriptionI18n' | 'category' | 'priceCents' | 'photoUrl' | 'isBestseller'>;
};

export type TableType = 'ADULT' | 'CHILDREN';
// Banquet event type a table category belongs to (guest picks one first on the tablet).
export type TableEventType = 'NAHOR' | 'FOTIHA' | 'TUI' | 'OTHERS';

export type TableCategory = {
  id: string;
  name: string;
  includedCategories: string;
  ratePerPerson: number;
  discountPercent?: number;
  tableType?: TableType;
  eventType?: TableEventType;
  // How many hot appetizers a guest may pick for this set menu (default 3).
  hotAppetizerCount?: number;
  description?: string;
  photoUrl?: string;
  photos?: string[];
  // MenuItem ids allowed as free substitutions for this table category only.
  // null/undefined = fall back to the legacy global MenuItem.tabletStatus 'FREE'.
  freeSubstitutionItemIds?: string[] | null;
  isActive: boolean;
  sortOrder?: number;
  packageItems?: TableCategoryPackageItem[];
};

export type TabletStatus = 'NONE' | 'FREE' | 'PAID';

export type DishI18n = { en?: string; ru?: string; uz?: string };

export type MenuItem = {
  id: string;
  name: string;
  description?: string;
  nameI18n?: DishI18n | null;
  descriptionI18n?: DishI18n | null;
  category:
    | 'SOUPS' | 'PIZZA' | 'COLD_APPETIZERS' | 'GRILL' | 'PASTRY' | 'HOT_APPETIZERS'
    | 'BEER_SNACKS' | 'DESSERT' | 'LAMB_DISHES' | 'BEEF_DISHES' | 'CHICKEN_DISHES'
    | 'SIDE_DISHES' | 'PASTA' | 'SOFT_DRINKS' | 'STEAKS' | 'ENERGY_DRINKS'
    | 'SALADS_OIL' | 'SALADS_MAYO' | 'COFFEE' | 'SUSHI_ROLLS'
    | 'DRIED_FRUITS' | 'CANDIES'
    | 'FIRST_COURSE' | 'SECOND_COURSE' | 'THIRD_COURSE' | 'SWEETS' | 'FRUITS'
    | 'ALCOHOL' | 'LEMONADES' | 'NON_ALCOHOLIC_COCKTAILS' | 'ALCOHOLIC_COCKTAILS'
    | 'MILKSHAKES' | 'TEA_MENU' | 'FRESH_JUICES' | 'LIQUEURS';
  priceCents: number;
  photoUrl?: string;
  isActive: boolean;
  showOnTablet?: boolean;
  tabletStatus?: TabletStatus;
  isBestseller?: boolean;
  isOutOfStock?: boolean;
  sortOrder?: number;
  subcategoryId?: string | null;
  subcategory?: Subcategory | null;
};

export type Subcategory = {
  id: string;
  name: string;
  category: MenuItem['category'];
  sortOrder?: number;
  hidden?: boolean;
};

// ── Restaurant Manager expense ledger ──
export type ProductExpense = {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  amountSum: number; // whole so'm
  sortOrder: number;
  eventId: string;
};

export type SalaryExpense = {
  id: string;
  name: string;
  amountSum: number; // whole so'm
  sortOrder: number;
  eventId: string;
};

export type AdditionalExpense = {
  id: string;
  name: string;
  amountSum: number; // whole so'm
  sortOrder: number;
  eventId: string;
};

// Spend on the "Additional Services" product — its own section, separate from
// AdditionalExpense (which is any unplanned cost).
export type ServiceExpense = {
  id: string;
  name: string;
  amountSum: number; // whole so'm
  sortOrder: number;
  eventId: string;
};

export type DayEventType = 'NAHOR' | 'FOTIHA' | 'TUI' | 'OTHERS';

export type DayEvent = {
  id: string;
  type: DayEventType;
  dayId: string;
  bookingName: string | null;
  guestCount: number;
  pricePerGuestSum: number; // whole so'm
  report: string | null;
  // null = guest revenue is guests x price per guest; a number overrides it.
  manualGuestsSum: number | null;
  products: ProductExpense[];
  salaries: SalaryExpense[];
  additionals: AdditionalExpense[];
  services: ServiceExpense[];
};

export type DayExtraExpense = {
  id: string;
  name: string;
  amountSum: number; // whole so'm
  sortOrder: number;
  dayId: string;
};

export type ExpenseDay = {
  id: string;
  date: string; // YYYY-MM-DD
  allocatedSum: number; // whole so'm
  report: string | null;
  isClosed: boolean;
  closedAt: string | null;
  managerId: string;
  events: DayEvent[];
  extras: DayExtraExpense[];
};

export type PricingSummary = {
  eventId: number;
  guestCount: number;
  subtotalCents: number;
  serviceFeeCents: number;
  taxCents: number;
  totalCents: number;
  perGuestCents: number;
};
