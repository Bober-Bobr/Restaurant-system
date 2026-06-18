import { MenuCategory } from '@prisma/client';
import { prisma } from '../../db/prisma.js';

export type CreateSubcategoryData = {
  name: string;
  category: MenuCategory;
  sortOrder?: number;
  hidden?: boolean;
};

export class SubcategoryRepository {
  async listAll(restaurantId: string) {
    return prisma.menuSubcategory.findMany({
      where: { restaurantId },
      orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }, { name: 'asc' }]
    });
  }

  async create(restaurantId: string, data: CreateSubcategoryData) {
    return prisma.menuSubcategory.create({ data: { ...data, restaurantId } });
  }

  async getById(id: string) {
    return prisma.menuSubcategory.findUnique({ where: { id } });
  }

  async getByName(restaurantId: string, category: MenuCategory, name: string) {
    return prisma.menuSubcategory.findFirst({ where: { restaurantId, category, name } });
  }

  async updateById(id: string, data: Partial<CreateSubcategoryData>) {
    return prisma.menuSubcategory.update({ where: { id }, data });
  }

  async deleteById(id: string) {
    return prisma.menuSubcategory.delete({ where: { id } });
  }

  async saveArrangement(restaurantId: string, order: { id: string; sortOrder: number }[]) {
    await prisma.$transaction(
      order.map((o) =>
        prisma.menuSubcategory.updateMany({
          where: { id: o.id, restaurantId },
          data: { sortOrder: o.sortOrder }
        })
      )
    );
  }
}
