import { MenuCategory } from '@prisma/client';
import { prisma } from '../../db/prisma.js';
import { getExcludedCategories, parseExcludedCategories } from '../../utils/excludedCategories.js';

export class MenuRepository {
  async listAll(restaurantId: string) {
    const excluded = await getExcludedCategories(restaurantId);
    return prisma.menuItem.findMany({
      where: { restaurantId, category: { notIn: excluded } },
      orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }, { name: 'asc' }]
    });
  }

  async listActive(restaurantId: string) {
    const excluded = await getExcludedCategories(restaurantId);
    return prisma.menuItem.findMany({
      where: { restaurantId, isActive: true, category: { notIn: excluded } },
      orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }, { name: 'asc' }]
    });
  }

  // Settings: the list of dish categories the restaurant has hidden everywhere.
  async getExcludedCategories(restaurantId: string): Promise<MenuCategory[]> {
    return getExcludedCategories(restaurantId);
  }

  async saveExcludedCategories(restaurantId: string, categories: MenuCategory[]) {
    await prisma.restaurant.update({
      where: { id: restaurantId },
      data: { excludedCategories: JSON.stringify(categories) },
    });
    return parseExcludedCategories(JSON.stringify(categories));
  }

  // Persist the catering-site arrangement: the restaurant's category order plus
  // each dish's position within its category. Dish updates are scoped to the
  // restaurant so a client can't reorder another tenant's items.
  async saveArrangement(
    restaurantId: string,
    categoryOrder: string[],
    dishOrder: { id: string; sortOrder: number }[]
  ) {
    await prisma.$transaction([
      prisma.restaurant.update({
        where: { id: restaurantId },
        data: { categoryOrder: JSON.stringify(categoryOrder) },
      }),
      ...dishOrder.map((d) =>
        prisma.menuItem.updateMany({
          where: { id: d.id, restaurantId },
          data: { sortOrder: d.sortOrder },
        })
      ),
    ]);
  }

  async create(restaurantId: string, payload: {
    name: string;
    description?: string;
    category: MenuCategory;
    priceCents: number;
    photoUrl?: string;
    isActive?: boolean;
    showOnTablet?: boolean;
    tabletStatus?: string;
    isBestseller?: boolean;
    isOutOfStock?: boolean;
    sortOrder?: number;
  }) {
    return prisma.menuItem.create({ data: { ...payload, restaurantId } });
  }

  async getById(menuItemId: string) {
    return prisma.menuItem.findUnique({ where: { id: menuItemId } });
  }

  async updateById(menuItemId: string, payload: {
    name?: string;
    description?: string;
    category?: MenuCategory;
    priceCents?: number;
    photoUrl?: string;
    isActive?: boolean;
    showOnTablet?: boolean;
    tabletStatus?: string;
    isBestseller?: boolean;
    isOutOfStock?: boolean;
    sortOrder?: number;
  }) {
    return prisma.menuItem.update({ where: { id: menuItemId }, data: payload });
  }

  async deleteById(menuItemId: string) {
    return prisma.menuItem.delete({ where: { id: menuItemId } });
  }

  async upsertSelection(eventId: string, menuItemId: string, quantity: number, unitPriceCents: number) {
    return prisma.eventMenuSelection.upsert({
      where: { eventId_menuItemId: { eventId, menuItemId } },
      create: { eventId, menuItemId, quantity, unitPriceCents },
      update: { quantity, unitPriceCents }
    });
  }
}
