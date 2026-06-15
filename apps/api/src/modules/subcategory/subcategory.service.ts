import createHttpError from 'http-errors';
import { MenuCategory } from '@prisma/client';
import { SubcategoryRepository, type CreateSubcategoryData } from './subcategory.repository.js';

export class SubcategoryService {
  constructor(private readonly repo: SubcategoryRepository) {}

  listAll(restaurantId: string) {
    return this.repo.listAll(restaurantId);
  }

  async create(restaurantId: string, data: CreateSubcategoryData) {
    const existing = await this.repo.getByName(restaurantId, data.category, data.name);
    if (existing) throw createHttpError(409, 'Subcategory with this name already exists in this category');
    return this.repo.create(restaurantId, data);
  }

  async update(restaurantId: string, id: string, data: Partial<CreateSubcategoryData>) {
    const existing = await this.repo.getById(id);
    if (!existing) throw createHttpError(404, 'Subcategory not found');
    if (data.name) {
      const category = (data.category ?? existing.category) as MenuCategory;
      const taken = await this.repo.getByName(restaurantId, category, data.name);
      if (taken && taken.id !== id) {
        throw createHttpError(409, 'Subcategory with this name already exists in this category');
      }
    }
    return this.repo.updateById(id, data);
  }

  async remove(id: string) {
    const existing = await this.repo.getById(id);
    if (!existing) throw createHttpError(404, 'Subcategory not found');
    await this.repo.deleteById(id);
  }

  async saveArrangement(restaurantId: string, order: { id: string; sortOrder: number }[]) {
    await this.repo.saveArrangement(restaurantId, order);
    return { ok: true };
  }
}
