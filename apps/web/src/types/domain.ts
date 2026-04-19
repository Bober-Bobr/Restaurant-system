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
  status: 'DRAFT' | 'CONFIRMED' | 'CANCELLED';
  eventType?: 'RESERVATION' | 'BANQUET' | 'WEDDING' | 'BIRTHDAY' | 'PRIVATE_PARTY' | 'CORPORATE';
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
  isActive: boolean;
};

export type TableCategoryPackageItem = {
  id: string;
  menuItem: Pick<MenuItem, 'id' | 'name' | 'description' | 'category' | 'priceCents' | 'photoUrl'>;
};

export type TableCategory = {
  id: string;
  name: string;
  includedCategories: string;
  ratePerPerson: number;
  description?: string;
  photoUrl?: string;
  isActive: boolean;
  packageItems?: TableCategoryPackageItem[];
};

export type MenuItem = {
  id: string;
  name: string;
  description?: string;
  category: 'COLD_APPETIZERS' | 'HOT_APPETIZERS' | 'SALADS' | 'FIRST_COURSE' | 'SECOND_COURSE' | 'DRINKS' | 'SWEETS' | 'FRUITS';
  priceCents: number;
  photoUrl?: string;
  isActive: boolean;
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
