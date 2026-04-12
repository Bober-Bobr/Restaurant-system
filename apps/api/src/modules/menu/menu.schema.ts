import { MenuCategory } from '@prisma/client';
import { z } from 'zod';

export const createMenuItemSchema = z.object({
  name: z.string().min(2).max(120),
  description: z.string().max(500).optional(),
  category: z.nativeEnum(MenuCategory),
  priceCents: z.number().int().positive().max(10000000),
  photoUrl: z.string().min(1).optional(),
  isActive: z.boolean().optional()
});

export const updateMenuItemSchema = createMenuItemSchema.partial();

export const menuItemIdSchema = z.object({
  menuItemId: z.string().cuid()
});

export const assignSelectionSchema = z.object({
  menuItemId: z.string().cuid(),
  quantity: z.number().int().positive().max(1000)
});
