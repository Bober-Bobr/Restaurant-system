import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import * as web from './ledgerMoney';
import { parseUsdToCents, usdInputValue } from './currency';
// The API's copy. The API cannot import from the web app, so the module exists
// twice — the same guard standing over `toSubdomainSlug`, the invoice
// arithmetic, the section rule and the floor-map geometry.
import * as api from '../../../api/src/utils/ledgerMoney';

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel: string) => readFileSync(join(SRC, rel), 'utf8');

/**
 * `toLocaleString('ru-RU')` groups with a NON-BREAKING space, so a formatted
 * figure and the identical-looking literal in a test are not equal. This bit
 * the owner's chart helpers too.
 */
const plain = (text: string) => text.replace(/\u00a0/g, ' ');

/** Every amount pairing worth running through both copies. */
const CASES: { sum: number; usdCents: number }[] = [
  { sum: 0, usdCents: 0 },
  { sum: 500_000, usdCents: 0 },
  { sum: 0, usdCents: 12_345 },
  { sum: 1, usdCents: 1 },
  { sum: 90_000_000, usdCents: 4_500_000 },
  { sum: -400_000, usdCents: -8_000 },
];

describe('the two copies of the money module agree', () => {
  it('exports the same names', () => {
    // A helper added to one copy and not the other is a rule that holds on one
    // side of the product only.
    const names = (m: object) => Object.keys(m).sort();
    expect(names(web)).toEqual(names(api));
  });

  it('agrees on the caps, which are the columns\' own limits', () => {
    expect(web.MAX_SUM).toBe(api.MAX_SUM);
    expect(web.MAX_USD_CENTS).toBe(api.MAX_USD_CENTS);
    expect(web.ZERO_MONEY).toEqual(api.ZERO_MONEY);
  });

  for (const a of CASES) {
    for (const b of CASES) {
      it(`adds and subtracts ${a.sum}/${a.usdCents} and ${b.sum}/${b.usdCents} identically`, () => {
        expect(web.addMoney(a, b)).toEqual(api.addMoney(a, b));
        expect(web.subtractMoney(a, b)).toEqual(api.subtractMoney(a, b));
      });
    }
  }

  for (const c of CASES) {
    it(`reads, scales and formats ${c.sum}/${c.usdCents} identically`, () => {
      const line = { amountSum: c.sum, amountUsdCents: c.usdCents };
      expect(web.moneyOf(line)).toEqual(api.moneyOf(line));
      expect(web.money(c.sum, c.usdCents)).toEqual(api.money(c.sum, c.usdCents));
      expect(web.scaleMoney(c, 7)).toEqual(api.scaleMoney(c, 7));
      expect(web.formatMoney(c)).toBe(api.formatMoney(c));
      expect(web.formatSom(c.sum)).toBe(api.formatSom(c.sum));
      expect(web.formatUsd(c.usdCents)).toBe(api.formatUsd(c.usdCents));
      expect(web.hasUsd(c)).toBe(api.hasUsd(c));
    });
  }

  it('sums a list of lines identically', () => {
    const lines = CASES.map((c) => ({ amountSum: c.sum, amountUsdCents: c.usdCents }));
    expect(web.sumMoney(lines)).toEqual(api.sumMoney(lines));
  });
});

describe('the two currencies never meet', () => {
  it('adds componentwise and nowhere across', () => {
    const a = { sum: 100, usdCents: 7 };
    const b = { sum: 20, usdCents: 3 };
    expect(web.addMoney(a, b)).toEqual({ sum: 120, usdCents: 10 });
  });

  it('leaves the other currency alone when one side has none', () => {
    // The case the whole pair exists for: dollars spent on a so'm-only
    // department must not appear as so'm, and the reverse.
    expect(web.addMoney({ sum: 0, usdCents: 5000 }, { sum: 300, usdCents: 0 }))
      .toEqual({ sum: 300, usdCents: 5000 });
  });

  it('has no conversion in it at all', () => {
    // There is no exchange rate in this product, and there must not be one: a
    // rate typed today would silently restate every day already recorded.
    // Read with the comments stripped: the prose explains the units, and
    // "1/100 so'm" is not a conversion.
    const source = read('utils/ledgerMoney.ts').replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, '');
    expect(source).not.toMatch(/\brate\b\s*[:=]/i);
    // No dollar figure divided or multiplied by anything but a plain count.
    expect(source).not.toMatch(/usdCents\s*\/\s*\w/);
    // And nothing that reduces a pair to one number.
    expect(web).not.toHaveProperty('totalMoney');
  });

  it('subtracts into the NEGATIVE, because a balance can be a loss', () => {
    expect(web.subtractMoney({ sum: 100, usdCents: 5 }, { sum: 400, usdCents: 50 }))
      .toEqual({ sum: -300, usdCents: -45 });
  });

  it('can be in profit in one currency and at a loss in the other', () => {
    // The reason a balance is a pair rather than a number. One figure cannot
    // say this, and whichever currency it picked would misreport the other.
    const balance = web.subtractMoney({ sum: 3_000_000, usdCents: 0 }, { sum: 100_000, usdCents: 80_000 });
    expect(balance.sum).toBeGreaterThan(0);
    expect(balance.usdCents).toBeLessThan(0);
  });
});

