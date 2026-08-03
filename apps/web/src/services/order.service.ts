import axios from 'axios';
import { httpClient } from './http';

const apiRoot = (): string =>
  (import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api').replace(/\/$/, '');

export type OrderStatus = 'PENDING' | 'OPEN' | 'CLOSED' | 'CANCELLED';

/** What the guest's own device is allowed to see. Deliberately narrow. */
export type GuestOrder = {
  code: string;
  guestToken: string;
  status: OrderStatus;
  comment: string | null;
  tableNumber: string | null;
  callPending: boolean;
  claimed: boolean;
  createdAt: string;
  items: { menuItemId: string | null; name: string; unitPriceCents: number; quantity: number }[];
  totalCents: number;
};

/** The waiter's fuller view. */
export type WaiterOrder = {
  id: string;
  restaurantId: string;
  code: string;
  status: OrderStatus;
  comment: string | null;
  tableNumber: string | null;
  waiterId: string | null;
  claimedAt: string | null;
  closedAt: string | null;
  callPendingAt: string | null;
  createdAt: string;
  items: {
    id: string;
    menuItemId: string | null;
    nameSnapshot: string;
    unitPriceCents: number;
    quantity: number;
  }[];
  waiter: { id: string; username: string } | null;
};

export type OrderLineInput = { menuItemId: string; quantity: number };

// Public calls use bare axios — these are unauthenticated by design and must not
// pick up the admin auth interceptor, exactly like the public review service.
export const publicOrderService = {
  async place(payload: { restaurantId: string; comment?: string | null; items: OrderLineInput[] }): Promise<GuestOrder> {
    const { data } = await axios.post(`${apiRoot()}/public/orders`, payload);
    return data;
  },
  async get(guestToken: string): Promise<GuestOrder> {
    const { data } = await axios.get(`${apiRoot()}/public/orders/${encodeURIComponent(guestToken)}`);
    return data;
  },
  async callWaiter(guestToken: string): Promise<GuestOrder> {
    const { data } = await axios.post(`${apiRoot()}/public/orders/${encodeURIComponent(guestToken)}/call-waiter`);
    return data;
  },
};

// Waiter calls go through httpClient so they carry the access token and get the
// auto-refresh-on-401 behaviour.
export const orderService = {
  async listMine(status?: OrderStatus): Promise<WaiterOrder[]> {
    const { data } = await httpClient.get('/orders/mine', { params: status ? { status } : undefined });
    return data;
  },
  async alertCount(): Promise<number> {
    const { data } = await httpClient.get('/orders/alerts/count');
    return data.count ?? 0;
  },
  async claim(code: string, tableNumber: string): Promise<WaiterOrder> {
    const { data } = await httpClient.post('/orders/claim', { code, tableNumber });
    return data;
  },
  async update(
    id: string,
    payload: { items?: OrderLineInput[]; comment?: string | null; tableNumber?: string },
  ): Promise<WaiterOrder> {
    const { data } = await httpClient.patch(`/orders/${id}`, payload);
    return data;
  },
  async acknowledge(id: string): Promise<WaiterOrder> {
    const { data } = await httpClient.post(`/orders/${id}/acknowledge`);
    return data;
  },
  async close(id: string): Promise<WaiterOrder> {
    const { data } = await httpClient.post(`/orders/${id}/close`);
    return data;
  },
};

/** Sum a waiter order's lines — the snapshotted prices, not the live menu. */
export function orderTotalCents(order: WaiterOrder): number {
  return order.items.reduce((sum, line) => sum + line.unitPriceCents * line.quantity, 0);
}

// ── Statistics over closed orders ───────────────────────────────────────────

export type Granularity = 'day' | 'week' | 'month' | 'year';
export type StatsScope = 'me' | 'restaurant';

export type StatsBucket = { bucket: string; orders: number; revenueCents: number };
export type EmployeeTotal = { waiterId: string | null; username: string; orders: number; revenueCents: number };
export type ClosedOrderPage = { items: WaiterOrder[]; total: number };

export type StatsFilters = {
  from?: Date;
  to?: Date;
  granularity?: Granularity;
  scope?: StatsScope;
  table?: string;
  take?: number;
  skip?: number;
};

// The server buckets in the VIEWER's local time, so every stats call carries the
// browser's offset. Without it a restaurant serving past midnight would see a
// single busy night split across two days.
function statsParams(filters: StatsFilters): Record<string, string | number> {
  const params: Record<string, string | number> = {
    tzOffsetMinutes: -new Date().getTimezoneOffset(),
  };
  if (filters.from) params.from = filters.from.toISOString();
  if (filters.to) params.to = filters.to.toISOString();
  if (filters.granularity) params.granularity = filters.granularity;
  if (filters.scope) params.scope = filters.scope;
  if (filters.table) params.table = filters.table;
  if (filters.take != null) params.take = filters.take;
  if (filters.skip != null) params.skip = filters.skip;
  return params;
}

export const orderStatsService = {
  async buckets(filters: StatsFilters): Promise<StatsBucket[]> {
    const { data } = await httpClient.get('/orders/stats', { params: statsParams(filters) });
    return data;
  },
  async employees(filters: StatsFilters): Promise<EmployeeTotal[]> {
    const { data } = await httpClient.get('/orders/stats/employees', { params: statsParams(filters) });
    return data;
  },
  async history(filters: StatsFilters): Promise<ClosedOrderPage> {
    const { data } = await httpClient.get('/orders/history', { params: statsParams(filters) });
    return data;
  },
  async tables(scope?: StatsScope): Promise<string[]> {
    const { data } = await httpClient.get('/orders/tables', { params: scope ? { scope } : undefined });
    return data;
  },
};
