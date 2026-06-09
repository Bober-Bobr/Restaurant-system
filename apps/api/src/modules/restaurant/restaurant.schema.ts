import { z } from 'zod';

export const createRestaurantSchema = z.object({
  name: z.string().min(1).max(150),
  address: z.string().max(300).optional(),
  phone: z.string().max(60).optional().nullable(),
  email: z.string().max(160).optional().nullable(),
  history: z.string().max(5000).optional().nullable(),
  logoUrl: z.string().min(1).optional(),
  backgroundImageUrl: z.string().optional().nullable(),
  companyId: z.string().optional(),
});

export const updateRestaurantSchema = createRestaurantSchema.partial();
