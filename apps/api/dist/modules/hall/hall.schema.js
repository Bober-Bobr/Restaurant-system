import { z } from 'zod';
export const createHallSchema = z.object({
    name: z.string().min(1).max(100),
    capacity: z.number().int().positive().max(5000),
    description: z.string().max(500).optional(),
    photoUrl: z.string().url().optional(),
    isActive: z.boolean().optional()
});
export const updateHallSchema = createHallSchema.partial();
export const hallIdSchema = z.object({
    id: z.string().cuid()
});
