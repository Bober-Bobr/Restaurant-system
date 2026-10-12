import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  dayRevenue, daySpent, generateCombinedPdf, generateExtrasPdf, usdColumn, type PdfDay,
} from './expense.pdf.service.js';

/**
 * The dollar column on the printed ledger.
 *
 * The rule worth protecting: a restaurant that keeps its ledger in so'm — most
 * of them — must get the sheet it has always got. Not one with an extra column
 * of dashes down the side, and not one where the so'm column has narrowed to
 * make room for figures nobody recorded.
 */
const SOURCE = readFileSync(join(__dirname, 'expense.pdf.service.ts'), 'utf8');

const emptyDay = (over: Partial<PdfDay> = {}): PdfDay => ({
  date: '2026-10-12',
  allocatedSum: 0,
  report: null,
  events: [],
  extras: [],
  ...over,
});

const department = (over: Record<string, unknown> = {}) => ({
  type: 'TUI',
  guestCount: 0,
  pricePerGuestSum: 0,
  products: [],
  salaries: [],
  additionals: [],
  services: [],
  ...over,
}) as PdfDay['events'][number];

describe('whether the sheet gets a dollar column', () => {
  it('no, for a ledger kept entirely in so\'m', () => {
    const day = emptyDay({
      events: [department({ guestCount: 100, pricePerGuestSum: 90_000, products: [{ name: 'Meat', amountSum: 500_000 }] })],
      extras: [{ name: 'Taxi', amountSum: 50_000 }],
    });
    expect(usdColumn([day])).toBe(false);
  });

  it('no, for a day with nothing on it at all', () => {
    expect(usdColumn([emptyDay()])).toBe(false);
    expect(usdColumn([])).toBe(false);
  });

  it('yes, for a dollar amount on a SPENDING line', () => {
    const day = emptyDay({
      events: [department({ products: [{ name: 'Cheese', amountSum: 0, amountUsdCents: 24_000 }] })],
    });
    expect(usdColumn([day])).toBe(true);
  });

  it('yes, for a dollar amount on a REVENUE line', () => {
    const day = emptyDay({
      events: [department({ services: [{ name: 'Singer', amountSum: 0, amountUsdCents: 30_000 }] })],
    });
    expect(usdColumn([day])).toBe(true);
  });

  it('yes, for a dollar PRICE PER GUEST', () => {
    const day = emptyDay({
      events: [department({ guestCount: 40, pricePerGuestUsdCents: 1250 })],
    });
    expect(usdColumn([day])).toBe(true);
  });

  it('yes, for a dollar amount on a day-level EXTRA', () => {
    // The extras document is a separate export and would otherwise print its
    // dollars nowhere.
    expect(usdColumn([emptyDay({ extras: [{ name: 'Courier', amountSum: 0, amountUsdCents: 1500 }] })])).toBe(true);
  });

  it('is decided ONCE for the whole document, not per page', () => {
    // A thirty-day export where one day was settled partly in dollars must
    // have the same columns on every page, or the pages do not line up.
    const plain = emptyDay({ date: '2026-10-01', events: [department({ products: [{ name: 'Rice', amountSum: 100 }] })] });
    const withUsd = emptyDay({ date: '2026-10-02', events: [department({ products: [{ name: 'Oil', amountSum: 0, amountUsdCents: 900 }] })] });
    expect(usdColumn([plain, withUsd])).toBe(true);
    expect(usdColumn([plain, plain])).toBe(false);
    // And both entry points ask it of the WHOLE set of days.
    expect(SOURCE).toContain('createDoc(locale, usdColumn(days))');
    expect((SOURCE.match(/createDoc\(locale, usdColumn\(days\)\)/g) ?? []).length).toBe(2);
  });

  it('gives up the NAME column\'s width, never the so\'m column\'s', () => {
    // A so'm amount runs to nine digits; it must not start wrapping because a
    // dollar column arrived beside it.
    expect(SOURCE).toMatch(/const COL1 = usd \? TW \* 0\.60 : TW \* 0\.78;/);
    expect(SOURCE).toMatch(/const COL2 = usd \? TW \* 0\.22 : TW \* 0\.22;/);
  });

  it('prints a dash, not $0.00, on a line with no dollars', () => {
    // A zero is a figure somebody recorded. A column of them reads as money
    // that was counted and came to nothing.
    const body = SOURCE.slice(SOURCE.indexOf('const dataRow ='), SOURCE.indexOf('const section ='));
    expect(body).toMatch(/hasUsd\(value\) \? formatUsd\(value\.usdCents\) : '—'/);
  });
});

describe('the sheet still renders, with and without dollars', () => {
  const run = async (day: PdfDay) => {
    const combined = await generateCombinedPdf([day], { from: day.date, to: day.date }, 'ru');
    const extras = await generateExtrasPdf([day], { from: day.date, to: day.date }, 'ru');
    return { combined, extras };
  };

  const somOnly = emptyDay({
    events: [department({
      guestCount: 100, pricePerGuestSum: 90_000,
      products: [{ name: 'Meat', amountSum: 4_000_000 }],
      salaries: [{ name: 'Cooks', amountSum: 1_200_000 }],
      services: [{ name: 'Host', amountSum: 1_500_000 }],
    })],
    extras: [{ name: 'Taxi', amountSum: 50_000 }],
  });

  const bothCurrencies = emptyDay({
    events: [department({
      guestCount: 100, pricePerGuestSum: 90_000, pricePerGuestUsdCents: 500,
      manualGuestsSum: 8_000_000, manualGuestsUsdCents: 60_000,
      products: [{ name: 'Meat', amountSum: 4_000_000, amountUsdCents: 15_000 }],
      salaries: [{ name: 'Cooks', amountSum: 1_200_000 }],
      services: [{ name: 'Host', amountSum: 0, amountUsdCents: 30_000 }],
    })],
    extras: [{ name: 'Courier', amountSum: 0, amountUsdCents: 1500 }],
  });

  it('produces a valid PDF for a so\'m-only day', async () => {
    const { combined, extras } = await run(somOnly);
    expect(combined.subarray(0, 5).toString('latin1')).toBe('%PDF-');
    expect(extras.subarray(0, 5).toString('latin1')).toBe('%PDF-');
  });

  it('produces a valid PDF when both currencies are on it', async () => {
    // The layout grows a third column and a dollar info line; this is the
    // cheapest guard against that crashing or running off the page.
    const { combined, extras } = await run(bothCurrencies);
    expect(combined.subarray(0, 5).toString('latin1')).toBe('%PDF-');
    expect(extras.subarray(0, 5).toString('latin1')).toBe('%PDF-');
  });

  it('draws MORE on the dollar sheet than on the so\'m one', () => {
    // Not a byte comparison — PDFKit output is compressed and carries a
    // timestamp — but the dollar sheet has strictly more cells, so it cannot
    // be the smaller document.
    expect(usdColumn([bothCurrencies])).toBe(true);
    expect(usdColumn([somOnly])).toBe(false);
  });

  it('keeps the two currencies apart in the day roll-ups', () => {
    expect(dayRevenue(bothCurrencies)).toEqual({ sum: 8_000_000, usdCents: 90_000 });
    expect(daySpent(bothCurrencies)).toEqual({ sum: 5_200_000, usdCents: 15_000 });
    // The so'm-only day reports no dollars at all, rather than a converted
    // figure, which is the whole rule.
    expect(dayRevenue(somOnly).usdCents).toBe(0);
    expect(daySpent(somOnly).usdCents).toBe(0);
  });
});
