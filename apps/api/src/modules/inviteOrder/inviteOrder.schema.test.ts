import { describe, expect, it } from 'vitest';
import { createInviteOrderSchema } from './inviteOrder.schema.js';

/**
 * What the promotional site's request form is actually allowed to send.
 *
 * The shape matters more here than in most places: this is a PUBLIC,
 * unauthenticated endpoint, so the schema is the only thing standing between a
 * stranger and the studio's Telegram inbox — and one field of it is deliberately
 * optional, which is exactly the kind of thing a later edit tightens back up
 * without noticing what it breaks.
 */
describe('a request from the price list', () => {
  const base = { name: 'Aziz', phone: '+998 90 123 45 67' };

  it('needs only a name and a phone number', () => {
    // THE RULE: the category is optional. A visitor who just wants to be rung
    // back must not have to decide what to spend first.
    const parsed = createInviteOrderSchema.parse(base);
    expect(parsed.tier).toBeUndefined();
  });

  it('accepts an explicit null category, which is what the form sends', () => {
    expect(createInviteOrderSchema.parse({ ...base, tier: null }).tier).toBeNull();
  });

  it('still refuses a request with no phone number', () => {
    // The one required field. Without it there is no way to answer the request
    // at all, so it is worth failing over.
    expect(() => createInviteOrderSchema.parse({ name: 'Aziz' })).toThrow();
    expect(() => createInviteOrderSchema.parse({ ...base, phone: '' })).toThrow();
  });

  it('refuses a category that is not one of the three', () => {
    expect(() => createInviteOrderSchema.parse({ ...base, tier: 'PLATINUM' })).toThrow();
  });

  it('takes each real category', () => {
    for (const tier of ['STANDARD', 'PREMIUM', 'LUXURY']) {
      expect(createInviteOrderSchema.parse({ ...base, tier }).tier).toBe(tier);
    }
  });

  it('carries no money at all', () => {
    /**
     * The body names a category and a code; what those are worth is decided by
     * `quoteOrder` on the server. If a price ever becomes accepted here, a
     * visitor can set their own — the same rule the food-service order flow
     * follows, where the body carries ids and quantities only.
     */
    const parsed = createInviteOrderSchema.parse({
      ...base, tier: 'LUXURY', totalCents: 1, discountCents: 999_999_00, listCents: 5,
    } as never) as Record<string, unknown>;
    for (const key of ['totalCents', 'discountCents', 'listCents']) {
      expect(parsed[key], `${key} reached the server from the browser`).toBeUndefined();
    }
  });

  it('accepts a promo code in any case, and lets the service judge it', () => {
    // Validity is `quoteOrder`'s job — the schema only bounds the length, so an
    // unrecognised code gets a message naming the code rather than a generic
    // "invalid body".
    expect(createInviteOrderSchema.parse({ ...base, promoCode: 'emir' }).promoCode).toBe('emir');
    expect(createInviteOrderSchema.parse({ ...base, promoCode: 'NOPE' }).promoCode).toBe('NOPE');
    expect(() => createInviteOrderSchema.parse({ ...base, promoCode: 'x'.repeat(61) })).toThrow();
  });
});
