import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { weddingFotihaTemplate as tpl } from './templates/wedding-fotiha/definition';
import { TEMPLATE_META } from './templates/meta';
import { RICH_TEMPLATES } from './templates';

/**
 * "Oq Fotiha" — the betrothal design.
 *
 * The generic template suites already cover the contract every design shares
 * (name order, fonts, music, bleed, the bind map, the default date). What is
 * here is what makes THIS one what it is, plus the three defects a real
 * browser found in it and a type checker could not:
 *
 *   · the gate laid out 611px wide inside a 390px phone, because its grid track
 *     was sized to the card's max-content;
 *   · the two invisible RSVP radios each took `width: 100%` of the viewport
 *     from `.f input` and, absolutely positioned with no positioned ancestor,
 *     dragged the document to 1966px on a 1280px screen;
 *   · a jump to the foot of the page left the dasturxon permanently blank,
 *     because an IntersectionObserver reports the state at delivery and a
 *     single-step scroll is never "crossed".
 */
const SRC = readFileSync(join(__dirname, 'templates', 'wedding-fotiha', 'template.html'), 'utf8');
/** Comments stripped: this file's own prose names the strings it forbids. */
const CODE = SRC.replace(/\/\*[\s\S]*?\*\//g, '');

describe('it is registered as a first-party design', () => {
  it('is in the registry, once', () => {
    expect(RICH_TEMPLATES.filter((t) => t.id === 'wedding-fotiha')).toHaveLength(1);
  });

  it('and in the metadata the marketing site reads without the markup', () => {
    const meta = TEMPLATE_META.find((m) => m.id === 'wedding-fotiha');
    expect(meta).toBeTruthy();
    expect(meta!.category).toBe(tpl.category);
    expect(meta!.nameKey).toBe(tpl.nameKey);
    expect(meta!.accent).toBe(tpl.accent);
  });

  it('every section id it offers Design+ is a real element', () => {
    for (const id of tpl.sectionIds ?? []) {
      expect(SRC, `no element with id="${id}"`).toContain(`id="${id}"`);
    }
    expect((tpl.sectionIds ?? []).length).toBeGreaterThan(5);
  });

  it('every accent variable it hands Design+ is one the stylesheet declares', () => {
    for (const v of tpl.accentVars ?? []) {
      expect(SRC, `${v} is never declared`).toContain(`${v}:`);
    }
  });
});

describe('it is a fotiha, not a wedding', () => {
  it('has no countdown — a betrothal is arranged in weeks, not counted down to', () => {
    expect(SRC).not.toContain('id="countdown"');
    expect(SRC).not.toContain('initCountdown');
  });

  it('but the date it ships with is still in the future', () => {
    // `templateCountdown.test.ts` guards this only for the designs that HAVE a
    // countdown, on the grounds that a stale default reads 00:00:00:00 there.
    // This one has none and the rule still applies for its own reason: the
    // catalog and the full-screen preview both render `defaultConfig`, so a
    // date in the past advertises a betrothal that already happened.
    // When it fails, move the default forward a year.
    const iso = (tpl.defaultConfig.event as { dateISO?: string }).dateISO;
    expect(typeof iso).toBe('string');
    const when = new Date(iso as string);
    expect(Number.isNaN(when.getTime()), `unparseable: ${iso}`).toBe(false);
    expect(when.getTime() > Date.now(), `the default date ${iso} has passed`).toBe(true);
  });

  it('asks for BOTH families, which is what the ceremony joins', () => {
    const paths = tpl.fields.map((f) => f.path);
    for (const p of ['families.groomName', 'families.groomParents', 'families.brideName', 'families.brideParents']) {
      expect(paths, `${p} is not asked for`).toContain(p);
    }
    expect(SRC).toContain('id="families"');
  });

  it('lays a dasturxon where other designs print a running order', () => {
    expect(SRC).toContain('id="dasturxon"');
    const items = (tpl.defaultConfig.dasturxon as { items?: unknown[] }).items ?? [];
    expect(items.length).toBeGreaterThan(3);
  });

  it('is written uz first, and the uz strings carry no apostrophes', () => {
    const uz = JSON.stringify(
      Object.values(tpl.defaultConfig).map((v) => (v && typeof v === 'object' ? (v as Record<string, unknown>) : {})),
    );
    expect(uz).toContain('"uz"');
    // The UI strings inside the template, too: uz in this product avoids them.
    const ui = CODE.slice(CODE.indexOf('uz: {'), CODE.indexOf('ru: {'));
    expect(ui).not.toMatch(/'[^']*’[^']*'/);
    expect(ui.match(/\\'/g), 'an escaped apostrophe in a uz string').toBeNull();
  });
});

describe('the loaf is the reveal', () => {
  it('breaks into two halves that move apart', () => {
    expect(CODE).toContain('.loaf.is-broken .loaf__half--l');
    expect(CODE).toContain('.loaf.is-broken .loaf__half--r');
    expect(CODE).toMatch(/\.loaf\.is-broken \.loaf__half--l\{?[^}]*translateX\(-/);
  });

  it('and the names only arrive once it has', () => {
    // Their base state is invisible, so the break is the only path to them.
    expect(CODE).toMatch(/\.hero__name\s*\{[^}]*opacity:\s*0/);
    expect(CODE).toContain('.loaf.is-broken ~ .hero__names .hero__name');
  });

  it('the hero clips the halves, which travel outside it', () => {
    const hero = CODE.slice(CODE.indexOf('.hero {'), CODE.indexOf('.hero__wash'));
    expect(hero).toContain('overflow: hidden');
  });
});

describe('the blessing is the one thing that does not move', () => {
  it('carries no entrance class', () => {
    const at = SRC.indexOf('<section class="bless pad"');
    const section = SRC.slice(at, SRC.indexOf('</section>', at));
    expect(section, 'the blessing has been given a reveal like everything else').not.toContain('class="rv"');
    expect(section).not.toMatch(/class="[^"]*\brv\b/);
  });
});

describe('what a browser found and a type checker could not', () => {
  it('the gate declares its grid track, so it cannot be wider than the phone', () => {
    // Left to `auto` the track takes the card's max-content — the title and
    // both names unwrapped — and the fixed overlay came out 611px inside 390px,
    // putting a horizontal scrollbar on the document that `visibility: hidden`
    // does not remove once the gate is dismissed.
    const gate = CODE.slice(CODE.indexOf('.gate {'), CODE.indexOf('.gate.is-gone'));
    expect(gate).toContain('grid-template-columns: minmax(0, 1fr)');
  });

  it('the hidden RSVP radios are pinned to their own label', () => {
    // `.f input` sets width:100%; absolutely positioned with no positioned
    // ancestor that is 100% of the VIEWPORT, twice, at their static positions.
    const label = CODE.slice(CODE.indexOf('.att label {'), CODE.indexOf('.att label.is-sel'));
    expect(label).toContain('position: relative');
    const input = CODE.slice(CODE.indexOf('.att input {'));
    expect(input.slice(0, 200)).toContain('inset: 0');
  });

  it('a jump past a section still reveals it', () => {
    // An IntersectionObserver reports the state at delivery, so scrolling to
    // the foot in one step never records the dasturxon as crossed and every
    // row stays at opacity 0.
    expect(CODE).toContain('function sweep()');
    expect(CODE).toMatch(/addEventListener\('scroll', sweep/);
    expect(CODE).toContain('setTimeout(sweep,');
  });

  it('writes the Uzbek date itself rather than trusting Intl', () => {
    // `Intl.DateTimeFormat('uz-Latn-UZ', { month: 'long' })` renders 11 April
    // 2027 as "2027 M04 11" in the ICU build Chrome ships — and uz is this
    // design's first language.
    expect(CODE).toContain('UZ_MONTHS');
    expect(CODE).toContain('UZ_DAYS');
    expect(CODE).toMatch(/if \(lang === 'uz'\) return d\.getDate\(\)/);
  });
});
