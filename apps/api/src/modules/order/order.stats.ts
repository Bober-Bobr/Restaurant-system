import { Prisma } from '@prisma/client';
import { prisma } from '../../db/prisma.js';

// ── Closed-order statistics ─────────────────────────────────────────────────
// Aggregated in SQL rather than by loading rows and summing in Node: a year of
// activity is thousands of orders and tens of thousands of lines, and the
// calendar alone needs 365 buckets.
//
// TIMEZONE. Every bucket is computed in the VIEWER's local time, not UTC. A
// restaurant serving until 02:00 closes orders that are already "yesterday" in
// UTC — bucketing by UTC would scatter a single busy night across two squares of
// the activity calendar and quietly understate the late shift. The client sends
// its offset; the server clamps it to a real-world range and does the shifting.

export type Granularity = 'day' | 'week' | 'month' | 'year';

export type StatsBucket = {
  /** ISO date of the bucket start, in the viewer's local time. */
  bucket: string;
  orders: number;
  /** Sum of the snapshotted line prices, in tiyin. */
  revenueCents: number;
};

export type StatsScope = {
  restaurantId: string;
  /** Null aggregates the whole restaurant (Food Admin view). */
  waiterId: string | null;
  from: Date;
  to: Date;
  tzOffsetMinutes: number;
};

/**
 * Resolve the reporting window. Both ends are optional — a client that just
 * opens the tab gets the last 12 months, which is also exactly what retention
 * keeps, so the default range can never promise data that has been purged.
 * A reversed range is swapped rather than returning nothing, since an empty
 * chart looks identical to "you had no orders".
 */
export function resolveRange(from?: string, to?: string): { from: Date; to: Date } {
  const end = to ? new Date(to) : new Date();
  const start = from ? new Date(from) : new Date(end.getTime() - 365 * 24 * 60 * 60 * 1000);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    const now = new Date();
    return { from: new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000), to: now };
  }
  return start <= end ? { from: start, to: end } : { from: end, to: start };
}

/** Real-world offsets run −12:00 … +14:00; anything else is a client bug or a probe. */
export function clampOffset(minutes: unknown): number {
  const value = Number(minutes);
  if (!Number.isFinite(value)) return 0;
  return Math.max(-720, Math.min(840, Math.round(value)));
}

// `date_trunc`'s unit is a plain text argument, so it parameterises safely — but
// the value is still restricted to this set rather than passed through, so a
// caller can never reach anything else.
const UNITS: Record<Granularity, string> = {
  day: 'day', week: 'week', month: 'month', year: 'year',
};

export function parseGranularity(value: unknown): Granularity {
  return value === 'week' || value === 'month' || value === 'year' ? value : 'day';
}

/**
 * Orders and revenue per bucket, closed orders only.
 *
 * Revenue joins OrderItem, so `COUNT(DISTINCT o.id)` is required — a plain
 * COUNT(*) would multiply each order by its number of lines and report a
 * five-dish order as five orders.
 */
export async function ordersByBucket(scope: StatsScope, granularity: Granularity): Promise<StatsBucket[]> {
  const unit = UNITS[granularity];
  const shift = `${scope.tzOffsetMinutes} minutes`;

  const rows = await prisma.$queryRaw<{ bucket: Date; orders: bigint; revenue: bigint }[]>`
    SELECT date_trunc(${unit}, o."closedAt" + ${shift}::interval) AS bucket,
           COUNT(DISTINCT o.id)                                   AS orders,
           COALESCE(SUM(i."unitPriceCents" * i.quantity), 0)       AS revenue
      FROM "Order" o
      LEFT JOIN "OrderItem" i ON i."orderId" = o.id
     WHERE o.status = 'CLOSED'
       AND o."restaurantId" = ${scope.restaurantId}
       AND o."closedAt" >= ${scope.from}
       AND o."closedAt" <  ${scope.to}
       AND (${scope.waiterId}::text IS NULL OR o."waiterId" = ${scope.waiterId})
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

/** Per-employee totals for the restaurant — the Food Admin's comparison view. */
export async function totalsByEmployee(scope: Omit<StatsScope, 'waiterId'>) {
  const rows = await prisma.$queryRaw<
    { waiterId: string | null; username: string | null; orders: bigint; revenue: bigint }[]
  >`
    SELECT o."waiterId"                                     AS "waiterId",
           u.username                                       AS username,
           COUNT(DISTINCT o.id)                             AS orders,
           COALESCE(SUM(i."unitPriceCents" * i.quantity), 0) AS revenue
      FROM "Order" o
      LEFT JOIN "OrderItem" i ON i."orderId" = o.id
      LEFT JOIN "AdminUser" u ON u.id = o."waiterId"
     WHERE o.status = 'CLOSED'
       AND o."restaurantId" = ${scope.restaurantId}
       AND o."closedAt" >= ${scope.from}
       AND o."closedAt" <  ${scope.to}
     GROUP BY 1, 2
     ORDER BY 3 DESC
  `;
  return rows.map((row) => ({
    waiterId: row.waiterId,
    username: row.username ?? '—',
    orders: Number(row.orders),
    revenueCents: Number(row.revenue),
  }));
}

/** The closed-order list behind the Statistics page, with its filters. */
export async function listClosedOrders(params: {
  restaurantId: string;
  waiterId: string | null;
  from?: Date;
  to?: Date;
  tableNumber?: string;
  take: number;
  skip: number;
}) {
  const where: Prisma.OrderWhereInput = {
    restaurantId: params.restaurantId,
    status: 'CLOSED',
    ...(params.waiterId ? { waiterId: params.waiterId } : {}),
    ...(params.from || params.to
      ? { closedAt: { ...(params.from ? { gte: params.from } : {}), ...(params.to ? { lt: params.to } : {}) } }
      : {}),
    // Table numbers are free text entered on a phone ("12", "12a", "terrace 3"),
    // so match loosely and case-insensitively rather than on equality.
    ...(params.tableNumber ? { tableNumber: { contains: params.tableNumber, mode: 'insensitive' } } : {}),
  };

  const [items, total] = await Promise.all([
    prisma.order.findMany({
      where,
      include: { items: true, waiter: { select: { id: true, username: true } } },
      orderBy: { closedAt: 'desc' },
      take: params.take,
      skip: params.skip,
    }),
    prisma.order.count({ where }),
  ]);
  return { items, total };
}

/** Distinct table numbers seen in the range — populates the table filter. */
export async function listTableNumbers(restaurantId: string, waiterId: string | null) {
  const rows = await prisma.order.findMany({
    where: {
      restaurantId, status: 'CLOSED', tableNumber: { not: null },
      ...(waiterId ? { waiterId } : {}),
    },
    select: { tableNumber: true },
    distinct: ['tableNumber'],
    take: 200,
  });
  return rows
    .map((row) => row.tableNumber!)
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}
