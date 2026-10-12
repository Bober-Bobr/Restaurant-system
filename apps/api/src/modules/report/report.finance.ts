/**
 * The owner's profit and loss, stated once.
 *
 * This is a THIRD implementation of the expense ledger's arithmetic — the page
 * ([ExpenseLedgerPage.tsx]) and the PDF ([expense.pdf.service.ts]) are the other
 * two, and CLAUDE.md warns they must be changed together. It is written as its
 * own copy rather than imported because the API cannot import from the web app
 * and the PDF's copy is entangled with PDFKit layout; what keeps all three
 * honest is `src/test/ledgerCases.ts`, which every suite asserts against. The
 * helper names here are deliberately the ledger page's (`guestsRevenue`,
 * `servicesRevenue`, `eventRevenue`, `eventSpent`) so a reader comparing the
 * three files is comparing like with like.
 *
 * TWO DEPARTURES from the Restaurant Manager's own totals, both deliberate and
 * both visible in the payload rather than folded into one number:
 *
 * 1. **Day-level extras count as spending.** `DayExtraExpense` is excluded from
 *    `daySpent` on both existing sides — the ledger reports it in a section of
 *    its own — but it is money the restaurant spent, and an owner's profit
 *    figure that leaves it out is too high. It is added in, and carried as its
 *    own field so the difference from the manager's screen is explainable
 *    rather than mysterious.
 * 2. **Everything leaves here in TIYIN.** The ledger's columns are whole so'm
 *    and every other money column in the product is tiyin (1/100 so'm); a
 *    payload carrying both units is a page that multiplies by 100 in some places
 *    and not others. `toTiyin` is the only conversion, and the field names say
 *    which unit they are in — `*Cents`, like the rest of the API.
 *
 * ── DOLLARS ────────────────────────────────────────────────────────────────
 * A ledger line can also carry a DOLLAR amount, and every field below has a
 * `*UsdCents` twin. The two are **never added**: there is no exchange rate in
 * this product, so a single "total" across both currencies would be a figure
 * nobody can reconcile, and a rate typed today would restate every day already
 * recorded. `utils/ledgerMoney.ts` is where that rule lives; here it shows up
 * as twice as many fields and no arithmetic between them.
 *
 * The dollar fields are already in CENTS in the database — dollars are the one
 * currency here whose minor unit the ledger stores — so `toTiyin` does not
 * touch them. That asymmetry is the price of the ledger's so'm columns being
 * whole so'm, and the field names are what keep it straight.
 */

/** Whole so'm (the ledger's unit) → tiyin (every other money column's unit). */
export function toTiyin(sum: number): number {
  return Math.round(sum) * 100;
}

export type LedgerLine = { amountSum: number; amountUsdCents?: number | null };

export type LedgerDepartment = {
  type: string;
  guestCount: number;
  pricePerGuestSum: number;
  pricePerGuestUsdCents?: number | null;
  manualGuestsSum?: number | null;
  manualGuestsUsdCents?: number | null;
  products: LedgerLine[];
  salaries: LedgerLine[];
  additionals: LedgerLine[];
  services: LedgerLine[];
};

export type LedgerDay = {
  date: string;
  events: LedgerDepartment[];
  extras: LedgerLine[];
};

const sumLines = (lines: LedgerLine[]): number =>
  (lines ?? []).reduce((sum, line) => sum + (line.amountSum ?? 0), 0);

/** The same lines' DOLLAR amounts, in cents. Never mixed with the above. */
const sumLinesUsd = (lines: LedgerLine[]): number =>
  (lines ?? []).reduce((sum, line) => sum + (line.amountUsdCents ?? 0), 0);

/**
 * What a department takes from its guests, in whole so'm.
 *
 * A typed figure WINS outright over guests × price — the ledger records what was
 * actually charged when the multiplication does not describe it. `!= null` and
 * not a truthiness test: a manual figure of **zero** is a decision ("we charged
 * nothing"), which is the whole reason the column is nullable.
 */
export function guestsRevenue(department: LedgerDepartment): number {
  return department.manualGuestsSum != null
    ? department.manualGuestsSum
    : department.guestCount * department.pricePerGuestSum;
}

/**
 * The same, in dollars (cents).
 *
 * Each currency honours its OWN override and otherwise falls back to its own
 * multiplication — one `!= null` test covering both would have a so'm override
 * silently zero the dollars recorded beside it, and would do it to every row
 * written before the dollar override existed.
 */
export function guestsRevenueUsd(department: LedgerDepartment): number {
  return department.manualGuestsUsdCents != null
    ? department.manualGuestsUsdCents
    : department.guestCount * (department.pricePerGuestUsdCents ?? 0);
}

