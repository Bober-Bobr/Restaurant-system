import { Prisma } from '@prisma/client';
import { prisma } from '../../db/prisma.js';
import type { Section } from '../../utils/section.js';

export type CreateTableCategoryData = {
  name: string;
  includedCategories: string;
  ratePerPerson: number;
  discountPercent?: number;
  tableType?: string;
  eventType?: string;
  hotAppetizerCount?: number;
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
        select: { id: true, name: true, description: true, nameI18n: true, descriptionI18n: true, category: true, priceCents: true, photoUrl: true, isBestseller: true }
      }
    }
  }
} as const;

/**
 * Table packages belong to a restaurant AND to a section. They are the whole
 * commercial difference between Banquet and Small Banquets — a package IS the
 * price — so `section` is required on every read and write here rather than an
 * optional filter a caller could omit.
 */
export class TableCategoryRepository {
  async list(restaurantId: string, section: Section, params?: { skip: number; take: number }) {
    return prisma.tableCategory.findMany({
      ...(params ?? {}),
      where: { restaurantId, section },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: packageItemsInclude
    });
  }

  async listActive(restaurantId: string, section: Section) {
    return prisma.tableCategory.findMany({
      where: { restaurantId, section, isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: packageItemsInclude
    });
  }

  async listAll(restaurantId: string, section: Section) {
    return prisma.tableCategory.findMany({
      where: { restaurantId, section },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: packageItemsInclude
    });
  }

  // `updateMany` with the scope in the WHERE is what makes this safe: an id
  // from the other section matches nothing and is silently skipped, rather than
  // being reordered by a caller who cannot even see it.
  async saveArrangement(restaurantId: string, section: Section, order: { id: string; sortOrder: number }[]) {
    await prisma.$transaction(
      order.map((item) =>
        prisma.tableCategory.updateMany({
          where: { id: item.id, restaurantId, section },
          data: { sortOrder: item.sortOrder },
        })
      )
    );
  }

  async count(restaurantId: string, section: Section) {
    return prisma.tableCategory.count({ where: { restaurantId, section } });
  }

  async create(restaurantId: string, section: Section, payload: CreateTableCategoryData) {
    const { photos, ...rest } = payload;
    return prisma.tableCategory.create({
      data: { ...rest, photos: photos ?? [], restaurantId, section },
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

  async getByName(restaurantId: string, section: Section, name: string) {
    return prisma.tableCategory.findFirst({ where: { restaurantId, section, name } });
  }

  async deleteById(id: string) {
    return prisma.tableCategory.delete({ where: { id } });
  }
}
