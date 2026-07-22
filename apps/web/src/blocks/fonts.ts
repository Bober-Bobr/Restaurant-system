// ── Curated flyer fonts ──────────────────────────────────────────────────────
// A block can pick a heading font and a body font (see headingFont / bodyFont
// props). Each entry maps a stable key → a CSS font-family stack. The families
// are loaded from Google Fonts (see fontsHref, linked in index.html); a browser
// only downloads a face once an element actually uses it, so listing many here
// is cheap. Keep keys stable — they are persisted in block props.

export type FontCategory = 'serif' | 'sans' | 'script' | 'display';

export type FontOption = {
  key: string;
  label: string;
  category: FontCategory;
  stack: string;
  // Google Fonts family name + the weights we request (omit for system fonts).
  google?: { name: string; weights: string };
};

export const FONT_OPTIONS: FontOption[] = [
  // System default (no download) — the current look.
  { key: '', label: 'Default', category: 'sans', stack: '' },

  // Elegant serifs
  { key: 'playfair', label: 'Playfair Display', category: 'serif', stack: '"Playfair Display", Georgia, serif', google: { name: 'Playfair Display', weights: 'ital,wght@0,400;0,600;0,700;1,400' } },
  { key: 'cormorant', label: 'Cormorant Garamond', category: 'serif', stack: '"Cormorant Garamond", Georgia, serif', google: { name: 'Cormorant Garamond', weights: 'ital,wght@0,400;0,600;1,400' } },
  { key: 'ebgaramond', label: 'EB Garamond', category: 'serif', stack: '"EB Garamond", Georgia, serif', google: { name: 'EB Garamond', weights: 'ital,wght@0,400;0,600;1,400' } },
  { key: 'prata', label: 'Prata', category: 'serif', stack: 'Prata, Georgia, serif', google: { name: 'Prata', weights: 'wght@400' } },
  { key: 'marcellus', label: 'Marcellus', category: 'serif', stack: 'Marcellus, Georgia, serif', google: { name: 'Marcellus', weights: 'wght@400' } },
  { key: 'cinzel', label: 'Cinzel', category: 'serif', stack: 'Cinzel, Georgia, serif', google: { name: 'Cinzel', weights: 'wght@400;600' } },

  // Modern sans
  { key: 'montserrat', label: 'Montserrat', category: 'sans', stack: 'Montserrat, system-ui, sans-serif', google: { name: 'Montserrat', weights: 'wght@300;400;600;700' } },
  { key: 'poppins', label: 'Poppins', category: 'sans', stack: 'Poppins, system-ui, sans-serif', google: { name: 'Poppins', weights: 'wght@300;400;600' } },
  { key: 'raleway', label: 'Raleway', category: 'sans', stack: 'Raleway, system-ui, sans-serif', google: { name: 'Raleway', weights: 'wght@300;400;600' } },
  { key: 'jost', label: 'Jost', category: 'sans', stack: 'Jost, system-ui, sans-serif', google: { name: 'Jost', weights: 'wght@300;400;500' } },
  { key: 'inter', label: 'Inter', category: 'sans', stack: 'Inter, system-ui, sans-serif', google: { name: 'Inter', weights: 'wght@400;600' } },

  // Script / calligraphy
  { key: 'greatvibes', label: 'Great Vibes', category: 'script', stack: '"Great Vibes", cursive', google: { name: 'Great Vibes', weights: 'wght@400' } },
  { key: 'dancing', label: 'Dancing Script', category: 'script', stack: '"Dancing Script", cursive', google: { name: 'Dancing Script', weights: 'wght@400;600' } },
  { key: 'parisienne', label: 'Parisienne', category: 'script', stack: 'Parisienne, cursive', google: { name: 'Parisienne', weights: 'wght@400' } },
  { key: 'sacramento', label: 'Sacramento', category: 'script', stack: 'Sacramento, cursive', google: { name: 'Sacramento', weights: 'wght@400' } },
  { key: 'caveat', label: 'Caveat', category: 'script', stack: 'Caveat, cursive', google: { name: 'Caveat', weights: 'wght@400;600' } },

  // Display / decorative
  { key: 'bebas', label: 'Bebas Neue', category: 'display', stack: '"Bebas Neue", Impact, sans-serif', google: { name: 'Bebas Neue', weights: 'wght@400' } },
  { key: 'abril', label: 'Abril Fatface', category: 'display', stack: '"Abril Fatface", Georgia, serif', google: { name: 'Abril Fatface', weights: 'wght@400' } },
  { key: 'yeseva', label: 'Yeseva One', category: 'display', stack: '"Yeseva One", Georgia, serif', google: { name: 'Yeseva One', weights: 'wght@400' } },
];

const BY_KEY = new Map(FONT_OPTIONS.map((f) => [f.key, f]));

/** CSS font-family stack for a stored key, or undefined for the default/unknown. */
export function fontStack(key: unknown): string | undefined {
  if (typeof key !== 'string' || !key) return undefined;
  return BY_KEY.get(key)?.stack || undefined;
}

/** The Google Fonts stylesheet URL for every downloadable family above. */
export const fontsHref = `https://fonts.googleapis.com/css2?${FONT_OPTIONS
  .filter((f) => f.google)
  .map((f) => `family=${encodeURIComponent(f.google!.name).replace(/%20/g, '+')}:${f.google!.weights}`)
  .join('&')}&display=swap`;
