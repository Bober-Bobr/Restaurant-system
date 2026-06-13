import { z } from 'zod';

export const createTableCategorySchema = z.object({
  name: z.string().min(1).max(100),
  includedCategories: z.string().max(500).optional().default(''),
  // Legacy: dish ids without per-table serving counts (defaults to 1 each).
  menuItemIds: z.array(z.string()).optional(),
  // Preferred: dishes with the number of servings provided per table.
  packageItems: z
    .array(z.object({ menuItemId: z.string(), servings: z.number().int().min(1).max(999) }))
    .optional(),
  ratePerPerson: z.number().int().nonnegative(),
  discountPercent: z.number().int().min(0).max(100).optional(),
  description: z.string().max(500).optional(),
  photoUrl: z.string().min(1).optional(),
  photos: z.array(z.string()).optional(),
  isActive: z.boolean().optional()
});

export const updateTableCategorySchema = createTableCategorySchema.partial();

export const tableCategoryIdSchema = z.object({
  id: z.string().cuid()
});
