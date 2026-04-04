import { prisma } from '../../db/prisma.js';
export class EventRepository {
    async list(params) {
        return prisma.event.findMany({
            ...params,
            orderBy: { eventDate: 'asc' },
            include: {
                hall: true,
                tableCategory: true,
                selections: {
                    include: { menuItem: true }
                }
            }
        });
    }
    async create(payload) {
        const lastEvent = await prisma.event.findFirst({
            orderBy: { eventNumber: 'desc' }
        });
        const nextEventNumber = lastEvent ? lastEvent.eventNumber + 1 : 1;
        return prisma.event.create({
            data: {
                ...payload,
                eventNumber: nextEventNumber
            },
            include: {
                hall: true,
                tableCategory: true,
                selections: {
                    include: { menuItem: true }
                }
            }
        });
    }
    async updateByNumber(eventNumber, payload) {
        return prisma.event.update({
            where: { eventNumber },
            data: payload,
            include: {
                hall: true,
                tableCategory: true,
                selections: {
                    include: { menuItem: true }
                }
            }
        });
    }
    async getByNumber(eventNumber) {
        return prisma.event.findUnique({
            where: { eventNumber },
            include: {
                hall: true,
                tableCategory: true,
                selections: {
                    include: { menuItem: true }
                }
            }
        });
    }
    async deleteByNumber(eventNumber) {
        return prisma.event.delete({ where: { eventNumber } });
    }
}
