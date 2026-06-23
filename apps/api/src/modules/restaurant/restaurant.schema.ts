import { z } from 'zod';

export const createRestaurantSchema = z.object({
  // Name is optional — a nameless restaurant inherits its company's name on create.
  name: z.string().max(150).optional(),
  address: z.string().max(300).optional(),
  phone: z.string().max(60).optional().nullable(),
  email: z.string().max(160).optional().nullable(),
  history: z.string().max(5000).optional().nullable(),
  logoUrl: z.string().min(1).optional(),
  backgroundImageUrl: z.string().optional().nullable(),
  companyId: z.string().optional(),
});

export const updateRestaurantSchema = createRestaurantSchema.partial();
