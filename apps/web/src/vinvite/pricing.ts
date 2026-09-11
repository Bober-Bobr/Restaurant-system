import type { TemplateTier } from './api';

// Pure pricing helpers, kept out of the page so they can be reasoned about (and
// tested) without dragging in React, the template registry or the HTTP client.
// The `import type` above is erased at build time, so this module has no runtime
// dependencies at all.

export const TIER_ORDER: TemplateTier[] = ['STANDARD', 'PREMIUM', 'LUXURY'];

/**
 * What the PUBLIC site may quote: a design with both a tier and a price.
 *
 * This reverses the rule `groupByTier` still follows, deliberately and on
 * request. The old behaviour kept an uncategorised design visible so that
 * shipping a new one could not make it silently vanish — a good rule for the
 * administrator, who needs to see that something is unpriced, and the wrong one
 * for a shop window, where it shows a customer a product with no price and no
 * category and invites them to buy it.
 *
 * So the safety valve moves rather than disappearing: `groupByTier` still
 * surfaces `unassigned`, and the Settings screen still lists every design, so
 * an unpriced template is visible to the person who can price it. It is only
 * the visitor who is not shown a half-finished listing.
 *
 * Both halves are required. A tier with no price quotes nothing; a price with
 * no tier has no column to sit in.
 */
export function sellableTemplates<T extends { id: string }>(
  templates: T[],
  pricing: Map<string, { tier: TemplateTier | null; priceCents?: number | null }>,
): T[] {
  return templates.filter((tpl) => {
    const row = pricing.get(tpl.id);
    if (!row) return false;
    if (!row.tier || !TIER_ORDER.includes(row.tier)) return false;
    // `priceCents` is nullable and zero is a real price — a design given away
    // as part of a package is priced, not unpriced. Only null means unset.
    return row.priceCents != null;
  });
}

/**
 * Split the visible templates into the three tiers.
 *
 * A template with no tier — or with a tier this build does not know — goes to
 * `unassigned` rather than being dropped. That is what lets the ADMIN screens
 * show an uncategorised design instead of losing it; the public site drops it
 * earlier, via `sellableTemplates` above.
 *
 * Order within a tier follows the order given, which is the showcase order the
 * administrator arranged — not the pricing map's insertion order.
 */
export function groupByTier<T extends { id: string }>(
  templates: T[],
  pricing: Map<string, { tier: TemplateTier | null }>,
): { buckets: Record<TemplateTier, T[]>; unassigned: T[] } {
  const buckets: Record<TemplateTier, T[]> = { STANDARD: [], PREMIUM: [], LUXURY: [] };
  const unassigned: T[] = [];
  for (const template of templates) {
    const tier = pricing.get(template.id)?.tier ?? null;
    if (tier && buckets[tier]) buckets[tier].push(template);
    else unassigned.push(template);
  }
  return { buckets, unassigned };
}

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
