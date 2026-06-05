import { prisma } from '../../db/prisma.js';
export class InvitationRepository {
    async findBySlug(slug) {
        return prisma.invitation.findUnique({
            where: { slug },
            include: {
                restaurant: { select: { id: true, name: true, logoUrl: true } },
            },
        });
    }
    async findById(id) {
        return prisma.invitation.findUnique({
            where: { id },
            include: {
                restaurant: { select: { id: true, name: true, logoUrl: true } },
                event: { select: { id: true, customerName: true, eventDate: true, eventType: true } },
            },
        });
    }
    async findByEventId(eventId) {
        return prisma.invitation.findUnique({
            where: { eventId },
            include: {
                restaurant: { select: { id: true, name: true, logoUrl: true } },
                event: { select: { id: true, customerName: true, eventDate: true, eventType: true } },
            },
        });
    }
    async listByRestaurant(restaurantId) {
        return prisma.invitation.findMany({
            where: { restaurantId },
            orderBy: { createdAt: 'desc' },
            include: {
                event: { select: { id: true, customerName: true, eventDate: true } },
            },
        });
    }
    async create(data) {
        return prisma.invitation.create({
            data,
            include: {
                restaurant: { select: { id: true, name: true, logoUrl: true } },
                event: { select: { id: true, customerName: true, eventDate: true } },
            },
        });
    }
    async update(id, data) {
        return prisma.invitation.update({
            where: { id },
            data,
            include: {
                restaurant: { select: { id: true, name: true, logoUrl: true } },
                event: { select: { id: true, customerName: true, eventDate: true } },
            },
        });
    }
    async delete(id) {
        return prisma.invitation.delete({ where: { id } });
    }
    async existsSlug(slug, excludeId) {
        const existing = await prisma.invitation.findUnique({ where: { slug } });
        if (!existing)
            return false;
        return existing.id !== excludeId;
    }
    // Events are externally identified by their per-restaurant `eventNumber` (int),
    // not their cuid `id`. The invitation FK is on `id`, so we resolve here.
    async resolveEventId(eventIdOrNumber, restaurantId) {
        if (!eventIdOrNumber)
            return null;
        const trimmed = String(eventIdOrNumber).trim();
        if (!trimmed)
            return null;
        const asInt = Number(trimmed);
        if (Number.isInteger(asInt) && asInt > 0) {
            const event = await prisma.event.findFirst({
                where: { eventNumber: asInt, restaurantId },
                select: { id: true },
            });
            return event?.id ?? null;
        }
        // Already a cuid (or some other id) — pass through.
        const event = await prisma.event.findUnique({ where: { id: trimmed }, select: { id: true } });
        return event?.id ?? null;
    }
}
