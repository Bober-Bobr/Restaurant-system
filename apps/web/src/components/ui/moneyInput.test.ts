import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { groupDigits, parseSumToTiyin, parseWholeSum } from '../../utils/currency';

/**
 * Amounts are grouped by place value in the field itself: `250 000`, not
 * `250000`. Six or seven digits with no separators cannot be read at a glance,
 * and the difference between 250000 and 2500000 is one character in the middle
 * of a blur — on a price, or a payment.
 *
 * The expense ledger already did this inline; every other amount field in the
 * product was a bare number box. `MoneyInput` is that rule in one place.
 */
const SRC = join(__dirname, '..', '..');
const read = (rel: string) => readFileSync(join(SRC, rel), 'utf8');

describe('grouping, and reading it back', () => {
  it('groups from the right, in threes', () => {
    expect(groupDigits('250000')).toBe('250 000');
    expect(groupDigits('2500000')).toBe('2 500 000');
    expect(groupDigits('99')).toBe('99');
    expect(groupDigits('')).toBe('');
  });

  it('is idempotent, so re-rendering an already-grouped value is safe', () => {
    // The component groups on the way in AND on the way out; if this were not
    // stable the caret would jump every keystroke.
    expect(groupDigits(groupDigits('2500000'))).toBe('2 500 000');
  });

  it('every parser reads a grouped amount back', () => {
    // This is the half that breaks silently: a field that renders "250 000" and
    // a validator that calls `Number()` on it disagree, and the form declares
    // every real amount invalid.
    expect(parseSumToTiyin('250 000')).toBe(250_000_00);
    expect(parseWholeSum('2 500 000')).toBe(2_500_000);
    expect(Number('250 000'), 'the trap this avoids').toBeNaN();
  });
});

describe('the field itself', () => {
  // Comments stripped first: this file EXPLAINS why it is `type="text"`, so a
  // presence check would match its own prose and pass against a number box.
  const src = read('components/ui/MoneyInput.tsx').replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, '');

  it('is a text box, because a number box cannot hold a space', () => {
    // `type="number"` rejects the separator outright, which is why every field
    // that needed grouping had to stop being one.
    expect(src).toContain('type="text"');
    expect(src).toContain('inputMode="numeric"');
    expect(src, 'still a number box').not.toContain('type="number"');
  });

  it('groups what it displays as well as what it stores', () => {
    expect(src).toContain('value={groupDigits(value)}');
    expect(src).toContain('onChange(groupDigits(e.target.value))');
  });

  it('carries the surrounding form\'s class', () => {
    // `adm-input` on the admin pages, `rg-input` on the kiosk — the same trap
    // NumberField fell into.
    expect(src).toContain("className = 'adm-input'");
  });
});

describe('the fields that collect an amount use it', () => {
  const SITES: [string, string[]][] = [
    ['pages/AdminEventsPage.tsx', ['depositText', 'guestCountText']],
    ['pages/AdminExtraServicesPage.tsx', ['priceText', 'editPriceText']],
    ['pages/AdminTableCategoriesPage.tsx', ['ratePerPersonText', 'editRatePerPersonText']],
    ['pages/AdminHallsPage.tsx', ['capacityText', 'editCapacityText']],
    ['pages/TabletSummaryPage.tsx', ['manualTotalText', 'depositText']],
    ['pages/AdminInvoicesPage.tsx', ['paymentDrafts[event.id]']],
  ];

  for (const [page, fields] of SITES) {
    for (const field of fields) {
      it(`${page}: ${field}`, () => {
        const src = read(page);
        const at = src.indexOf(`value={${field}`);
        expect(at, `${field} has no input`).toBeGreaterThan(-1);
        // Walk back to the tag that owns it.
        const tag = src.lastIndexOf('<', at);
        expect(src.slice(tag, at), `${field} is not a MoneyInput`).toContain('MoneyInput');
      });
    }
  }

  it('the validators that read those fields were taught about spaces', () => {
    // Changing the field without changing the parser is how "250 000" becomes
    // "Rate per person must be a non-negative number" — and, with the editor
    // autosaved, a row that silently refuses to save at all.
    expect(read('pages/AdminTableCategoriesPage.tsx')).toContain('const rate = parseWholeSum(');
    for (const page of ['pages/AdminHallsPage.tsx', 'pages/AdminEventsPage.tsx']) {
      expect(read(page), page).toContain("const trimmed = value.replace(/\\s/g, '').trim();");
    }
  });

  it('counts too small to group are left alone, deliberately', () => {
    // Servings (1–20) and a discount percent (0–100) gain nothing from a
    // separator, and an event id is an identifier — "1 234" would be wrong.
    expect(read('pages/AdminTableCategoriesPage.tsx')).toContain('type="number"');
    expect(read('pages/TabletSummaryPage.tsx')).toContain('type="number"');
  });
});
