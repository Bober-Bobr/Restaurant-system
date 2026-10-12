import { describe, expect, it } from 'vitest';
import { LEDGER_CASES, LEDGER_DAY, expectedUsd } from '../../test/ledgerCases.js';
import {
  dayExtras, dayExtrasUsd, dayProfit, departmentProfit, eventRevenue, eventRevenueUsd, eventSpent, eventSpentUsd,
  guestsRevenue, guestsRevenueUsd, marginPct, marginPctUsd, servicesRevenue, servicesRevenueUsd,
  toTiyin, totalProfit,
  type LedgerDay, type LedgerDepartment,
} from './report.finance.js';

// ── The owner's P&L is the ledger's arithmetic, so it is held to the ledger's
// own fixture ───────────────────────────────────────────────────────────────
// `src/test/ledgerCases.ts` is the shared statement of what the expense ledger
// means, and the page and the PDF already assert against it. This is the third
// implementation and it is pinned to the same file, so the owner's report cannot
// quietly disagree with the screen the restaurant manager fills in — which would
// be the worst kind of bug here, two people reading different profits off one
// set of numbers with no way to tell which is wrong.

/**
 * A case by NAME, never by position.
 *
 * These were `caseNamed(GUESTS_ONLY)`, `[3]`, `[7]` — which silently pointed at
 * different cases the moment the dollar cases were inserted into the middle of
 * the list. One of them turned a loss into a profit and the test caught it; the
 * other two would have gone on passing against the wrong case.
 */
const caseNamed = (name: string) => {
  const found = LEDGER_CASES.find((c) => c.name === name);
  if (!found) throw new Error(`no ledger case named "${name}"`);
  return found;
};

const GUESTS_ONLY = 'guest revenue is guests × price per guest';
const FULL_DEPARTMENT = 'spending is products + salaries + additional expenses only';
const AT_A_LOSS = 'a department can run at a loss';

/**
 * The fixture's department, as this module takes one.
 *
 * It carries the DOLLAR fields too. It did not at first, which silently dropped
 * every dollar input on the floor — so the dollar half of this implementation
 * read zero and agreed with any expectation of zero. A break-check is what
 * showed that up: six deliberate breaks to the dollar arithmetic changed
 * nothing any test could see.
 */
const asDepartment = (event: (typeof LEDGER_CASES)[number]['event']): LedgerDepartment => ({
  type: event.type,
  guestCount: event.guestCount,
  pricePerGuestSum: event.pricePerGuestSum,
  pricePerGuestUsdCents: event.pricePerGuestUsdCents ?? 0,
  manualGuestsSum: event.manualGuestsSum ?? null,
  manualGuestsUsdCents: event.manualGuestsUsdCents ?? null,
  products: event.products,
  salaries: event.salaries,
  additionals: event.additionals,
  services: event.services,
});

