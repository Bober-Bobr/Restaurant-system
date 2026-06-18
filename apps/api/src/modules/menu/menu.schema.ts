import { MenuCategory } from '@prisma/client';
import { z } from 'zod';

export const createMenuItemSchema = z.object({
  name: z.string().min(2).max(120),
  description: z.string().max(500).optional(),
  category: z.nativeEnum(MenuCategory),
  priceCents: z.number().int().positive().max(10000000000),
  photoUrl: z.string().min(1).optional(),
  isActive: z.boolean().optional(),
  showOnTablet: z.boolean().optional(),
  tabletStatus: z.enum(['NONE', 'FREE', 'PAID']).optional(),
  isBestseller: z.boolean().optional(),
  isOutOfStock: z.boolean().optional(),
  sortOrder: z.number().int().min(0).optional(),
  // Optional subcategory assignment (null clears it).
  subcategoryId: z.string().cuid().nullable().optional()
});

export const updateMenuItemSchema = createMenuItemSchema.partial();

export const arrangementSchema = z.object({
  categoryOrder: z.array(z.nativeEnum(MenuCategory)),
  dishOrder: z.array(z.object({
    id: z.string().cuid(),
    sortOrder: z.number().int().min(0)
  }))
});

export const settingsSchema = z.object({
  excludedCategories: z.array(z.nativeEnum(MenuCategory)),
  hideSubcategories: z.boolean().optional()
});

export const menuItemIdSchema = z.object({
  menuItemId: z.string().cuid()
});

export const assignSelectionSchema = z.object({
  menuItemId: z.string().cuid(),
  quantity: z.number().int().positive().max(1000)
});
