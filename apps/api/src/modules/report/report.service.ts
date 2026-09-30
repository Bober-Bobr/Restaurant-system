/**
 * The owner's reports.
 *
 * ── THE ONE DECISION THIS FILE IS BUILT ON ─────────────────────────────────
 *
 * A restaurant's takings are recorded in three places, and TWO OF THEM OVERLAP:
 *
 *   · the expense ledger (`ExpenseDay` → `DayEvent`)  — revenue AND spending
 *   · banquet bookings (`Event` + payments)           — revenue only
 *   · food-service orders (`Order`)                   — revenue only
 *
 * `event.ledgerSync.ts` mirrors every banquet booking into the ledger as that
 * day's department booking, so **ledger revenue already contains the bookings**.
 * Adding the two together would report a wedding twice and hand the owner a
 * profit figure roughly double the truth — which is exactly the kind of number
 * somebody makes a decision on. So:
 *
 *   · **The ledger is the profit and loss.** It is the only source with a
 *     spending side, so it is the only one that can produce a balance.
 *   · **Bookings are reported as BOOKINGS** — how many, for how many guests,
 *     invoiced, collected, still owed — and never added into the P&L total.
 *     That is also the more useful cut: invoiced against collected is the
 *     question a booking answers, and the ledger cannot answer it at all.
 *   · **Orders are added**, because nothing mirrors them into the ledger, so
 *     they are the one revenue stream the ledger is genuinely missing. They are
 *     carried as their own field as well as in the total, so an owner can see
 *     which half of the business earned what.
 *
 * The mirror is also LOSSY, and the report says so rather than pretending
 * otherwise: `DayEvent` is unique on `[dayId, type]`, so a second wedding on one
 * evening overwrites the first in the ledger. `bookingsBeyondLedger` counts the
 * bookings that cannot have reached it, which is the honest way to show that the
 * ledger understates a busy day.
 */

import { AdminRole } from '@prisma/client';
import { invoiceOutstandingCents, invoicePaidCents, invoiceTotalCents } from '../../utils/invoice.js';
import {
  dayProfit, departmentProfit, marginPct, toTiyin, totalProfit,
  type LedgerDay, type Profit,
} from './report.finance.js';
import {
  daysBetween, localDayKey, localMonthKey, monthsBetween, type ReportScope,
} from './report.scope.js';
import * as repo from './report.repository.js';

// The ledger's four departments, in the order the ledger itself shows them.
const DEPARTMENTS = ['NAHOR', 'FOTIHA', 'TUI', 'OTHERS'] as const;

const zeroProfit = (): Profit => ({
  guestsRevenueCents: 0, servicesRevenueCents: 0, revenueCents: 0,
  productsCents: 0, salariesCents: 0, additionalsCents: 0, extrasCents: 0,
  spentCents: 0, balanceCents: 0,
});

const addProfit = (a: Profit, b: Profit): Profit => {
  const guestsRevenueCents = a.guestsRevenueCents + b.guestsRevenueCents;
  const servicesRevenueCents = a.servicesRevenueCents + b.servicesRevenueCents;
  const productsCents = a.productsCents + b.productsCents;
  const salariesCents = a.salariesCents + b.salariesCents;
  const additionalsCents = a.additionalsCents + b.additionalsCents;
  const extrasCents = a.extrasCents + b.extrasCents;
  const revenueCents = guestsRevenueCents + servicesRevenueCents;
  const spentCents = productsCents + salariesCents + additionalsCents + extrasCents;
  return {
    guestsRevenueCents, servicesRevenueCents, revenueCents,
    productsCents, salariesCents, additionalsCents, extrasCents,
    spentCents, balanceCents: revenueCents - spentCents,
  };
};

// ── Profit and loss ─────────────────────────────────────────────────────────

