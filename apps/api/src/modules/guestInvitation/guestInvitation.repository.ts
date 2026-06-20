import type { Prisma } from '@prisma/client';
import { prisma } from '../../db/prisma.js';

export class GuestInvitationRepository {
  // Manager-facing: their own invitations, newest first, with a response count.
  async listByCreator(createdById: string) {
    return prisma.guestInvitation.findMany({
      where: { createdById },
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { rsvps: true } } },
    });
  }

  async findById(id: string) {
    return prisma.guestInvitation.findUnique({ where: { id } });
  }

  async findBySlug(slug: string) {
    return prisma.guestInvitation.findUnique({ where: { slug } });
  }

  async create(data: Prisma.GuestInvitationUncheckedCreateInput) {
    return prisma.guestInvitation.create({ data });
  }

  async update(id: string, data: Prisma.GuestInvitationUncheckedUpdateInput) {
    return prisma.guestInvitation.update({ where: { id }, data });
  }

  async delete(id: string) {
    return prisma.guestInvitation.delete({ where: { id } });
  }

  async existsSlug(slug: string, excludeId?: string) {
    const existing = await prisma.guestInvitation.findUnique({ where: { slug }, select: { id: true } });
    if (!existing) return false;
    return existing.id !== excludeId;
  }

  // RSVPs
  async addRsvp(invitationId: string, data: { guestName: string; attending: boolean }) {
    return prisma.guestInvitationRsvp.create({ data: { ...data, invitationId } });
  }

  async listRsvps(invitationId: string) {
    return prisma.guestInvitationRsvp.findMany({
      where: { invitationId },
      orderBy: { createdAt: 'desc' },
    });
  }
}
