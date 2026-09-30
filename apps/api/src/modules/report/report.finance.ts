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
 */

/** Whole so'm (the ledger's unit) → tiyin (every other money column's unit). */
export function toTiyin(sum: number): number {
  return Math.round(sum) * 100;
}

export type LedgerLine = { amountSum: number };

export type LedgerDepartment = {
  type: string;
  guestCount: number;
  pricePerGuestSum: number;
  manualGuestsSum?: number | null;
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
 * Additional services are REVENUE, despite `ServiceExpense`'s name — performers,
 * hosts and invitations are sold. They sit OUTSIDE the manual override, so
 * typing a guest figure by hand can never silently drop them.
 */
export function servicesRevenue(department: LedgerDepartment): number {
  return sumLines(department.services);
}

/** Guests + services: the figure at the top of a department. */
export function eventRevenue(department: LedgerDepartment): number {
  return guestsRevenue(department) + servicesRevenue(department);
}

/** Products + salaries + additional expenses. Services are revenue, not spend. */
export function eventSpent(department: LedgerDepartment): number {
  return sumLines(department.products) + sumLines(department.salaries) + sumLines(department.additionals);
}

/** A day's extras — the ledger's own day-level costs. Spending, see the note above. */
export function dayExtras(day: LedgerDay): number {
  return sumLines(day.extras);
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
};

const EMPTY: Profit = {
  guestsRevenueCents: 0, servicesRevenueCents: 0, revenueCents: 0,
  productsCents: 0, salariesCents: 0, additionalsCents: 0, extrasCents: 0,
  spentCents: 0, balanceCents: 0,
};

/** The profit and loss of one department, in tiyin. */
export function departmentProfit(department: LedgerDepartment): Profit {
  return settle({
    ...EMPTY,
    guestsRevenueCents: toTiyin(guestsRevenue(department)),
    servicesRevenueCents: toTiyin(servicesRevenue(department)),
    productsCents: toTiyin(sumLines(department.products)),
    salariesCents: toTiyin(sumLines(department.salaries)),
    additionalsCents: toTiyin(sumLines(department.additionals)),
  });
}

/** The profit and loss of one day: its departments plus the day's own extras. */
export function dayProfit(day: LedgerDay): Profit {
  const departments = (day.events ?? []).map(departmentProfit);
  return settle({
    ...addUp(departments),
    extrasCents: toTiyin(dayExtras(day)),
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
  }), { ...EMPTY });
}

/** Fill in revenue, spent and balance from the parts. */
function settle(profit: Profit): Profit {
  const revenueCents = profit.guestsRevenueCents + profit.servicesRevenueCents;
  const spentCents = profit.productsCents + profit.salariesCents + profit.additionalsCents + profit.extrasCents;
  return { ...profit, revenueCents, spentCents, balanceCents: revenueCents - spentCents };
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