export async function financeReport(scope: ReportScope) {
  const fromKey = localDayKey(scope.from, scope.tzOffsetMinutes);
  const toKey = localDayKey(scope.to, scope.tzOffsetMinutes);

  const managers = await repo.ledgerManagers(scope.restaurantIds);
  const days = await repo.ledgerDays(managers.map((m) => m.id), fromKey, toKey);
  const [bookingRows, orderDays] = await Promise.all([
    repo.bookings(scope.restaurantIds, scope.from, scope.to),
    repo.ordersByDay(scope.restaurantIds, scope.from, scope.to, scope.tzOffsetMinutes),
  ]);

  const ledger = totalProfit(days as LedgerDay[]);

  // ── Per month, every month in the window ──
  // Built over `monthsBetween` rather than over the rows, so a month the
  // restaurant was shut is an empty column instead of being absent — a chart
  // drawn only from the months that have data puts August beside October and
  // reads as an unbroken run of trade.
  const months = monthsBetween(scope.from, scope.to, scope.tzOffsetMinutes);
  const ledgerByMonth = new Map<string, Profit>();
  for (const day of days) {
    const key = day.date.slice(0, 7);
    ledgerByMonth.set(key, addProfit(ledgerByMonth.get(key) ?? zeroProfit(), dayProfit(day as LedgerDay)));
  }
  const ordersByMonth = new Map<string, { orders: number; revenueCents: number }>();
  for (const bucket of orderDays) {
    const key = bucket.bucket.slice(0, 7);
    const at = ordersByMonth.get(key) ?? { orders: 0, revenueCents: 0 };
    ordersByMonth.set(key, { orders: at.orders + bucket.orders, revenueCents: at.revenueCents + bucket.revenueCents });
  }

  // ── Per department ──
  const byDepartment = DEPARTMENTS.map((type) => {
    let profit = zeroProfit();
    let guests = 0;
    let recorded = 0;
    for (const day of days) {
      for (const department of day.events) {
        if (department.type !== type) continue;
        profit = addProfit(profit, departmentProfit(department));
        guests += department.guestCount;
        // "Recorded" means somebody put a figure on it. A department that ran at
        // a genuine zero and one nobody filled in look identical in the columns,
        // and only this tells them apart.
        if (department.guestCount > 0 || department.manualGuestsSum != null) recorded += 1;
      }
    }
    return { type, ...profit, guests, days: recorded, marginPct: marginPct(profit) };
  });

  // ── Bookings, never added to the P&L (see the header) ──
  const bookings = summariseBookings(bookingRows, scope);

  const orders = {
    count: orderDays.reduce((sum, bucket) => sum + bucket.orders, 0),
    revenueCents: orderDays.reduce((sum, bucket) => sum + bucket.revenueCents, 0),
  };

  // The headline. Ledger revenue plus order revenue, because orders are the one
  // stream nothing mirrors into the ledger; bookings are deliberately absent.
  const totalRevenueCents = ledger.revenueCents + orders.revenueCents;
  const totalSpentCents = ledger.spentCents;
  const totalBalanceCents = totalRevenueCents - totalSpentCents;

  return {
    range: { from: scope.from.toISOString(), to: scope.to.toISOString(), fromKey, toKey },
    total: {
      revenueCents: totalRevenueCents,
      spentCents: totalSpentCents,
      balanceCents: totalBalanceCents,
      marginPct: marginPct({ revenueCents: totalRevenueCents, balanceCents: totalBalanceCents }),
    },
    ledger: {
      ...ledger,
      /** Days with a ledger entry at all — how much of the window is recorded. */
      daysRecorded: days.length,
      daysClosed: days.filter((day) => day.isClosed).length,
      /** Budget the manager was allocated, for the "was it spent?" question. */
      allocatedCents: days.reduce((sum, day) => sum + toTiyin(day.allocatedSum), 0),
      marginPct: marginPct(ledger),
      byDepartment,
    },
    /**
     * Whether a ledger exists at all. Without an assigned RESTAURANT_MANAGER
     * there is no spending side anywhere in the product, so the page must say
     * "nobody is keeping this ledger" rather than draw a flat zero line, which
     * reads as a restaurant that spent nothing.
     */
    ledgerManagers: managers.map((m) => ({ id: m.id, username: m.username, restaurantId: m.restaurantId })),
    bookings,
    orders,
    byMonth: months.map((month) => {
      const led = ledgerByMonth.get(month) ?? zeroProfit();
      const ord = ordersByMonth.get(month) ?? { orders: 0, revenueCents: 0 };
      const revenueCents = led.revenueCents + ord.revenueCents;
      return {
        month,
        revenueCents,
        spentCents: led.spentCents,
        balanceCents: revenueCents - led.spentCents,
        ledgerRevenueCents: led.revenueCents,
        orderRevenueCents: ord.revenueCents,
        orders: ord.orders,
        bookings: bookings.byMonth.find((row) => row.month === month)?.count ?? 0,
      };
    }),
    /** One square per day, for the activity calendar. */
    byDay: activityByDay(scope, days as LedgerDay[], orderDays, bookingRows),
  };
}

