import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const SRC = join(__dirname, '..');
const read = (rel: string) => readFileSync(join(SRC, rel), 'utf8');
const menu = read('pages/TabletMenuPage.tsx');
const summary = read('pages/TabletSummaryPage.tsx');

/**
 * The running total, and what a kiosk booking must have before it can be
 * confirmed.
 */
describe('the running total is always on screen', () => {
  it('sits beside the music toggle, not in the page flow', () => {
    // The figure changes while the guest scrolls through dishes, which is
    // exactly when it has to be readable.
    expect(menu).toContain('function RunningTotal(');
    const panel = menu.slice(menu.indexOf('function RunningTotal('));
    expect(panel.slice(0, panel.indexOf('</div>'))).toContain("position: 'fixed'");
  });

  it('shares the music toggle\'s row', () => {
    // The toggle is 52px wide at right: 18, so the panel starts at 82.
    const toggle = menu.slice(menu.indexOf('function TabletMusicToggle('));
    expect(toggle).toContain("bottom: 'calc(84px + env(safe-area-inset-bottom))', right: 18");
    const panel = menu.slice(menu.indexOf('function RunningTotal('));
    expect(panel).toContain("bottom: 'calc(84px + env(safe-area-inset-bottom))', right: 82");
  });

  it('shows the per-guest price and the order total', () => {
    expect(menu).toContain("{t('price_per_guest')}");
    expect(menu).toMatch(/totalCents=\{pricing\.perGuestCents \* guestCount\}/);
  });

  it('drops the total when there is no head count to multiply by', () => {
    // Zero guests is reachable (§41), and a "total" equal to the per-guest
    // figure would be a lie rather than a blank.
    expect(menu).toContain('{guestCount > 0 && (');
  });

  it('only appears once a table has been chosen', () => {
    // Before that there is no rate, so the panel would read zero.
    expect(menu).toMatch(/\{welcomeShown && selectedTableCategory && \(\s*\n\s*<RunningTotal/);
  });

  it('is announced when it changes', () => {
    expect(menu).toContain('aria-live="polite"');
  });
});

describe('a kiosk booking needs a hall and a table', () => {
  it('Confirm requires the hall and the table', () => {
    const line = summary.slice(summary.indexOf('const confirmDisabled ='));
    expect(line.slice(0, line.indexOf(';'))).toMatch(/!selectedHallId \|\| !selectedTableCategoryId/);
  });

  it('the kiosk stops the guest at the field they need, not a page later', () => {
    // The Summary has pickers for neither the hall nor the head count — both are
    // in the settings block on the menu page — so blocking only at Confirm would
    // strand the guest a page away from the field.
    expect(menu).toContain('disabled={!!settingsMissing}');
    expect(menu).toContain("{settingsMissing ? t(settingsMissing) : `${t('view_summary')} →`}");
  });

  it('and names the field it is waiting on', () => {
    // A button that only goes grey does not say what to do.
    expect(menu).toMatch(
      /!selectedHallId \? 'select_room_required'\s*\n\s*: guestCount < 1 \? 'guest_count_required'\s*\n\s*: null;/,
    );
  });

  it('the head count is required too, on both screens', () => {
    const line = summary.slice(summary.indexOf('const confirmDisabled ='));
    expect(line.slice(0, line.indexOf(';'))).toContain('guestCount < 1');
    expect(summary).toContain("t('guest_count_required')");
  });

  it('and the Summary says which one is missing', () => {
    expect(summary).toMatch(/\(!selectedHallId \|\| !selectedTableCategoryId \|\| guestCount < 1\) && \(/);
  });

  it('the Events page is deliberately NOT gated', () => {
    // Staff pencil a date in and fill the rest later; a blank event is the
    // documented behaviour there and the API defaults every core field.
    const events = read('pages/AdminEventsPage.tsx');
    expect(events).not.toMatch(/!hallId \|\| !tableCategoryId/);
    expect(events).toMatch(/hallId: hallId \? hallId : undefined/);
  });

  it('the required labels are translated in all three locales', () => {
    const translations = read('utils/translate.ts');
    for (const key of ['select_room_required', 'guest_count_required', 'remove_dish', 'restore_dish']) {
      expect((translations.match(new RegExp(`\\b${key}:`, 'g')) ?? []).length, key).toBe(3);
    }
  });
});

describe('taking a dish off the table', () => {
  it('is offered on each included dish, with the saving on the button', () => {
    expect(menu).toContain("{removed ? t('restore_dish') : t('remove_dish')}");
    expect(menu).toContain('{formatSum(pi.menuItem.priceCents)}');
  });

  it('greys and darkens the PHOTO, leaving the card readable', () => {
    // The guest has to read what they took off in order to put it back, and to
    // recognise the saving on the button — so dimming the whole card was wrong.
    // The photo carries the "not being served" signal on its own.
    expect(menu).toContain("filter: 'grayscale(1) brightness(0.45)'");
    expect(menu).not.toContain('opacity: removed ? 0.45 : 1,');
    expect(menu).toContain("textDecoration: 'line-through'");
  });

  it('greys the placeholder too, not only a real photo', () => {
    // A dish with no photo still has to read as removed.
    expect(menu).toContain("style={{ background: 'rgba(0,0,0,0.2)', ...removedPhoto }}");
  });

  it('hides the free-swap button on a removed dish', () => {
    // Choosing a replacement for a dish that is not being served prices nothing.
    expect(menu).toContain('{freeAlts.length > 0 && !removed && (');
  });

  it('is not offered on the children\'s table', () => {
    // Shared component; the children's rate is separate and unadjusted.
    expect((menu.match(/onToggleRemoved=\{toggleRemovedPackageItem\}/g) ?? []).length).toBe(1);
  });
});
