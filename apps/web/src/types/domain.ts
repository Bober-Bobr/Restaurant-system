export type Event = {
  id: string;
  customerName: string;
  customerPhone?: string;
  eventDate: string;
  guestCount: number;
  status: 'DRAFT' | 'CONFIRMED' | 'CANCELLED';
  eventType?: 'RESERVATION' | 'BANQUET' | 'WEDDING' | 'PRIVATE_PARTY' | 'CORPORATE';
  region?: 'US' | 'CA' | 'GB' | 'DE' | 'FR' | 'IT' | 'ES' | 'RU' | 'CN' | 'JP' | 'KR' | 'AU' | 'UZ' | 'EU';
  hallId?: string;
  tableCategoryId?: string;
  hall?: Hall;
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

export type TableCategory = {
  id: string;
  name: string;
  seatingCapacity: number;
  mealPackage: string;
  ratePerPerson: number;
  description?: string;
  photoUrl?: string;
  isActive: boolean;
};

export type MenuItem = {
  id: string;
  name: string;
  description?: string;
  category: 'HOT_APPETIZERS' | 'FIRST_COURSE' | 'SECOND_COURSE';
  priceCents: number;
  photoUrl?: string;
  isActive: boolean;
};

export type PricingSummary = {
  eventId: string;
  guestCount: number;
  subtotalCents: number;
  serviceFeeCents: number;
  taxCents: number;
  totalCents: number;
  perGuestCents: number;
};