type BookingRow = Awaited<ReturnType<typeof repo.bookings>>[number];

/**
 * Bookings summarised, invoiced against collected.
 *
 * CANCELLED bookings are counted but contribute NO money: the invoice is void,
 * and leaving its total in "invoiced" would show an owner revenue they will never
 * see. They are still counted, because how many bookings fall through is a fact
 * about the business worth having.
 */
function summariseBookings(rows: BookingRow[], scope: ReportScope) {
  const live = rows.filter((row) => row.status !== 'CANCELLED');
  const guests = live.reduce((sum, row) => sum + row.guestCount, 0);

  const money = live.reduce((acc, row) => ({
    invoicedCents: acc.invoicedCents + invoiceTotalCents(row),
    collectedCents: acc.collectedCents + invoicePaidCents(row),
    outstandingCents: acc.outstandingCents + invoiceOutstandingCents(row),
  }), { invoicedCents: 0, collectedCents: 0, outstandingCents: 0 });

  const byStatusMap = new Map<string, number>();
  for (const row of rows) byStatusMap.set(row.status, (byStatusMap.get(row.status) ?? 0) + 1);

  const bySectionMap = new Map<string, { count: number; guests: number; invoicedCents: number }>();
  for (const row of live) {
    const at = bySectionMap.get(row.section) ?? { count: 0, guests: 0, invoicedCents: 0 };
    bySectionMap.set(row.section, {
      count: at.count + 1,
      guests: at.guests + row.guestCount,
      invoicedCents: at.invoicedCents + invoiceTotalCents(row),
    });
  }

  const byMonthMap = new Map<string, { count: number; guests: number; invoicedCents: number; collectedCents: number }>();
  for (const row of live) {
    const key = localMonthKey(row.eventDate, scope.tzOffsetMinutes);
    const at = byMonthMap.get(key) ?? { count: 0, guests: 0, invoicedCents: 0, collectedCents: 0 };
    byMonthMap.set(key, {
      count: at.count + 1,
      guests: at.guests + row.guestCount,
      invoicedCents: at.invoicedCents + invoiceTotalCents(row),
      collectedCents: at.collectedCents + invoicePaidCents(row),
    });
  }

  // How many bookings the ledger CANNOT be holding. One department per day takes
  // one booking (`@@unique([dayId, type])`), so a day with three evening weddings
  // shows one in the ledger and the other two are money the P&L never saw.
  const perDayDepartment = new Map<string, number>();
  for (const row of live) {
    const key = `${localDayKey(row.eventDate, scope.tzOffsetMinutes)}:${row.restaurantId}`;
    perDayDepartment.set(key, (perDayDepartment.get(key) ?? 0) + 1);
  }
  const bookingsBeyondLedger = [...perDayDepartment.values()]
    .reduce((sum, count) => sum + Math.max(0, count - 1), 0);

  return {
    count: live.length,
    cancelled: rows.length - live.length,
    guests,
    children: live.reduce((sum, row) => sum + row.childrenCount, 0),
    ...money,
    averageInvoiceCents: live.length > 0 ? Math.round(money.invoicedCents / live.length) : 0,
    averageGuests: live.length > 0 ? Math.round(guests / live.length) : 0,
    collectedPct: money.invoicedCents > 0
      ? Math.round((money.collectedCents / money.invoicedCents) * 1000) / 10
      : null,
    bookingsBeyondLedger,
    byStatus: [...byStatusMap.entries()].map(([status, count]) => ({ status, count })),
    bySection: [...bySectionMap.entries()].map(([section, value]) => ({ section, ...value })),
    byMonth: [...byMonthMap.entries()]
      .map(([month, value]) => ({ month, ...value }))
      .sort((a, b) => a.month.localeCompare(b.month)),
  };
}

