import { prisma } from '../../db/prisma.js';
export class HallRepository {
    async list(params) {
        return prisma.hall.findMany({
            ...params,
            orderBy: { name: 'asc' }
        });
    }
    async listActive() {
        return prisma.hall.findMany({
            where: { isActive: true },
            orderBy: { name: 'asc' }
        });
    }
    async count() {
        return prisma.hall.count();
    }
    async create(payload) {
        return prisma.hall.create({ data: payload });
    }
    async updateById(id, payload) {
        return prisma.hall.update({
            where: { id },
            data: payload
        });
    }
    async getById(id) {
        return prisma.hall.findUnique({ where: { id } });
    }
    async getByName(name) {
        return prisma.hall.findUnique({ where: { name } });
    }
    async deleteById(id) {
        return prisma.hall.delete({ where: { id } });
    }
}
