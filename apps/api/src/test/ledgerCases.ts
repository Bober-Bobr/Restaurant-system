// ── The expense ledger's arithmetic, stated once ────────────────────────────
// The page ([ExpenseLedgerPage.tsx]) and the PDF ([expense.pdf.service.ts])
// implement this separately — the PDF is not generated from the page — and
// CLAUDE.md warns they must be changed together. Nothing enforced that.
//
// These are the expected answers. BOTH suites import this file and assert
// against it, so the two implementations cannot drift apart without a test
// failing on the side that changed. Plain data, no imports, so either project
// can load it.

/**
 * A line, in either currency or both.
 *
 * `amountUsdCents` is a SECOND amount beside the so'm one, in US cents, and is
 * never added to it — see utils/ledgerMoney.ts. Optional here on purpose: a
 * case that omits it is a line as it was written before dollars existed, and
 * every such case below keeps the so'm answers it always had.
 */
type CaseLine = { name: string; amountSum: number; amountUsdCents?: number };

export type LedgerCase = {
  name: string;
  event: {
    type: string;
    guestCount: number;
    pricePerGuestSum: number;
    pricePerGuestUsdCents?: number;
    manualGuestsSum?: number | null;
    manualGuestsUsdCents?: number | null;
    products: CaseLine[];
    salaries: CaseLine[];
    additionals: CaseLine[];
    services: CaseLine[];
  };
  expected: {
    guestsRevenue: number;
    servicesRevenue: number;
    /** guests + services. The prominent figure at the top of a department. */
    revenue: number;
    /** products + salaries + additionals. Services are NOT spending. */
    spent: number;
    balance: number;
    /**
     * The same five figures in DOLLARS (US cents). A case that leaves this out
     * expects zero throughout — which is the point: adding a second currency
     * must not move a single so'm figure on a ledger kept in so'm.
     */
    usd?: {
      guestsRevenue: number;
      servicesRevenue: number;
      revenue: number;
      spent: number;
      balance: number;
    };
  };
};

