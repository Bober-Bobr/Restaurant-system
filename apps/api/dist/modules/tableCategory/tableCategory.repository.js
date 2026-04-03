import { prisma } from '../../db/prisma.js';
export class TableCategoryRepository {
    async list(params) {
        return prisma.tableCategory.findMany({
            ...params,
            orderBy: { name: 'asc' }
        });
    }
    async listActive() {
        return prisma.tableCategory.findMany({
            where: { isActive: true },
            orderBy: { name: 'asc' }
        });
    }
    async count() {
        return prisma.tableCategory.count();
    }
    async create(payload) {
        return prisma.tableCategory.create({ data: payload });
    }
    async updateById(id, payload) {
        return prisma.tableCategory.update({
            where: { id },
            data: payload
        });
    }
    async getById(id) {
        return prisma.tableCategory.findUnique({ where: { id } });
    }
    async getByName(name) {
        return prisma.tableCategory.findUnique({ where: { name } });
    }
    async deleteById(id) {
        return prisma.tableCategory.delete({ where: { id } });
    }
}
