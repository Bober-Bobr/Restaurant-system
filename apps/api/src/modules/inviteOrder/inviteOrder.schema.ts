import { z } from 'zod';
import { TIERS } from '../../utils/invitePromo.js';

// Submitted by an unauthenticated visitor on the promotional site, so every
// bound is explicit.
//
// NOTE WHAT IS NOT HERE: no price, no discount, no total. The browser names the
// category and (optionally) a code; what those are worth is decided by
// `quoteOrder` on this side. A public endpoint that accepted a price would let
// a visitor set their own — the same rule the food-service order flow follows,
// where the body carries ids and quantities only.
export const createInviteOrderSchema = z.object({
  name: z.string().min(1).max(120),
  phone: z.string().min(3).max(40),
  tier: z.enum(TIERS),
  // Absent, empty or a partner restaurant's code. Bounded well above the
  // longest real code so a typo gets the "not recognised" message rather than a
  // validation error that does not say which field is wrong.
  promoCode: z.string().max(60).optional().nullable(),
});

export type CreateInviteOrderInput = z.infer<typeof createInviteOrderSchema>;