// ── The dollar half, against the same fixture ──────────────────────────────
// A second currency is a second chance for this implementation to disagree with
// the manager's screen, so it is pinned to the same shared cases. Note the unit
// asymmetry these assertions encode: the so'm figures are multiplied into tiyin
// on the way out and the dollar figures are ALREADY cents, so `toTiyin` must
// never touch them.
describe('the ledger arithmetic, in dollars', () => {
  for (const testCase of LEDGER_CASES) {
    it(testCase.name, () => {
      const department = asDepartment(testCase.event);
      const usd = expectedUsd(testCase);
      expect(guestsRevenueUsd(department)).toBe(usd.guestsRevenue);
      expect(servicesRevenueUsd(department)).toBe(usd.servicesRevenue);
      expect(eventRevenueUsd(department)).toBe(usd.revenue);
      expect(eventSpentUsd(department)).toBe(usd.spent);
      expect(eventRevenueUsd(department) - eventSpentUsd(department)).toBe(usd.balance);
    });
  }

  for (const testCase of LEDGER_CASES) {
    it(`${testCase.name} — through departmentProfit`, () => {
      const profit = departmentProfit(asDepartment(testCase.event));
      const usd = expectedUsd(testCase);
      // Dollars pass through unscaled...
      expect(profit.guestsRevenueUsdCents).toBe(usd.guestsRevenue);
      expect(profit.servicesRevenueUsdCents).toBe(usd.servicesRevenue);
      expect(profit.revenueUsdCents).toBe(usd.revenue);
      expect(profit.spentUsdCents).toBe(usd.spent);
      expect(profit.balanceUsdCents).toBe(usd.balance);
      // ...while the so'm side is multiplied into tiyin, on the same object.
      expect(profit.revenueCents).toBe(toTiyin(testCase.expected.revenue));
      expect(profit.balanceCents).toBe(toTiyin(testCase.expected.balance));
    });
  }

  it('rolls a day up in both currencies, and never across them', () => {
    const day: LedgerDay = {
      date: LEDGER_DAY.date,
      events: LEDGER_DAY.events.map(asDepartment),
      extras: [{ amountSum: 10_000, amountUsdCents: 2_500 }],
    };
    const profit = dayProfit(day);
    expect(profit.revenueUsdCents).toBe(LEDGER_DAY.expected.usd.revenue);
    // The day's extras count as spending here — the one deliberate departure
    // from the manager's own totals — in both currencies.
    expect(profit.spentUsdCents).toBe(LEDGER_DAY.expected.usd.spent + 2_500);
    expect(profit.extrasUsdCents).toBe(2_500);
    expect(profit.extrasCents).toBe(toTiyin(10_000));
    // And the so'm side is untouched by any of it.
    expect(profit.revenueCents).toBe(toTiyin(LEDGER_DAY.expected.revenue));
    expect(profit.spentCents).toBe(toTiyin(LEDGER_DAY.expected.spent + 10_000));
  });

  it('adds the dollar parts up across days', () => {
    const one: LedgerDay = {
      date: '2026-10-01',
      events: [asDepartment(caseNamed('a line can be part so\'m and part dollars, and neither part reaches the other').event)],
      extras: [],
    };
    const two: LedgerDay = {
      date: '2026-10-02',
      events: [asDepartment(caseNamed('a line can be wholly in dollars, and leaves the so\'m total at zero').event)],
      extras: [{ amountSum: 0, amountUsdCents: 700 }],
    };
    const total = totalProfit([one, two]);
    expect(total.productsUsdCents).toBe(15_000 + 24_000);
    expect(total.additionalsUsdCents).toBe(2_500);
    expect(total.servicesRevenueUsdCents).toBe(30_000);
    expect(total.extrasUsdCents).toBe(700);
    // Products + additionals + the day's extras, each in its own column.
    expect(total.spentUsdCents).toBe(15_000 + 2_500 + 24_000 + 700);
    expect(total.revenueUsdCents).toBe(20_000 + 30_000);
    expect(total.balanceUsdCents).toBe(total.revenueUsdCents - total.spentUsdCents);
  });

  it('reads the day\'s dollar extras on their own', () => {
    const day: LedgerDay = { date: '2026-10-03', events: [], extras: [{ amountSum: 1_000, amountUsdCents: 450 }] };
    expect(dayExtras(day)).toBe(1_000);
    expect(dayExtrasUsd(day)).toBe(450);
  });

  it('can be in profit in so\'m and at a loss in dollars at once', () => {
    // The reason there are two balances. One figure cannot say this, and
    // whichever currency it picked would misreport the other.
    const profit = departmentProfit(asDepartment(
      caseNamed('a department can be in profit in so\'m and at a loss in dollars at once').event,
    ));
    expect(profit.balanceCents).toBeGreaterThan(0);
    expect(profit.balanceUsdCents).toBeLessThan(0);
  });
});

describe('the dollar margin is its own ratio', () => {
  it('is measured against the dollar revenue, not the so\'m one', () => {
    expect(marginPctUsd({ revenueUsdCents: 50_000, balanceUsdCents: 35_000 })).toBe(70);
    // And the so'm margin is unaffected by the dollar figures beside it.
    expect(marginPct({ revenueCents: 1_000_000, balanceCents: 250_000 })).toBe(25);
  });

  it('is NULL on no dollar revenue, never 0%', () => {
    // A period that took no dollars has no dollar margin; printing "0%" would
    // say it broke even in a currency it never traded in.
    expect(marginPctUsd({ revenueUsdCents: 0, balanceUsdCents: 0 })).toBe(null);
    expect(marginPctUsd({ revenueUsdCents: 0, balanceUsdCents: -8_000 })).toBe(null);
  });

  it('reports a dollar loss as a negative percentage', () => {
    expect(marginPctUsd({ revenueUsdCents: 10_000, balanceUsdCents: -5_000 })).toBe(-50);
  });
});

describe('the ledger arithmetic, in whole so’m', () => {
  for (const testCase of LEDGER_CASES) {
    it(testCase.name, () => {
      const department = asDepartment(testCase.event);
      expect(guestsRevenue(department)).toBe(testCase.expected.guestsRevenue);
      expect(servicesRevenue(department)).toBe(testCase.expected.servicesRevenue);
      expect(eventRevenue(department)).toBe(testCase.expected.revenue);
      expect(eventSpent(department)).toBe(testCase.expected.spent);
      expect(eventRevenue(department) - eventSpent(department)).toBe(testCase.expected.balance);
    });
  }

  it('a whole day rolls up to the sum of its departments', () => {
    const day: LedgerDay = { date: LEDGER_DAY.date, events: LEDGER_DAY.events.map(asDepartment), extras: [] };
    const profit = dayProfit(day);
    expect(profit.revenueCents).toBe(toTiyin(LEDGER_DAY.expected.revenue));
    expect(profit.spentCents).toBe(toTiyin(LEDGER_DAY.expected.spent));
  });
});

