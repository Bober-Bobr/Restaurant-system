import { prisma } from '../../db/prisma.js';
export class MenuRepository {
    async listAll(restaurantId) {
        return prisma.menuItem.findMany({
            where: { restaurantId },
            orderBy: [{ category: 'asc' }, { name: 'asc' }]
        });
    }
    async listActive(restaurantId) {
        return prisma.menuItem.findMany({
            where: { restaurantId, isActive: true },
            orderBy: [{ category: 'asc' }, { name: 'asc' }]
        });
    }
    async create(restaurantId, payload) {
        return prisma.menuItem.create({ data: { ...payload, restaurantId } });
    }
    async getById(menuItemId) {
        return prisma.menuItem.findUnique({ where: { id: menuItemId } });
    }
    async updateById(menuItemId, payload) {
        return prisma.menuItem.update({ where: { id: menuItemId }, data: payload });
    }
    async deleteById(menuItemId) {
        return prisma.menuItem.delete({ where: { id: menuItemId } });
    }
    async upsertSelection(eventId, menuItemId, quantity, unitPriceCents) {
        return prisma.eventMenuSelection.upsert({
            where: { eventId_menuItemId: { eventId, menuItemId } },
            create: { eventId, menuItemId, quantity, unitPriceCents },
            update: { quantity, unitPriceCents }
        });
    }
}
