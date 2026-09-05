import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * What the Summary page requires before a booking can be confirmed, and what it
 * no longer does.
 *
 * The rest of the system is explicit that a head count is not needed to take a
 * booking: the API defaults `guestCount` to 0, and the Events page creates an
 * entirely blank event for later editing. The tablet contradicted that — the
 * Confirm button stayed disabled until someone typed a figure, so a restaurant
 * taking a booking before the count was known had to invent one, and an invented
 * head count is worse than a missing one because it prices the event.
 *
 * Source-reading, in the style of `translate.test.ts` and `settingsScopes.test.ts`:
 * the web suite has no DOM, and what is asserted is which conditions a call site
 * puts on the button.
 */
const SRC = join(__dirname, '..');
const read = (rel: string) => readFileSync(join(SRC, rel), 'utf8');
const summary = read('pages/TabletSummaryPage.tsx');

const confirmDisabled = (() => {
  const line = summary.split('\n').find((l) => l.includes('const confirmDisabled ='));
  if (!line) throw new Error('confirmDisabled is gone — this suite needs rewriting');
  return line;
})();

describe('nothing numeric blocks confirming a booking', () => {
  it('the guest count is not required', () => {
    expect(confirmDisabled).not.toContain('guestCount');
  });

  it('and the field no longer marks itself required', () => {
    // The red "— required" note beside the caption was the other half of the
    // same rule; leaving it would say the button is blocked when it is not.
    expect(summary).not.toMatch(/guestCount < 1 && \(/);
  });

  it('the guest input carries no floor and no ceiling', () => {
    // `max={5000}` mirrored an API cap that has been lifted; `min={1}` was the
    // same rule as the disabled button, written twice.
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
    // Zero guests is now reachable, so the division that was previously
    // unreachable with a zero denominator is now on a live path.
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
    // An event opened from the Events page for a couple must not hide half its
    // contacts behind a button that says "add".
    expect(summary).toMatch(
      /useState\(\s*!!draftSecondCustomerName\.trim\(\) \|\| !!draftSecondCustomerPhone\.trim\(\),?\s*\)/,
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
