// ── The expense ledger's arithmetic, stated once ────────────────────────────
// The page ([ExpenseLedgerPage.tsx]) and the PDF ([expense.pdf.service.ts])
// implement this separately — the PDF is not generated from the page — and
// CLAUDE.md warns they must be changed together. Nothing enforced that.
//
// These are the expected answers. BOTH suites import this file and assert
// against it, so the two implementations cannot drift apart without a test
// failing on the side that changed. Plain data, no imports, so either project
// can load it.

export type LedgerCase = {
  name: string;
  event: {
    type: string;
    guestCount: number;
    pricePerGuestSum: number;
    manualGuestsSum?: number | null;
    products: { name: string; amountSum: number }[];
    salaries: { name: string; amountSum: number }[];
    additionals: { name: string; amountSum: number }[];
    services: { name: string; amountSum: number }[];
  };
  expected: {
    guestsRevenue: number;
    servicesRevenue: number;
    /** guests + services. The prominent figure at the top of a department. */
    revenue: number;
    /** products + salaries + additionals. Services are NOT spending. */
    spent: number;
    balance: number;
  };
};

const noLines = { products: [], salaries: [], additionals: [], services: [] };

export const LEDGER_CASES: LedgerCase[] = [
  {
    name: 'an empty department is all zeros',
    event: { type: 'MORNING', guestCount: 0, pricePerGuestSum: 0, ...noLines },
    expected: { guestsRevenue: 0, servicesRevenue: 0, revenue: 0, spent: 0, balance: 0 },
  },
  {
    name: 'guest revenue is guests × price per guest',
    event: { type: 'MORNING', guestCount: 120, pricePerGuestSum: 85000, ...noLines },
    expected: { guestsRevenue: 10200000, servicesRevenue: 0, revenue: 10200000, spent: 0, balance: 10200000 },
  },
  {
    name: 'services are REVENUE despite the table being called an expense',
    event: {
      type: 'DAY', guestCount: 100, pricePerGuestSum: 50000,
      products: [], salaries: [], additionals: [],
      services: [{ name: 'Host', amountSum: 1500000 }, { name: 'Singer', amountSum: 2000000 }],
    },
    expected: { guestsRevenue: 5000000, servicesRevenue: 3500000, revenue: 8500000, spent: 0, balance: 8500000 },
  },
  {
    name: 'spending is products + salaries + additional expenses only',
    event: {
      type: 'EVENING', guestCount: 200, pricePerGuestSum: 100000,
      products: [{ name: 'Meat', amountSum: 4000000 }, { name: 'Rice', amountSum: 800000 }],
      salaries: [{ name: 'Cooks', amountSum: 1200000 }],
      additionals: [{ name: 'Taxi', amountSum: 100000 }],
      services: [{ name: 'Tamada', amountSum: 3000000 }],
    },
    expected: {
      guestsRevenue: 20000000, servicesRevenue: 3000000, revenue: 23000000,
      spent: 6100000, balance: 16900000,
    },
  },
  {
    name: 'a manual figure replaces the guest revenue outright',
    event: { type: 'NIGHT', guestCount: 100, pricePerGuestSum: 90000, manualGuestsSum: 7000000, ...noLines },
    expected: { guestsRevenue: 7000000, servicesRevenue: 0, revenue: 7000000, spent: 0, balance: 7000000 },
  },
  {
    name: 'a manual figure of zero is honoured, not treated as "not set"',
    // Why the column is nullable rather than 0-defaulted: "overridden to zero"
    // and "not overridden" are different facts.
    event: { type: 'NIGHT', guestCount: 100, pricePerGuestSum: 90000, manualGuestsSum: 0, ...noLines },
    expected: { guestsRevenue: 0, servicesRevenue: 0, revenue: 0, spent: 0, balance: 0 },
  },
  {
    name: 'a manual figure never swallows the services sold alongside it',
    event: {
      type: 'NIGHT', guestCount: 100, pricePerGuestSum: 90000, manualGuestsSum: 5000000,
      products: [], salaries: [], additionals: [],
      services: [{ name: 'Invitations', amountSum: 400000 }],
    },
    expected: { guestsRevenue: 5000000, servicesRevenue: 400000, revenue: 5400000, spent: 0, balance: 5400000 },
  },
  {
    name: 'a department can run at a loss',
    event: {
      type: 'DAY', guestCount: 10, pricePerGuestSum: 50000,
      products: [{ name: 'Meat', amountSum: 900000 }],
      salaries: [], additionals: [], services: [],
    },
    expected: { guestsRevenue: 500000, servicesRevenue: 0, revenue: 500000, spent: 900000, balance: -400000 },
  },
];

/** A whole day: the roll-ups must be the sum of the departments. */
export const LEDGER_DAY = {
  date: '2026-08-12',
  events: LEDGER_CASES.map((c) => c.event),
  expected: {
    revenue: LEDGER_CASES.reduce((sum, c) => sum + c.expected.revenue, 0),
    spent: LEDGER_CASES.reduce((sum, c) => sum + c.expected.spent, 0),
  },
};
