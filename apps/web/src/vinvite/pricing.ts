import type { TemplateTier } from './api';

// Pure pricing helpers, kept out of the page so they can be reasoned about (and
// tested) without dragging in React, the template registry or the HTTP client.
// The `import type` above is erased at build time, so this module has no runtime
// dependencies at all.

export const TIER_ORDER: TemplateTier[] = ['STANDARD', 'PREMIUM', 'LUXURY'];

// ── What a tier costs, and what it buys ──────────────────────────────────────
//
// The price belongs to the CATEGORY, not to a design. It used to live per
// template on `InviteTemplateOverride.priceCents`, which meant twelve prices
// to keep in step for a shop that quotes three — and a customer choosing a
// tier could be shown a different number depending on which design happened to
// be cheapest inside it.
//
// So it is one table, here, beside the tier order it belongs with. Two
// consequences worth being explicit about:
//
//  · Changing a price is a DEPLOY, not a form. That is the trade the studio
//    asked for when the per-template price board was removed; three numbers
//    that change rarely are better as reviewed content than as an admin screen
//    nobody remembers exists.
//  · The benefits are `ViKey` SUFFIXES shared between tiers, not sentences.
//    Music is in all three and the premium animation is in two, so writing them
//    per tier would mean the same claim phrased three slightly different ways
//    within a fortnight. Shared keys make the ladder literal: Premium is
//    Standard's list with the animation upgraded and a voice added, and that is
//    exactly what the reader should see.
//
// Tiyin, like every other price in the codebase (1/100 so'm).
export const TIER_PRICE_CENTS: Record<TemplateTier, number> = {
  STANDARD: 600_000_00,
  PREMIUM: 800_000_00,
  LUXURY: 1_400_000_00,
};

/** i18n keys, in the order they are listed. Resolved as `pricing_b_<key>`. */
export const TIER_BENEFITS: Record<TemplateTier, readonly string[]> = {
  STANDARD: ['anim', 'music'],
  PREMIUM: ['anim_pro', 'voice', 'music'],
  LUXURY: ['anim_pro', 'voice', 'music', 'custom'],
};

/**
 * The retired pair.
 *
 * `sellableTemplates` and `groupByTier` sorted designs into tiers for a price
 * list that named them. The price list now sells the three CATEGORIES and
 * names no design, so both had no caller left; a filter nothing filters is a
 * rule that quietly stops being true.
 *
 * What they encoded is not lost, it moved: a category's price is
 * `TIER_PRICE_CENTS` above, and which category a design belongs to is still
 * recorded per template on `InviteTemplateOverride.tier` and edited on the
 * Settings board — it is simply not what the shop window is built from.
 */

// The administrator may type a handle, an @handle or a full URL into the studio
// contact fields. Accept all three rather than making them remember which one
// this particular field wanted — the field has never said.
export function telegramHref(value: string): string {
  const raw = value.trim();
  if (/^https?:\/\//i.test(raw)) return raw;
  return `https://t.me/${raw.replace(/^@/, '')}`;
}

export function instagramHref(value: string): string {
  const raw = value.trim();
  if (/^https?:\/\//i.test(raw)) return raw;
  return `https://instagram.com/${raw.replace(/^@/, '')}`;
}
