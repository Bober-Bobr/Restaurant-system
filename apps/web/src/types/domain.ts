export type EventMenuSelection = {
  id: string;
  menuItem: Pick<MenuItem, 'id' | 'name' | 'category'>;
  quantity: number;
  unitPriceCents: number;
};

export type Event = {
  id: number;
  customerName: string;
  customerPhone?: string;
  eventDate: string;
  guestCount: number;
  status: 'DRAFT' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED';
  eventType?: 'RESERVATION' | 'BANQUET' | 'WEDDING' | 'BIRTHDAY' | 'PRIVATE_PARTY' | 'CORPORATE' | 'FOTIHA_TUI' | 'NACHOR_OSHI';
  birthdayPersonName?: string;
  brideName?: string;
  groomName?: string;
  honoreePersonName?: string;
  region?: 'US' | 'CA' | 'GB' | 'DE' | 'FR' | 'IT' | 'ES' | 'RU' | 'CN' | 'JP' | 'KR' | 'AU' | 'UZ' | 'EU';
  hallId?: string;
  tableCategoryId?: string;
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

export type TableCategoryPackageItem = {
  id: string;
  servings: number;
  menuItem: Pick<MenuItem, 'id' | 'name' | 'description' | 'category' | 'priceCents' | 'photoUrl'>;
};

export type TableCategory = {
  id: string;
  name: string;
  includedCategories: string;
  ratePerPerson: number;
  discountPercent?: number;
  description?: string;
  photoUrl?: string;
  photos?: string[];
  isActive: boolean;
  sortOrder?: number;
  packageItems?: TableCategoryPackageItem[];
};

export type TabletStatus = 'NONE' | 'FREE' | 'PAID';

export type MenuItem = {
  id: string;
  name: string;
  description?: string;
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
