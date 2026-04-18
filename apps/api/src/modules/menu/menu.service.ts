import createHttpError from 'http-errors';
import { MenuCategory } from '@prisma/client';
import { EventRepository } from '../events/event.repository.js';
import { MenuRepository } from './menu.repository.js';

export class MenuService {
  constructor(
    private readonly menuRepository: MenuRepository,
    private readonly eventRepository: EventRepository
  ) {}

  async listMenuItems(restaurantId: string) {
    return this.menuRepository.listActive(restaurantId);
  }

  async listAllMenuItems(restaurantId: string) {
    return this.menuRepository.listAll(restaurantId);
  }

  async createMenuItem(restaurantId: string, payload: {
    name: string;
    description?: string;
    category: MenuCategory;
    priceCents: number;
    photoUrl?: string;
    isActive?: boolean;
  }) {
    return this.menuRepository.create(restaurantId, payload);
  }

  async updateMenuItem(menuItemId: string, payload: {
    name?: string;
    description?: string;
    category?: MenuCategory;
    priceCents?: number;
    photoUrl?: string;
    isActive?: boolean;
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
