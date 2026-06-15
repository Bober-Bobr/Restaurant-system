import { MenuCategory } from '@prisma/client';
import { z } from 'zod';

export const createSubcategorySchema = z.object({
  name: z.string().min(1).max(100),
  category: z.nativeEnum(MenuCategory),
  sortOrder: z.number().int().min(0).optional()
});

export const updateSubcategorySchema = createSubcategorySchema.partial();

export const subcategoryArrangementSchema = z.object({
  order: z.array(z.object({
    id: z.string().cuid(),
    sortOrder: z.number().int().min(0)
  }))
});

export const subcategoryIdSchema = z.object({
  id: z.string().cuid()
});
