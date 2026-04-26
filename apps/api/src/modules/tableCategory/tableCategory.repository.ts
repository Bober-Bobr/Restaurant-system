import { Prisma } from '@prisma/client';
import { prisma } from '../../db/prisma.js';

export type CreateTableCategoryData = {
  name: string;
  includedCategories: string;
  ratePerPerson: number;
  description?: string;
  photoUrl?: string;
  photos?: string[];
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
  async list(restaurantId: string, params: { skip: number; take: number }) {
    return prisma.tableCategory.findMany({
      ...params,
      where: { restaurantId },
      orderBy: { name: 'asc' },
      include: packageItemsInclude
    });
  }

  async listActive(restaurantId: string) {
    return prisma.tableCategory.findMany({
      where: { restaurantId, isActive: true },
      orderBy: { name: 'asc' },
      include: packageItemsInclude
    });
  }

  async count(restaurantId: string) {
    return prisma.tableCategory.count({ where: { restaurantId } });
  }

  async create(restaurantId: string, payload: CreateTableCategoryData) {
    const { photos, ...rest } = payload;
    return prisma.tableCategory.create({
      data: { ...rest, photos: photos ?? [], restaurantId },
      include: packageItemsInclude
    });
  }

  async updateById(id: string, payload: Prisma.TableCategoryUpdateInput) {
    return prisma.tableCategory.update({ where: { id }, data: payload, include: packageItemsInclude });
  }

  async setPackageItems(tableCategoryId: string, menuItemIds: string[]) {
    await prisma.tableCategoryMenuItem.deleteMany({ where: { tableCategoryId } });
    if (menuItemIds.length > 0) {
      await prisma.tableCategoryMenuItem.createMany({
        data: menuItemIds.map((menuItemId) => ({ tableCategoryId, menuItemId }))
      });
    }
    return prisma.tableCategory.findUnique({ where: { id: tableCategoryId }, include: packageItemsInclude });
  }

  async getById(id: string) {
    return prisma.tableCategory.findUnique({ where: { id }, include: packageItemsInclude });
  }

  async getByName(restaurantId: string, name: string) {
    return prisma.tableCategory.findFirst({ where: { restaurantId, name } });
  }

  async deleteById(id: string) {
    return prisma.tableCategory.delete({ where: { id } });
  }
}
