import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { AdminRole } from '../store/auth.store';
import {
  DEFAULT_KIOSK_SESSION, KIOSK_SESSIONS, bookingMissing, kioskAsksSession,
  kioskSessionsFor, kioskSurface, resolveKioskSession, type KioskSession,
} from './kioskSession';
import { DEFAULT_TABLET_THEME, SMALL_BANQUET_TABLET_THEME, kioskTheme } from './tabletTheme';

/**
 * The kiosk's two sessions.
 *
 * The rules are here; the two kiosk pages are 3800 lines and read them in a
 * dozen places, so the second half of this file reads their SOURCE — a gate
 * that is written but never applied is the shape this feature fails in.
 */
const WEB = join(__dirname, '..');
const strip = (code: string) => code.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, '');
const src = (rel: string) => strip(readFileSync(join(WEB, rel), 'utf8'));

const READY = {
  customerName: 'Nodira', customerPhone: '998901234567',
  eventDate: '2026-10-02', eventTime: '19:00', guestCount: 8,
  hallId: 'h1', tableCategoryId: 'tc1',
};

describe('which kiosk is asked which evening this is', () => {
  it('the Small Banquets kiosk offers both, when the restaurant runs general dining', () => {
    expect(kioskSessionsFor('SUPERVISOR', { moduleCatering: true })).toEqual(['banquet', 'dining']);
    expect(kioskAsksSession(kioskSessionsFor('SUPERVISOR', { moduleCatering: true }))).toBe(true);
  });

  it('and offers only banquet when it does not — general dining IS that module', () => {
    expect(kioskSessionsFor('SUPERVISOR', { moduleCatering: false })).toEqual(['banquet']);
    expect(kioskSessionsFor('SUPERVISOR', {})).toEqual(['banquet']);
    expect(kioskSessionsFor('SUPERVISOR', undefined)).toEqual(['banquet']);
    expect(kioskAsksSession(['banquet'])).toBe(false);
  });

  it('every other kiosk is never asked, whatever modules the restaurant has', () => {
    // A POSITIVE list: a role added to a kiosk layout later gets the plain
    // banquet flow rather than inheriting a question about another product.
    const schema = readFileSync(join(WEB, '..', '..', 'api', 'prisma', 'schema.prisma'), 'utf8');
    const body = schema.slice(schema.indexOf('enum AdminRole {'), schema.indexOf('}', schema.indexOf('enum AdminRole {')));
    const roles = [...body.matchAll(/^\s+([A-Z_]+)\s*$/gm)].map((m) => m[1]);
    expect(roles).toContain('EMPLOYEE');
    expect(roles.length).toBeGreaterThan(10);
    for (const role of roles.filter((r) => r !== 'SUPERVISOR')) {
      expect(kioskSessionsFor(role as AdminRole, { moduleCatering: true }), role).toEqual(['banquet']);
    }
    expect(kioskSessionsFor(null, { moduleCatering: true })).toEqual(['banquet']);
  });
});

describe('what a session has', () => {
  it('a banquet evening is the kiosk exactly as it was', () => {
    expect(Object.values(kioskSurface('banquet')).every(Boolean)).toBe(true);
  });

  it('a general-dining evening has none of it — no menu, packages, prices, event type or services', () => {
    const dining = kioskSurface('dining');
    expect(Object.values(dining).some(Boolean)).toBe(false);
    // Named one by one, because each was asked for separately and a future
    // change that restores one should have to say which.
    expect(dining).toEqual({
      menu: false, areas: false, tablePackages: false, additionalDishes: false,
      pricing: false, eventType: false, extraServices: false, addonServices: false,
    });
  });

  it('every session in the list has a surface', () => {
    for (const session of KIOSK_SESSIONS) expect(Object.keys(kioskSurface(session))).toHaveLength(8);
  });
});

describe('a stored session is never trusted on its own', () => {
  it('one the kiosk no longer offers falls back rather than taking a booking nobody can serve', () => {
    // The module was withdrawn between one booking and the next.
    expect(resolveKioskSession('dining', ['banquet'])).toBe('banquet');
    expect(resolveKioskSession('dining', ['banquet', 'dining'])).toBe('dining');
  });

  it('"not asked yet" reads as the flow every tablet has always had', () => {
    expect(resolveKioskSession(null, ['banquet', 'dining'])).toBe('banquet');
    expect(resolveKioskSession(undefined, [])).toBe(DEFAULT_KIOSK_SESSION);
  });

  it('null is not the same as banquet — the chooser needs to tell them apart', () => {
    // Both resolve to 'banquet', and that is exactly why the stored value has
    // to stay nullable: the page asks `sessionKind === null`, not `=== banquet`.
    expect(src('pages/TabletMenuPage.tsx')).toContain('sessionKind === null');
    expect(src('store/tablet.store.ts')).toMatch(/sessionKind:\s*KioskSession\s*\|\s*null/);
  });
});

