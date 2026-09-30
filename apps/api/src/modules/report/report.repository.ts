/**
 * What the owner's reports read.
 *
 * Three notes that decide the shape of everything here:
 *
 * 1. **Two money units.** The expense ledger's columns are whole so'm; every
 *    other money column in the product is tiyin. Nothing is converted in this
 *    file — the rows come back as stored and `report.finance.ts` does the one
 *    conversion, so there is exactly one place that can get it wrong.
 * 2. **The ledger is keyed by MANAGER, not by restaurant.** `ExpenseDay.managerId`
 *    points at an `AdminUser`, and the link to a restaurant is that user's
 *    `restaurantId` (which is why `createUserAsChief` refuses to make an owner's
 *    RESTAURANT_MANAGER without one). A manager with no restaurant — a
 *    Chief-Admin-created one — has a ledger that belongs to no restaurant and is
 *    therefore invisible to this report. `ledgerManagers` is what the service
 *    uses to say so on screen instead of silently reporting zero.
 * 3. **Aggregates that would load thousands of rows are SQL.** Orders and their
 *    lines are the same shape of problem `order.stats.ts` already solved that
 *    way, and for the same reason: a year of a busy restaurant is tens of
 *    thousands of lines and summing them in Node to draw twelve bars is waste.
 *    Bookings are read as rows because the invoice arithmetic they need
 *    (`utils/invoice.ts`) is shared code that must not be re-expressed in SQL.
 */

import { AdminRole } from '@prisma/client';
import { prisma } from '../../db/prisma.js';

const lineOrder = [{ sortOrder: 'asc' as const }, { createdAt: 'asc' as const }];

/** The restaurant managers whose ledgers these restaurants' figures come from. */
export async function ledgerManagers(restaurantIds: string[]) {
  return prisma.adminUser.findMany({
    where: { role: AdminRole.RESTAURANT_MANAGER, restaurantId: { in: restaurantIds } },
    select: { id: true, username: true, restaurantId: true },
  });
}

/**
 * The ledger days in the window.
 *
 * `ExpenseDay.date` is a `YYYY-MM-DD` **string**, not a timestamp, so the range
 * is a string comparison — which is correct for ISO dates and needs no timezone
 * reasoning at all. The strings were written in Tashkent local time by
 * `event.ledgerSync.ts`, so they already mean the day the restaurant worked.
 */
export async function ledgerDays(managerIds: string[], fromKey: string, toKey: string) {
  if (managerIds.length === 0) return [];
  return prisma.expenseDay.findMany({
    where: { managerId: { in: managerIds }, date: { gte: fromKey, lte: toKey } },
    orderBy: { date: 'asc' },
    select: {
      id: true, date: true, managerId: true, allocatedSum: true, isClosed: true,
      extras: { select: { amountSum: true }, orderBy: lineOrder },
      events: {
        orderBy: { createdAt: 'asc' },
        select: {
          type: true, guestCount: true, pricePerGuestSum: true, manualGuestsSum: true,
          products: { select: { amountSum: true }, orderBy: lineOrder },
          salaries: { select: { amountSum: true }, orderBy: lineOrder },
          additionals: { select: { amountSum: true }, orderBy: lineOrder },
          services: { select: { amountSum: true }, orderBy: lineOrder },
        },
      },
    },
  });
}

/**
 * The bookings in the window, with everything the invoice arithmetic needs.
 *
 * Both sections (Banquet and Small Banquets) are included and the section is
 * carried on each row: an owner owns the whole restaurant, and the section split
 * is a boundary between the STAFF of two products, not a fact an owner should
 * have to read two reports to get around.
 */
export async function bookings(restaurantIds: string[], from: Date, to: Date) {
  return prisma.event.findMany({
    where: { restaurantId: { in: restaurantIds }, eventDate: { gte: from, lte: to } },
    orderBy: { eventDate: 'asc' },
    select: {
      id: true, eventNumber: true, eventDate: true, status: true, section: true,
      eventType: true, guestCount: true, childrenCount: true, depositCents: true,
      hallId: true, restaurantId: true,
      tableCategory: { select: { ratePerPerson: true } },
      selections: { select: { quantity: true, unitPriceCents: true } },
      payments: { select: { amountCents: true } },
    },
  });
}

export type OrderBucketRow = { bucket: string; orders: number; revenueCents: number };

/**
 * Closed food-service orders per day, in the reader's own time.
 *
 * `COUNT(DISTINCT o.id)` is mandatory, not tidiness: the revenue sum needs the
 * join to `OrderItem`, and a plain `COUNT(*)` over the joined rows reports a
 * five-dish order as five orders. Same trap `order.stats.ts` documents.
 *
 * Only CLOSED orders count. A PENDING or OPEN order is money not yet taken, and
 * an owner's revenue figure that included them would move when a waiter cancels.
 */
