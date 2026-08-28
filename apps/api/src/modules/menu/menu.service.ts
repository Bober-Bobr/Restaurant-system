import createHttpError from 'http-errors';
import { MenuCategory } from '@prisma/client';
import { EventRepository } from '../events/event.repository.js';
import { MenuRepository, type I18nMap } from './menu.repository.js';
import type { MenuScope } from '../../utils/excludedCategories.js';

export class MenuService {
  constructor(
    private readonly menuRepository: MenuRepository,
    private readonly eventRepository: EventRepository
  ) {}

  async listMenuItems(restaurantId: string, scope: MenuScope) {
    return this.menuRepository.listActive(restaurantId, scope);
  }

  async listAllMenuItems(restaurantId: string) {
    return this.menuRepository.listAll(restaurantId);
  }

  async createMenuItem(restaurantId: string, payload: {
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
    return this.menuRepository.create(restaurantId, payload);
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

  async saveSettings(
    restaurantId: string,
    payload: { excludedCategories?: Partial<Record<MenuScope, MenuCategory[]>>; hideSubcategories?: boolean },
  ) {
    const excludedCategories = await this.menuRepository.saveExcludedCategories(
      restaurantId,
      payload.excludedCategories ?? {},
    );
    const hideSubcategories = payload.hideSubcategories === undefined
      ? await this.menuRepository.getHideSubcategories(restaurantId)
      : await this.menuRepository.saveHideSubcategories(restaurantId, payload.hideSubcategories);
    return { excludedCategories, hideSubcategories };
  }

  async updateMenuItem(menuItemId: string, payload: {
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
    const existingItem = await this.menuRepository.getById(menuItemId);
    if (!existingItem) throw createHttpError(404, 'Menu item not found');
    return this.menuRepository.updateById(menuItemId, payload);
  }

  async deleteMenuItem(menuItemId: string) {
    const existingItem = await this.menuRepository.getById(menuItemId);
    if (!existingItem) throw createHttpError(404, 'Menu item not found');
    await this.menuRepository.deleteById(menuItemId);
  }

  async assignMenuItemToEvent(restaurantId: string, eventId: number, payload: { menuItemId: string; quantity: number }) {
    const [event, menuItem] = await Promise.all([
      this.eventRepository.getByNumber(restaurantId, eventId),
      this.menuRepository.getById(payload.menuItemId)
    ]);

    if (!event) throw createHttpError(404, 'Event not found');
    if (!menuItem || !menuItem.isActive) throw createHttpError(404, 'Menu item not found or inactive');

    return this.menuRepository.upsertSelection(event.id, payload.menuItemId, payload.quantity, menuItem.priceCents);
  }
}
