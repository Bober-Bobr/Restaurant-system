// Per-restaurant tablet/summary color palette. The manager sets two colors —
// an accent and a background — and everything else (lighter accent, darker
// background used in gradients, and the rgb channel triples used by the many
// rgba(...) glows/borders) is derived here into CSS custom properties that the
// tablet + summary pages and the .rg-* classes consume.

export type TabletTheme = { accent: string; bg: string };

// The banquet brand palette — used as the fallback everywhere. Must match the
// `--rg-*` defaults in index.css, which cover the moment before a restaurant's
// theme has loaded. Was a gold-on-green of its own until the banquet rebrand;
// a restaurant that saved its own colors keeps them, since those never reach
// this fallback.
export const DEFAULT_TABLET_THEME: TabletTheme = { accent: '#d8b45f', bg: '#0b1120' };

const HEX = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

function normalizeHex(hex: string | null | undefined): string | null {
  if (!hex || !HEX.test(hex.trim())) return null;
  let h = hex.trim().slice(1);
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  return `#${h.toLowerCase()}`;
}

function toRgb(hex: string): { r: number; g: number; b: number } {
  const n = parseInt(hex.slice(1), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
const toHex = ({ r, g, b }: { r: number; g: number; b: number }) =>
  `#${[r, g, b].map((v) => clamp(v).toString(16).padStart(2, '0')).join('')}`;
const channels = ({ r, g, b }: { r: number; g: number; b: number }) => `${clamp(r)},${clamp(g)},${clamp(b)}`;

// Mix a color toward white (amt > 0) or black (amt < 0), 0..1 magnitude.
function shade(hex: string, amt: number): { r: number; g: number; b: number } {
  const { r, g, b } = toRgb(hex);
  const target = amt >= 0 ? 255 : 0;
  const t = Math.abs(amt);
  return { r: r + (target - r) * t, g: g + (target - g) * t, b: b + (target - b) * t };
}

/**
 * Build the CSS-variable style object for a tablet theme. Invalid/absent colors
 * fall back to the default gold palette, so this is always safe to spread onto a
 * page root: `style={{ ...base, ...tabletThemeVars(theme) }}`.
 */
export function tabletThemeVars(theme?: { accent?: string | null; bg?: string | null } | null): Record<string, string> {
  const accent = normalizeHex(theme?.accent) ?? DEFAULT_TABLET_THEME.accent;
  const bg = normalizeHex(theme?.bg) ?? DEFAULT_TABLET_THEME.bg;

  const accentSoft = shade(accent, 0.35);   // lighter accent (was #d9b84a / #f7e6a8)
  const bgDark = shade(bg, -0.4);            // darker bg for gradients (was #0f2114 / 15,33,20)

  return {
    '--rg-accent': accent,
    '--rg-accent-rgb': channels(toRgb(accent)),
    '--rg-accent-soft': toHex(accentSoft),
    '--rg-bg': bg,
    '--rg-bg-rgb': channels(toRgb(bg)),
    '--rg-bg-dark': toHex(bgDark),
    '--rg-bg-dark-rgb': channels(bgDark),
  };
}