describe('what a booking still needs', () => {
  it('a ready banquet booking is ready', () => {
    expect(bookingMissing('banquet', READY)).toBeNull();
  });

  it('names the first missing field rather than only going grey', () => {
    expect(bookingMissing('banquet', { ...READY, customerName: '  ' })).toBe('customer_name_required');
    expect(bookingMissing('banquet', { ...READY, customerPhone: '' })).toBe('customer_phone_required');
    expect(bookingMissing('banquet', { ...READY, eventDate: '' })).toBe('event_date_required');
    expect(bookingMissing('banquet', { ...READY, eventTime: '' })).toBe('event_time_required');
    expect(bookingMissing('banquet', { ...READY, guestCount: 0 })).toBe('guest_count_required');
  });

  it('a banquet booking needs its area and its package', () => {
    expect(bookingMissing('banquet', { ...READY, hallId: undefined })).toBe('select_room_required');
    expect(bookingMissing('banquet', { ...READY, tableCategoryId: undefined })).toBe('select_table_category_required');
  });

  it('a dining booking needs neither — there is nothing to price and the guest is seated on the night', () => {
    expect(bookingMissing('dining', { ...READY, hallId: undefined, tableCategoryId: undefined })).toBeNull();
  });

  it('but it still needs who, when and for how many', () => {
    const bare = { ...READY, hallId: undefined, tableCategoryId: undefined };
    expect(bookingMissing('dining', { ...bare, customerName: '' })).toBe('customer_name_required');
    expect(bookingMissing('dining', { ...bare, customerPhone: '' })).toBe('customer_phone_required');
    expect(bookingMissing('dining', { ...bare, eventDate: '' })).toBe('event_date_required');
    expect(bookingMissing('dining', { ...bare, eventTime: '' })).toBe('event_time_required');
    expect(bookingMissing('dining', { ...bare, guestCount: 0 })).toBe('guest_count_required');
  });
});

