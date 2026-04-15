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

const packageItemsInclude = {
  packageItems: {
    include: {
      menuItem: {
        select: { id: true, name: true, description: true, category: true, priceCents: true, photoUrl: true }
      }
    }
  }
} as const;

export class TableCategoryRepository {
  async list(params: { skip: number; take: number }) {
    return prisma.tableCategory.findMany({
      ...params,
      orderBy: { name: 'asc' },
      include: packageItemsInclude
    });
  }

  async listActive() {
    return prisma.tableCategory.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      include: packageItemsInclude
    });
  }

  async count() {
    return prisma.tableCategory.count();
  }

  async create(payload: CreateTableCategoryData) {
    return prisma.tableCategory.create({
      data: payload,
      include: packageItemsInclude
    });
  }

  async updateById(id: string, payload: Prisma.TableCategoryUpdateInput) {
    return prisma.tableCategory.update({
      where: { id },
      data: payload,
      include: packageItemsInclude
    });
  }

  async setPackageItems(tableCategoryId: string, menuItemIds: string[]) {
    await prisma.tableCategoryMenuItem.deleteMany({ where: { tableCategoryId } });
    if (menuItemIds.length > 0) {
      await prisma.tableCategoryMenuItem.createMany({
        data: menuItemIds.map((menuItemId) => ({ tableCategoryId, menuItemId }))
      });
    }
    return prisma.tableCategory.findUnique({
      where: { id: tableCategoryId },
      include: packageItemsInclude
    });
  }

  async getById(id: string) {
    return prisma.tableCategory.findUnique({
      where: { id },
      include: packageItemsInclude
    });
  }

  async getByName(name: string) {
    return prisma.tableCategory.findUnique({ where: { name } });
  }

  async deleteById(id: string) {
    return prisma.tableCategory.delete({ where: { id } });
  }
}
