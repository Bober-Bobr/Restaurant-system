import { prisma } from '../../db/prisma.js';
export class HallRepository {
    async list(restaurantId, params) {
        return prisma.hall.findMany({ ...params, where: { restaurantId }, orderBy: { name: 'asc' } });
    }
    async listActive(restaurantId) {
        return prisma.hall.findMany({ where: { restaurantId, isActive: true }, orderBy: { name: 'asc' } });
    }
    async count(restaurantId) {
        return prisma.hall.count({ where: { restaurantId } });
    }
    async create(restaurantId, payload) {
        return prisma.hall.create({ data: { ...payload, restaurantId } });
    }
    async updateById(id, payload) {
        return prisma.hall.update({ where: { id }, data: payload });
    }
    async getById(id) {
        return prisma.hall.findUnique({ where: { id } });
    }
    async getByName(restaurantId, name) {
        return prisma.hall.findFirst({ where: { restaurantId, name } });
    }
    async deleteById(id) {
        return prisma.hall.delete({ where: { id } });
    }
}