describe('the Small Banquets kiosk does not look like the banquet one', () => {
  it('it takes the section palette and ignores the restaurant\'s saved tablet colours', () => {
    // Those colours are the MAIN ADMIN's, chosen for the banquet kiosk — the
    // supervisor has no shell settings of their own — so honouring them here
    // would paint the two kiosks identically, which is the whole point.
    const saved = { accent: '#ff0000', bg: '#ffffff' };
    expect(kioskTheme('SUPERVISOR', saved)).toEqual(SMALL_BANQUET_TABLET_THEME);
    expect(kioskTheme('SUPERVISOR', null)).toEqual(SMALL_BANQUET_TABLET_THEME);
  });

  it('every other kiosk keeps the restaurant\'s colours exactly as before', () => {
    const saved = { accent: '#ff0000', bg: '#ffffff' };
    for (const role of ['EMPLOYEE', 'ADMIN', 'CHIEF_ADMIN', null]) {
      expect(kioskTheme(role, saved), String(role)).toEqual(saved);
    }
  });

  it('and the two palettes are actually different', () => {
    expect(SMALL_BANQUET_TABLET_THEME.accent).not.toBe(DEFAULT_TABLET_THEME.accent);
    expect(SMALL_BANQUET_TABLET_THEME.bg).not.toBe(DEFAULT_TABLET_THEME.bg);
  });

  it('both kiosk pages take their palette from the role, not from the restaurant row', () => {
    for (const file of ['pages/TabletMenuPage.tsx', 'pages/TabletSummaryPage.tsx']) {
      expect(src(file), file).toMatch(/tabletThemeVars\(kioskTheme\(role,/);
    }
  });

  it('the section kiosk carries its scope class, and only for the supervisor', () => {
    const layout = src('app/TabletLayout.tsx');
    expect(layout).toMatch(/role === 'SUPERVISOR' \? SECTION_KIOSK_CLASS/);
    // The scope restates the primitives rather than forking the pages.
    const css = readFileSync(join(WEB, 'index.css'), 'utf8');
    for (const rule of ['.svr-kiosk .rg-card', '.svr-kiosk .rg-heading', '.svr-kiosk .rg-display']) {
      expect(css, rule).toContain(rule);
    }
  });

  it('the scope\'s --rg-* fallbacks match the palette it is the fallback for', () => {
    const css = readFileSync(join(WEB, 'index.css'), 'utf8');
    const block = css.slice(css.indexOf('.svr-kiosk {'), css.indexOf('}', css.indexOf('.svr-kiosk {')));
    expect(block).toContain(`--rg-accent: ${SMALL_BANQUET_TABLET_THEME.accent}`);
    expect(block).toContain(`--rg-bg: ${SMALL_BANQUET_TABLET_THEME.bg}`);
  });

  it('the sweep is parked at the start, never merely stopped', () => {
    // `.rg-shine` paints gradient-clipped text: an animation stopped mid-sweep
    // leaves the heading part-coloured, and resizing the gradient under it is
    // worse. Same rule the reduced-motion block follows.
    const css = readFileSync(join(WEB, 'index.css'), 'utf8');
    const rule = css.slice(css.indexOf('.svr-kiosk .rg-shine'));
    expect(rule.slice(0, 120)).toContain('background-position: 0% 50%');
    expect(rule.slice(0, 120)).not.toContain('background-size');
  });
});

describe('the gates are actually applied', () => {
  const menu = src('pages/TabletMenuPage.tsx');
  const summary = src('pages/TabletSummaryPage.tsx');

  it('the chooser is shown by the menu page, and picking dining leaves for the summary', () => {
    expect(menu).toContain('<KioskSessionChooser');
    expect(menu).toMatch(/if \(picked === 'dining'\) navigate\('\/tablet\/summary'\)/);
  });

  it('the package chooser and the Additional dishes are behind the session', () => {
    expect(menu).toContain('surface.tablePackages && !selectedTableCategoryId');
    expect(menu).toContain('{surface.additionalDishes && (');
  });

  it('the summary hides the pricing block, the event type, the services and the dish list', () => {
    expect(summary).toContain('{surface.pricing && (');
    expect(summary).toContain('{surface.eventType && (<>');
    expect(summary).toContain('{surface.extraServices && extraServices.length > 0 && (');
    expect(summary).toContain('{surface.menu && (');
  });

  it('the confirmed screen reads the session it was CONFIRMED in, not the draft\'s', () => {
    // Confirming calls reset(), which clears the draft's session; reading it
    // there would offer a dining guest the Additional Services button.
    expect(summary).toContain('kioskSurface(confirmedSession ?? session)');
    expect(summary).toContain('moduleAddons && confirmedSurface.addonServices');
    expect(summary).toContain('setConfirmedSession(session)');
  });

  it('a dining booking sends no event type and no honoree names', () => {
    expect(summary).toMatch(/\.\.\.\(surface\.eventType \? \{ eventType \} : \{\}\)/);
    for (const field of ['birthdayPersonName', 'brideName', 'groomName', 'honoreePersonName']) {
      const at = summary.indexOf(`${field}:  `) >= 0 ? summary.indexOf(`${field}:  `) : summary.indexOf(`${field}:`);
      expect(summary.slice(at, at + 120), field).toContain('surface.eventType');
    }
  });

  it('the booking records which session took it', () => {
    expect(summary).toContain('sessionKind: session');
    expect(src('types/domain.ts')).toMatch(/sessionKind\?:\s*'banquet' \| 'dining'/);
  });

  it('confirming clears the session, so the next guest is asked again', () => {
    const store = src('store/tablet.store.ts');
    const reset = store.slice(store.indexOf('reset: () => {'));
    expect(reset).toContain('sessionKind: null');
  });
});

describe('every string the chooser needs exists in all three languages', () => {
  const translate = readFileSync(join(WEB, 'utils', 'translate.ts'), 'utf8');
  const KEYS = [
    'kiosk_session_title', 'kiosk_session_subtitle', 'kiosk_session_eyebrow', 'kiosk_session_start',
    'kiosk_session_banquet', 'kiosk_session_banquet_hint', 'kiosk_session_dining', 'kiosk_session_dining_hint',
    'customer_name_required', 'customer_phone_required', 'event_date_required', 'event_time_required',
    'select_table_category_required',
  ];
  for (const key of KEYS) {
    it(key, () => {
      // Three locales, three copies — translate.ts falls back to uz at runtime,
      // which would hide a missing en or ru key.
      expect([...translate.matchAll(new RegExp(`^\\s+${key}:`, 'gm'))]).toHaveLength(3);
    });
  }

  it('the uz strings avoid apostrophes, as every other uz string here does', () => {
    for (const key of KEYS) {
      const all = [...translate.matchAll(new RegExp(`^\\s+${key}: '([^\\n]*)',$`, 'gm'))].map((m) => m[1]);
      expect(all[2] ?? '', key).not.toContain("\\'");
    }
  });
});
