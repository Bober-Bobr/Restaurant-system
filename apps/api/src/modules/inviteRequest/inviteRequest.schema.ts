import { z } from 'zod';

// Submitted by an unauthenticated visitor, so every bound is explicit.
export const createInviteRequestSchema = z.object({
  // At least one honoree name; a wedding sends two. Blank entries are dropped
  // by the service before the count is checked.
  names: z.array(z.string().max(120)).min(1).max(6),
  eventType: z.string().min(1).max(40),
  phone: z.string().min(3).max(40),
  cardNumber: z.string().max(40).optional().nullable(),
  restaurantName: z.string().min(1).max(150),
  // ISO date (yyyy-mm-dd) from the date input.
  eventDate: z.string().min(4).max(40),
  eventTime: z.string().min(1).max(20),
  menu: z.string().max(4000).optional().nullable(),
  photoUrl: z.string().max(500).optional().nullable(),
  dressCode: z.string().max(500).optional().nullable(),
  // Provenance, when the form was opened from a confirmed banquet event.
  restaurantId: z.string().max(60).optional().nullable(),
  eventNumber: z.number().int().positive().optional().nullable(),
});

export type CreateInviteRequestInput = z.infer<typeof createInviteRequestSchema>;
