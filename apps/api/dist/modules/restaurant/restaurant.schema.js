import { z } from 'zod';
export const createRestaurantSchema = z.object({
    name: z.string().min(1).max(150),
    address: z.string().max(300).optional(),
    logoUrl: z.string().min(1).optional()
});
export const updateRestaurantSchema = createRestaurantSchema.partial();
