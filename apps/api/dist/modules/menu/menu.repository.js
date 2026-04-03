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
    async create(payload) {
        return prisma.menuItem.create({ data: payload });
    }
    async getById(menuItemId) {
        return prisma.menuItem.findUnique({ where: { id: menuItemId } });
    }
    async updateById(menuItemId, payload) {
        return prisma.menuItem.update({
            where: { id: menuItemId },
            data: payload
        });
    }
    async deleteById(menuItemId) {
        return prisma.menuItem.delete({ where: { id: menuItemId } });
    }
    async upsertSelection(eventId, menuItemId, quantity, unitPriceCents) {
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