/** One row per day in the window: what the activity calendar shades its squares by. */
function activityByDay(
  scope: ReportScope,
  days: LedgerDay[],
  orderDays: repo.OrderBucketRow[],
  bookingRows: BookingRow[],
) {
  const ledgerByDay = new Map<string, Profit>();
  for (const day of days) ledgerByDay.set(day.date, dayProfit(day));

  const ordersByDayMap = new Map(orderDays.map((bucket) => [bucket.bucket, bucket]));

  const bookingsByDay = new Map<string, number>();
  const guestsByDay = new Map<string, number>();
  for (const row of bookingRows) {
    if (row.status === 'CANCELLED') continue;
    const key = localDayKey(row.eventDate, scope.tzOffsetMinutes);
    bookingsByDay.set(key, (bookingsByDay.get(key) ?? 0) + 1);
    guestsByDay.set(key, (guestsByDay.get(key) ?? 0) + row.guestCount);
  }

  return daysBetween(scope.from, scope.to, scope.tzOffsetMinutes).map((date) => {
    const led = ledgerByDay.get(date);
    const ord = ordersByDayMap.get(date);
    const revenueCents = (led?.revenueCents ?? 0) + (ord?.revenueCents ?? 0);
    return {
      date,
      revenueCents,
      spentCents: led?.spentCents ?? 0,
      balanceCents: revenueCents - (led?.spentCents ?? 0),
      orders: ord?.orders ?? 0,
      bookings: bookingsByDay.get(date) ?? 0,
      guests: guestsByDay.get(date) ?? 0,
    };
  });
}

// ── Dining areas ────────────────────────────────────────────────────────────

/**
 * Profit and loss per dining area — with one honest limitation stated in the
 * payload rather than papered over.
 *
 * **Revenue per area is real**: a booking names its hall, so what each room was
 * invoiced and what it collected are facts.
 *
 * **Spending per area is NOT RECORDED ANYWHERE.** The ledger's only subdivision
 * is its four departments (morning / afternoon / evening / other), which are
 * times of day, not rooms; nothing in the product ever ties a sack of rice to a
 * hall. So this report does not invent one. Apportioning the day's spending
 * across the rooms by their share of revenue would produce a per-room "profit"
 * that is really just revenue scaled by a constant — a number that looks like
 * accounting and is arithmetic on a guess. `spendingIsPerArea: false` is the
 * flag the page uses to label the section for what it is.
 */
export async function areasReport(scope: ReportScope) {
  const [areas, bookingRows] = await Promise.all([
    repo.areas(scope.restaurantIds),
    repo.bookings(scope.restaurantIds, scope.from, scope.to),
  ]);

  const live = bookingRows.filter((row) => row.status !== 'CANCELLED');

  const byArea = new Map<string, { count: number; guests: number; invoicedCents: number; collectedCents: number; outstandingCents: number }>();
  const blank = () => ({ count: 0, guests: 0, invoicedCents: 0, collectedCents: 0, outstandingCents: 0 });
  for (const row of live) {
    const key = row.hallId ?? '';
    const at = byArea.get(key) ?? blank();
    byArea.set(key, {
      count: at.count + 1,
      guests: at.guests + row.guestCount,
      invoicedCents: at.invoicedCents + invoiceTotalCents(row),
      collectedCents: at.collectedCents + invoicePaidCents(row),
      outstandingCents: at.outstandingCents + invoiceOutstandingCents(row),
    });
  }

  const rows = areas.map((area) => {
    const figures = byArea.get(area.id) ?? blank();
    const seats = area.floorTables.reduce((sum, table) => sum + table.seats, 0);
    return {
      id: area.id,
      name: area.name,
      section: area.section,
      kind: area.kind,
      restaurantId: area.restaurantId,
      capacity: area.capacity,
      isActive: area.isActive,
      tables: area.floorTables.length,
      /** Seats actually drawn on the floor map, which can differ from `capacity`. */
      seats,
      ...figures,
      /**
       * Guests per booking against the room's stated capacity. Null when the
       * capacity is not set — a percentage of an unknown is not 0%, and printing
       * 0% beside a full room is worse than printing nothing.
       */
      fillPct: area.capacity > 0 && figures.count > 0
        ? Math.round((figures.guests / (area.capacity * figures.count)) * 1000) / 10
        : null,
      revenuePerGuestCents: figures.guests > 0 ? Math.round(figures.invoicedCents / figures.guests) : 0,
    };
  }).sort((a, b) => b.invoicedCents - a.invoicedCents || a.name.localeCompare(b.name));

  const unassigned = byArea.get('') ?? blank();

  return {
    spendingIsPerArea: false,
    areas: rows,
    /** Bookings that name no room at all — they belong to no area's figures. */
    unassigned,
    totals: {
      invoicedCents: rows.reduce((sum, row) => sum + row.invoicedCents, 0) + unassigned.invoicedCents,
      collectedCents: rows.reduce((sum, row) => sum + row.collectedCents, 0) + unassigned.collectedCents,
      bookings: rows.reduce((sum, row) => sum + row.count, 0) + unassigned.count,
      guests: rows.reduce((sum, row) => sum + row.guests, 0) + unassigned.guests,
    },
  };
}

