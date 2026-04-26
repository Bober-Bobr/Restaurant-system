import { z } from 'zod';
export const createTableCategorySchema = z.object({
    name: z.string().min(1).max(100),
    includedCategories: z.string().max(500).optional().default(''),
    menuItemIds: z.array(z.string()).optional(),
    ratePerPerson: z.number().int().nonnegative(),
    description: z.string().max(500).optional(),
    photoUrl: z.string().min(1).optional(),
    photos: z.array(z.string()).optional(),
    isActive: z.boolean().optional()
});
export const updateTableCategorySchema = createTableCategorySchema.partial();
export const tableCategoryIdSchema = z.object({
    id: z.string().cuid()
});
