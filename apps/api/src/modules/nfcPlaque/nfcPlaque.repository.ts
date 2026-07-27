import type { Prisma } from '@prisma/client';
import { prisma } from '../../db/prisma.js';

export class NfcPlaqueRepository {
  // Builder-facing: the maker's own plaques, newest first.
  async listByCreator(createdById: string) {
    return prisma.nfcPlaque.findMany({
      where: { createdById },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async findById(id: string) {
    return prisma.nfcPlaque.findUnique({ where: { id } });
  }

  async findBySlug(slug: string) {
    return prisma.nfcPlaque.findUnique({ where: { slug } });
  }

  async create(data: Prisma.NfcPlaqueUncheckedCreateInput) {
    return prisma.nfcPlaque.create({ data });
  }

  async update(id: string, data: Prisma.NfcPlaqueUncheckedUpdateInput) {
    return prisma.nfcPlaque.update({ where: { id }, data });
  }

  async delete(id: string) {
    return prisma.nfcPlaque.delete({ where: { id } });
  }

  // True when the slug is taken by a DIFFERENT plaque.
  async slugTaken(slug: string, excludeId?: string) {
    const existing = await prisma.nfcPlaque.findUnique({ where: { slug }, select: { id: true } });
    if (!existing) return false;
    return existing.id !== excludeId;
  }
}
