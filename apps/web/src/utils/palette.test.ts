/**
 * Guards the brand palettes introduced by the banquet rebrand.
 *
 * The colours now live in exactly one place per product — a token block at the
 * top of a stylesheet — which is what makes them adjustable at all. The same
 * property makes them easy to nudge into an unreadable state in a single line,
 * with nothing failing until somebody looks at the screen. So this reads the
 * real stylesheets rather than a copy of the values, and measures each token
 * against the job it actually does.
 *
 * It deliberately does NOT assert particular hexes: the point of the exercise
 * was that the palette should be changeable. It asserts legibility.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DEFAULT_TABLET_THEME } from './tabletTheme';

const SRC = join(__dirname, '..');
const read = (rel: string) => readFileSync(join(SRC, rel), 'utf8');

/** Pull `--name: value;` out of the first block that declares it. */
function token(css: string, name: string, afterIndex = 0): string {
  const re = new RegExp(`--${name}\\s*:\\s*([^;]+);`, 'g');
  re.lastIndex = afterIndex;
  const m = re.exec(css);
  if (!m) throw new Error(`token --${name} not found`);
  return m[1].trim();
}

function rgb(value: string): [number, number, number] {
  const hex = value.match(/^#([0-9a-fA-F]{6})$/);
  if (hex) {
    const n = parseInt(hex[1], 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  const triple = value.match(/^(\d+)\s*,\s*(\d+)\s*,\s*(\d+)$/);
  if (triple) return [Number(triple[1]), Number(triple[2]), Number(triple[3])];
  throw new Error(`not a colour this test can read: ${value}`);
}

/** WCAG relative luminance. */
function luminance(value: string): number {
  const [r, g, b] = rgb(value).map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

// 4.5 is WCAG AA for body text. The accent is used for small uppercase labels
// and 13px nav items, so it is held to the body-text bar rather than the 3.0
// large-text one.
const AA = 4.5;

describe('banquet palette (index.css)', () => {
  const css = read('index.css');
  // `--adm-accent` is declared twice more further down (the .adm-legacy and
  // .cadm-theme opt-outs), so each scope is read from its own offset.
  const brand = css.indexOf('--adm-accent:');
  // Anchored on the rule's opening brace, not the bare class name — the token
  // block's own comment names `.adm-legacy` further up the file.
  const legacy = css.indexOf('.adm-legacy {');
  const catering = css.indexOf('.cadm-theme {');

  it('accent is legible on the page background', () => {
    expect(contrast(token(css, 'adm-accent', brand), token(css, 'adm-bg', brand))).toBeGreaterThanOrEqual(AA);
  });

  it('body text is legible on the page background', () => {
    expect(contrast(token(css, 'adm-text', brand), token(css, 'adm-bg', brand))).toBeGreaterThanOrEqual(AA);
  });

  it('primary-button ink is legible on the accent', () => {
    // The button is a gradient from --adm-accent-deep to --adm-accent-soft, so
    // the ink has to survive both ends, not just the midpoint.
    for (const stop of ['adm-accent-deep', 'adm-accent', 'adm-accent-soft']) {
      expect(contrast(token(css, 'adm-accent-ink', brand), token(css, stop, brand))).toBeGreaterThanOrEqual(AA);
    }
  });

  it('--adm-accent-rgb matches --adm-accent', () => {
    expect(rgb(token(css, 'adm-accent-rgb', brand))).toEqual(rgb(token(css, 'adm-accent', brand)));
  });

  it('the owner cabinet still carries the pre-rebrand palette', () => {
    // The owner view was explicitly excluded from the rebrand. If someone
    // "tidies up" .adm-legacy into an alias of the brand tokens, that exclusion
    // silently disappears — hence asserting the two are different.
    expect(token(css, 'adm-accent', legacy)).not.toBe(token(css, 'adm-accent', brand));
    expect(contrast(token(css, 'adm-accent', legacy), token(css, 'adm-bg', legacy))).toBeGreaterThanOrEqual(AA);
  });

  it('every opt-out scope redeclares the whole token set', () => {
    // A scope that overrides only *some* tokens half-opts-out: the ones it
    // forgets leak in from :root, so the owner cabinet quietly picks up the new
    // surface colour on the cards it uses them for. Caught exactly that during
    // the rebrand, with --adm-surface-rgb and --adm-line.
    const declared = (from: number) => {
      const block = css.slice(from, css.indexOf('}', from));
      return new Set([...block.matchAll(/--(adm-[a-z-]+)\s*:/g)].map((m) => m[1]));
    };
    const base = declared(css.indexOf(':root {', css.indexOf('Banquet brand palette')));
    // The blue aurora blob; .cadm-theme hides both blobs outright.
    const exempt = new Set(['adm-cool']);
    for (const [name, at] of [['.adm-legacy', legacy], ['.cadm-theme', catering]] as const) {
      const missing = [...base].filter((tk) => !declared(at).has(tk) && !exempt.has(tk));
      expect(missing, `${name} does not redeclare: ${missing.join(', ')}`).toEqual([]);
    }
  });

  it('food-service surfaces stay monochrome', () => {
    // The gate that keeps the rebrand out of the catering/food-employee pages.
    const [r, g, b] = rgb(token(css, 'adm-accent', catering));
    expect(r).toBe(g);
    expect(g).toBe(b);
  });

  it('the tablet defaults agree with the --rg-* fallbacks', () => {
    // Two copies exist by necessity: the CSS ones cover the first paint, before
    // the restaurant's saved theme has loaded. They must not drift.
    const rg = css.indexOf('--rg-accent:');
    expect(token(css, 'rg-accent', rg)).toBe(DEFAULT_TABLET_THEME.accent);
    expect(token(css, 'rg-bg', rg)).toBe(DEFAULT_TABLET_THEME.bg);
    expect(rgb(token(css, 'rg-accent-rgb', rg))).toEqual(rgb(DEFAULT_TABLET_THEME.accent));
    expect(contrast(DEFAULT_TABLET_THEME.accent, DEFAULT_TABLET_THEME.bg)).toBeGreaterThanOrEqual(AA);
  });
});

describe('v-invite palette (vinvite.css)', () => {
  const css = read('vinvite/vinvite.css');
  const light = css.indexOf('.vi-root {');
  const dark = css.indexOf(".vi-root[data-theme='dark']");

  for (const [name, at] of [['light', light], ['dark', dark]] as const) {
    it(`${name}: button ink is legible on the accent`, () => {
      // This is the one that was actually broken: the dark theme put #fff on a
      // light blue at ~2.5:1, from before the rebrand.
      expect(contrast(token(css, 'vi-accent-ink', at), token(css, 'vi-accent', at))).toBeGreaterThanOrEqual(AA);
      expect(contrast(token(css, 'vi-accent-ink', at), token(css, 'vi-accent-strong', at))).toBeGreaterThanOrEqual(AA);
    });

    it(`${name}: body text is legible on the card`, () => {
      expect(contrast(token(css, 'vi-text', at), token(css, 'vi-card', at))).toBeGreaterThanOrEqual(AA);
    });

    it(`${name}: --vi-accent-rgb matches --vi-accent`, () => {
      expect(rgb(token(css, 'vi-accent-rgb', at))).toEqual(rgb(token(css, 'vi-accent', at)));
    });
  }
});

describe('v-connect palette (vconnect.css)', () => {
  const css = read('vconnect/vconnect.css');

  it('beige body text is legible on black', () => {
    expect(contrast(token(css, 'vc-beige'), token(css, 'vc-black'))).toBeGreaterThanOrEqual(AA);
  });

  it('the accent is legible on the raised surface', () => {
    expect(contrast(token(css, 'vc-accent'), token(css, 'vc-surface'))).toBeGreaterThanOrEqual(AA);
  });

  it('the rgb triples match their hexes', () => {
    expect(rgb(token(css, 'vc-accent-rgb'))).toEqual(rgb(token(css, 'vc-accent')));
    expect(rgb(token(css, 'vc-beige-rgb'))).toEqual(rgb(token(css, 'vc-beige')));
  });
});
