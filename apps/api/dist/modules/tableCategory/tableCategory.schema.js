import { z } from 'zod';
export const createTableCategorySchema = z.object({
    name: z.string().min(1).max(100),
    includedCategories: z.string().max(500).optional().default(''),
    ratePerPerson: z.number().int().nonnegative().max(100000),
    description: z.string().max(500).optional(),
    photoUrl: z.string().min(1).optional(),
    isActive: z.boolean().optional()
});
export const updateTableCategorySchema = createTableCategorySchema.partial();
export const tableCategoryIdSchema = z.object({
    id: z.string().cuid()
});
