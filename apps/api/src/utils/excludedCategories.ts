import { MenuCategory } from '@prisma/client';
import { prisma } from '../db/prisma.js';

// Excluded categories are stored on Restaurant as a JSON array of MenuCategory
// names (e.g. ["SUSHI_ROLLS","ALCOHOL"]). Parse defensively.
export function parseExcludedCategories(raw: string | null | undefined): MenuCategory[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const valid = new Set(Object.values(MenuCategory) as string[]);
    return parsed.filter((c): c is MenuCategory => typeof c === 'string' && valid.has(c));
  } catch {
    return [];
  }
}

export async function getExcludedCategories(restaurantId: string): Promise<MenuCategory[]> {
  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    select: { excludedCategories: true },
  });
  return parseExcludedCategories(restaurant?.excludedCategories);
}
