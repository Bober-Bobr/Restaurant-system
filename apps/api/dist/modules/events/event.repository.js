import { prisma } from '../../db/prisma.js';
export class EventRepository {
    async list(params) {
        return prisma.event.findMany({
            ...params,
            orderBy: { eventDate: 'asc' },
            include: {
                hall: true,
                tableCategory: true
            }
        });
    }
    async create(payload) {
        return prisma.event.create({
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
    async updateById(eventId, payload) {
        return prisma.event.update({
            where: { id: eventId },
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
    async getById(eventId) {
        return prisma.event.findUnique({
            where: { id: eventId },
            include: {
                hall: true,
                tableCategory: true,
                selections: {
                    include: { menuItem: true }
                }
            }
        });
    }
    async deleteById(eventId) {
        return prisma.event.delete({ where: { id: eventId } });
    }
}
