import { prisma } from '../../db/prisma.js';
const eventInclude = {
    hall: true,
    tableCategory: true,
    selections: { include: { menuItem: true } }
};
export class EventRepository {
    async list(restaurantId, params) {
        return prisma.event.findMany({
            ...params,
            where: { restaurantId },
            orderBy: { eventDate: 'asc' },
            include: eventInclude
        });
    }
    async create(restaurantId, payload) {
        const lastEvent = await prisma.event.findFirst({
            where: { restaurantId },
            orderBy: { eventNumber: 'desc' }
        });
        const nextEventNumber = lastEvent ? lastEvent.eventNumber + 1 : 1;
        return prisma.event.create({
            data: { ...payload, restaurantId, eventNumber: nextEventNumber },
            include: eventInclude
        });
    }
    async updateByNumber(restaurantId, eventNumber, payload) {
        await prisma.event.updateMany({ where: { eventNumber, restaurantId }, data: payload });
        return prisma.event.findFirst({ where: { eventNumber, restaurantId }, include: eventInclude });
    }
    async getByNumber(restaurantId, eventNumber) {
        return prisma.event.findFirst({
            where: { eventNumber, restaurantId },
            include: eventInclude
        });
    }
    async deleteByNumber(restaurantId, eventNumber) {
        return prisma.event.deleteMany({ where: { eventNumber, restaurantId } });
    }
}