describe('reading a stored line', () => {
  it('treats a missing or malformed dollar amount as nothing', () => {
    // Every row written before the column existed, and anything a bad write
    // could leave behind.
    expect(web.moneyOf({ amountSum: 500 })).toEqual({ sum: 500, usdCents: 0 });
    expect(web.moneyOf({ amountSum: 500, amountUsdCents: null })).toEqual({ sum: 500, usdCents: 0 });
    expect(web.moneyOf(undefined)).toEqual({ sum: 0, usdCents: 0 });
    expect(web.moneyOf({ amountSum: NaN, amountUsdCents: Infinity })).toEqual({ sum: 0, usdCents: 0 });
  });

  it('clamps to what the columns can hold', () => {
    // Both are a 32-bit Int, and a figure past the cap is a 500 on the way in.
    expect(web.money(1e12, 1e12)).toEqual({ sum: web.MAX_SUM, usdCents: web.MAX_USD_CENTS });
    expect(web.money(-5, -5)).toEqual({ sum: 0, usdCents: 0 });
  });

  it('rounds, because both columns are integers', () => {
    expect(web.money(10.6, 10.4)).toEqual({ sum: 11, usdCents: 10 });
  });

  it('multiplies a per-guest price by a whole count', () => {
    expect(web.scaleMoney({ sum: 50_000, usdCents: 1250 }, 40)).toEqual({ sum: 2_000_000, usdCents: 50_000 });
    expect(web.scaleMoney({ sum: 50_000, usdCents: 1250 }, 0)).toEqual({ sum: 0, usdCents: 0 });
  });
});

describe('how a figure reads', () => {
  it('shows the so\'m alone when nothing is in dollars', () => {
    // A ledger kept in so'm — most of them — must read exactly as it did
    // before dollars existed, with no trailing "$0.00".
    expect(plain(web.formatMoney({ sum: 500_000, usdCents: 0 }))).toBe("500 000 so'm");
    expect(web.formatMoney({ sum: 500_000, usdCents: 0 })).not.toContain('$');
  });

  it('shows both when there are dollars, separated and not summed', () => {
    const text = plain(web.formatMoney({ sum: 500_000, usdCents: 12_345 }));
    expect(text).toContain("500 000 so'm");
    expect(text).toContain('$123.45');
    // A plus sign would invite the reader to do the one sum this refuses to do.
    expect(text).not.toContain('+');
  });

  it('always prints two decimal places', () => {
    expect(web.formatUsd(0)).toBe('$0.00');
    expect(web.formatUsd(5)).toBe('$0.05');
    expect(web.formatUsd(1200)).toBe('$12.00');
    expect(plain(web.formatUsd(100_000))).toBe('$1 000.00');
  });

  it('puts a minus BEFORE the dollar sign', () => {
    // `$-40.00` reads as a price; `-$40.00` reads as a loss, which on these
    // pages is what a negative figure always is.
    expect(web.formatUsd(-4000)).toBe('-$40.00');
  });
});

describe('typing a dollar amount', () => {
  it('reads a plain amount, with or without cents', () => {
    expect(parseUsdToCents('12.50')).toBe(1250);
    expect(parseUsdToCents('12')).toBe(1200);
    expect(parseUsdToCents('0.05')).toBe(5);
  });

  it('accepts a COMMA as the decimal point', () => {
    // The ledger is typed on a Russian or Uzbek layout, where the comma is the
    // decimal separator — refusing it looks like the field is broken.
    expect(parseUsdToCents('12,50')).toBe(1250);
  });

  it('forgives the spaces and the dollar sign a person types', () => {
    expect(parseUsdToCents(' $12.50 ')).toBe(1250);
  });

  it('refuses what it cannot read, rather than guessing', () => {
    for (const bad of ['', '   ', 'abc', '-5', '1.2.3', '1e3', '$', '12..5']) {
      expect(parseUsdToCents(bad)).toBe(null);
    }
  });

  it('rounds a third decimal instead of refusing it', () => {
    // A third digit of cents is a typo, not a different amount.
    expect(parseUsdToCents('12.567')).toBe(1257);
  });

  it('round-trips through the input field', () => {
    for (const cents of [0, 5, 1250, 100_000, 99]) {
      expect(parseUsdToCents(usdInputValue(cents))).toBe(cents);
    }
  });

  it('keeps the trailing cents in the field', () => {
    // So the field reads as an amount of money rather than a count.
    expect(usdInputValue(1200)).toBe('12.00');
    expect(usdInputValue(0)).toBe('0.00');
  });
});

// ── No currency may cross into the other, in any implementation ────────────
// Three files implement the ledger arithmetic — the page, the PDF and the
// owner's report — and the one bug worth making impossible is a so'm figure
// and a dollar figure meeting in one expression. These sweep for it.
describe('no implementation mixes the two currencies', () => {
  const IMPLEMENTATIONS: [string, string][] = [
    ['the ledger page', read('pages/ExpenseLedgerPage.tsx')],
    ['the day-extras page', read('pages/AdditionalExpensesPage.tsx')],
    ['the accounts page', read('pages/AccountsPage.tsx')],
    ['the money module', read('utils/ledgerMoney.ts')],
    ['the PDF', readFileSync(join(SRC, '../../api/src/modules/expense/expense.pdf.service.ts'), 'utf8')],
    ['the owner\'s report', readFileSync(join(SRC, '../../api/src/modules/report/report.finance.ts'), 'utf8')],
  ];

  for (const [what, source] of IMPLEMENTATIONS) {
    it(`${what} never adds a so'm figure to a dollar figure`, () => {
      const code = source.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, '');
      // `x.sum + y.usdCents` and the reverse, however they are spelt.
      expect(code).not.toMatch(/\.sum\s*[+\-]\s*[\w.[\]]*[Uu]sd/);
      expect(code).not.toMatch(/[Uu]sdCents\s*[+\-]\s*[\w.[\]]*\.sum\b/);
      expect(code).not.toMatch(/Cents\s*\+\s*[\w.]*\bspentCents\b.*Usd/);
    });
  }
});