// ── The dish table ──────────────────────────────────────────────────────────

/**
 * Every dish, with all three systems' prices and switches side by side.
 *
 * This is the one screen in the product that shows them together. Everywhere
 * else a dish is presented AS ONE SYSTEM SEES IT (`presentForScope`) — precisely
 * so no page can show or write back a price that is not its own — and that is
 * right for the people who set prices. It is wrong for an owner, whose question
 * is "what am I charging for this across the three sides of my business", and who
 * cannot answer it without signing in as three different roles.
 *
 * It is READ-ONLY here for the same reason it is scoped elsewhere: the owner sees
 * every system's price, and the report offers no way to write one.
 */
export async function menuReport(scope: ReportScope) {
  const [items, inBookings, inOrders] = await Promise.all([
    repo.menuItems(scope.restaurantIds),
    repo.dishesInBookings(scope.restaurantIds, scope.from, scope.to),
    repo.dishesInOrders(scope.restaurantIds, scope.from, scope.to),
  ]);

  const bookingDemand = new Map(inBookings.map((row) => [row.menuItemId, row]));
  const orderDemand = new Map(inOrders.map((row) => [row.menuItemId, row]));

  const rows = items.map((item) => {
    const booked = bookingDemand.get(item.id);
    const ordered = orderDemand.get(item.id);
    return {
      id: item.id,
      name: item.name,
      category: item.category as string,
      restaurantId: item.restaurantId,
      priceCents: item.priceCents,
      priceCentsSmallBanquet: item.priceCentsSmallBanquet,
      priceCentsCatering: item.priceCentsCatering,
      disabledBanquet: item.disabledBanquet,
      disabledSmallBanquet: item.disabledSmallBanquet,
      disabledCatering: item.disabledCatering,
      isActive: item.isActive,
      isOutOfStock: item.isOutOfStock,
      isBestseller: item.isBestseller,
      tabletStatus: item.tabletStatus,
      hasPhoto: !!item.photoUrl,
      bookedTimes: booked?.times ?? 0,
      bookedQuantity: booked?.quantity ?? 0,
      bookedRevenueCents: booked?.revenueCents ?? 0,
      orderedTimes: ordered?.times ?? 0,
      orderedQuantity: ordered?.quantity ?? 0,
      orderedRevenueCents: ordered?.revenueCents ?? 0,
      /** One figure to rank by: everything this dish was chosen for, either side. */
      demand: (booked?.quantity ?? 0) + (ordered?.quantity ?? 0),
      demandRevenueCents: (booked?.revenueCents ?? 0) + (ordered?.revenueCents ?? 0),
    };
  });

  const byCategoryMap = new Map<string, {
    dishes: number; active: number; outOfStock: number; withPhoto: number;
    demand: number; demandRevenueCents: number; priceSum: number; priced: number;
  }>();
  for (const row of rows) {
    const at = byCategoryMap.get(row.category) ?? {
      dishes: 0, active: 0, outOfStock: 0, withPhoto: 0, demand: 0, demandRevenueCents: 0, priceSum: 0, priced: 0,
    };
    byCategoryMap.set(row.category, {
      dishes: at.dishes + 1,
      active: at.active + (row.isActive ? 1 : 0),
      outOfStock: at.outOfStock + (row.isOutOfStock ? 1 : 0),
      withPhoto: at.withPhoto + (row.hasPhoto ? 1 : 0),
      demand: at.demand + row.demand,
      demandRevenueCents: at.demandRevenueCents + row.demandRevenueCents,
      // Averaged over the dishes that HAVE a price. A free dish would otherwise
      // drag a category's average price down as though it were being sold for
      // nothing, when it is usually an included course.
      priceSum: at.priceSum + (row.priceCents > 0 ? row.priceCents : 0),
      priced: at.priced + (row.priceCents > 0 ? 1 : 0),
    });
  }

  return {
    totals: {
      dishes: rows.length,
      active: rows.filter((row) => row.isActive).length,
      outOfStock: rows.filter((row) => row.isOutOfStock).length,
      bestsellers: rows.filter((row) => row.isBestseller).length,
      withoutPhoto: rows.filter((row) => !row.hasPhoto).length,
      offBanquet: rows.filter((row) => row.disabledBanquet).length,
      offSmallBanquet: rows.filter((row) => row.disabledSmallBanquet).length,
      offCatering: rows.filter((row) => row.disabledCatering).length,
      /** Dishes nobody chose in the window — the "why is this on the menu" list. */
      neverChosen: rows.filter((row) => row.demand === 0).length,
    },
    byCategory: [...byCategoryMap.entries()]
      .map(([category, value]) => ({
        category,
        ...value,
        averagePriceCents: value.priced > 0 ? Math.round(value.priceSum / value.priced) : 0,
      }))
      .sort((a, b) => b.dishes - a.dishes || a.category.localeCompare(b.category)),
    items: rows,
  };
}

