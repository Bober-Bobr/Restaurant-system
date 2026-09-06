import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * What the Summary page requires before a booking can be confirmed.
 *
 * Two rules that look contradictory and are not. §41 took the head count OUT of
 * the requirements, because the API defaults `guestCount` to 0 and the Events
 * page creates an entirely blank event — a figure the restaurant does not have
 * yet is not worth inventing to get past a button. It is now required again, but
 * only HERE: a table package is a per-person price, so a kiosk booking with no
 * head count has no total, and quoting one is what the kiosk is for.
 *
 * What survived from §41 is the level the rule lives at. Nothing caps or clamps
 * the number, and the API still does not require it — so the Events page is
 * unaffected, which is the whole point of putting the requirement on the screen
 * rather than in the record.
 *
 * Source-reading, in the style of `translate.test.ts` and `settingsScopes.test.ts`:
 * the web suite has no DOM, and what is asserted is which conditions a call site
 * puts on the button.
 */
const SRC = join(__dirname, '..');
const read = (rel: string) => readFileSync(join(SRC, rel), 'utf8');
const summary = read('pages/TabletSummaryPage.tsx');

// The whole statement, not one line: the condition spans several.
const confirmDisabled = (() => {
  const at = summary.indexOf('const confirmDisabled =');
  if (at === -1) throw new Error('confirmDisabled is gone — this suite needs rewriting');
  return summary.slice(at, summary.indexOf(';', at));
})();

describe('what the Confirm button waits for', () => {
  it('the guest count IS required again, but only on this screen', () => {
    // §41 removed it; it is back because a table package is a PER-PERSON price,
    // so a kiosk booking with no head count has no total. What §41 established
    // still holds one level down: the API does not require it, because the
    // Events page still creates an entirely blank event.
    expect(confirmDisabled).toContain('guestCount < 1');
    expect(summary).toMatch(/guestCount < 1 && \(/);
  });

  it('the guest input still carries no floor and no ceiling', () => {
    // Required is not the same as clamped. `max={5000}` mirrored an API cap that
    // has been lifted, and a `min` would fight the typing rather than the empty
    // value — the disabled button is what states the requirement.
    const field = summary.slice(summary.indexOf("t('guest_count')"));
    const input = field.slice(0, field.indexOf('/>'));
    expect(input).toContain('type="number"');
    expect(input).not.toMatch(/\bmin=\{/);
    expect(input).not.toMatch(/\bmax=\{/);
  });

  it('but a typed negative is still clamped', () => {
    // Not a restriction on confirming — it is what stops a minus sign reaching
    // the totals, which are computed from this value before the store sees it.
    expect(summary).toContain('Math.max(0, Number(e.target.value))');
  });

  it('who and when are still required — those are not numbers', () => {
    // The scope of this change. A booking with no caller and no date is not a
    // booking, and removing those would be a different decision.
    for (const field of ['customerName', 'customerPhone', 'eventDate', 'eventTime']) {
      expect(confirmDisabled, `${field} is no longer required`).toContain(field);
    }
  });

  it('the per-guest figures still guard against dividing by zero', () => {
    // Confirm now needs a head count, but every figure on the page is computed
    // BEFORE the guest supplies one, so zero is still on a live path.
    expect(summary).toContain('guestCount > 0 ? Math.round(manualTotalCents / guestCount)');
    expect(read('hooks/usePriceCalculator.ts')).toContain('guestCount > 0 ?');
  });
});

describe('the second contact is folded away', () => {
  it('the fields render only once asked for', () => {
    expect(summary).toMatch(/\{!showSecondCustomer \? \(/);
    expect(summary).toMatch(/onClick=\{\(\) => setShowSecondCustomer\(true\)\}/);
    expect(summary).toContain("t('add_second_customer')");
  });

  it('closing it clears both fields', () => {
    // Otherwise a name typed and then hidden is still submitted with the
    // booking — invisible on the screen and present in the record.
    expect(summary).toMatch(
      /setSecondCustomerName\(''\); setSecondCustomerPhone\(''\); setShowSecondCustomer\(false\)/,
    );
  });

  it('it opens by itself when the draft already has one', () => {
    // An event opened from the Events page for a couple — or a reload mid-edit —
    // must not hide half its contacts behind a button that says "add".
    expect(summary).toMatch(
      /useState\(\s*!!secondCustomerName\.trim\(\) \|\| !!secondCustomerPhone\.trim\(\),?\s*\)/,
    );
  });

  it('the confirm payload is unchanged — an empty pair is still omitted', () => {
    expect(summary).toContain("secondCustomerName: secondCustomerName.trim() || undefined");
    expect(summary).toContain("secondCustomerPhone: secondCustomerPhone.trim() || undefined");
  });

  it('both button labels are translated in all three locales', () => {
    const translations = read('utils/translate.ts');
    for (const key of ['add_second_customer', 'remove_second_customer']) {
      expect((translations.match(new RegExp(`\\b${key}:`, 'g')) ?? []).length, key).toBe(3);
    }
  });
});
