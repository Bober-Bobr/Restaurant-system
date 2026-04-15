import { prisma } from '../../db/prisma.js';
const packageItemsInclude = {
    packageItems: {
        include: {
            menuItem: {
                select: { id: true, name: true, description: true, category: true, priceCents: true, photoUrl: true }
            }
        }
    }
};
export class TableCategoryRepository {
    async list(params) {
        return prisma.tableCategory.findMany({
            ...params,
            orderBy: { name: 'asc' },
            include: packageItemsInclude
        });
    }
    async listActive() {
        return prisma.tableCategory.findMany({
            where: { isActive: true },
            orderBy: { name: 'asc' },
            include: packageItemsInclude
        });
    }
    async count() {
        return prisma.tableCategory.count();
    }
    async create(payload) {
        return prisma.tableCategory.create({
            data: payload,
            include: packageItemsInclude
        });
    }
    async updateById(id, payload) {
        return prisma.tableCategory.update({
            where: { id },
            data: payload,
            include: packageItemsInclude
        });
    }
    async setPackageItems(tableCategoryId, menuItemIds) {
        await prisma.tableCategoryMenuItem.deleteMany({ where: { tableCategoryId } });
        if (menuItemIds.length > 0) {
            await prisma.tableCategoryMenuItem.createMany({
                data: menuItemIds.map((menuItemId) => ({ tableCategoryId, menuItemId }))
            });
        }
        return prisma.tableCategory.findUnique({
            where: { id: tableCategoryId },
            include: packageItemsInclude
        });
    }
    async getById(id) {
        return prisma.tableCategory.findUnique({
            where: { id },
            include: packageItemsInclude
        });
    }
    async getByName(name) {
        return prisma.tableCategory.findUnique({ where: { name } });
    }
    async deleteById(id) {
        return prisma.tableCategory.delete({ where: { id } });
    }
}
