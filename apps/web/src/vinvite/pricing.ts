import type { TemplateTier } from './api';

// Pure pricing helpers, kept out of the page so they can be reasoned about (and
// tested) without dragging in React, the template registry or the HTTP client.
// The `import type` above is erased at build time, so this module has no runtime
// dependencies at all.

export const TIER_ORDER: TemplateTier[] = ['STANDARD', 'PREMIUM', 'LUXURY'];

/**
 * Split the visible templates into the three tiers.
 *
 * A template with no tier — or with a tier this build does not know — goes to
 * `unassigned` rather than being dropped. Silently hiding it would mean that
 * shipping a new template makes it invisible on the price list until somebody
 * remembers to categorise it, the same silent failure `resolveShowcase` guards
 * against on the landing page.
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
