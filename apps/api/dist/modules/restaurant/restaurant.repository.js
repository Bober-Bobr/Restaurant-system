import { prisma } from '../../db/prisma.js';
export class RestaurantRepository {
    async findAllByOwner(ownerId) {
        return prisma.restaurant.findMany({
            where: { ownerId },
            orderBy: { createdAt: 'asc' },
            include: { company: { select: { id: true, name: true, logoUrl: true } } }
        });
    }
    async findById(id) {
        return prisma.restaurant.findUnique({
            where: { id },
            include: { company: { select: { id: true, name: true, logoUrl: true } } }
        });
    }
    async listAllPublic() {
        return prisma.restaurant.findMany({
            orderBy: { createdAt: 'asc' },
            select: {
                id: true,
                name: true,
                logoUrl: true,
                company: { select: { name: true, logoUrl: true } },
            },
        });
    }
    async findByStaffUserId(userId) {
        const user = await prisma.adminUser.findUnique({
            where: { id: userId },
            select: { restaurantId: true }
        });
        if (!user?.restaurantId)
            return null;
        return prisma.restaurant.findUnique({
            where: { id: user.restaurantId },
            include: { company: { select: { id: true, name: true, logoUrl: true } } }
        });
    }
    async create(ownerId, data) {
        return prisma.restaurant.create({ data: { ...data, ownerId } });
    }
    async update(id, data) {
        return prisma.restaurant.update({ where: { id }, data });
    }
    async findAll() {
        return prisma.restaurant.findMany({
            orderBy: { createdAt: 'asc' },
            include: { company: { select: { id: true, name: true, logoUrl: true } } }
        });
    }
    async delete(id) {
        return prisma.restaurant.delete({ where: { id } });
    }
}