// ── Staff ───────────────────────────────────────────────────────────────────

/**
 * Who works here and what the waiters did.
 *
 * "Waiter statistics" is the food-service side: a `CATERING_EMPLOYEE` claims an
 * order and closes it, and those two acts are the only per-person record of work
 * the product keeps. Banquet staff do not appear here with figures, because
 * nothing in the banquet flow records WHO took a booking — an honest absence,
 * and the reason the roster is reported beside the figures rather than instead of
 * them.
 */
export async function staffReport(scope: ReportScope) {
  const [waiterRows, roster] = await Promise.all([
    repo.waiters(scope.restaurantIds, scope.from, scope.to),
    repo.staffRoster(scope.restaurantIds),
  ]);

  const waiters = waiterRows.map((row) => ({
    id: row.waiterId,
    username: row.username,
    restaurantId: row.restaurantId,
    orders: row.orders,
    revenueCents: row.revenueCents,
    tables: row.tables,
    averageOrderCents: row.orders > 0 ? Math.round(row.revenueCents / row.orders) : 0,
    lastClosedAt: row.lastClosedAt?.toISOString() ?? null,
    /**
     * The account is gone but its closed orders are not (`onDelete: SetNull`).
     * Shown rather than dropped, or the per-waiter figures would add up to less
     * than the restaurant's own total with nothing to explain the gap.
     */
    former: !row.waiterId,
  }));

  const byRoleMap = new Map<string, number>();
  for (const row of roster) byRoleMap.set(row.role, (byRoleMap.get(row.role) ?? 0) + row.count);

  const total = waiters.reduce((acc, row) => ({
    orders: acc.orders + row.orders, revenueCents: acc.revenueCents + row.revenueCents,
  }), { orders: 0, revenueCents: 0 });

  return {
    waiters,
    total,
    roster: [...byRoleMap.entries()]
      .map(([role, count]) => ({ role, count }))
      .sort((a, b) => b.count - a.count || a.role.localeCompare(b.role)),
    staffCount: roster.reduce((sum, row) => sum + row.count, 0),
    /** Roles that keep no per-person record, named so their absence is explained. */
    unmeasuredRoles: [AdminRole.EMPLOYEE, AdminRole.ADMIN, AdminRole.SUPERVISOR] as string[],
  };
}

// ── The business at a glance ────────────────────────────────────────────────

export async function scopeReport(scope: ReportScope) {
  const [rows, counts] = await Promise.all([
    repo.restaurants(scope.restaurantIds),
    repo.activityCounts(scope.restaurantIds, scope.from, scope.to),
  ]);
  return {
    restaurants: rows.map((row) => ({
      id: row.id, name: row.name, address: row.address, logoUrl: row.logoUrl,
      company: row.company,
      modules: {
        banquet: row.moduleBanquet, catering: row.moduleCatering, addons: row.moduleAddons,
      },
    })),
    counts,
  };
}
