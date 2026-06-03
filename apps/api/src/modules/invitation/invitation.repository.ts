import type { Prisma } from '@prisma/client';
import { prisma } from '../../db/prisma.js';

export class InvitationRepository {
  async findBySlug(slug: string) {
    return prisma.invitation.findUnique({
      where: { slug },
      include: {
        restaurant: { select: { id: true, name: true, logoUrl: true } },
      },
    });
  }

  async findById(id: string) {
    return prisma.invitation.findUnique({
      where: { id },
      include: {
        restaurant: { select: { id: true, name: true, logoUrl: true } },
        event: { select: { id: true, customerName: true, eventDate: true, eventType: true } },
      },
    });
  }

  async findByEventId(eventId: string) {
    return prisma.invitation.findUnique({
      where: { eventId },
      include: {
        restaurant: { select: { id: true, name: true, logoUrl: true } },
        event: { select: { id: true, customerName: true, eventDate: true, eventType: true } },
      },
    });
  }

  async listByRestaurant(restaurantId: string) {
    return prisma.invitation.findMany({
      where: { restaurantId },
      orderBy: { createdAt: 'desc' },
      include: {
        event: { select: { id: true, customerName: true, eventDate: true } },
      },
    });
  }

  async create(data: Prisma.InvitationUncheckedCreateInput) {
    return prisma.invitation.create({
      data,
      include: {
        restaurant: { select: { id: true, name: true, logoUrl: true } },
        event: { select: { id: true, customerName: true, eventDate: true } },
      },
    });
  }

  async update(id: string, data: Prisma.InvitationUncheckedUpdateInput) {
    return prisma.invitation.update({
      where: { id },
      data,
      include: {
        restaurant: { select: { id: true, name: true, logoUrl: true } },
        event: { select: { id: true, customerName: true, eventDate: true } },
      },
    });
  }

  async delete(id: string) {
    return prisma.invitation.delete({ where: { id } });
  }

  async existsSlug(slug: string, excludeId?: string) {
    const existing = await prisma.invitation.findUnique({ where: { slug } });
    if (!existing) return false;
    return existing.id !== excludeId;
  }
}
