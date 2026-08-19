import { describe, expect, it } from 'vitest';
import {
  CARD_DARK, CARD_LIGHT, TEMPLATE_BRANDS, brandOf, brandVars, contrast, deriveBrand,
  longDescKey, shortDescKey,
} from './templateBrand';
import { RICH_TEMPLATES } from './templates';
import { viDict } from './i18n';

// The catalog cards are hand-coloured, one palette per design, and they sit on
// two different card backgrounds because the marketing site has a light and a
// dark theme. That is eighteen colour decisions nobody can eyeball reliably —
// and a heading that vanishes into its own card is the kind of bug that only
// ever gets reported by a customer.

// WCAG AA for large text. Card names are 18–21px semibold, which qualifies.
const MIN = 3;

describe('every template card is legible in both themes', () => {
  for (const [id, brand] of Object.entries(TEMPLATE_BRANDS)) {
    it(`${id}: the name reads on the light card and the dark card`, () => {
      expect(contrast(brand.ink, CARD_LIGHT)).toBeGreaterThanOrEqual(MIN);
      expect(contrast(brand.inkDark, CARD_DARK)).toBeGreaterThanOrEqual(MIN);
    });

    it(`${id}: the button's label reads on the button`, () => {
      // Body-sized text on a filled button — the stricter bar applies.
      expect(contrast(brand.buttonInk, brand.button)).toBeGreaterThanOrEqual(4.5);
    });

    it(`${id}: the ink reads on its own tint, which sits behind the header`, () => {
      expect(contrast(brand.ink, brand.tint)).toBeGreaterThanOrEqual(MIN);
    });
  }
});

describe('a template with no hand-picked palette still gets a usable card', () => {
  // Shipping a design must not produce a black-on-black card while somebody
  // remembers to add it to the table — the same rule the price list follows for
  // a template nobody has categorised.
  const ACCENTS = ['#2563eb', '#c9a96a', '#8f1d2e', '#0a0f26', '#ffffff', '#000000', '#7f8c8d'];

  for (const accent of ACCENTS) {
    it(`derives a legible pair from ${accent}`, () => {
      const brand = deriveBrand(accent);
      expect(contrast(brand.ink, CARD_LIGHT)).toBeGreaterThanOrEqual(MIN);
      expect(contrast(brand.inkDark, CARD_DARK)).toBeGreaterThanOrEqual(MIN);
      expect(contrast(brand.buttonInk, brand.button)).toBeGreaterThanOrEqual(4.5);
    });
  }

  it('survives a colour that is not a colour', () => {
    for (const junk of ['', 'rebeccapurple', '#12', 'rgb(1,2,3)']) {
      const brand = deriveBrand(junk);
      expect(contrast(brand.ink, CARD_LIGHT)).toBeGreaterThanOrEqual(MIN);
    }
  });

  it('brandOf falls back for an unknown template', () => {
    const brand = brandOf({ id: 'not-shipped-yet', accent: '#8f1d2e' });
    expect(brand.border).toBe('#8f1d2e');
  });
});

describe('every shipped template is dressed and described', () => {
  // The catalog reads these for each design. A missing entry is not a crash —
  // it is a card in the wrong colours with a translation key printed on it,
  // which is worse, because it looks deliberate.
  for (const tpl of RICH_TEMPLATES) {
    it(`${tpl.id} has a palette, a short line and a full description`, () => {
      expect(TEMPLATE_BRANDS[tpl.id], `${tpl.id} is missing from TEMPLATE_BRANDS`).toBeDefined();
      for (const locale of ['en', 'ru', 'uz'] as const) {
        const dict = viDict[locale] as Record<string, string>;
        expect(dict[shortDescKey(tpl.id)], `${tpl.id} short description missing in ${locale}`).toBeTruthy();
        expect(dict[longDescKey(tpl.id)], `${tpl.id} full description missing in ${locale}`).toBeTruthy();
      }
    });
  }

  it('gives each design its own display face', () => {
    // The point of the per-template font is that the catalog does not look like
    // one product listed nine times.
    const fonts = RICH_TEMPLATES.map((tpl) => brandOf(tpl).font);
    expect(new Set(fonts).size).toBe(fonts.length);
  });
});

describe('the CSS custom properties handed to the card', () => {
  it('swaps the ink and drops the wash in dark mode', () => {
    const brand = TEMPLATE_BRANDS['wedding-chateau']!;
    expect(brandVars(brand, false)['--tb-ink']).toBe(brand.ink);
    expect(brandVars(brand, true)['--tb-ink']).toBe(brand.inkDark);
    // A pale slab of parchment behind a dark card would be a hole in the page.
    expect(brandVars(brand, true)['--tb-tint']).toBe('transparent');
    expect(brandVars(brand, false)['--tb-tint']).toBe(brand.tint);
  });

  it('names every property the stylesheet reads', () => {
    const vars = brandVars(TEMPLATE_BRANDS['wedding-talbon']!, false);
    expect(Object.keys(vars).sort()).toEqual(
      ['--tb-border', '--tb-button', '--tb-button-ink', '--tb-font', '--tb-ink', '--tb-tint'],
    );
  });
});
