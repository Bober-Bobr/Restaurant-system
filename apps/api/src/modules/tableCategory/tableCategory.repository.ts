import { Prisma } from '@prisma/client';
import { prisma } from '../../db/prisma.js';

export type CreateTableCategoryData = {
  name: string;
  includedCategories: string;
  ratePerPerson: number;
  description?: string;
  photoUrl?: string;
  isActive?: boolean;
};

export class TableCategoryRepository {
  async list(params: { skip: number; take: number }) {
    return prisma.tableCategory.findMany({
      ...params,
      orderBy: { name: 'asc' }
    });
  }

  async listActive() {
    return prisma.tableCategory.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' }
    });
  }

  async count() {
    return prisma.tableCategory.count();
  }

  async create(payload: CreateTableCategoryData) {
    return prisma.tableCategory.create({ data: payload });
  }

  async updateById(id: string, payload: Prisma.TableCategoryUpdateInput) {
    return prisma.tableCategory.update({
      where: { id },
      data: payload
    });
  }

  async getById(id: string) {
    return prisma.tableCategory.findUnique({ where: { id } });
  }

  async getByName(name: string) {
    return prisma.tableCategory.findUnique({ where: { name } });
  }

  async deleteById(id: string) {
    return prisma.tableCategory.delete({ where: { id } });
  }
}
