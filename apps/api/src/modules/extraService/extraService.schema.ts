import { z } from 'zod';

export const createExtraServiceSchema = z.object({
  name: z.string().min(1).max(150),
  description: z.string().max(2000).optional().nullable(),
  // Price in tiyin (1/100 so'm).
  priceCents: z.number().int().min(0).max(100_000_000_00).optional(),
  // Photo/video URLs served from /uploads.
  media: z.array(z.string()).max(30).optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().min(0).max(10_000).optional(),
});

export const updateExtraServiceSchema = createExtraServiceSchema.partial();

export const extraServiceIdSchema = z.object({
  id: z.string().cuid(),
});
