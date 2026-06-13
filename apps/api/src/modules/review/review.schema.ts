import { z } from 'zod';

export const createReviewSchema = z.object({
  restaurantId: z.string().min(1).max(40),
  authorName: z.string().min(1).max(80),
  rating: z.number().int().min(1).max(5),
  text: z.string().max(1000).optional().nullable(),
  photoUrl: z.string().max(500).optional().nullable(),
});

export const setApprovedSchema = z.object({
  isApproved: z.boolean(),
});
