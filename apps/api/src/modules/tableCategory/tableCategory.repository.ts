import { Prisma } from '@prisma/client';
import { prisma } from '../../db/prisma.js';

export type CreateTableCategoryData = {
  name: string;
  includedCategories: string;
  ratePerPerson: number;
  discountPercent?: number;
  tableType?: string;
  description?: string;
  photoUrl?: string;
  photos?: string[];
  freeSubstitutionItemIds?: string[];
  isActive?: boolean;
};

const packageItemsInclude = {
  packageItems: {
    include: {
      menuItem: {
        select: { id: true, name: true, description: true, nameI18n: true, descriptionI18n: true, category: true, priceCents: true, photoUrl: true }
      }
    }
  }
} as const;

export class TableCategoryRepository {
  async list(restaurantId: string, params: { skip: number; take: number }) {
    return prisma.tableCategory.findMany({
      ...params,
      where: { restaurantId },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: packageItemsInclude
    });
  }

  async listActive(restaurantId: string) {
    return prisma.tableCategory.findMany({
      where: { restaurantId, isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: packageItemsInclude
    });
  }

  async listAll(restaurantId: string) {
    return prisma.tableCategory.findMany({
      where: { restaurantId },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: packageItemsInclude
    });
  }

  async saveArrangement(restaurantId: string, order: { id: string; sortOrder: number }[]) {
    await prisma.$transaction(
      order.map((item) =>
        prisma.tableCategory.updateMany({
          where: { id: item.id, restaurantId },
          data: { sortOrder: item.sortOrder },
        })
      )
    );
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

  async setPackageItems(tableCategoryId: string, items: { menuItemId: string; servings: number }[]) {
    await prisma.tableCategoryMenuItem.deleteMany({ where: { tableCategoryId } });
    if (items.length > 0) {
      await prisma.tableCategoryMenuItem.createMany({
        data: items.map(({ menuItemId, servings }) => ({ tableCategoryId, menuItemId, servings }))
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
