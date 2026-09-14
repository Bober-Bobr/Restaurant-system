// ── What an invitation costs, and what a promo code takes off it ─────────────
//
// This file is the SERVER's copy of a rule that also exists on the web, at
// `apps/web/src/vinvite/promo.ts`. The API cannot import from the web app, so
// the pair is kept honest by `promoAgreement.test.ts`, which imports BOTH and
// runs every tier and every code through each — the same guard already standing
// over `toSubdomainSlug`, the invoice arithmetic and the section rule.
//
// WHY THE SERVER HAS A COPY AT ALL: the promotional site's order form shows the
// discount as it is typed, so the web needs the rule; and a public, unauthenticated
// endpoint must never be told what something costs by the browser posting to it.
// Same rule as the food-service order flow, where the request body carries ids
// and quantities only and every price is resolved here. A visitor who edits the
// request and claims a 5 000 000 discount gets the real quote written to the row
// and forwarded to the studio.

export const TIERS = ['STANDARD', 'PREMIUM', 'LUXURY'] as const;
export type OrderTier = (typeof TIERS)[number];

/**
 * The list price of each category, in tiyin (1/100 so'm) like every other price
 * on this platform.
 *
 * Mirrors `TIER_PRICE_CENTS` in the web's `vinvite/pricing.ts`, which is what
 * the price list renders. Duplicated rather than shared because this half has to
 * hold when the browser is hostile; the agreement test is what stops the two
 * drifting into quoting different numbers for the same category.
 */
export const TIER_PRICE_CENTS: Record<OrderTier, number> = {
  STANDARD: 600_000_00,
  PREMIUM: 800_000_00,
  LUXURY: 1_400_000_00,
};

/**
 * What a valid promo code takes off, per category.
 *
 * A flat amount per tier, NOT a percentage and NOT per code: every code is worth
 * the same, and which code was used matters only as provenance — it says which
 * restaurant sent the customer, which is the whole point of handing them out.
 * So the codes are a membership test and the money is this table.
 */
export const TIER_DISCOUNT_CENTS: Record<OrderTier, number> = {
  STANDARD: 150_000_00,
  PREMIUM: 200_000_00,
  LUXURY: 300_000_00,
};

/**
 * The valid codes: the partner restaurants, plus PERY.
 *
 * Uppercase is the canonical form — it is how they are printed and how they are
 * stored, quoted and forwarded to the studio. Input is folded to it rather than
 * refused (see `normalizePromoCode`), because a phone keyboard that autocorrects
 * to lowercase must not be the reason a customer loses their discount.
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
 * "GRANDASLI" are the same restaurant to the person reading it off a card, and
 * no code is a prefix or concatenation of another, so removing spaces cannot
 * turn one code into a different one.
 */
export function normalizePromoCode(raw: string): string {
  return raw.replace(/\s+/g, '').toUpperCase();
}

export function isPromoCode(raw: string): boolean {
  return CODE_SET.has(normalizePromoCode(raw));
}

export function isTier(value: string): value is OrderTier {
  return (TIERS as readonly string[]).includes(value);
}

/**
 * A priced order, or an unpriced one.
 *
 * All four money/tier fields are nullable together, because a request may be
 * sent with NO category chosen — a customer who just wants to be rung back
 * should not have to decide what to spend first. There is then nothing to
 * quote: the discount is a per-category amount, so without a category it has no
 * value. The code is still recorded, and the figures are agreed in the
 * conversation that follows.
 */
export type Quote = {
  tier: OrderTier | null;
  /** The canonical code, or null when none was given. */
  promoCode: string | null;
  listCents: number | null;
  discountCents: number | null;
  totalCents: number | null;
};

/**
 * Price one order.
 *
 * An empty / absent code is simply no discount — a customer without one is the
 * normal case, not an error. A code that is NOT recognised throws rather than
 * quietly quoting the full price: by that point the form has already shown the
 * customer a reduced figure, and silently charging them more is the one outcome
 * worth refusing over. The form blocks the same case before it is sent, so this
 * fires only for a hand-made request.
 *
 * The code is checked BEFORE the category, so a wrong code is refused even when
 * there is no category to price it against. Otherwise a request with no tier
 * would quietly bank a misspelling and the customer would find out later that
 * the discount they typed was never recognised.
 */
export function quoteOrder(tier: OrderTier | null, rawCode?: string | null): Quote {
  const code = rawCode ? normalizePromoCode(rawCode) : '';
  if (code && !CODE_SET.has(code)) throw new Error(`Unknown promo code: ${code}`);
  const promoCode = code || null;

  // No category: nothing to price. Recorded as a lead with its code intact.
  if (!tier) {
    return { tier: null, promoCode, listCents: null, discountCents: null, totalCents: null };
  }

  const listCents = TIER_PRICE_CENTS[tier];
  if (!promoCode) return { tier, promoCode: null, listCents, discountCents: 0, totalCents: listCents };

  // Floored at zero: a discount that grew past the price would otherwise quote a
  // negative total, i.e. money the studio owes the customer. Same guard as
  // `effectiveRatePerPerson` on the banquet side.
  const discountCents = Math.min(TIER_DISCOUNT_CENTS[tier], listCents);
  return { tier, promoCode, listCents, discountCents, totalCents: listCents - discountCents };
}
