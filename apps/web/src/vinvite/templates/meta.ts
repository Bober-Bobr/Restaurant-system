import type { TemplateCategory } from './types';

// ── What a design IS, without the design itself ──────────────────────────────
//
// Every `definition.ts` opens with `import html from './template.html?raw'`, so
// touching the registry at all pulls all twelve designs' markup — about 1.1 MB
// raw, 374 kB gzipped — into whatever chunk did the touching. That is the right
// trade in the builder and on a published invitation, which need the markup.
//
// It is the wrong trade on the marketing site, which needs a NAME, an emoji and
// an accent to draw a price list, and needs the markup only when a visitor
// actually opens a preview. Measured: the landing page was paying the whole
// bundle to render a list of twelve names.
//
// So the metadata lives here, in a module with no imports that carry weight,
// and the registry is loaded on demand. This IS a second copy of facts that
// also exist in the definitions, which is a real cost — `templateMeta.test.ts`
// imports both and fails if they disagree on any field, the same guard already
// standing over `toSubdomainSlug` and the invoice arithmetic.

export type TemplateMeta = {
  id: string;
  category: TemplateCategory;
  /** translate() key for the display name. */
  nameKey: string;
  /** The emoji on the card. */
  cover: string;
  /** Card accent — also what `brandOf` falls back to for an unlisted design. */
  accent: string;
};

/** Every first-party design, in the order they are offered. */
export const TEMPLATE_META: TemplateMeta[] = [
  { id: 'birthday-tuscan', category: 'birthday', nameKey: 'tpl_birthday_tuscan', cover: '🏛️', accent: '#b08d4f' },
  { id: 'birthday-midnight', category: 'birthday', nameKey: 'tpl_birthday_midnight', cover: '🎁', accent: '#D8B268' },
  { id: 'birthday-prestige', category: 'birthday', nameKey: 'tpl_birthday_prestige', cover: '🎭', accent: '#C6A25E' },
  { id: 'wedding-arabic', category: 'wedding', nameKey: 'tpl_wedding_arabic', cover: '🕌', accent: '#C79A52' },
  { id: 'wedding-celestial', category: 'wedding', nameKey: 'tpl_wedding_celestial', cover: '🌙', accent: '#e7c66b' },
  { id: 'wedding-chateau', category: 'wedding', nameKey: 'tpl_wedding_chateau', cover: '🏰', accent: '#B8924E' },
  { id: 'wedding-eternal-vows', category: 'wedding', nameKey: 'tpl_wedding_eternal_vows', cover: '💍', accent: '#c9a96a' },
  { id: 'wedding-keepsake', category: 'wedding', nameKey: 'tpl_wedding_keepsake', cover: '🎟', accent: '#7c2e3c' },
  { id: 'wedding-paris', category: 'wedding', nameKey: 'tpl_wedding_paris', cover: '🗼', accent: '#B08D4F' },
  { id: 'wedding-samarkand', category: 'wedding', nameKey: 'tpl_wedding_samarkand', cover: '🏮', accent: '#C9A227' },
  { id: 'wedding-stillvatn', category: 'wedding', nameKey: 'tpl_wedding_stillvatn', cover: '🌾', accent: '#6B7A63' },
  { id: 'wedding-talbon', category: 'wedding', nameKey: 'tpl_wedding_talbon', cover: '🍎', accent: '#8f1d2e' },
];

export function getTemplateMeta(id: string): TemplateMeta | null {
  return TEMPLATE_META.find((m) => m.id === id) ?? null;
}
