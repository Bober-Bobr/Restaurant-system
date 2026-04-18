import createHttpError from 'http-errors';
import { TableCategoryRepository, type CreateTableCategoryData } from './tableCategory.repository.js';

export class TableCategoryService {
  constructor(private readonly tableCategoryRepository: TableCategoryRepository) {}

  async listTableCategories(restaurantId: string, params: { skip: number; take: number }) {
    return this.tableCategoryRepository.list(restaurantId, params);
  }

  async countTableCategories(restaurantId: string) {
    return this.tableCategoryRepository.count(restaurantId);
  }

  async createTableCategory(restaurantId: string, payload: CreateTableCategoryData & { menuItemIds?: string[] }) {
    const { menuItemIds, ...data } = payload;
    const existing = await this.tableCategoryRepository.getByName(restaurantId, data.name);
    if (existing) throw createHttpError(409, 'Table category with this name already exists');

    const created = await this.tableCategoryRepository.create(restaurantId, data);
    if (menuItemIds && menuItemIds.length > 0) {
      return this.tableCategoryRepository.setPackageItems(created.id, menuItemIds);
    }
    return created;
  }

  async updateTableCategory(restaurantId: string, id: string, payload: Partial<CreateTableCategoryData> & { menuItemIds?: string[] }) {
    const { menuItemIds, ...data } = payload;
    const existing = await this.tableCategoryRepository.getById(id);
    if (!existing) throw createHttpError(404, 'Table category not found');

    if (data.name && data.name !== existing.name) {
      const nameTaken = await this.tableCategoryRepository.getByName(restaurantId, data.name);
      if (nameTaken) throw createHttpError(409, 'Table category with this name already exists');
    }

    if (menuItemIds !== undefined) {
      await this.tableCategoryRepository.setPackageItems(id, menuItemIds);
    }
    if (Object.keys(data).length > 0) {
      return this.tableCategoryRepository.updateById(id, data);
    }
    return this.tableCategoryRepository.getById(id);
  }

  async getTableCategoryDetails(id: string) {
    const category = await this.tableCategoryRepository.getById(id);
    if (!category) throw createHttpError(404, 'Table category not found');
    return category;
  }

  async deleteTableCategory(id: string) {
    const existing = await this.tableCategoryRepository.getById(id);
    if (!existing) throw createHttpError(404, 'Table category not found');
    await this.tableCategoryRepository.deleteById(id);
  }
}
