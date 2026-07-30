import createHttpError from 'http-errors';
import { prisma } from '../../db/prisma.js';
import type { CreateInviteRequestInput } from './inviteRequest.schema.js';

export class InviteRequestService {
  async create(input: CreateInviteRequestInput) {
    const names = input.names.map((n) => n.trim()).filter(Boolean);
    if (names.length === 0) throw createHttpError(400, 'At least one name is required.');

    const eventDate = new Date(input.eventDate);
    if (Number.isNaN(eventDate.getTime())) throw createHttpError(400, 'Invalid event date.');

    return prisma.inviteRequest.create({
      data: {
        names,
        eventType: input.eventType.trim(),
        phone: input.phone.trim(),
        cardNumber: input.cardNumber?.trim() || null,
        restaurantName: input.restaurantName.trim(),
        eventDate,
        eventTime: input.eventTime.trim(),
        menu: input.menu?.trim() || null,
        photoUrl: input.photoUrl?.trim() || null,
        dressCode: input.dressCode?.trim() || null,
        restaurantId: input.restaurantId?.trim() || null,
        eventNumber: input.eventNumber ?? null,
      },
      select: { id: true, createdAt: true },
    });
  }

  async list() {
    return prisma.inviteRequest.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async unreadCount() {
    return prisma.inviteRequest.count({ where: { isRead: false } });
  }

  async setRead(id: string, isRead: boolean) {
    const existing = await prisma.inviteRequest.findUnique({ where: { id }, select: { id: true } });
    if (!existing) throw createHttpError(404, 'Request not found');
    return prisma.inviteRequest.update({ where: { id }, data: { isRead } });
  }

  async remove(id: string) {
    const existing = await prisma.inviteRequest.findUnique({ where: { id }, select: { id: true } });
    if (!existing) throw createHttpError(404, 'Request not found');
    await prisma.inviteRequest.delete({ where: { id } });
  }
}
