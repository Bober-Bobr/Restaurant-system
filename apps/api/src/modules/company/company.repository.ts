import { prisma } from '../../db/prisma.js';

export class CompanyRepository {
  async findByOwnerId(ownerId: string) {
    return prisma.company.findUnique({ where: { ownerId } });
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
}
