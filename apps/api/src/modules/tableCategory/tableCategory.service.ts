import createHttpError from 'http-errors';
import { TableCategoryRepository, type CreateTableCategoryData } from './tableCategory.repository.js';

type PackageItemInput = { menuItemId: string; servings: number };
type PackageItemsPayload = { menuItemIds?: string[]; packageItems?: PackageItemInput[] };

// Normalise either the preferred `packageItems` (with serving counts) or the
// legacy `menuItemIds` (servings default to 1) into a single shape. Returns
// `undefined` when neither was supplied so callers can skip the write.
function resolvePackageItems(payload: PackageItemsPayload): PackageItemInput[] | undefined {
  if (payload.packageItems !== undefined) {
    return payload.packageItems.map(({ menuItemId, servings }) => ({ menuItemId, servings: servings > 0 ? servings : 1 }));
  }
  if (payload.menuItemIds !== undefined) {
    return payload.menuItemIds.map((menuItemId) => ({ menuItemId, servings: 1 }));
  }
  return undefined;
}

export class TableCategoryService {
  constructor(private readonly tableCategoryRepository: TableCategoryRepository) {}

  async listTableCategories(restaurantId: string, params: { skip: number; take: number }) {
    return this.tableCategoryRepository.list(restaurantId, params);
  }

  async listAllTableCategories(restaurantId: string) {
    return this.tableCategoryRepository.listAll(restaurantId);
  }

  async saveArrangement(restaurantId: string, order: { id: string; sortOrder: number }[]) {
    await this.tableCategoryRepository.saveArrangement(restaurantId, order);
    return { ok: true };
  }

  async countTableCategories(restaurantId: string) {
    return this.tableCategoryRepository.count(restaurantId);
  }

  async createTableCategory(restaurantId: string, payload: CreateTableCategoryData & PackageItemsPayload) {
    const { menuItemIds, packageItems, ...data } = payload;
    const items = resolvePackageItems({ menuItemIds, packageItems });
    const existing = await this.tableCategoryRepository.getByName(restaurantId, data.name);
    if (existing) throw createHttpError(409, 'Table category with this name already exists');

    const created = await this.tableCategoryRepository.create(restaurantId, data);
    if (items && items.length > 0) {
      return this.tableCategoryRepository.setPackageItems(created.id, items);
    }
    return created;
  }

  async updateTableCategory(restaurantId: string, id: string, payload: Partial<CreateTableCategoryData> & PackageItemsPayload) {
    const { menuItemIds, packageItems, ...data } = payload;
    const items = resolvePackageItems({ menuItemIds, packageItems });
    const existing = await this.tableCategoryRepository.getById(id);
    if (!existing) throw createHttpError(404, 'Table category not found');

    if (data.name && data.name !== existing.name) {
      const nameTaken = await this.tableCategoryRepository.getByName(restaurantId, data.name);
      if (nameTaken) throw createHttpError(409, 'Table category with this name already exists');
    }

    if (items !== undefined) {
      await this.tableCategoryRepository.setPackageItems(id, items);
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
