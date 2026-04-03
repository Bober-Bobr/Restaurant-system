import { MenuCategory } from '@prisma/client';
import { prisma } from '../../db/prisma.js';

export class MenuRepository {
  async listAll() {
    return prisma.menuItem.findMany({
      orderBy: [{ category: 'asc' }, { name: 'asc' }]
    });
  }

  async listActive() {
    return prisma.menuItem.findMany({
      where: { isActive: true },
      orderBy: [{ category: 'asc' }, { name: 'asc' }]
    });
  }

  async create(payload: {
    name: string;
    description?: string;
    category: MenuCategory;
    priceCents: number;
    photoUrl?: string;
    isActive?: boolean;
  }) {
    return prisma.menuItem.create({ data: payload });
  }

  async getById(menuItemId: string) {
    return prisma.menuItem.findUnique({ where: { id: menuItemId } });
  }

  async updateById(
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
    return prisma.menuItem.update({
      where: { id: menuItemId },
      data: payload
    });
  }

  async deleteById(menuItemId: string) {
    return prisma.menuItem.delete({ where: { id: menuItemId } });
  }

  async upsertSelection(eventId: string, menuItemId: string, quantity: number, unitPriceCents: number) {
    return prisma.eventMenuSelection.upsert({
      where: {
        eventId_menuItemId: {
          eventId,
          menuItemId
        }
      },
      create: {
        eventId,
        menuItemId,
        quantity,
        unitPriceCents
      },
      update: {
        quantity,
        unitPriceCents
      }
    });
  }
}
