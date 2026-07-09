import type { Prisma } from '@prisma/client';
import { prisma } from '../../db/prisma.js';

export class InvitationRepository {
  async findBySlug(slug: string) {
    return prisma.invitation.findUnique({
      where: { slug },
      include: {
        restaurant: { select: { id: true, name: true, logoUrl: true } },
        // eventDate feeds the auto-countdown on the public flyer.
        event: { select: { id: true, customerName: true, eventDate: true } },
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
        _count: { select: { requests: true } },
      },
    });
  }

  // ── Leads from the flyer "form" block ──
  async addRequest(invitationId: string, data: { name: string; phone: string; message?: string | null }) {
    return prisma.invitationRequest.create({ data: { ...data, invitationId } });
  }

  async listRequests(invitationId: string) {
    return prisma.invitationRequest.findMany({
      where: { invitationId },
      orderBy: { createdAt: 'desc' },
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

  // Events are externally identified by their per-restaurant `eventNumber` (int),
  // not their cuid `id`. The invitation FK is on `id`, so we resolve here.
  async resolveEventId(eventIdOrNumber: string | null | undefined, restaurantId: string): Promise<string | null> {
    if (!eventIdOrNumber) return null;
    const trimmed = String(eventIdOrNumber).trim();
    if (!trimmed) return null;
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
