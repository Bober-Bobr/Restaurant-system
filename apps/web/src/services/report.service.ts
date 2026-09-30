import { httpClient } from './http';

/**
 * The owner's reports.
 *
 * Five reads and no writes — the API router has no POST or PATCH at all, which is
 * what makes it safe for this to be the one place all three systems' prices are
 * shown side by side.
 *
 * Every figure ending in `Cents` is TIYIN (1/100 so'm), including the ones that
 * came out of the expense ledger's whole-so'm columns: the API converts once so
 * the page has a single unit and `formatSum` works everywhere. A field named
 * `*Sum` would mean whole so'm, and there are none here on purpose.
 */

export type ReportFilters = {
  /** Undefined rolls every restaurant the owner has together. */
  restaurantId?: string;
  from?: Date;
  to?: Date;
};

/** Local `YYYY-MM-DD`; `toISOString()` would shift the day for anyone east of UTC. */
const dayKey = (date: Date): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

const params = (filters: ReportFilters) => ({
  ...(filters.restaurantId ? { restaurantId: filters.restaurantId } : {}),
  ...(filters.from ? { from: dayKey(filters.from) } : {}),
  ...(filters.to ? { to: dayKey(filters.to) } : {}),
  // The same offset the order statistics send. Buckets are computed in the
  // reader's own time, or a restaurant serving past midnight has one night's
  // trade split across two days.
  tz: -new Date().getTimezoneOffset(),
});

export type Profit = {
  guestsRevenueCents: number;
  servicesRevenueCents: number;
  revenueCents: number;
  productsCents: number;
  salariesCents: number;
  additionalsCents: number;
  extrasCents: number;
  spentCents: number;
  balanceCents: number;
};

export type DepartmentRow = Profit & {
  type: string;
  guests: number;
  days: number;
  marginPct: number | null;
};

export type MonthRow = {
  month: string;
  revenueCents: number;
  spentCents: number;
  balanceCents: number;
  ledgerRevenueCents: number;
  orderRevenueCents: number;
  orders: number;
  bookings: number;
};

export type DayRow = {
  date: string;
  revenueCents: number;
  spentCents: number;
  balanceCents: number;
  orders: number;
  bookings: number;
  guests: number;
};

export type BookingsSummary = {
  count: number;
  cancelled: number;
  guests: number;
  children: number;
  invoicedCents: number;
  collectedCents: number;
  outstandingCents: number;
  averageInvoiceCents: number;
  averageGuests: number;
  collectedPct: number | null;
  /** Bookings the ledger cannot be holding — one department takes one booking a day. */
  bookingsBeyondLedger: number;
  byStatus: { status: string; count: number }[];
  bySection: { section: string; count: number; guests: number; invoicedCents: number }[];
  byMonth: { month: string; count: number; guests: number; invoicedCents: number; collectedCents: number }[];
};

export type FinanceReport = {
  range: { from: string; to: string; fromKey: string; toKey: string };
  total: { revenueCents: number; spentCents: number; balanceCents: number; marginPct: number | null };
  ledger: Profit & {
    daysRecorded: number;
    daysClosed: number;
    allocatedCents: number;
    marginPct: number | null;
    byDepartment: DepartmentRow[];
  };
  /** Empty means nobody keeps this ledger — there is then no spending side at all. */
  ledgerManagers: { id: string; username: string; restaurantId: string | null }[];
  bookings: BookingsSummary;
  orders: { count: number; revenueCents: number };
  byMonth: MonthRow[];
  byDay: DayRow[];
};

export type AreaRow = {
  id: string;
  name: string;
  section: string;
  kind: string;
  restaurantId: string | null;
  capacity: number;
  isActive: boolean;
  tables: number;
  seats: number;
  count: number;
  guests: number;
  invoicedCents: number;
  collectedCents: number;
  outstandingCents: number;
  fillPct: number | null;
  revenuePerGuestCents: number;
};

export type AreasReport = {
  /** False, and said out loud: nothing in the product records spending per room. */
  spendingIsPerArea: boolean;
  areas: AreaRow[];
  unassigned: { count: number; guests: number; invoicedCents: number; collectedCents: number; outstandingCents: number };
  totals: { invoicedCents: number; collectedCents: number; bookings: number; guests: number };
};

export type MenuRow = {
  id: string;
  name: string;
  category: string;
  restaurantId: string | null;
  priceCents: number;
  priceCentsSmallBanquet: number;
  priceCentsCatering: number;
  disabledBanquet: boolean;
  disabledSmallBanquet: boolean;
  disabledCatering: boolean;
  isActive: boolean;
  isOutOfStock: boolean;
  isBestseller: boolean;
  tabletStatus: string;
  hasPhoto: boolean;
  bookedTimes: number;
  bookedQuantity: number;
  bookedRevenueCents: number;
  orderedTimes: number;
  orderedQuantity: number;
  orderedRevenueCents: number;
  demand: number;
  demandRevenueCents: number;
};

export type MenuReport = {
  totals: {
    dishes: number; active: number; outOfStock: number; bestsellers: number;
    withoutPhoto: number; offBanquet: number; offSmallBanquet: number;
    offCatering: number; neverChosen: number;
  };
  byCategory: {
    category: string; dishes: number; active: number; outOfStock: number; withPhoto: number;
    demand: number; demandRevenueCents: number; averagePriceCents: number;
  }[];
  items: MenuRow[];
};

export type WaiterRow = {
  id: string | null;
  username: string;
  restaurantId: string | null;
  orders: number;
  revenueCents: number;
  tables: number;
  averageOrderCents: number;
  lastClosedAt: string | null;
  /** The account is gone; its closed orders are not. */
  former: boolean;
};

export type StaffReport = {
  waiters: WaiterRow[];
  total: { orders: number; revenueCents: number };
  roster: { role: string; count: number }[];
  staffCount: number;
  unmeasuredRoles: string[];
};

export type ScopeReport = {
  restaurants: {
    id: string; name: string; address: string | null; logoUrl: string | null;
    company: { id: string; name: string } | null;
    modules: { banquet: boolean; catering: boolean; addons: boolean };
  }[];
  counts: { tableCategories: number; extraServices: number; reviews: number; invitations: number };
};

export const reportService = {
  async scope(filters: ReportFilters): Promise<ScopeReport> {
    const { data } = await httpClient.get('/reports/scope', { params: params(filters) });
    return data;
  },
  async finance(filters: ReportFilters): Promise<FinanceReport> {
    const { data } = await httpClient.get('/reports/finance', { params: params(filters) });
    return data;
  },
  async areas(filters: ReportFilters): Promise<AreasReport> {
    const { data } = await httpClient.get('/reports/areas', { params: params(filters) });
    return data;
  },
  async menu(filters: ReportFilters): Promise<MenuReport> {
    const { data } = await httpClient.get('/reports/menu', { params: params(filters) });
    return data;
  },
  async staff(filters: ReportFilters): Promise<StaffReport> {
    const { data } = await httpClient.get('/reports/staff', { params: params(filters) });
    return data;
  },
};
