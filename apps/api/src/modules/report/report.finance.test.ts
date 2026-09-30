import { describe, expect, it } from 'vitest';
import { LEDGER_CASES, LEDGER_DAY } from '../../test/ledgerCases.js';
import {
  dayExtras, dayProfit, departmentProfit, eventRevenue, eventSpent,
  guestsRevenue, marginPct, servicesRevenue, toTiyin, totalProfit,
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

const asDepartment = (event: (typeof LEDGER_CASES)[number]['event']): LedgerDepartment => ({
  type: event.type,
  guestCount: event.guestCount,
  pricePerGuestSum: event.pricePerGuestSum,
  manualGuestsSum: event.manualGuestsSum ?? null,
  products: event.products,
  salaries: event.salaries,
  additionals: event.additionals,
  services: event.services,
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
    const department = asDepartment(LEDGER_CASES[1].event);
    expect(departmentProfit(department).revenueCents).toBe(LEDGER_CASES[1].expected.revenue * 100);
  });

  it('counts day-level extras as spending, unlike daySpent on the other two sides', () => {
    const department = asDepartment(LEDGER_CASES[1].event); // 10 200 000 revenue, no spend
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
    expect(departmentProfit(asDepartment(LEDGER_CASES[3].event)).extrasCents).toBe(0);
  });
});

describe('totals are recomputed from the parts', () => {
  it('sums several days', () => {
    const one: LedgerDay = { date: '2026-08-01', events: [asDepartment(LEDGER_CASES[1].event)], extras: [] };
    const two: LedgerDay = { date: '2026-08-02', events: [asDepartment(LEDGER_CASES[3].event)], extras: [{ amountSum: 10_000 }] };
    const total = totalProfit([one, two]);
    expect(total.revenueCents).toBe(toTiyin(10_200_000 + 23_000_000));
    expect(total.spentCents).toBe(toTiyin(6_100_000 + 10_000));
    expect(total.balanceCents).toBe(total.revenueCents - total.spentCents);
  });

  it('a loss stays negative rather than being floored at zero', () => {
    // An owner has to be able to see a loss. `Math.max(0, …)` belongs on an
    // invoice balance, not here.
    const day: LedgerDay = { date: '2026-08-03', events: [asDepartment(LEDGER_CASES[7].event)], extras: [] };
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