export async function ordersByDay(
  restaurantIds: string[], from: Date, to: Date, tzOffsetMinutes: number,
): Promise<OrderBucketRow[]> {
  if (restaurantIds.length === 0) return [];
  const shift = `${tzOffsetMinutes} minutes`;
  const rows = await prisma.$queryRaw<{ bucket: Date; orders: bigint; revenue: bigint }[]>`
    SELECT date_trunc('day', o."closedAt" + ${shift}::interval) AS bucket,
           COUNT(DISTINCT o.id)                                 AS orders,
           COALESCE(SUM(i."unitPriceCents" * i.quantity), 0)     AS revenue
      FROM "Order" o
      LEFT JOIN "OrderItem" i ON i."orderId" = o.id
     WHERE o.status = 'CLOSED'
       AND o."restaurantId" = ANY(${restaurantIds})
       AND o."closedAt" >= ${from}
       AND o."closedAt" <= ${to}
     GROUP BY 1
     ORDER BY 1
  `;
  return rows.map((row) => ({
    // The shifted timestamp is already local wall-clock; take the date part.
    bucket: row.bucket.toISOString().slice(0, 10),
    orders: Number(row.orders),
    revenueCents: Number(row.revenue),
  }));
}

export type WaiterRow = {
  waiterId: string | null;
  username: string;
  restaurantId: string | null;
  orders: number;
  revenueCents: number;
  tables: number;
  lastClosedAt: Date | null;
};

/**
 * Per-waiter figures for the window.
 *
 * `waiterId` can be null — `Order.waiterId` is `onDelete: SetNull`, so a closed
 * order outlives the account that served it. Those rows are kept and shown as
 * one "former staff" line rather than dropped, because dropping them would make
 * the per-waiter revenue add up to less than the restaurant's total with nothing
 * saying why.
 */
export async function waiters(
  restaurantIds: string[], from: Date, to: Date,
): Promise<WaiterRow[]> {
  if (restaurantIds.length === 0) return [];
  const rows = await prisma.$queryRaw<{
    waiterId: string | null; username: string | null; restaurantId: string | null;
    orders: bigint; revenue: bigint; tables: bigint; last: Date | null;
  }[]>`
    SELECT o."waiterId"                                       AS "waiterId",
           u.username                                         AS username,
           u."restaurantId"                                    AS "restaurantId",
           COUNT(DISTINCT o.id)                                AS orders,
           COALESCE(SUM(i."unitPriceCents" * i.quantity), 0)    AS revenue,
           COUNT(DISTINCT o."tableNumber")                     AS tables,
           MAX(o."closedAt")                                   AS last
      FROM "Order" o
      LEFT JOIN "OrderItem" i ON i."orderId" = o.id
      LEFT JOIN "AdminUser" u ON u.id = o."waiterId"
     WHERE o.status = 'CLOSED'
       AND o."restaurantId" = ANY(${restaurantIds})
       AND o."closedAt" >= ${from}
       AND o."closedAt" <= ${to}
     GROUP BY 1, 2, 3
     ORDER BY 5 DESC
  `;
  return rows.map((row) => ({
    waiterId: row.waiterId,
    username: row.username ?? '',
    restaurantId: row.restaurantId,
    orders: Number(row.orders),
    revenueCents: Number(row.revenue),
    tables: Number(row.tables),
    lastClosedAt: row.last,
  }));
}

/** Every dining area of every restaurant in scope, both sections, with its tables. */
export async function areas(restaurantIds: string[]) {
  return prisma.hall.findMany({
    where: { restaurantId: { in: restaurantIds } },
    orderBy: [{ section: 'asc' }, { name: 'asc' }],
    select: {
      id: true, name: true, capacity: true, isActive: true, section: true, kind: true,
      restaurantId: true,
      floorTables: { select: { seats: true } },
    },
  });
}

/** The dish table as the owner sees it: every system's price and every switch. */
export async function menuItems(restaurantIds: string[]) {
  return prisma.menuItem.findMany({
    where: { restaurantId: { in: restaurantIds } },
    orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }, { name: 'asc' }],
    select: {
      id: true, name: true, category: true, restaurantId: true,
      priceCents: true, priceCentsSmallBanquet: true, priceCentsCatering: true,
      disabledBanquet: true, disabledSmallBanquet: true, disabledCatering: true,
      isActive: true, isOutOfStock: true, isBestseller: true, tabletStatus: true,
      photoUrl: true, subcategoryId: true, createdAt: true,
    },
  });
}

