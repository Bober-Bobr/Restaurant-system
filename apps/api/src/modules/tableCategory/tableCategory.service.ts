import createHttpError from 'http-errors';
import { TableCategoryRepository, type CreateTableCategoryData } from './tableCategory.repository.js';

export class TableCategoryService {
  constructor(private readonly tableCategoryRepository: TableCategoryRepository) {}

  async listTableCategories(params: { skip: number; take: number }) {
    return this.tableCategoryRepository.list(params);
  }

  async countTableCategories() {
    return this.tableCategoryRepository.count();
  }

  async createTableCategory(payload: CreateTableCategoryData) {
    const existing = await this.tableCategoryRepository.getByName(payload.name);
    if (existing) {
      throw createHttpError(409, 'Table category with this name already exists');
    }

    return this.tableCategoryRepository.create(payload);
  }

  async updateTableCategory(id: string, payload: Partial<CreateTableCategoryData>) {
    const existing = await this.tableCategoryRepository.getById(id);

    if (!existing) {
      throw createHttpError(404, 'Table category not found');
    }

    if (payload.name && payload.name !== existing.name) {
      const nameTaken = await this.tableCategoryRepository.getByName(payload.name);
      if (nameTaken) {
        throw createHttpError(409, 'Table category with this name already exists');
      }
    }

    return this.tableCategoryRepository.updateById(id, payload);
  }

  async getTableCategoryDetails(id: string) {
    const category = await this.tableCategoryRepository.getById(id);

    if (!category) {
      throw createHttpError(404, 'Table category not found');
    }

    return category;
  }

  async deleteTableCategory(id: string) {
    const existing = await this.tableCategoryRepository.getById(id);

    if (!existing) {
      throw createHttpError(404, 'Table category not found');
    }

    await this.tableCategoryRepository.deleteById(id);
  }
}