/**
 * Additional services are REVENUE, despite `ServiceExpense`'s name — performers,
 * hosts and invitations are sold. They sit OUTSIDE the manual override, so
 * typing a guest figure by hand can never silently drop them.
 */
export function servicesRevenue(department: LedgerDepartment): number {
  return sumLines(department.services);
}

export function servicesRevenueUsd(department: LedgerDepartment): number {
  return sumLinesUsd(department.services);
}

/** Guests + services: the figure at the top of a department. */
export function eventRevenue(department: LedgerDepartment): number {
  return guestsRevenue(department) + servicesRevenue(department);
}

export function eventRevenueUsd(department: LedgerDepartment): number {
  return guestsRevenueUsd(department) + servicesRevenueUsd(department);
}

/** Products + salaries + additional expenses. Services are revenue, not spend. */
export function eventSpent(department: LedgerDepartment): number {
  return sumLines(department.products) + sumLines(department.salaries) + sumLines(department.additionals);
}

export function eventSpentUsd(department: LedgerDepartment): number {
  return sumLinesUsd(department.products) + sumLinesUsd(department.salaries) + sumLinesUsd(department.additionals);
}

/** A day's extras — the ledger's own day-level costs. Spending, see the note above. */
export function dayExtras(day: LedgerDay): number {
  return sumLines(day.extras);
}

export function dayExtrasUsd(day: LedgerDay): number {
  return sumLinesUsd(day.extras);
}

export type Profit = {
  /** Guests × price, or the typed figure. */
  guestsRevenueCents: number;
  /** Additional services sold. */
  servicesRevenueCents: number;
  /** guestsRevenue + servicesRevenue. */
  revenueCents: number;
  productsCents: number;
  salariesCents: number;
  additionalsCents: number;
  /** Day-level extras. Zero for a single department — they belong to the day. */
  extrasCents: number;
  /** products + salaries + additionals + extras. */
  spentCents: number;
  /** revenue − spent. Negative is a loss, and is meant to be shown as one. */
  balanceCents: number;

  // ── The same figures in DOLLARS (US cents) ───────────────────────────────
  // A second set, never summed with the first. A period can show a profit in
  // so'm and a shortfall in dollars at once, which is exactly why there are
  // two balances and not one.
  guestsRevenueUsdCents: number;
  servicesRevenueUsdCents: number;
  revenueUsdCents: number;
  productsUsdCents: number;
  salariesUsdCents: number;
  additionalsUsdCents: number;
  extrasUsdCents: number;
  spentUsdCents: number;
  balanceUsdCents: number;
};

const EMPTY: Profit = {
  guestsRevenueCents: 0, servicesRevenueCents: 0, revenueCents: 0,
  productsCents: 0, salariesCents: 0, additionalsCents: 0, extrasCents: 0,
  spentCents: 0, balanceCents: 0,
  guestsRevenueUsdCents: 0, servicesRevenueUsdCents: 0, revenueUsdCents: 0,
  productsUsdCents: 0, salariesUsdCents: 0, additionalsUsdCents: 0, extrasUsdCents: 0,
  spentUsdCents: 0, balanceUsdCents: 0,
};

/**
 * Whether a period recorded anything in dollars at all.
 *
 * The owner's page asks this before it shows a dollar figure anywhere: a
 * restaurant whose ledger is kept in so'm must see the report it has always
 * seen, not one with a second zero beside every number.
 */
export function hasUsd(profit: Profit): boolean {
  return profit.revenueUsdCents !== 0 || profit.spentUsdCents !== 0;
}

/** An empty profit — every field zero. Exported: the report service needs one. */
export function zeroProfit(): Profit {
  return { ...EMPTY };
}

/**
 * Two profits added together, both currencies kept apart.
 *
 * The report service had its own copy of this, which with a second currency
 * would have become a fourth place stating the same nine sums. One copy, beside
 * the field list it has to agree with.
 */
export function addProfit(a: Profit, b: Profit): Profit {
  return settle(addUp([a, b]));
}

