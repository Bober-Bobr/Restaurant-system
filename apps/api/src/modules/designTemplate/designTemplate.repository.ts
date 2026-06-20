import type { Prisma } from '@prisma/client';
import { prisma } from '../../db/prisma.js';

export class DesignTemplateRepository {
  listByOwner(ownerId: string, kind?: string) {
    return prisma.designTemplate.findMany({
      where: { ownerId, ...(kind ? { kind } : {}) },
      orderBy: { createdAt: 'desc' },
    });
  }

  findById(id: string) {
    return prisma.designTemplate.findUnique({ where: { id } });
  }

  create(data: Prisma.DesignTemplateUncheckedCreateInput) {
    return prisma.designTemplate.create({ data });
  }

  delete(id: string) {
    return prisma.designTemplate.delete({ where: { id } });
  }
}
