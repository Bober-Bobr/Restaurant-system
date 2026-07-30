import { z } from 'zod';

const url = z.string().max(500);

export const updatePerformerProfileSchema = z.object({
  displayName: z.string().min(1).max(120).optional(),
  craft: z.string().max(80).optional().nullable(),
  bio: z.string().max(4000).optional().nullable(),
  phone: z.string().max(40).optional().nullable(),
  avatarUrl: url.optional().nullable(),
  photos: z.array(url).max(40).optional(),
  videos: z.array(url).max(20).optional(),
  isVisible: z.boolean().optional(),
});

export const performerEventSchema = z.object({
  // ISO date (yyyy-mm-dd) from the date input.
  eventDate: z.string().min(4).max(40),
  eventTime: z.string().min(1).max(20),
  title: z.string().min(1).max(200),
  note: z.string().max(4000).optional().nullable(),
});

export const updatePerformerEventSchema = performerEventSchema.partial();

// Raised from the public Additional Services page — every bound is explicit.
export const createPerformerBookingSchema = z.object({
  performerId: z.string().min(1).max(60),
  restaurantName: z.string().min(1).max(150),
  contactName: z.string().min(1).max(120),
  phone: z.string().min(3).max(40),
  eventDate: z.string().min(4).max(40),
  eventTime: z.string().min(1).max(20),
  eventType: z.string().max(40).optional().nullable(),
  note: z.string().max(4000).optional().nullable(),
  restaurantId: z.string().max(60).optional().nullable(),
  eventNumber: z.number().int().positive().optional().nullable(),
});

export const bookingDecisionSchema = z.object({
  status: z.enum(['ACCEPTED', 'DECLINED']),
});
