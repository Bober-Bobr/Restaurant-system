import createHttpError from 'http-errors';
import { MenuCategory } from '@prisma/client';
import { EventRepository } from '../events/event.repository.js';
import { MenuRepository } from './menu.repository.js';

export class MenuService {
  constructor(
    private readonly menuRepository: MenuRepository,
    private readonly eventRepository: EventRepository
  ) {}

  async listMenuItems() {
    return this.menuRepository.listActive();
  }

  async listAllMenuItems() {
    return this.menuRepository.listAll();
  }

  async createMenuItem(payload: {
    name: string;
    description?: string;
    category: MenuCategory;
    priceCents: number;
    photoUrl?: string;
    isActive?: boolean;
  }) {
    return this.menuRepository.create(payload);
  }

  async updateMenuItem(
    menuItemId: string,
    payload: {
      name?: string;
      description?: string;
      category?: MenuCategory;
      priceCents?: number;
      photoUrl?: string;
      isActive?: boolean;
    }
  ) {
    const existingItem = await this.menuRepository.getById(menuItemId);
    if (!existingItem) {
      throw createHttpError(404, 'Menu item not found');
    }

    return this.menuRepository.updateById(menuItemId, payload);
  }

  async deleteMenuItem(menuItemId: string) {
    const existingItem = await this.menuRepository.getById(menuItemId);
    if (!existingItem) {
      throw createHttpError(404, 'Menu item not found');
    }

    await this.menuRepository.deleteById(menuItemId);
  }

  async assignMenuItemToEvent(eventId: string, payload: { menuItemId: string; quantity: number }) {
    const [event, menuItem] = await Promise.all([
      this.eventRepository.getById(eventId),
      this.menuRepository.getById(payload.menuItemId)
    ]);

    if (!event) {
      throw createHttpError(404, 'Event not found');
    }

    if (!menuItem || !menuItem.isActive) {
      throw createHttpError(404, 'Menu item not found or inactive');
    }

    return this.menuRepository.upsertSelection(eventId, payload.menuItemId, payload.quantity, menuItem.priceCents);
  }
}
