// ── Per-restaurant accent colour ────────────────────────────────────────────
// The food-service site is themed by the restaurant's own colour, reusing the
// `tabletAccentColor` it already sets for the kiosk rather than adding a column.
//
// The readability guard is the point of this file. The site is near-black, and a
// restaurant is free to save a near-black brand colour — without a guard that
// produces an unreadable site that looks like our bug, not their setting.

/** Platform default: electric lime, used when a restaurant has set no colour. */
export const DEFAULT_ACCENT = '#c6f24e';

// The surface the accent actually has to survive against. NOT --fs-bg: prices,
// links and section bars sit on CARDS, and a card is --fs-surface-2 composited
// over whatever shows through, which is lighter than the page. This is the
// lightest such surface, so clearing the bar here clears it everywhere.
const SURFACE_BG: [number, number, number] = [0x22, 0x26, 0x2a];

/** Text placed ON the accent, when the accent is light enough to take it. */
const INK_DARK = '#040506';

// The WCAG AA bar for normal-size text. Judging the accent by contrast against
// the actual page background, rather than by a raw luminance threshold, is what
// keeps ordinary mid-tone brand colours (a medium blue, say) from being thrown
// away while genuinely unreadable ones still are.
const MIN_CONTRAST = 4.5;

export type ResolvedAccent = {
  /** The hex to use. */
  accent: string;
  /** "r, g, b" — feeds `rgb(var(--fs-accent-rgb) / <alpha>)` in foodsite.css. */
  accentRgb: string;
  /** Text colour to place ON the accent. */
  accentInk: string;
};

function parseHex(value: string | null | undefined): [number, number, number] | null {
  if (!value) return null;
  let hex = value.trim().replace(/^#/, '');
  if (hex.length === 3) hex = hex.split('').map((c) => c + c).join('');
  if (!/^[0-9a-fA-F]{6}$/.test(hex)) return null;
  return [
    parseInt(hex.slice(0, 2), 16),
    parseInt(hex.slice(2, 4), 16),
    parseInt(hex.slice(4, 6), 16),
  ];
}

// WCAG relative luminance.
function luminance([r, g, b]: [number, number, number]): number {
  const channel = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

// WCAG contrast ratio between two colours, 1..21.
function contrast(a: [number, number, number], b: [number, number, number]): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

// ── Rescuing a too-dark accent ──────────────────────────────────────────────
// Rejecting the restaurant's colour outright would swap a brand navy for the
// platform lime, which is a surprising thing for a settings field to do. So the
// hue is kept and only the lightness is raised, just far enough to clear the
// contrast bar. Only a colour with no hue to preserve — black, charcoal, any
// near-grey — falls back to the default, because lightening that yields grey,
// which is not anybody's brand colour either.

const MIN_SATURATION = 0.12;

function toHsl([r, g, b]: [number, number, number]): [number, number, number] {
  const [rn, gn, bn] = [r / 255, g / 255, b / 255];
  const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return [0, 0, l];
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6;
  else if (max === gn) h = ((bn - rn) / d + 2) / 6;
  else h = ((rn - gn) / d + 4) / 6;
  return [h, s, l];
}

function toRgb([h, s, l]: [number, number, number]): [number, number, number] {
  if (s === 0) { const v = Math.round(l * 255); return [v, v, v]; }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const channel = (t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return [
    Math.round(channel(h + 1 / 3) * 255),
    Math.round(channel(h) * 255),
    Math.round(channel(h - 1 / 3) * 255),
  ];
}

function makeReadable(rgb: [number, number, number]): [number, number, number] | null {
  if (contrast(rgb, SURFACE_BG) >= MIN_CONTRAST) return rgb;
  const [h, s, l] = toHsl(rgb);
  if (s < MIN_SATURATION) return null; // no hue worth preserving
  // Finer step than the eye can see, so a colour is never lifted further than
  // it has to be — the point is to keep the restaurant's hue recognisable.
  for (let next = l + 0.01; next <= 0.97; next += 0.01) {
    const lifted = toRgb([h, s, next]);
    if (contrast(lifted, SURFACE_BG) >= MIN_CONTRAST) return lifted;
  }
  return null;
}

export function resolveAccent(value: string | null | undefined): ResolvedAccent {
  const parsed = parseHex(value);
  const fallback = parseHex(DEFAULT_ACCENT)!;
  const rgb = (parsed && makeReadable(parsed)) ?? fallback;

  // Whichever of the two reads better on the accent. Deciding by measurement
  // means an unusual brand colour cannot end up with unreadable text on its
  // buttons and pills.
  const white: [number, number, number] = [255, 255, 255];
  const accentInk = contrast(rgb, SURFACE_BG) >= contrast(rgb, white) ? INK_DARK : '#ffffff';

  return {
    accent: `#${rgb.map((c) => c.toString(16).padStart(2, '0')).join('')}`,
    accentRgb: rgb.join(', '),
    accentInk,
  };
}

/** Inline style applied to `.fs-root`, mirroring how the tablet overrides --rg-*. */
export function accentStyle(value: string | null | undefined): React.CSSProperties {
  const { accent, accentRgb, accentInk } = resolveAccent(value);
  return {
    '--fs-accent': accent,
    '--fs-accent-rgb': accentRgb,
    '--fs-accent-ink': accentInk,
  } as React.CSSProperties;
}
