import { TIER_PRICE_CENTS } from './pricing';
import type { TemplateTier } from './api';

// ── The browser's copy of the promo rule ─────────────────────────────────────
//
// The order form quotes the discount as the code is typed, so the rule has to
// exist here; the API cannot be allowed to take the browser's word for a price,
// so it exists there too, at `apps/api/src/utils/invitePromo.ts`. The API cannot
// import from the web app, which is why this is a second copy rather than a
// shared module — the same arrangement as `toSubdomainSlug`, the invoice
// arithmetic and the section rule, and `promoAgreement.test.ts` imports BOTH
// and runs every tier and code through each so they cannot drift.
//
// The list price is NOT duplicated a third time: it is imported from
// `./pricing`, which is what the price list itself renders, so a category can
// never be advertised at one figure and quoted at another on the same page.
// The agreement test compares that table against the API's copy.

/**
 * What a valid code takes off, per category.
 *
 * Flat per tier, not a percentage and not per code. Every code is worth the
 * same; which one was used matters only as provenance — it says which
 * restaurant sent the customer, which is why they were handed out.
 */
export const TIER_DISCOUNT_CENTS: Record<TemplateTier, number> = {
  STANDARD: 150_000_00,
  PREMIUM: 200_000_00,
  LUXURY: 300_000_00,
};

/**
 * The partner restaurants, plus PERY.
 *
 * Uppercase is canonical: it is how they are printed, stored, quoted and
 * forwarded to the studio. The field folds what is typed to it rather than
 * refusing lowercase — a phone keyboard that autocorrects must not be the
 * reason a customer loses their discount.
 */
export const PROMO_CODES: readonly string[] = [
  'EMIR',
  'GOLDENASIA',
  'SANGIZAR',
  'MARJON',
  'BAXT',
  'TOHIRIY',
  'GRANDASLI',
  'AFSONA',
  'GRANDSABINA',
  'ZILOLBAXT',
  'MADINABEK',
  'FARIDAXANIM',
  'MAROQAND',
  'PERY',
];

const CODE_SET = new Set(PROMO_CODES);

/**
 * Fold typed input to the canonical form.
 *
 * Whitespace is stripped rather than merely trimmed: "GRAND ASLI" and
 * "GRANDASLI" are the same restaurant to someone reading it off a card, and no
 * code is a concatenation of others, so this cannot turn one code into another.
 */
export function normalizePromoCode(raw: string): string {
  return raw.replace(/\s+/g, '').toUpperCase();
}

export function isPromoCode(raw: string): boolean {
  return CODE_SET.has(normalizePromoCode(raw));
}

export type Quote = {
  tier: TemplateTier;
  promoCode: string | null;
  listCents: number;
  discountCents: number;
  totalCents: number;
};

/**
 * Price one order. Throws on a code that is not recognised — see the API copy;
 * the form asks `isPromoCode` first and never submits an unknown one.
 */
export function quoteOrder(tier: TemplateTier, rawCode?: string | null): Quote {
  const listCents = TIER_PRICE_CENTS[tier];
  const code = rawCode ? normalizePromoCode(rawCode) : '';

  if (!code) {
    return { tier, promoCode: null, listCents, discountCents: 0, totalCents: listCents };
  }
  if (!CODE_SET.has(code)) throw new Error(`Unknown promo code: ${code}`);

  // Floored at the list price so a discount can never quote a negative total.
  const discountCents = Math.min(TIER_DISCOUNT_CENTS[tier], listCents);
  return { tier, promoCode: code, listCents, discountCents, totalCents: listCents - discountCents };
}
