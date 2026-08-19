import type { ViKey } from './i18n';

// ── Each template's own colours and typeface, on the marketing site ──────────
//
// The catalog card and the full-view preview are dressed in the palette of the
// design they are advertising: its border, its button, its heading colour and
// its display face. A row of identically blue cards tells a visitor nothing;
// these are what the difference between a midnight birthday and an ivory
// wedding actually looks like, before they open anything.
//
// Colours are taken from each template's own `:root`, not invented here — the
// card is a swatch of the design, so inventing a colour would make it a
// swatch of nothing.
//
// TWO inks per template, because the marketing site has a light and a dark
// theme and the cards sit on `--vi-card` in both. A single mid-tone that reads
// on cream and on navy does not exist; `templateBrand.test.ts` measures both
// against the real card colours and fails the build if one of them is picked
// badly. The fonts are all families the app already loads in index.html.

export type TemplateBrand = {
  /** Heading colour on the light card. */
  ink: string;
  /** Heading colour on the dark card. */
  inkDark: string;
  /** Card and full-view border. */
  border: string;
  /** Primary action background. */
  button: string;
  /** Text on that button. */
  buttonInk: string;
  /** A soft wash behind the card's header, light theme only. */
  tint: string;
  /** Display family for the name — already loaded by index.html. */
  font: string;
};

/** The card colours of `--vi-card` in each theme, which the inks sit on. */
export const CARD_LIGHT = '#fffdf8';
export const CARD_DARK = '#161f31';

const SERIF_FALLBACK = "Georgia, 'Times New Roman', serif";

export const TEMPLATE_BRANDS: Record<string, TemplateBrand> = {
  // Dusty rose and sage over champagne — an evening, not a party.
  'birthday-tuscan': {
    ink: '#8c4a41', inkDark: '#e6b3aa', border: '#c99a94',
    button: '#8c5a53', buttonInk: '#faf5ea', tint: '#f6f0e4',
    font: `'Cormorant Garamond', ${SERIF_FALLBACK}`,
  },
  // Royal navy under champagne gold.
  'birthday-midnight': {
    ink: '#2c3f9e', inkDark: '#f0d79b', border: '#d8b268',
    button: '#101636', buttonInk: '#f3e5cb', tint: '#eef0fa',
    font: `'Cinzel', ${SERIF_FALLBACK}`,
  },
  // Brass on black — a theatre bill.
  'birthday-prestige': {
    ink: '#7a5c26', inkDark: '#e6ce9a', border: '#c6a25e',
    button: '#131317', buttonInk: '#e6ce9a', tint: '#f4f1ea',
    font: `'Playfair Display', ${SERIF_FALLBACK}`,
  },
  // The gold arch over ivory.
  'wedding-arabic': {
    ink: '#8d6d22', inkDark: '#e2c78c', border: '#c6a35c',
    button: '#7d6122', buttonInk: '#faf5ea', tint: '#f6efe3',
    font: `'Marcellus', ${SERIF_FALLBACK}`,
  },
  // Indigo and plum, lit by star gold.
  'wedding-celestial': {
    ink: '#3f2a63', inkDark: '#e7c66b', border: '#e7c66b',
    button: '#141b40', buttonInk: '#f0dfae', tint: '#eeeaf6',
    font: `'Yeseva One', ${SERIF_FALLBACK}`,
  },
  // Marble and gold leaf.
  'wedding-eternal-vows': {
    ink: '#8a713c', inkDark: '#e7d2a4', border: '#c9a96a',
    button: '#6f5b2e', buttonInk: '#fbf8f3', tint: '#f1e9db',
    font: `'Prata', ${SERIF_FALLBACK}`,
  },
  // Burgundy under a scratch coating.
  'wedding-keepsake': {
    ink: '#7c2e3c', inkDark: '#e3a3ac', border: '#9a4a52',
    button: '#6d2233', buttonInk: '#f8f1e7', tint: '#f3e9d9',
    font: `'Abril Fatface', ${SERIF_FALLBACK}`,
  },
  // Pomegranate red and satin gold.
  'wedding-talbon': {
    ink: '#8f1d2e', inkDark: '#e8a99f', border: '#c9a05a',
    button: '#8f1d2e', buttonInk: '#f7ecd8', tint: '#f7ece2',
    font: `'EB Garamond', ${SERIF_FALLBACK}`,
  },
  // Estate green and engraved gold.
  'wedding-chateau': {
    ink: '#3d4a3b', inkDark: '#dfc48a', border: '#b8924e',
    button: '#2f3a2e', buttonInk: '#f7f2e8', tint: '#efe6d5',
    font: `'Italiana', ${SERIF_FALLBACK}`,
  },
};

