import { describe, expect, it } from 'vitest';
import {
  computedGuests, guestsRevenue, servicesRevenue, eventRevenue, eventSpent,
  daySpent, dayRevenue, type PdfEvent,
} from './expense.pdf.service.js';
import { LEDGER_CASES, LEDGER_DAY, expectedUsd } from '../../test/ledgerCases.js';
import { subtractMoney } from '../../utils/ledgerMoney.js';

// The PDF's half of the ledger arithmetic. The web page implements the same
// rules separately — the PDF is not generated from the page — and both suites
// assert against the SAME expectations in `ledgerCases.ts`, so the two cannot
// drift apart silently.
//
// Every figure is now a PAIR, so'm and dollars. Each case asserts BOTH halves,
// and the cases that state no dollars expect zero — which is the guard that
// matters most: a second currency must not move a single so'm figure.

const asEvent = (e: unknown) => e as PdfEvent;

describe('expense ledger arithmetic (PDF side)', () => {
  for (const c of LEDGER_CASES) {
    const { name, event, expected } = c;
    const usd = expectedUsd(c);
    it(name, () => {
      expect(guestsRevenue(asEvent(event)).sum).toBe(expected.guestsRevenue);
      expect(servicesRevenue(asEvent(event)).sum).toBe(expected.servicesRevenue);
      expect(eventRevenue(asEvent(event)).sum).toBe(expected.revenue);
      expect(eventSpent(asEvent(event)).sum).toBe(expected.spent);
      expect(subtractMoney(eventRevenue(asEvent(event)), eventSpent(asEvent(event))).sum).toBe(expected.balance);

      expect(guestsRevenue(asEvent(event)).usdCents).toBe(usd.guestsRevenue);
      expect(servicesRevenue(asEvent(event)).usdCents).toBe(usd.servicesRevenue);
      expect(eventRevenue(asEvent(event)).usdCents).toBe(usd.revenue);
      expect(eventSpent(asEvent(event)).usdCents).toBe(usd.spent);
      expect(subtractMoney(eventRevenue(asEvent(event)), eventSpent(asEvent(event))).usdCents).toBe(usd.balance);
    });
  }

  it('rolls a day up as the sum of its departments', () => {
    const day = { ...LEDGER_DAY, allocatedSum: 0, extras: [], events: LEDGER_DAY.events } as never;
    expect(dayRevenue(day).sum).toBe(LEDGER_DAY.expected.revenue);
    expect(daySpent(day).sum).toBe(LEDGER_DAY.expected.spent);
    expect(dayRevenue(day).usdCents).toBe(LEDGER_DAY.expected.usd.revenue);
    expect(daySpent(day).usdCents).toBe(LEDGER_DAY.expected.usd.spent);
  });

  it('keeps the replaced multiplication available beside an override', () => {
    // The PDF prints `guests × price` next to the manual figure so the reader
    // can see what was substituted; that needs the raw product to survive — in
    // both currencies, since the sheet prints both.
    const overridden = asEvent({
      type: 'NIGHT', guestCount: 100, pricePerGuestSum: 90000, pricePerGuestUsdCents: 250,
      manualGuestsSum: 7000000, manualGuestsUsdCents: 20000,
      products: [], salaries: [], additionals: [], services: [],
    });
    expect(computedGuests(overridden)).toEqual({ sum: 9000000, usdCents: 25000 });
    expect(guestsRevenue(overridden)).toEqual({ sum: 7000000, usdCents: 20000 });
  });

  it('never counts a service against the department', () => {
    // The single mistake this arithmetic exists to prevent: `ServiceExpense` is
    // named like a cost and is not one. True of the dollar half too.
    const withService = asEvent({
      type: 'DAY', guestCount: 0, pricePerGuestSum: 0,
      products: [], salaries: [], additionals: [],
      services: [{ name: 'Host', amountSum: 1000000, amountUsdCents: 5000 }],
    });
    expect(eventSpent(withService)).toEqual({ sum: 0, usdCents: 0 });
    expect(eventRevenue(withService)).toEqual({ sum: 1000000, usdCents: 5000 });
  });

  it('never lets one currency reach the other', () => {
    // The whole reason a figure is a pair. A department with money only in
    // dollars must report NOTHING in so'm, and the reverse — anything else
    // means an exchange rate got invented somewhere.
    const dollarsOnly = asEvent({
      type: 'DAY', guestCount: 0, pricePerGuestSum: 0,
      products: [{ name: 'Cheese', amountSum: 0, amountUsdCents: 12345 }],
      salaries: [], additionals: [], services: [],
    });
    expect(eventSpent(dollarsOnly).sum).toBe(0);
    expect(eventSpent(dollarsOnly).usdCents).toBe(12345);

    const somOnly = asEvent({
      type: 'DAY', guestCount: 0, pricePerGuestSum: 0,
      products: [{ name: 'Rice', amountSum: 500000 }],
      salaries: [], additionals: [], services: [],
    });
    expect(eventSpent(somOnly).sum).toBe(500000);
    expect(eventSpent(somOnly).usdCents).toBe(0);
  });
});
