import { describe, expect, it } from 'vitest';
import {
  computedGuests, guestsRevenue, servicesRevenue, eventRevenue, eventSpent,
  daySpent, dayRevenue, type PdfEvent,
} from './expense.pdf.service.js';
import { LEDGER_CASES, LEDGER_DAY } from '../../test/ledgerCases.js';

// The PDF's half of the ledger arithmetic. The web page implements the same
// rules separately — the PDF is not generated from the page — and both suites
// assert against the SAME expectations in `ledgerCases.ts`, so the two cannot
// drift apart silently.

const asEvent = (e: unknown) => e as PdfEvent;

describe('expense ledger arithmetic (PDF side)', () => {
  for (const { name, event, expected } of LEDGER_CASES) {
    it(name, () => {
      expect(guestsRevenue(asEvent(event))).toBe(expected.guestsRevenue);
      expect(servicesRevenue(asEvent(event))).toBe(expected.servicesRevenue);
      expect(eventRevenue(asEvent(event))).toBe(expected.revenue);
      expect(eventSpent(asEvent(event))).toBe(expected.spent);
      expect(eventRevenue(asEvent(event)) - eventSpent(asEvent(event))).toBe(expected.balance);
    });
  }

  it('rolls a day up as the sum of its departments', () => {
    const day = { ...LEDGER_DAY, allocatedSum: 0, extras: [], events: LEDGER_DAY.events } as never;
    expect(dayRevenue(day)).toBe(LEDGER_DAY.expected.revenue);
    expect(daySpent(day)).toBe(LEDGER_DAY.expected.spent);
  });

  it('keeps the replaced multiplication available beside an override', () => {
    // The PDF prints `guests × price` next to the manual figure so the reader
    // can see what was substituted; that needs the raw product to survive.
    const overridden = asEvent({
      type: 'NIGHT', guestCount: 100, pricePerGuestSum: 90000, manualGuestsSum: 7000000,
      products: [], salaries: [], additionals: [], services: [],
    });
    expect(computedGuests(overridden)).toBe(9000000);
    expect(guestsRevenue(overridden)).toBe(7000000);
  });

  it('never counts a service against the department', () => {
    // The single mistake this arithmetic exists to prevent: `ServiceExpense` is
    // named like a cost and is not one.
    const withService = asEvent({
      type: 'DAY', guestCount: 0, pricePerGuestSum: 0,
      products: [], salaries: [], additionals: [], services: [{ name: 'Host', amountSum: 1000000 }],
    });
    expect(eventSpent(withService)).toBe(0);
    expect(eventRevenue(withService)).toBe(1000000);
  });
});
