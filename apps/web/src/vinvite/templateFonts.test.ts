import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

/**
 * A template must LOAD every face it asks for, and the hand it sets the names in
 * has to be able to spell an Uzbek name.
 *
 * Each rich template runs in a `srcdoc` iframe on an opaque origin and carries
 * its own `<link>` to Google Fonts — `index.html`'s nineteen families do not
 * reach it. So a face named in the CSS but missing from that link does not fail:
 * it silently falls back to the system cursive/serif, which looks approximately
 * right on the machine of whoever added it and wrong everywhere else. Nothing
 * else in the suite can see that; the smoke test's linkedom has no fonts at all.
 *
 * The second rule is the one that cost a rewrite. `--hand` was first set to
 * Great Vibes, which HAS the modifier letter turned comma (U+02BB) but draws it
 * as a tick jammed against the following letter — so `Oʻtkirbek` reads as
 * `Otkirbek` and `gʻayrat` as a collision. That is most of a wedding guest list
 * in this product's home market. The faces below were each rendered with those
 * characters and checked before being used.
 */
const DIR = join(__dirname, 'templates');
const TEMPLATES = readdirSync(DIR, { withFileTypes: true })
  .filter((e) => e.isDirectory() && existsSync(join(DIR, e.name, 'template.html')))
  .map((e) => e.name);

/**
 * Script faces checked against `Oʻ` and `gʻ` at display size.
 *
 * Adding one to this list means rendering those two pairs and looking at the
 * result — the character being present in the font is NOT the test, Great Vibes
 * had it. What matters is whether it stays a separate readable mark.
 */
const HANDS_OK = ['Parisienne', 'Sacramento', 'Dancing Script', 'La Belle Aurore', 'Caveat'];
/** Rejected, with the reason, so it does not get picked again next time. */
const HANDS_REJECTED: Record<string, string> = {
  'Great Vibes': "draws U+02BB as a tick against the next letter — O'tkirbek reads as Otkirbek",
};

/** Families a template's own <link> pulls from Google Fonts. */
function linkedFamilies(src: string): Set<string> {
  const out = new Set<string>();
  for (const m of src.matchAll(/fonts\.googleapis\.com\/css2\?([^"']+)/g)) {
    for (const f of m[1].matchAll(/family=([^&:]+)/g)) out.add(decodeURIComponent(f[1]).replace(/\+/g, ' '));
  }
  return out;
}

/** Quoted family names appearing in `font-family:` or a `--*` font token. */
function usedFamilies(src: string): Set<string> {
  const css = /<style>([\s\S]*?)<\/style>/.exec(src)?.[1] ?? '';
  const out = new Set<string>();
  for (const m of css.matchAll(/(?:font-family|--[a-z-]*(?:display|body|util|hand|script|serif|sans)[a-z-]*)\s*:\s*([^;}]+)/g)) {
    for (const q of m[1].matchAll(/["']([^"']+)["']/g)) out.add(q[1]);
  }
  return out;
}

/**
 * Faces that need no link: the browser has them, or they are a generic.
 * Everything else has to be fetched or it is not what the visitor sees.
 */
const SYSTEM = new Set([
  'Iowan Old Style', 'Snell Roundhand', 'Segoe Script', 'Segoe UI', 'Avenir Next', 'Futura',
  'Optima', 'Palatino', 'Palatino Linotype', 'Didot', 'Bodoni MT', 'Times New Roman', 'Georgia',
  'Garamond', 'Baskerville', 'Hoefler Text', 'Courier New', 'Menlo', 'Monaco', 'system-ui',
  'Helvetica Neue', 'Helvetica', 'Arial', 'Apple Color Emoji', 'Segoe UI Emoji',
]);

describe.each(TEMPLATES)('%s', (name) => {
  const src = readFileSync(join(DIR, name, 'template.html'), 'utf8');

  it('loads every non-system face it names', () => {
    const linked = linkedFamilies(src);
    const missing = [...usedFamilies(src)].filter((f) => !SYSTEM.has(f) && !linked.has(f));
    expect(
      missing,
      `named in the CSS but never fetched, so it silently falls back: ${missing.join(', ')}`,
    ).toEqual([]);
  });

  it('sets the names in a hand whose Uzbek diacritics survive', () => {
    const hand = /--hand\s*:\s*["']([^"']+)["']/.exec(src)?.[1];
    if (!hand) return;   // not every template uses one
    expect(HANDS_REJECTED[hand] ?? null, `${hand}: ${HANDS_REJECTED[hand]}`).toBeNull();
    expect(HANDS_OK, `${hand} has not been checked against O' and g'`).toContain(hand);
  });
});

describe('the hand is for names, not for the whole page', () => {
  // A connecting script set in uppercase with .3em of tracking comes apart into
  // loose unrelated glyphs, and these templates track their small caps hard.
  //
  // So the rule is about the GENERIC heading rule, not about every heading: the
  // couple's names, and the venue's name over the "Where" block, are proper
  // names and are set in the hand deliberately. What must stay a serif is
  // `--display`, which dresses every section title at once.
  for (const name of TEMPLATES) {
    const src = readFileSync(join(DIR, name, 'template.html'), 'utf8');
    const css = /<style>([\s\S]*?)<\/style>/.exec(src)?.[1] ?? '';
    if (!/--hand\s*:/.test(css)) continue;

    it(`${name}: the generic h1,h2,h3 rule does not use it`, () => {
      const headings = /(^|\n)\s*h1\s*,\s*h2\s*,\s*h3\s*\{([^}]*)\}/.exec(css)?.[2];
      if (headings) expect(headings).not.toContain('var(--hand)');
    });

    it(`${name}: nothing uppercase-and-tracked uses it`, () => {
      const bad = [...css.matchAll(/\.[a-z0-9_-]+[^{]*\{([^}]*)\}/g)]
        .filter((m) => m[1].includes('var(--hand)')
          && /text-transform\s*:\s*uppercase/.test(m[1])
          && /letter-spacing\s*:\s*\.?[1-9]/.test(m[1]))
        .map((m) => m[0].slice(0, m[0].indexOf('{')));
      expect(bad, `a script cannot be tracked uppercase: ${bad.join(', ')}`).toEqual([]);
    });
  }
});

describe('the venue name is set in the hand', () => {
  // It is the heading over the "Where" block, and the one place a guest reads
  // the venue as an address rather than as scenery — a proper name, like the
  // couple's, so it gets the same treatment.
  for (const name of TEMPLATES) {
    const src = readFileSync(join(DIR, name, 'template.html'), 'utf8');
    const rule = /\.place__title\s*\{([^}]*)\}/.exec(src)?.[1];
    if (!rule) continue;

    it(`${name}: in the hand, untracked`, () => {
      expect(rule, 'the venue heading fell back to the display serif').toContain('var(--hand)');
      // A script's letters are drawn to touch; inherited tracking pulls them apart.
      expect(rule).toMatch(/letter-spacing\s*:\s*0/);
    });
  }
});
