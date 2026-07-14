import type { Prisma } from '@prisma/client';
import { prisma } from '../../db/prisma.js';

export class DesignTemplateRepository {
  listByOwner(ownerId: string, kind?: string) {
    return prisma.designTemplate.findMany({
      where: { ownerId, ...(kind ? { kind } : {}) },
      // Favorites pinned first, then newest.
      orderBy: [{ isFavorite: 'desc' }, { createdAt: 'desc' }],
    });
  }

  findById(id: string) {
    return prisma.designTemplate.findUnique({ where: { id } });
  }

  create(data: Prisma.DesignTemplateUncheckedCreateInput) {
    return prisma.designTemplate.create({ data });
  }

  update(id: string, data: Prisma.DesignTemplateUncheckedUpdateInput) {
    return prisma.designTemplate.update({ where: { id }, data });
  }

  delete(id: string) {
    return prisma.designTemplate.delete({ where: { id } });
  }
}