describe('the report’s own two departures from the ledger screen', () => {
  // Both of these are places the owner's figure is DELIBERATELY not the
  // manager's. Asserted, because an undocumented difference between two profit
  // figures is indistinguishable from a bug.

  it('reports in tiyin, not the ledger’s whole so’m', () => {
    // Every other money column in the product is tiyin. A payload carrying both
    // units is a page that multiplies by 100 in some places and not others.
    const department = asDepartment(caseNamed(GUESTS_ONLY).event);
    expect(departmentProfit(department).revenueCents).toBe(caseNamed(GUESTS_ONLY).expected.revenue * 100);
  });

  it('counts day-level extras as spending, unlike daySpent on the other two sides', () => {
    const department = asDepartment(caseNamed(GUESTS_ONLY).event); // 10 200 000 revenue, no spend
    const day: LedgerDay = {
      date: '2026-08-12', events: [department], extras: [{ amountSum: 250_000 }, { amountSum: 50_000 }],
    };
    expect(dayExtras(day)).toBe(300_000);
    const profit = dayProfit(day);
    expect(profit.extrasCents).toBe(toTiyin(300_000));
    // The ledger's own daySpent would say 0 here. The owner's says 300 000, and
    // the balance is lower by exactly that.
    expect(profit.spentCents).toBe(toTiyin(300_000));
    expect(profit.balanceCents).toBe(toTiyin(10_200_000 - 300_000));
  });

  it('keeps extras out of a DEPARTMENT’s figures — they belong to the day', () => {
    // A department has no extras of its own, so attributing the day's to one
    // would make the four departments add up to more than the day.
    expect(departmentProfit(asDepartment(caseNamed(FULL_DEPARTMENT).event)).extrasCents).toBe(0);
  });
});

describe('totals are recomputed from the parts', () => {
  it('sums several days', () => {
    const one: LedgerDay = { date: '2026-08-01', events: [asDepartment(caseNamed(GUESTS_ONLY).event)], extras: [] };
    const two: LedgerDay = { date: '2026-08-02', events: [asDepartment(caseNamed(FULL_DEPARTMENT).event)], extras: [{ amountSum: 10_000 }] };
    const total = totalProfit([one, two]);
    expect(total.revenueCents).toBe(toTiyin(10_200_000 + 23_000_000));
    expect(total.spentCents).toBe(toTiyin(6_100_000 + 10_000));
    expect(total.balanceCents).toBe(total.revenueCents - total.spentCents);
  });

  it('a loss stays negative rather than being floored at zero', () => {
    // An owner has to be able to see a loss. `Math.max(0, …)` belongs on an
    // invoice balance, not here.
    const day: LedgerDay = { date: '2026-08-03', events: [asDepartment(caseNamed(AT_A_LOSS).event)], extras: [] };
    expect(dayProfit(day).balanceCents).toBe(toTiyin(-400_000));
  });

  it('an empty window is all zeros, not NaN', () => {
    const total = totalProfit([]);
    expect(total.revenueCents).toBe(0);
    expect(total.spentCents).toBe(0);
    expect(total.balanceCents).toBe(0);
  });
});

describe('margin', () => {
  it('is a percentage of revenue, to one decimal', () => {
    expect(marginPct({ revenueCents: 1_000_000, balanceCents: 250_000 })).toBe(25);
    expect(marginPct({ revenueCents: 300_000, balanceCents: 100_000 })).toBe(33.3);
  });

  it('is NULL on no revenue, never 0%', () => {
    // "0%" beside a month that took nothing says it broke even, which is a
    // different fact from having done no business at all.
    expect(marginPct({ revenueCents: 0, balanceCents: 0 })).toBeNull();
    expect(marginPct({ revenueCents: 0, balanceCents: -500 })).toBeNull();
  });

  it('goes negative on a loss', () => {
    expect(marginPct({ revenueCents: 1_000_000, balanceCents: -200_000 })).toBe(-20);
  });
});

describe('a manual guest figure', () => {
  it('of zero is honoured, not read as "not set"', () => {
    // The whole reason `manualGuestsSum` is nullable. A truthiness test here
    // would put the multiplication back and invent revenue nobody charged.
    const department = asDepartment({
      type: 'TUI', guestCount: 100, pricePerGuestSum: 90_000, manualGuestsSum: 0,
      products: [], salaries: [], additionals: [], services: [],
    });
    expect(departmentProfit(department).guestsRevenueCents).toBe(0);
  });

  it('never swallows the services sold alongside it', () => {
    const department = asDepartment({
      type: 'TUI', guestCount: 100, pricePerGuestSum: 90_000, manualGuestsSum: 5_000_000,
      products: [], salaries: [], additionals: [], services: [{ name: 'Invitations', amountSum: 400_000 }],
    });
    const profit = departmentProfit(department);
    expect(profit.servicesRevenueCents).toBe(toTiyin(400_000));
    expect(profit.revenueCents).toBe(toTiyin(5_400_000));
  });
});
