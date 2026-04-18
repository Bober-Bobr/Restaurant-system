import { AdminRole } from '@prisma/client';
import { prisma } from '../../db/prisma.js';
export class AuthRepository {
    async countAdmins() {
        return prisma.adminUser.count();
    }
    async listAll() {
        return prisma.adminUser.findMany({
            select: { id: true, username: true, role: true, restaurantId: true, createdAt: true },
            orderBy: { createdAt: 'asc' }
        });
    }
    async listByRestaurant(restaurantId) {
        const restaurant = await prisma.restaurant.findUnique({
            where: { id: restaurantId },
            select: { ownerId: true }
        });
        if (!restaurant)
            return [];
        return prisma.adminUser.findMany({
            where: { OR: [{ id: restaurant.ownerId }, { restaurantId }] },
            select: { id: true, username: true, role: true, restaurantId: true, createdAt: true },
            orderBy: { createdAt: 'asc' }
        });
    }
    async findByUsername(username) {
        return prisma.adminUser.findUnique({ where: { username } });
    }
    async findById(id) {
        return prisma.adminUser.findUnique({ where: { id } });
    }
    async create(username, passwordHash, role = AdminRole.OWNER, restaurantId) {
        return prisma.adminUser.create({
            data: { username, passwordHash, role, ...(restaurantId ? { restaurantId } : {}) }
        });
    }
    async updateRefreshToken(userId, refreshTokenHash) {
        return prisma.adminUser.update({
            where: { id: userId },
            data: { refreshTokenHash }
        });
    }
    async updateRole(userId, role) {
        return prisma.adminUser.update({
            where: { id: userId },
            data: { role },
            select: { id: true, username: true, role: true }
        });
    }
    async deleteById(userId) {
        return prisma.adminUser.delete({ where: { id: userId } });
    }
}
