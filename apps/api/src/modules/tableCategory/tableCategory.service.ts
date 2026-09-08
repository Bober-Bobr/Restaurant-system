import createHttpError from 'http-errors';
import { TableCategoryRepository, type CreateTableCategoryData } from './tableCategory.repository.js';
import type { Section } from '../../utils/section.js';

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

  // A package fetched by id alone belongs to whichever section created it, and
  // the id is all the caller supplies on the detail/update/delete paths. 404
  // rather than 403 so the status code does not enumerate the other section's
  // ids — the same rule the restaurant scoping already follows.
  private async getInSection(id: string, section: Section) {
    const category = await this.tableCategoryRepository.getById(id);
    if (!category || category.section !== section) throw createHttpError(404, 'Table category not found');
    return category;
  }

  async listTableCategories(restaurantId: string, section: Section, params?: { skip: number; take: number }) {
    return this.tableCategoryRepository.list(restaurantId, section, params);
  }

  async listAllTableCategories(restaurantId: string, section: Section) {
    return this.tableCategoryRepository.listAll(restaurantId, section);
  }

  async saveArrangement(restaurantId: string, section: Section, order: { id: string; sortOrder: number }[]) {
    await this.tableCategoryRepository.saveArrangement(restaurantId, section, order);
    return { ok: true };
  }

  async countTableCategories(restaurantId: string, section: Section) {
    return this.tableCategoryRepository.count(restaurantId, section);
  }

  async createTableCategory(restaurantId: string, section: Section, payload: CreateTableCategoryData & PackageItemsPayload) {
    const { menuItemIds, packageItems, ...data } = payload;
    const items = resolvePackageItems({ menuItemIds, packageItems });
    const existing = await this.tableCategoryRepository.getByName(restaurantId, section, data.name);
    if (existing) throw createHttpError(409, 'Table category with this name already exists');

    const created = await this.tableCategoryRepository.create(restaurantId, section, data);
    if (items && items.length > 0) {
      return this.tableCategoryRepository.setPackageItems(created.id, items);
    }
    return created;
  }

  async updateTableCategory(restaurantId: string, section: Section, id: string, payload: Partial<CreateTableCategoryData> & PackageItemsPayload) {
    const { menuItemIds, packageItems, ...data } = payload;
    const items = resolvePackageItems({ menuItemIds, packageItems });
    const existing = await this.getInSection(id, section);

    if (data.name && data.name !== existing.name) {
      const nameTaken = await this.tableCategoryRepository.getByName(restaurantId, section, data.name);
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

  async getTableCategoryDetails(id: string, section: Section) {
    return this.getInSection(id, section);
  }

  async deleteTableCategory(id: string, section: Section) {
    await this.getInSection(id, section);
    await this.tableCategoryRepository.deleteById(id);
  }
}
