import createHttpError from 'http-errors';
export class TableCategoryService {
    tableCategoryRepository;
    constructor(tableCategoryRepository) {
        this.tableCategoryRepository = tableCategoryRepository;
    }
    async listTableCategories(params) {
        return this.tableCategoryRepository.list(params);
    }
    async countTableCategories() {
        return this.tableCategoryRepository.count();
    }
    async createTableCategory(payload) {
        const { menuItemIds, ...data } = payload;
        const existing = await this.tableCategoryRepository.getByName(data.name);
        if (existing) {
            throw createHttpError(409, 'Table category with this name already exists');
        }
        const created = await this.tableCategoryRepository.create(data);
        if (menuItemIds && menuItemIds.length > 0) {
            return this.tableCategoryRepository.setPackageItems(created.id, menuItemIds);
        }
        return created;
    }
    async updateTableCategory(id, payload) {
        const { menuItemIds, ...data } = payload;
        const existing = await this.tableCategoryRepository.getById(id);
        if (!existing) {
            throw createHttpError(404, 'Table category not found');
        }
        if (data.name && data.name !== existing.name) {
            const nameTaken = await this.tableCategoryRepository.getByName(data.name);
            if (nameTaken) {
                throw createHttpError(409, 'Table category with this name already exists');
            }
        }
        if (menuItemIds !== undefined) {
            await this.tableCategoryRepository.setPackageItems(id, menuItemIds);
        }
        if (Object.keys(data).length > 0) {
            return this.tableCategoryRepository.updateById(id, data);
        }
        return this.tableCategoryRepository.getById(id);
    }
    async getTableCategoryDetails(id) {
        const category = await this.tableCategoryRepository.getById(id);
        if (!category) {
            throw createHttpError(404, 'Table category not found');
        }
        return category;
    }
    async deleteTableCategory(id) {
        const existing = await this.tableCategoryRepository.getById(id);
        if (!existing) {
            throw createHttpError(404, 'Table category not found');
        }
        await this.tableCategoryRepository.deleteById(id);
    }
}
