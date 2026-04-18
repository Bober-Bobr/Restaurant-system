import { prisma } from '../../db/prisma.js';
export class RestaurantRepository {
    async findAllByOwner(ownerId) {
        return prisma.restaurant.findMany({
            where: { ownerId },
            orderBy: { createdAt: 'asc' }
        });
    }
    async findById(id) {
        return prisma.restaurant.findUnique({ where: { id } });
    }
    async findByStaffUserId(userId) {
        const user = await prisma.adminUser.findUnique({
            where: { id: userId },
            select: { restaurantId: true }
        });
        if (!user?.restaurantId)
            return null;
        return prisma.restaurant.findUnique({ where: { id: user.restaurantId } });
    }
    async create(ownerId, data) {
        return prisma.restaurant.create({ data: { ...data, ownerId } });
    }
    async update(id, data) {
        return prisma.restaurant.update({ where: { id }, data });
    }
    async delete(id) {
        return prisma.restaurant.delete({ where: { id } });
    }
}
