import { describe, expect, it } from 'vitest';
import * as api from '../../../api/src/utils/invitePromo';
import * as web from './promo';
import { TIER_ORDER, TIER_PRICE_CENTS } from './pricing';

/**
 * The promo rule exists TWICE and the two copies must agree.
 *
 * The browser needs it to quote the discount as the code is typed; the server
 * needs it because the endpoint is public and unauthenticated, and a price a
 * browser posts is a price a browser chose. The API cannot import from the web
 * app, so the rule is duplicated — and this file is what makes that safe, the
 * same guard already standing over `toSubdomainSlug`, the invoice arithmetic
 * and the section rule.
 *
 * A drift here is not a crash. It is a form that shows a customer 450 000 and a
 * studio that is told 600 000, which is the kind of disagreement nobody notices
 * until someone argues about a bill.
 */
describe('the promo rule, on both sides', () => {
  it('knows the same codes', () => {
    expect([...web.PROMO_CODES].sort()).toEqual([...api.PROMO_CODES].sort());
  });

  it('lists each code once', () => {
    // A duplicate is harmless to the Set but means the list was edited twice,
    // and it is the kind of thing a sorted comparison above would hide.
    expect(new Set(api.PROMO_CODES).size).toBe(api.PROMO_CODES.length);
    expect(new Set(web.PROMO_CODES).size).toBe(web.PROMO_CODES.length);
  });

  it('writes every code in the canonical uppercase form', () => {
    // The studio's instruction, and what makes `normalizePromoCode` a fold to a
    // form that actually exists in the table rather than to an arbitrary case.
    for (const code of api.PROMO_CODES) expect(code).toBe(code.toUpperCase());
  });

  it('prices the categories identically', () => {
    // The web has ONE copy of this (pricing.ts, which the price list renders),
    // so this compares the shop window against what the server will quote.
    expect(TIER_PRICE_CENTS).toEqual(api.TIER_PRICE_CENTS);
    expect(web.TIER_DISCOUNT_CENTS).toEqual(api.TIER_DISCOUNT_CENTS);
  });

  it('orders the tiers the same way', () => {
    expect([...TIER_ORDER]).toEqual([...api.TIERS]);
  });

  it('quotes every tier and every code the same', () => {
    const inputs = [
      undefined, null, '', '   ',
      ...api.PROMO_CODES,
      // The forms input arrives in: lowercase from an autocorrecting keyboard,
      // padded by a paste, split by a thumb.
      'emir', '  Baxt  ', 'grand asli', 'PERY ',
    ];
    for (const tier of api.TIERS) {
      for (const code of inputs) {
        expect(web.quoteOrder(tier, code), `${tier} + ${JSON.stringify(code)}`)
          .toEqual(api.quoteOrder(tier, code));
      }
    }
  });

  it('refuses an unrecognised code on both sides', () => {
    // Quoting the full price instead would charge a customer more than the form
    // just showed them, which is the one outcome worth failing over.
    for (const bad of ['NOPE', 'EMIRR', 'EMI', 'PERY1', '0']) {
      expect(() => api.quoteOrder('STANDARD', bad), `api accepted ${bad}`).toThrow();
      expect(() => web.quoteOrder('STANDARD', bad), `web accepted ${bad}`).toThrow();
    }
  });
});

describe('what a promo customer actually pays', () => {
  /**
   * The three figures the studio stated, written out rather than computed.
   *
   * This is a tripwire, and the case it exists for is a LIST price being edited
   * later: the discounts would stay as they are and the advertised "with a code
   * you pay X" would quietly become something else. Computing the expectation
   * from the same two tables the code reads would assert nothing at all.
   */
  const STATED_FINAL: Record<api.OrderTier, number> = {
    STANDARD: 450_000_00,
    PREMIUM: 600_000_00,
    LUXURY: 1_100_000_00,
  };

  it('matches the prices the studio quoted', () => {
    for (const tier of api.TIERS) {
      expect(api.quoteOrder(tier, 'EMIR').totalCents, `${tier} with a code`).toBe(STATED_FINAL[tier]);
      expect(api.quoteOrder(tier).totalCents, `${tier} without one`).toBe(api.TIER_PRICE_CENTS[tier]);
    }
  });

  it('is the same discount whichever code was used', () => {
    // The code says which restaurant sent the customer; it does not change the
    // money. If that ever stops being true, the discount belongs beside the code.
    for (const tier of api.TIERS) {
      const amounts = new Set(api.PROMO_CODES.map((c) => api.quoteOrder(tier, c).discountCents));
      expect(amounts.size, `${tier} discounts vary by code`).toBe(1);
    }
  });

  it('keeps the money in tiyin', () => {
    for (const tier of api.TIERS) {
      expect(api.TIER_DISCOUNT_CENTS[tier] % 100, `${tier} discount is not a whole so'm`).toBe(0);
      // A discount typed in so'm would be a hundredth of itself and would look
      // like a rounding error rather than a bug.
      expect(api.TIER_DISCOUNT_CENTS[tier]).toBeGreaterThanOrEqual(100_000);
    }
  });

  it('never discounts a category below zero', () => {
    for (const tier of api.TIERS) {
      expect(api.quoteOrder(tier, 'PERY').totalCents).toBeGreaterThanOrEqual(0);
      expect(api.TIER_DISCOUNT_CENTS[tier]).toBeLessThan(api.TIER_PRICE_CENTS[tier]);
    }
  });
});