export type DishDemandRow = { menuItemId: string; times: number; quantity: number; revenueCents: number };

/**
 * How often each dish was actually chosen, from BANQUET BOOKINGS in the window.
 *
 * Aggregated in SQL for the reason the order buckets are: a restaurant's
 * selections over a year run to tens of thousands of rows and the page wants one
 * number per dish.
 */
export async function dishesInBookings(
  restaurantIds: string[], from: Date, to: Date,
): Promise<DishDemandRow[]> {
  if (restaurantIds.length === 0) return [];
  const rows = await prisma.$queryRaw<{ id: string; times: bigint; qty: bigint; revenue: bigint }[]>`
    SELECT s."menuItemId"                                    AS id,
           COUNT(*)                                          AS times,
           COALESCE(SUM(s.quantity), 0)                      AS qty,
           COALESCE(SUM(s.quantity * s."unitPriceCents"), 0)  AS revenue
      FROM "EventMenuSelection" s
      JOIN "Event" e ON e.id = s."eventId"
     WHERE e."restaurantId" = ANY(${restaurantIds})
       AND e."eventDate" >= ${from}
       AND e."eventDate" <= ${to}
       AND e.status <> 'CANCELLED'
     GROUP BY 1
  `;
  return rows.map((row) => ({
    menuItemId: row.id, times: Number(row.times),
    quantity: Number(row.qty), revenueCents: Number(row.revenue),
  }));
}

/**
 * How often each dish was ordered on the food-service side, closed orders only.
 *
 * `menuItemId` is nullable on `OrderItem` — a deleted dish leaves its lines
 * behind with only the name snapshot — so those lines cannot be attributed to a
 * row in the dish table and are excluded here. Their money is still in the
 * restaurant's order revenue, which is read separately; this is a per-dish
 * demand figure, not a second revenue total.
 */
export async function dishesInOrders(
  restaurantIds: string[], from: Date, to: Date,
): Promise<DishDemandRow[]> {
  if (restaurantIds.length === 0) return [];
  const rows = await prisma.$queryRaw<{ id: string; times: bigint; qty: bigint; revenue: bigint }[]>`
    SELECT i."menuItemId"                                    AS id,
           COUNT(*)                                          AS times,
           COALESCE(SUM(i.quantity), 0)                      AS qty,
           COALESCE(SUM(i.quantity * i."unitPriceCents"), 0)  AS revenue
      FROM "OrderItem" i
      JOIN "Order" o ON o.id = i."orderId"
     WHERE o.status = 'CLOSED'
       AND o."restaurantId" = ANY(${restaurantIds})
       AND o."closedAt" >= ${from}
       AND o."closedAt" <= ${to}
       AND i."menuItemId" IS NOT NULL
     GROUP BY 1
  `;
  return rows.map((row) => ({
    menuItemId: row.id, times: Number(row.times),
    quantity: Number(row.qty), revenueCents: Number(row.revenue),
  }));
}

/** Who works here, by role — the "scope of the business" figures. */
export async function staffRoster(restaurantIds: string[]) {
  const rows = await prisma.adminUser.groupBy({
    by: ['role', 'restaurantId'],
    where: { restaurantId: { in: restaurantIds } },
    _count: { _all: true },
  });
  return rows.map((row) => ({
    role: row.role, restaurantId: row.restaurantId, count: row._count._all,
  }));
}

/** The restaurants in scope, for naming them on screen. */
export async function restaurants(restaurantIds: string[]) {
  return prisma.restaurant.findMany({
    where: { id: { in: restaurantIds } },
    orderBy: { name: 'asc' },
    select: {
      id: true, name: true, address: true, logoUrl: true,
      moduleBanquet: true, moduleCatering: true, moduleAddons: true,
      company: { select: { id: true, name: true } },
    },
  });
}

/** Counts that describe the shape of the business rather than its money. */
export async function activityCounts(restaurantIds: string[], from: Date, to: Date) {
  const [tableCategories, extraServices, reviews, invitations] = await Promise.all([
    prisma.tableCategory.count({ where: { restaurantId: { in: restaurantIds } } }),
    prisma.extraService.count({ where: { restaurantId: { in: restaurantIds } } }),
    prisma.review.count({ where: { restaurantId: { in: restaurantIds }, createdAt: { gte: from, lte: to } } }),
    prisma.invitation.count({ where: { restaurantId: { in: restaurantIds } } }),
  ]);
  return { tableCategories, extraServices, reviews, invitations };
}
