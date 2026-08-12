import { describe, expect, it } from 'vitest';
import { eventRevenue, daySpent, dayRevenue } from './ExpenseLedgerPage';
import { LEDGER_CASES, LEDGER_DAY } from '../../../api/src/test/ledgerCases';
import type { DayEvent, ExpenseDay } from '../types/domain';

// ── The ledger arithmetic, checked against the PDF's copy ───────────────────
// The page and the PDF implement these rules SEPARATELY — the PDF is not
// generated from the page — and CLAUDE.md says they must be changed together.
// Nothing enforced that until now: both suites assert against the same
// expectations in `ledgerCases.ts`, so changing one side turns the other red.

const asEvent = (e: unknown) => e as DayEvent;

describe('expense ledger arithmetic (page side)', () => {
  for (const { name, event, expected } of LEDGER_CASES) {
    it(name, () => {
      expect(eventRevenue(asEvent(event))).toBe(expected.revenue);
      // The page exports the revenue and the day roll-ups; spending is checked
      // through the day total below and directly on the PDF side.
    });
  }

  it('rolls a day up as the sum of its departments', () => {
    const day = { ...LEDGER_DAY, allocatedSum: 0, extras: [] } as unknown as ExpenseDay;
    expect(dayRevenue(day)).toBe(LEDGER_DAY.expected.revenue);
    expect(daySpent(day)).toBe(LEDGER_DAY.expected.spent);
  });

  it('counts a service as revenue, never as spending', () => {
    // `ServiceExpense` is named like a cost and is not one. This is the single
    // mistake the arithmetic exists to prevent.
    const withService = asEvent({
      type: 'DAY', guestCount: 0, pricePerGuestSum: 0,
      products: [], salaries: [], additionals: [],
      services: [{ name: 'Host', amountSum: 1000000 }],
    });
    const day = { date: '2026-08-12', allocatedSum: 0, extras: [], events: [withService] } as unknown as ExpenseDay;
    expect(dayRevenue(day)).toBe(1000000);
    expect(daySpent(day)).toBe(0);
  });

  it('honours a manual guest figure of zero', () => {
    // Why the column is nullable rather than 0-defaulted: "overridden to zero"
    // and "not overridden" are different facts.
    const overridden = asEvent({
      type: 'NIGHT', guestCount: 100, pricePerGuestSum: 90000, manualGuestsSum: 0,
      products: [], salaries: [], additionals: [], services: [],
    });
    expect(eventRevenue(overridden)).toBe(0);
  });

  it('adds services on top of a manual guest figure', () => {
    const overridden = asEvent({
      type: 'NIGHT', guestCount: 100, pricePerGuestSum: 90000, manualGuestsSum: 5000000,
      products: [], salaries: [], additionals: [],
      services: [{ name: 'Invitations', amountSum: 400000 }],
    });
    expect(eventRevenue(overridden)).toBe(5400000);
  });
});
