import { MenuCategory } from '@prisma/client';
import { prisma } from '../../db/prisma.js';
import {
  DISABLED_COLUMN,
  PRICE_COLUMN,
  getExcludedCategories,
  getExcludedCategoriesBoth,
  presentForScope,
  type ExcludedCategories,
  type MenuScope,
} from '../../utils/excludedCategories.js';

// Per-language overrides for a dish's name/description (any locale optional).
export type I18nMap = { en?: string; ru?: string; uz?: string };

export class MenuRepository {
  /**
   * The management view — the Menu, Additional, Table categories and Photos
   * pages — for ONE system: what that system switched off, by category or by
   * dish, is not on its pages.
   *
   * It used to hide only what EVERY product had switched off, so that a dish
   * still sold elsewhere stayed editable. That is what made switching a
   * category off for banquets look broken: the banquet pages went on showing
   * it. Each system now sees its own pages, and a dish another system still
   * sells stays editable THERE, by that system's admin; switching it back on is
   * the Settings page, which lists everything.
   */
  async listAll(restaurantId: string, scope: MenuScope) {
    const excluded = await getExcludedCategories(restaurantId, scope);
    const rows = await prisma.menuItem.findMany({
      where: { restaurantId, category: { notIn: excluded }, [DISABLED_COLUMN[scope]]: false },
      orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }, { name: 'asc' }],
      include: { subcategory: { select: { id: true, name: true, category: true, sortOrder: true, hidden: true } } }
    });
    return rows.map((row) => presentForScope(row, scope));
  }

  // What a guest actually sees, and therefore scoped to one product.
  async listActive(restaurantId: string, scope: MenuScope) {
    const excluded = await getExcludedCategories(restaurantId, scope);
    const rows = await prisma.menuItem.findMany({
      where: { restaurantId, isActive: true, category: { notIn: excluded }, [DISABLED_COLUMN[scope]]: false },
      orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }, { name: 'asc' }],
      include: { subcategory: { select: { id: true, name: true, category: true, sortOrder: true, hidden: true } } }
    });
    return rows.map((row) => presentForScope(row, scope));
  }

  /**
   * The Settings page's list: EVERY active dish, switched off or not, with this
   * system's switch — it is where a dish is switched back on, so hiding the
   * switched-off ones here would make that impossible.
   */
  async listForSettings(restaurantId: string, scope: MenuScope) {
    const rows = await prisma.menuItem.findMany({
      where: { restaurantId, isActive: true },
      orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }, { name: 'asc' }],
      select: {
        id: true, name: true, nameI18n: true, category: true, photoUrl: true,
        priceCents: true, priceCentsSmallBanquet: true, priceCentsCatering: true,
        disabledBanquet: true, disabledSmallBanquet: true, disabledCatering: true,
      },
    });
    return rows.map((row) => presentForScope(row, scope));
  }

  /**
   * One system's switched-off dishes, as a whole list: every dish of the
   * restaurant not named is switched back ON. Writes this system's column and
   * no other — the other systems' switches are not in the statement at all.
   */
  async saveDisabledDishes(restaurantId: string, scope: MenuScope, ids: string[]) {
    const column = DISABLED_COLUMN[scope];
    await prisma.$transaction([
      prisma.menuItem.updateMany({ where: { restaurantId, id: { notIn: ids } }, data: { [column]: false } }),
      prisma.menuItem.updateMany({ where: { restaurantId, id: { in: ids } }, data: { [column]: true } }),
    ]);
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
    if (payload.smallBanquet) data.excludedCategoriesSmallBanquet = JSON.stringify(payload.smallBanquet);
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

  /**
   * A new dish starts at the same price in every system — whoever created it
   * typed one figure — and from then on each system's price moves on its own.
   */
  async create(restaurantId: string, scope: MenuScope, payload: {
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
    const { nameI18n, descriptionI18n, priceCents, ...rest } = payload;
    const row = await prisma.menuItem.create({
      data: {
        ...rest,
        restaurantId,
        priceCents,
        priceCentsSmallBanquet: priceCents,
        priceCentsCatering: priceCents,
        ...(nameI18n != null ? { nameI18n } : {}),
        ...(descriptionI18n != null ? { descriptionI18n } : {}),
      },
    });
    return presentForScope(row, scope);
  }

  async getById(menuItemId: string) {
    return prisma.menuItem.findUnique({ where: { id: menuItemId } });
  }

  /**
   * A price in the payload is THIS system's price and lands in this system's
   * column only (PRICE_COLUMN). Everything else on the dish — its name, photo,
   * category — is the dish itself, shared by every system.
   */
  async updateById(menuItemId: string, scope: MenuScope, payload: {
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
    const { nameI18n, descriptionI18n, priceCents, ...rest } = payload;
    const row = await prisma.menuItem.update({
      where: { id: menuItemId },
      data: {
        ...rest,
        ...(priceCents !== undefined ? { [PRICE_COLUMN[scope]]: priceCents } : {}),
        ...(nameI18n != null ? { nameI18n } : {}),
        ...(descriptionI18n != null ? { descriptionI18n } : {}),
      },
    });
    return presentForScope(row, scope);
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
