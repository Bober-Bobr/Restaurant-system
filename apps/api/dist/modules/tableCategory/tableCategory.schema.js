import { z } from 'zod';
export const createTableCategorySchema = z.object({
    name: z.string().min(1).max(100),
    seatingCapacity: z.number().int().positive().max(1000),
    mealPackage: z.string().min(1).max(200),
    ratePerPerson: z.number().int().nonnegative().max(100000),
    description: z.string().max(500).optional(),
    photoUrl: z.string().url().optional(),
    isActive: z.boolean().optional()
});
export const updateTableCategorySchema = createTableCategorySchema.partial();
export const tableCategoryIdSchema = z.object({
    id: z.string().cuid()
});