/** The dollar half of a case's expectations, with "not stated" meaning zero. */
export const expectedUsd = (c: LedgerCase) =>
  c.expected.usd ?? { guestsRevenue: 0, servicesRevenue: 0, revenue: 0, spent: 0, balance: 0 };

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
  // ── The dollar side ──────────────────────────────────────────────────────
  // Every case above states dollars nowhere and expects zero, which is the
  // guard that matters most: a ledger kept in so'm must read exactly as it did
  // before this column existed. These are the cases that exercise the second
  // currency, and each one pins that the two are kept APART — no case anywhere
  // in this file expects a so'm figure to move because of a dollar figure.
  {
    name: 'a dollar price per guest multiplies by the guest count, like the so\'m one',
    event: {
      type: 'DAY', guestCount: 40, pricePerGuestSum: 50000, pricePerGuestUsdCents: 1250,
      ...noLines,
    },
    expected: {
      guestsRevenue: 2000000, servicesRevenue: 0, revenue: 2000000, spent: 0, balance: 2000000,
      // 40 x $12.50
      usd: { guestsRevenue: 50000, servicesRevenue: 0, revenue: 50000, spent: 0, balance: 50000 },
    },
  },
  {
    name: 'a line can be wholly in dollars, and leaves the so\'m total at zero',
    event: {
      type: 'EVENING', guestCount: 0, pricePerGuestSum: 0,
      products: [{ name: 'Imported cheese', amountSum: 0, amountUsdCents: 24000 }],
      salaries: [], additionals: [], services: [],
    },
    expected: {
      guestsRevenue: 0, servicesRevenue: 0, revenue: 0, spent: 0, balance: 0,
      usd: { guestsRevenue: 0, servicesRevenue: 0, revenue: 0, spent: 24000, balance: -24000 },
    },
  },
  {
    name: 'a line can be part so\'m and part dollars, and neither part reaches the other',
    event: {
      type: 'TUI', guestCount: 100, pricePerGuestSum: 90000, pricePerGuestUsdCents: 200,
      products: [{ name: 'Meat', amountSum: 3000000, amountUsdCents: 15000 }],
      salaries: [{ name: 'Cooks', amountSum: 1000000 }],
      additionals: [],
      services: [{ name: 'Singer', amountSum: 2000000, amountUsdCents: 30000 }],
    },
    expected: {
      guestsRevenue: 9000000, servicesRevenue: 2000000, revenue: 11000000,
      spent: 4000000, balance: 7000000,
      usd: {
        guestsRevenue: 20000, servicesRevenue: 30000, revenue: 50000,
        spent: 15000, balance: 35000,
      },
    },
  },
  {
    name: 'each currency honours its OWN manual override',
    // The override is one decision on the page and two figures in the data.
    // A so'm override that zeroed the dollars would silently lose money that
    // was recorded.
    event: {
      type: 'NIGHT', guestCount: 100, pricePerGuestSum: 90000, pricePerGuestUsdCents: 500,
      manualGuestsSum: 7000000, manualGuestsUsdCents: 60000,
      ...noLines,
    },
    expected: {
      guestsRevenue: 7000000, servicesRevenue: 0, revenue: 7000000, spent: 0, balance: 7000000,
      usd: { guestsRevenue: 60000, servicesRevenue: 0, revenue: 60000, spent: 0, balance: 60000 },
    },
  },
  {
    name: 'a so\'m override leaves the dollars on their own multiplication',
    // What a row written before the dollar override existed looks like: the
    // so'm figure is overridden, the dollar column is null, and the dollars
    // still answer guests x price rather than collapsing to nothing.
    event: {
      type: 'NIGHT', guestCount: 20, pricePerGuestSum: 90000, pricePerGuestUsdCents: 1000,
      manualGuestsSum: 1000000, manualGuestsUsdCents: null,
      ...noLines,
    },
    expected: {
      guestsRevenue: 1000000, servicesRevenue: 0, revenue: 1000000, spent: 0, balance: 1000000,
      usd: { guestsRevenue: 20000, servicesRevenue: 0, revenue: 20000, spent: 0, balance: 20000 },
    },
  },
  {
    name: 'a dollar override of zero is honoured, not read as "not overridden"',
    event: {
      type: 'NIGHT', guestCount: 20, pricePerGuestSum: 50000, pricePerGuestUsdCents: 1000,
      manualGuestsSum: null, manualGuestsUsdCents: 0,
      ...noLines,
    },
    expected: {
      guestsRevenue: 1000000, servicesRevenue: 0, revenue: 1000000, spent: 0, balance: 1000000,
      usd: { guestsRevenue: 0, servicesRevenue: 0, revenue: 0, spent: 0, balance: 0 },
    },
  },
  {
    name: 'a department can be in profit in so\'m and at a loss in dollars at once',
    // The reason a balance has to be a pair rather than a number: one figure
    // cannot say this, and whichever currency it chose would be a lie about
    // the other.
    event: {
      type: 'DAY', guestCount: 50, pricePerGuestSum: 60000,
      products: [{ name: 'Spirits', amountSum: 100000, amountUsdCents: 80000 }],
      salaries: [], additionals: [], services: [],
    },
    expected: {
      guestsRevenue: 3000000, servicesRevenue: 0, revenue: 3000000, spent: 100000, balance: 2900000,
      usd: { guestsRevenue: 0, servicesRevenue: 0, revenue: 0, spent: 80000, balance: -80000 },
    },
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

/**
 * A whole day: the roll-ups must be the sum of the departments, in BOTH
 * currencies and never across them.
 *
 * Note the departments are keyed `[dayId, type]` in the database, so a real day
 * holds four; this is a list of every case so the roll-up is exercised over all
 * of them at once.
 */
export const LEDGER_DAY = {
  date: '2026-08-12',
  events: LEDGER_CASES.map((c) => c.event),
  expected: {
    revenue: LEDGER_CASES.reduce((sum, c) => sum + c.expected.revenue, 0),
    spent: LEDGER_CASES.reduce((sum, c) => sum + c.expected.spent, 0),
    usd: {
      revenue: LEDGER_CASES.reduce((sum, c) => sum + expectedUsd(c).revenue, 0),
      spent: LEDGER_CASES.reduce((sum, c) => sum + expectedUsd(c).spent, 0),
    },
  },
};
