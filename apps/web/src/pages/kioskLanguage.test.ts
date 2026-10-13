import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * What language the kiosk is in.
 *
 * Two rules, and they are the two halves of one complaint: the tablet opened in
 * Uzbek however the staff had set their own app, and the first screen it shows
 * — "which evening is this?" — had no way to change that.
 *
 *   · it OPENS in the admin panel's language. Same browser, same people, and
 *     that is the only setting anybody there has actually chosen.
 *   · the guest can still disagree, from the chooser as well as from the
 *     welcome overlay and the menu header.
 *
 * Reads the source, the house style where there is no DOM.
 */
const WEB = join(__dirname, '..');
const strip = (code: string) => code.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, '');
const src = (rel: string) => strip(readFileSync(join(WEB, rel), 'utf8'));

const store = src('store/tablet.store.ts');
const layout = src('app/TabletLayout.tsx');
const chooser = src('pages/KioskSessionChooser.tsx');
const menu = src('pages/TabletMenuPage.tsx');

describe('the kiosk opens in the admin panel\'s language', () => {
  it('there is ONE function that answers it, and it reads the admin store', () => {
    // A constant captured at import time would be the language the bundle
    // loaded with, not the one the staff have the app in now.
    expect(store).toMatch(/export const adminLocale = \(\): Locale => useAdminStore\.getState\(\)\.locale/);
    expect(store).toMatch(/import \{ useAdminStore \} from '\.\/admin\.store'/);
  });

  it('and every place that sets a starting locale uses it, not the uz default', () => {
    // The store's initial value and `reset` — confirming a booking resets the
    // store, and snapping back to Uzbek there is the same bug a page later.
    expect((store.match(/locale: adminLocale\(\)/g) ?? []).length).toBe(2);
    // `defaultLocale` survives only as adminLocale's own fallback.
    const uses = store.match(/locale: defaultLocale/g) ?? [];
    expect(uses.length).toBe(0);
  });

  it('the layout seeds it on MOUNT — which is what "when the tablet is opened" means', () => {
    expect(layout).toMatch(/setLocale\(adminLocale\(\)\);/);
    // Mount only: both kiosk pages share this layout, so a dependency on the
    // locale would put the admin's language back over the guest's choice every
    // time they moved between the menu and the summary.
    const at = layout.indexOf('setLocale(adminLocale())');
    expect(layout.slice(at, at + 120)).toMatch(/\}, \[setLocale\]\)/);
  });

  it('the kiosk draft still does not carry the language to the next tab', () => {
    // It is the preference of the person standing there, not part of a booking.
    expect(store).toContain('partialize: ({ locale, ...draft }) => draft');
  });
});

describe('the "which evening is this?" screen can be read in any of the three', () => {
  it('it renders a pill per locale, from the shared list', () => {
    expect(chooser).toMatch(/import \{ locales,/);
    expect(chooser).toMatch(/locales\.map\(\(loc\) => \(/);
    expect(chooser).toContain('setLocale(loc)');
  });

  it('the chosen one is marked for a screen reader as well as painted', () => {
    expect(chooser).toMatch(/aria-pressed=\{locale === loc\}/);
    expect(chooser).toMatch(/is-on/);
  });

  it('the targets are big enough for a finger', () => {
    // A kiosk is pressed by hand; the ≥44px rule applies here more than
    // anywhere else in the product.
    const rule = chooser.slice(chooser.indexOf('.kiosk-session-lang {'));
    expect(rule.slice(0, 240)).toMatch(/min-height: 44px/);
    expect(rule.slice(0, 240)).toMatch(/min-width: 48px/);
  });

  it('and the menu page actually hands it the language', () => {
    // The props exist and are never passed is the shape this fails in.
    const at = menu.indexOf('<KioskSessionChooser');
    expect(at).toBeGreaterThan(-1);
    const tag = menu.slice(at, menu.indexOf('/>', at));
    expect(tag).toContain('locale={locale}');
    expect(tag).toContain('setLocale={setLocale}');
  });
});
