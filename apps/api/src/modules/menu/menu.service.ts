import createHttpError from 'http-errors';
import { MenuCategory } from '@prisma/client';
import { EventRepository } from '../events/event.repository.js';
import { MenuRepository, type I18nMap } from './menu.repository.js';
import { DISABLED_COLUMN, PRICE_COLUMN, type MenuScope } from '../../utils/excludedCategories.js';
import type { Section } from '../../utils/section.js';

export class MenuService {
  constructor(
    private readonly menuRepository: MenuRepository,
    private readonly eventRepository: EventRepository
  ) {}

  async listMenuItems(restaurantId: string, scope: MenuScope) {
    return this.menuRepository.listActive(restaurantId, scope);
  }

  async listAllMenuItems(restaurantId: string, scope: MenuScope) {
    return this.menuRepository.listAll(restaurantId, scope);
  }

  async listDishesForSettings(restaurantId: string, scope: MenuScope) {
    return this.menuRepository.listForSettings(restaurantId, scope);
  }

  async createMenuItem(restaurantId: string, scope: MenuScope, payload: {
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
    return this.menuRepository.create(restaurantId, scope, payload);
  }

  async saveArrangement(
    restaurantId: string,
    payload: { categoryOrder: MenuCategory[]; dishOrder: { id: string; sortOrder: number }[] }
  ) {
    await this.menuRepository.saveArrangement(restaurantId, payload.categoryOrder, payload.dishOrder);
    return { ok: true };
  }

  async getSettings(restaurantId: string) {
    return {
      excludedCategories: await this.menuRepository.getExcludedCategories(restaurantId),
      hideSubcategories: await this.menuRepository.getHideSubcategories(restaurantId),
    };
  }

  /**
   * `allowed` is the systems the CALLER may change — their own, from their
   * role; every one only for a platform role. A save naming another system's
   * list is refused outright, before anything is written: the golden rule is
   * that one system's settings cannot reach another's, and until now any role
   * with this page could send any product's list.
   */
  async saveSettings(
    restaurantId: string,
    allowed: MenuScope[],
    payload: {
      excludedCategories?: Partial<Record<MenuScope, MenuCategory[]>>;
      disabledDishes?: Partial<Record<MenuScope, string[]>>;
      hideSubcategories?: boolean;
    },
  ) {
    const named = [...Object.keys(payload.excludedCategories ?? {}), ...Object.keys(payload.disabledDishes ?? {})] as MenuScope[];
    const foreign = named.filter((scope) => !allowed.includes(scope));
    if (foreign.length) throw createHttpError(403, `Not your system's settings: ${foreign.join(', ')}`);

    const excludedCategories = await this.menuRepository.saveExcludedCategories(
      restaurantId,
      payload.excludedCategories ?? {},
    );
    for (const [scope, ids] of Object.entries(payload.disabledDishes ?? {}) as [MenuScope, string[]][]) {
      await this.menuRepository.saveDisabledDishes(restaurantId, scope, ids);
    }
    const hideSubcategories = payload.hideSubcategories === undefined
      ? await this.menuRepository.getHideSubcategories(restaurantId)
      : await this.menuRepository.saveHideSubcategories(restaurantId, payload.hideSubcategories);
    return { excludedCategories, hideSubcategories };
  }

  async updateMenuItem(restaurantId: string, scope: MenuScope, menuItemId: string, payload: {
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
    // The restaurant is checked too: the dish was looked up by id alone, so any
    // signed-in restaurant could edit another's dish by its id.
    const existingItem = await this.menuRepository.getById(menuItemId);
    if (!existingItem || existingItem.restaurantId !== restaurantId) throw createHttpError(404, 'Menu item not found');
    return this.menuRepository.updateById(menuItemId, scope, payload);
  }

  async deleteMenuItem(restaurantId: string, menuItemId: string) {
    const existingItem = await this.menuRepository.getById(menuItemId);
    if (!existingItem || existingItem.restaurantId !== restaurantId) throw createHttpError(404, 'Menu item not found');
    await this.menuRepository.deleteById(menuItemId);
  }

  // Section-scoped like every other event read: a supervisor attaching a dish
  // must not be able to reach a banquet booking by sending its number.
  async assignMenuItemToEvent(restaurantId: string, section: Section, eventId: number, payload: { menuItemId: string; quantity: number }) {
    const [event, menuItem] = await Promise.all([
      this.eventRepository.getByNumber(restaurantId, section, eventId),
      this.menuRepository.getById(payload.menuItemId)
    ]);

    if (!event) throw createHttpError(404, 'Event not found');
    // The event's own system decides the price, and whether the dish is on.
    const scope: MenuScope = section === 'SMALL_BANQUET' ? 'smallBanquet' : 'banquet';
    if (!menuItem || !menuItem.isActive || menuItem.restaurantId !== restaurantId || menuItem[DISABLED_COLUMN[scope]]) {
      throw createHttpError(404, 'Menu item not found or inactive');
    }

    return this.menuRepository.upsertSelection(event.id, payload.menuItemId, payload.quantity, menuItem[PRICE_COLUMN[scope]]);
  }
}