// ── Colour maths, for the fallback ──────────────────────────────────────────
// A template shipped without an entry above must still get a coherent card
// rather than a blank one — the same rule the price list follows for a template
// nobody has categorised yet. Everything below is derived from its `accent`.

function parseHex(hex: string): [number, number, number] | null {
  const raw = hex.trim().replace('#', '');
  const full = raw.length === 3 ? raw.split('').map((c) => c + c).join('') : raw;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return null;
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16)) as [number, number, number];
}

const toHex = (rgb: number[]) =>
  '#' + rgb.map((c) => Math.max(0, Math.min(255, Math.round(c))).toString(16).padStart(2, '0')).join('');

/** Mix towards white (`amount` > 0) or black (`amount` < 0). */
function shade(hex: string, amount: number): string {
  const rgb = parseHex(hex);
  if (!rgb) return hex;
  const target = amount > 0 ? 255 : 0;
  const k = Math.abs(amount);
  return toHex(rgb.map((c) => c + (target - c) * k));
}

/** WCAG relative luminance. */
export function luminance(hex: string): number {
  const rgb = parseHex(hex);
  if (!rgb) return 0;
  const [r, g, b] = rgb.map((c) => c / 255) as [number, number, number];
  const ch = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b);
}

export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** Darken (or lighten) until the colour is legible on `on`, or give up safely. */
function legibleOn(hex: string, on: string, minimum = 4.5): string {
  const towardsBlack = luminance(on) > 0.5;
  let out = hex;
  for (let step = 0; step < 12 && contrast(out, on) < minimum; step += 1) {
    out = shade(out, towardsBlack ? -0.1 : 0.1);
  }
  // A hue that cannot reach the bar even at the extremes (a mid grey against a
  // mid card) falls back to plain text rather than to something unreadable.
  return contrast(out, on) >= minimum ? out : (towardsBlack ? '#1f2937' : '#ede7da');
}

/** Everything a card needs, derived from one accent. */
export function deriveBrand(accent: string): TemplateBrand {
  const base = parseHex(accent) ? accent : '#2563eb';
  return {
    ink: legibleOn(base, CARD_LIGHT),
    inkDark: legibleOn(base, CARD_DARK),
    border: base,
    button: legibleOn(base, '#ffffff'),
    buttonInk: '#ffffff',
    tint: shade(base, 0.86),
    font: `'Playfair Display', ${SERIF_FALLBACK}`,
  };
}

/**
 * The brand for a template.
 *
 * Hand-picked where we have one, derived from the accent where we do not — a
 * template added tomorrow gets a usable card today, and only looks generic
 * until somebody gives it an entry above.
 */
export function brandOf(template: { id: string; accent: string }): TemplateBrand {
  return TEMPLATE_BRANDS[template.id] ?? deriveBrand(template.accent);
}

/**
 * The CSS custom properties the card and the preview read.
 *
 * One object, applied as an inline style, so every brand-coloured rule lives in
 * vinvite.css instead of being spread through the JSX as inline colours.
 */
export function brandVars(brand: TemplateBrand, dark: boolean): Record<string, string> {
  return {
    '--tb-ink': dark ? brand.inkDark : brand.ink,
    '--tb-border': brand.border,
    '--tb-button': brand.button,
    '--tb-button-ink': brand.buttonInk,
    // The wash is a light-theme flourish; on the dark card it would be a pale
    // slab, so it becomes a whisper of the border colour instead.
    '--tb-tint': dark ? 'transparent' : brand.tint,
    '--tb-font': brand.font,
  };
}

/** i18n keys for a template's one-line and full descriptions. */
export const shortDescKey = (id: string) => `tdesc_${id.replace(/-/g, '_')}` as ViKey;
export const longDescKey = (id: string) => `tlong_${id.replace(/-/g, '_')}` as ViKey;
