import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The dollar amount on the restaurant manager's pages, from the pages' side.
 *
 * The arithmetic is `ledgerMoneyAgreement.test.ts` and the shared cases in
 * `ledgerCases.ts`. What is checked here is the chain around the fields: that
 * every price entry has one, that a recorded amount can never be hidden, that
 * clearing a field takes the amount OFF rather than leaving it, and that the
 * owner's report shows dollars only where there are dollars.
 *
 * Reads the source, the house style where there is no DOM.
 */
const SRC = join(__dirname, '..');
const strip = (code: string) => code.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, '');
const src = (rel: string) => strip(readFileSync(join(SRC, rel), 'utf8'));
const raw = (rel: string) => readFileSync(join(SRC, rel), 'utf8');

const ledger = src('pages/ExpenseLedgerPage.tsx');
const extras = src('pages/AdditionalExpensesPage.tsx');
const accounts = src('pages/AccountsPage.tsx');
const reports = src('pages/OwnerReportsPage.tsx');
const schema = strip(readFileSync(join(SRC, '../../api/src/modules/expense/expense.schema.ts'), 'utf8'));
const repository = strip(readFileSync(join(SRC, '../../api/src/modules/report/report.repository.ts'), 'utf8'));

describe('every price entry can carry a dollar amount', () => {
  // The seven money fields a restaurant manager types, and where each lives.
  it('the four per-department line kinds, through the shared rows', () => {
    // Services, salaries and additional expenses share `LineRow`; products
    // have their own row because of the quantity and unit.
    const between = (from: string, to: string) =>
      ledger.slice(ledger.indexOf(from), ledger.indexOf(to));
    expect(between('const LineRow =', 'const AddLineRow =')).toContain('<UsdField');
    expect(between('const ProductRow =', 'const AddProductRow =')).toContain('<UsdField');
    // And both "add" rows, or a dollar amount could be typed only by editing a
    // line after creating it.
    expect(ledger).toMatch(/const AddLineRow = [\s\S]{0,1400}amountUsdCents/);
    expect(ledger).toMatch(/const AddProductRow = [\s\S]{0,1400}amountUsdCents/);
  });

  it('the booking\'s price per guest', () => {
    expect(ledger).toContain("pricePerGuestUsdCents: usd");
    expect(ledger).toMatch(/label=\{t\('price_per_guest_usd'\)\}/);
  });

  it('the manual override of the guest revenue', () => {
    expect(ledger).toMatch(/const ManualGuestsField = [\s\S]{0,2600}<UsdField/);
    expect(ledger).toContain('manualGuestsUsdCents');
  });

  it('the day-level extras, on their own page', () => {
    expect(extras).toContain('amountUsdCents');
    expect(extras).toMatch(/addExtra\([\s\S]{0,200}amountUsdCents/);
  });

  it('and the server accepts all of them', () => {
    // A field the page sends and the schema does not name is stripped by zod
    // and silently lost.
    for (const field of ['amountUsdCents', 'pricePerGuestUsdCents', 'manualGuestsUsdCents']) {
      expect(schema).toContain(field);
    }
    // The override is nullable on both currencies, for the same reason: "set to
    // zero" and "not set" are different facts.
    expect(schema).toMatch(/manualGuestsUsdCents: usdCents\.nullable\(\)\.optional\(\)/);
  });
});

describe('a recorded dollar amount can never be hidden', () => {
  it('the column is shown whenever the data has one, whatever the preference', () => {
    // A stored amount nobody can see is money the ledger is hiding, which is
    // worse than a column of empty fields.
    expect(ledger).toMatch(/const showUsd = usdPref \|\| dayHasUsd;/);
    expect(extras).toMatch(/const showUsd = usdPref \|\| hasUsd\(total\);/);
  });

  it('and the switch is disabled while it is, with a reason', () => {
    const sw = ledger.slice(ledger.indexOf('const UsdSwitch'), ledger.indexOf('const ProductHeader'));
    expect(sw).toMatch(/disabled=\{locked\}/);
    expect(sw).toContain("t('usd_column_locked')");
    // And both of the ledger's own renderings pass the day's own answer.
    expect((ledger.match(/<UsdSwitch t=\{t\} on=\{showUsd\} locked=\{dayHasUsd\}/g) ?? []).length).toBe(2);
    expect(extras).toMatch(/disabled=\{hasUsd\(total\)\}/);
  });

  it('both prices are listed by DEFAULT — only a stored "0" puts the column away', () => {
    // It was a column you switched on, which left a manager who works partly
    // in dollars with no field on the one screen that has the price fields.
    const read = ledger.slice(ledger.indexOf('export const readUsdPref'), ledger.indexOf('export const writeUsdPref'));
    expect(read).toMatch(/getItem\(USD_PREF_KEY\) !== '0'/);
    // A browser that refuses storage shows it, rather than hiding a field.
    expect(read).toMatch(/catch \{[\s\S]*return true;/);
  });

  it('the switch is reachable from the open DEPARTMENT, not only the overview', () => {
    // The price fields are inside a department; a switch only on the overview
    // is a column nobody can turn on from where they need it.
    // The row carrying the back button out of the open department.
    const back = ledger.indexOf('‹ {t(EVENT_LABEL_KEY[activeEvent.type])}');
    expect(back).toBeGreaterThan(-1);
    expect(ledger.slice(back, back + 400)).toContain('<UsdSwitch');
  });

  it('the day\'s check covers revenue, spending AND the extras', () => {
    // Three places a dollar figure can be; missing one hides it.
    expect(ledger).toMatch(/anyUsd\(\[dayRevenue\(day\), daySpent\(day\), sumMoney\(day\.extras\)\]\)/);
  });

  it('the preference survives a browser that refuses storage', () => {
    // Private windows and blocked site data throw on access, and the ledger
    // must still open.
    const read = ledger.slice(ledger.indexOf('export const readUsdPref'), ledger.indexOf('export const writeUsdPref'));
    expect(read).toContain('try {');
    expect(read).toContain('catch');
    const write = ledger.slice(ledger.indexOf('export const writeUsdPref'));
    expect(write.slice(0, 400)).toContain('catch');
  });

  it('is one switch for both manager pages', () => {
    // Two copies would drift and the two pages would disagree about whether
    // this manager works in dollars.
    expect(extras).toMatch(/import \{ QUERY_KEY, readUsdPref, writeUsdPref \} from '\.\/ExpenseLedgerPage'/);
  });
});

describe('clearing a dollar field takes the amount off', () => {
  it('an emptied field commits ZERO, not "leave it be"', () => {
    // Otherwise a dollar amount typed by mistake could never be removed — the
    // field would blank and the stored figure would stay.
    const field = ledger.slice(ledger.indexOf('const UsdField'), ledger.indexOf('return label ?'));
    expect(field).toMatch(/text\.trim\(\) === '' \? 0 : parseUsdToCents\(text\)/);
    expect(extras).toMatch(/usd\.trim\(\) === '' \? 0 : parseUsdToCents\(usd\)/);
  });

  it('an unreadable field is put back rather than written as zero', () => {
    const field = ledger.slice(ledger.indexOf('const UsdField'), ledger.indexOf('return label ?'));
    expect(field).toMatch(/if \(next === null\) \{ setText\(/);
  });

  it('commits on blur and on Enter, never per keystroke', () => {
    // Every commit is a request; "12." on the way to "12.50" is not an amount.
    const field = ledger.slice(ledger.indexOf('const UsdField'), ledger.indexOf('return label ?'));
    expect(field).toContain('onBlur={commit}');
    expect(field).toMatch(/e\.key === 'Enter'/);
    expect(field).not.toMatch(/onChange=\{[^}]*commit\(/);
  });
});

describe('the manual override is one decision and two figures', () => {
  it('ticking it seeds BOTH currencies', () => {
    // Seeding only the so'm figure would leave the dollars still following the
    // price, so the one number nobody typed is the one that moves.
    const toggle = ledger.slice(ledger.indexOf('const toggle = (checked: boolean) =>'), ledger.indexOf('return (', ledger.indexOf('const toggle = (checked: boolean) =>')));
    expect(toggle).toContain('computed.sum');
    expect(toggle).toContain('computed.usdCents');
  });

  it('but does not write a dollar override onto a so\'m-only ledger', () => {
    // An explicit 0 would make the column non-null and force the dollar
    // column on for every day anybody ever overrode.
    const toggle = ledger.slice(ledger.indexOf('const toggle = (checked: boolean) =>'), ledger.indexOf('return (', ledger.indexOf('const toggle = (checked: boolean) =>')));
    expect(toggle).toMatch(/computed\.usdCents > 0/);
  });

  it('and the switch is on when EITHER currency is overridden', () => {
    expect(ledger).toMatch(/event\.manualGuestsSum != null \|\| event\.manualGuestsUsdCents != null/);
  });
});

describe('a so\'m-only ledger reads exactly as it did', () => {
  it('nothing on these pages formats money with the old so\'m-only helper', () => {
    // `formatWholeSum` takes a number; every figure on these pages is a pair
    // now, and a leftover call would print the so'm and silently drop the
    // dollars beside it.
    for (const page of [ledger, extras, accounts]) {
      expect(page).not.toContain('formatWholeSum');
    }
  });

  it('`formatMoney` is what prints a figure, and it omits an absent dollar half', () => {
    expect(ledger).toContain('formatMoney(');
    expect(accounts).toContain('formatMoney(');
  });

  it('a balance is red when EITHER currency is negative', () => {
    // A department in profit in so'm and short in dollars printed green would
    // say the day went well.
    expect(ledger).toMatch(/remaining\.sum < 0 \|\| remaining\.usdCents < 0/);
    expect(accounts).toMatch(/balance\.sum < 0 \|\| balance\.usdCents < 0/);
  });
});

describe('the owner\'s report shows dollars only where there are dollars', () => {
  it('one flag from the server decides, for the whole tab', () => {
    expect(reports).toMatch(/const usd = data\.total\.hasUsd;/);
  });

  it('the hero\'s dollar balance is on its own line, with its own margin', () => {
    // Side by side the two read as one amount; and a margin across two
    // currencies would need a rate to exist at all.
    expect(reports).toMatch(/\{usd && \([\s\S]{0,400}rep-usd/);
    expect(reports).toContain('data.total.marginPctUsd');
    expect(raw('pages/OwnerReportsPage.tsx')).toMatch(/\.rep-usd \{[^}]*display: block/);
  });

  it('each department table gains its dollar columns together, or not at all', () => {
    // Two tables carry them — the P&L tab's and the calendar day's — and each
    // is counted on its own, so one losing a column cannot hide behind the other.
    const tables = reports.split('<table className="rep-table">').slice(1)
      .filter((table) => table.includes('row.balanceUsdCents'));
    expect(tables).toHaveLength(2);
    for (const table of tables) {
      const body = table.slice(0, table.indexOf('</table>'));
      const headers = (body.match(/\{usd && <th className="num">/g) ?? []).length;
      const cells = (body.match(/\{usd && <td className="num">/g) ?? []).length;
      // Three headers; two plain cells plus the coloured balance cell.
      expect(headers).toBe(3);
      expect(cells).toBe(2);
      expect(body).toMatch(/\{usd && \([\s\S]{0,260}row\.balanceUsdCents/);
    }
  });

  it('the report actually SELECTS the dollar columns', () => {
    // This select is explicit: a column left out reads as undefined and the
    // owner's report would quietly show no dollars at all.
    for (const field of ['amountUsdCents', 'pricePerGuestUsdCents', 'manualGuestsUsdCents']) {
      expect(repository).toContain(field);
    }
    // Every line table, not just the first.
    expect((repository.match(/amountSum: true, amountUsdCents: true/g) ?? []).length).toBe(5);
  });

  it('no chart tries to carry both currencies', () => {
    // CLAUDE.md: no dual axis anywhere — two measures of different scale get
    // two charts, and two CURRENCIES cannot share an axis at all. So no series
    // and no sparkline is ever fed a dollar figure; the dollars are text.
    const plotted = reports.match(/values[:=]\s*\{?[^\n]*/g) ?? [];
    expect(plotted.length).toBeGreaterThan(3);
    for (const line of plotted) expect(line).not.toContain('Usd');
  });
});