/** The profit and loss of one department, in tiyin. */
export function departmentProfit(department: LedgerDepartment): Profit {
  return settle({
    ...EMPTY,
    guestsRevenueCents: toTiyin(guestsRevenue(department)),
    servicesRevenueCents: toTiyin(servicesRevenue(department)),
    productsCents: toTiyin(sumLines(department.products)),
    salariesCents: toTiyin(sumLines(department.salaries)),
    additionalsCents: toTiyin(sumLines(department.additionals)),
    // Already in cents in the database — `toTiyin` is for the so'm columns
    // only, and running it here would multiply every dollar figure by a
    // hundred.
    guestsRevenueUsdCents: guestsRevenueUsd(department),
    servicesRevenueUsdCents: servicesRevenueUsd(department),
    productsUsdCents: sumLinesUsd(department.products),
    salariesUsdCents: sumLinesUsd(department.salaries),
    additionalsUsdCents: sumLinesUsd(department.additionals),
  });
}

/** The profit and loss of one day: its departments plus the day's own extras. */
export function dayProfit(day: LedgerDay): Profit {
  const departments = (day.events ?? []).map(departmentProfit);
  return settle({
    ...addUp(departments),
    extrasCents: toTiyin(dayExtras(day)),
    extrasUsdCents: dayExtrasUsd(day),
  });
}

/** The profit and loss of a set of days. */
export function totalProfit(days: LedgerDay[]): Profit {
  return settle(addUp(days.map(dayProfit)));
}

/**
 * Add the parts up, leaving the three derived fields to `settle`.
 *
 * The totals are recomputed from the parts rather than summed from each part's
 * own total: summing both would make a rounding difference in one department
 * invisible, and there is exactly one place that says what the totals mean.
 */
function addUp(parts: Profit[]): Profit {
  return parts.reduce<Profit>((acc, part) => ({
    ...acc,
    guestsRevenueCents: acc.guestsRevenueCents + part.guestsRevenueCents,
    servicesRevenueCents: acc.servicesRevenueCents + part.servicesRevenueCents,
    productsCents: acc.productsCents + part.productsCents,
    salariesCents: acc.salariesCents + part.salariesCents,
    additionalsCents: acc.additionalsCents + part.additionalsCents,
    extrasCents: acc.extrasCents + part.extrasCents,
    guestsRevenueUsdCents: acc.guestsRevenueUsdCents + part.guestsRevenueUsdCents,
    servicesRevenueUsdCents: acc.servicesRevenueUsdCents + part.servicesRevenueUsdCents,
    productsUsdCents: acc.productsUsdCents + part.productsUsdCents,
    salariesUsdCents: acc.salariesUsdCents + part.salariesUsdCents,
    additionalsUsdCents: acc.additionalsUsdCents + part.additionalsUsdCents,
    extrasUsdCents: acc.extrasUsdCents + part.extrasUsdCents,
  }), { ...EMPTY });
}

/** Fill in revenue, spent and balance from the parts. */
function settle(profit: Profit): Profit {
  const revenueCents = profit.guestsRevenueCents + profit.servicesRevenueCents;
  const spentCents = profit.productsCents + profit.salariesCents + profit.additionalsCents + profit.extrasCents;
  // The same three sums again, per currency. Not one loop over a pair, because
  // the payload is flat JSON the page reads field by field — and because two
  // currencies crossing anywhere in this function is the one bug worth making
  // impossible to introduce quietly.
  const revenueUsdCents = profit.guestsRevenueUsdCents + profit.servicesRevenueUsdCents;
  const spentUsdCents = profit.productsUsdCents + profit.salariesUsdCents
    + profit.additionalsUsdCents + profit.extrasUsdCents;
  return {
    ...profit,
    revenueCents, spentCents, balanceCents: revenueCents - spentCents,
    revenueUsdCents, spentUsdCents, balanceUsdCents: revenueUsdCents - spentUsdCents,
  };
}

/**
 * Profit as a percentage of revenue, or null when there was no revenue.
 *
 * Null rather than 0: a month that took nothing has no margin, and printing
 * "0%" beside a month that broke even says they were the same month. A loss on
 * no revenue at all is likewise not "−100%", it is unmeasurable.
 */
export function marginPct(profit: Pick<Profit, 'revenueCents' | 'balanceCents'>): number | null {
  if (profit.revenueCents <= 0) return null;
  return Math.round((profit.balanceCents / profit.revenueCents) * 1000) / 10;
}

/**
 * The margin on the dollar side, as its own percentage.
 *
 * Its own, and not folded into the one above, because a margin is a ratio and
 * a ratio across two currencies needs a rate to exist at all. Two margins is
 * the honest answer; one would have to pick a currency and would then be wrong
 * about the other.
 */
export function marginPctUsd(profit: Pick<Profit, 'revenueUsdCents' | 'balanceUsdCents'>): number | null {
  if (profit.revenueUsdCents <= 0) return null;
  return Math.round((profit.balanceUsdCents / profit.revenueUsdCents) * 1000) / 10;
}
