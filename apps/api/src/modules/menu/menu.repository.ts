import { MenuCategory } from '@prisma/client';
import { prisma } from '../../db/prisma.js';
import {
  getExcludedCategories,
  getExcludedCategoriesBoth,
  getExcludedEverywhere,
  type ExcludedCategories,
  type MenuScope,
} from '../../utils/excludedCategories.js';

// Per-language overrides for a dish's name/description (any locale optional).
export type I18nMap = { en?: string; ru?: string; uz?: string };

export class MenuRepository {
  // The management view. It hides only what BOTH products have switched off —
  // a category still on the catering menu has to stay editable even once the
  // banquet side has dropped it, or its dishes are on sale and unreachable.
  async listAll(restaurantId: string) {
    const excluded = await getExcludedEverywhere(restaurantId);
    return prisma.menuItem.findMany({
      where: { restaurantId, category: { notIn: excluded } },
      orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }, { name: 'asc' }],
      include: { subcategory: { select: { id: true, name: true, category: true, sortOrder: true, hidden: true } } }
    });
  }

  // What a guest actually sees, and therefore scoped to one product.
  async listActive(restaurantId: string, scope: MenuScope) {
    const excluded = await getExcludedCategories(restaurantId, scope);
    return prisma.menuItem.findMany({
      where: { restaurantId, isActive: true, category: { notIn: excluded } },
      orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }, { name: 'asc' }],
      include: { subcategory: { select: { id: true, name: true, category: true, sortOrder: true, hidden: true } } }
    });
  }

  // Settings: both lists of switched-off dish categories.
  async getExcludedCategories(restaurantId: string): Promise<ExcludedCategories> {
    return getExcludedCategoriesBoth(restaurantId);
  }

  /**
   * Each scope is written only when the caller sent it. The Settings page edits
   * one product at a time and the Subcategories page sends neither, so a save
   * that always wrote both would clear the list the caller never saw.
   */
  async saveExcludedCategories(
    restaurantId: string,
    payload: Partial<Record<MenuScope, MenuCategory[]>>,
  ): Promise<ExcludedCategories> {
    const data: Record<string, string> = {};
    if (payload.banquet) data.excludedCategoriesBanquet = JSON.stringify(payload.banquet);
    if (payload.catering) data.excludedCategoriesCatering = JSON.stringify(payload.catering);
    if (Object.keys(data).length > 0) {
      await prisma.restaurant.update({ where: { id: restaurantId }, data });
    }
    return getExcludedCategoriesBoth(restaurantId);
  }

  // Master switch: hide all subcategories everywhere for this restaurant.
  async getHideSubcategories(restaurantId: string): Promise<boolean> {
    const row = await prisma.restaurant.findUnique({
      where: { id: restaurantId },
      select: { hideSubcategories: true },
    });
    return row?.hideSubcategories ?? false;
  }

  async saveHideSubcategories(restaurantId: string, value: boolean): Promise<boolean> {
    await prisma.restaurant.update({
      where: { id: restaurantId },
      data: { hideSubcategories: value },
    });
    return value;
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
    nameI18n?: I18nMap | null;
    descriptionI18n?: I18nMap | null;
    category: MenuCategory;
    priceCents: number;
    photoUrl?: string;
    isActive?: boolean;
    showOnTablet?: boolean;
    tabletStatus?: string;
    isBestseller?: boolean;
    isOutOfStock?: boolean;
    sortOrder?: number;
    subcategoryId?: string | null;
  }) {
    const { nameI18n, descriptionI18n, ...rest } = payload;
    return prisma.menuItem.create({
      data: {
        ...rest,
        restaurantId,
        ...(nameI18n != null ? { nameI18n } : {}),
        ...(descriptionI18n != null ? { descriptionI18n } : {}),
      },
    });
  }

  async getById(menuItemId: string) {
    return prisma.menuItem.findUnique({ where: { id: menuItemId } });
  }

  async updateById(menuItemId: string, payload: {
    name?: string;
    description?: string;
    nameI18n?: I18nMap | null;
    descriptionI18n?: I18nMap | null;
    category?: MenuCategory;
    priceCents?: number;
    photoUrl?: string;
    isActive?: boolean;
    showOnTablet?: boolean;
    tabletStatus?: string;
    isBestseller?: boolean;
    isOutOfStock?: boolean;
    sortOrder?: number;
    subcategoryId?: string | null;
  }) {
    const { nameI18n, descriptionI18n, ...rest } = payload;
    return prisma.menuItem.update({
      where: { id: menuItemId },
      data: {
        ...rest,
        ...(nameI18n != null ? { nameI18n } : {}),
        ...(descriptionI18n != null ? { descriptionI18n } : {}),
      },
    });
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
