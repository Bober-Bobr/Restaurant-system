import { prisma } from '../../db/prisma.js';

export class CompanyRepository {
  async findAllByOwnerId(ownerId: string) {
    return prisma.company.findMany({
      where: { ownerId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async findById(id: string) {
    return prisma.company.findUnique({ where: { id } });
  }

  async create(ownerId: string, data: { name: string; logoUrl?: string }) {
    return prisma.company.create({ data: { ...data, ownerId } });
  }

  async update(id: string, data: { name?: string; logoUrl?: string }) {
    return prisma.company.update({ where: { id }, data });
  }

  async findAll() {
    return prisma.company.findMany({ orderBy: { createdAt: 'asc' } });
  }

  async findAllWithDetails() {
    return prisma.company.findMany({
      orderBy: { createdAt: 'asc' },
      include: {
        owner: { select: { id: true, username: true } },
        restaurants: { orderBy: { createdAt: 'asc' } },
      },
    });
  }

  async deleteById(id: string) {
    return prisma.company.delete({ where: { id } });
  }
}
