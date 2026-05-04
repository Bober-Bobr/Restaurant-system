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

  async listByOwner(ownerId: string) {
    const restaurants = await prisma.restaurant.findMany({
      where: { ownerId },
      select: { id: true }
    });
    const restaurantIds = restaurants.map((r) => r.id);
    return prisma.adminUser.findMany({
      where: { OR: [{ id: ownerId }, { restaurantId: { in: restaurantIds } }] },
      select: { id: true, username: true, role: true, restaurantId: true, createdAt: true },
      orderBy: { createdAt: 'asc' }
    });
  }

  async listByRestaurant(restaurantId: string) {
    const restaurant = await prisma.restaurant.findUnique({
      where: { id: restaurantId },
      select: { ownerId: true }
    });
    if (!restaurant) return [];
    return prisma.adminUser.findMany({
      where: { OR: [{ id: restaurant.ownerId }, { restaurantId }] },
      select: { id: true, username: true, role: true, restaurantId: true, createdAt: true },
      orderBy: { createdAt: 'asc' }
    });
  }

  async findByUsername(username: string) {
    return prisma.adminUser.findUnique({ where: { username } });
  }

  async findById(id: string) {
    return prisma.adminUser.findUnique({ where: { id } });
  }

  async create(username: string, passwordHash: string, role: AdminRole = AdminRole.OWNER, restaurantId?: string) {
    return prisma.adminUser.create({
      data: { username, passwordHash, role, ...(restaurantId ? { restaurantId } : {}) }
    });
  }

  async findRestaurantByName(name: string) {
    return prisma.restaurant.findFirst({
      where: { name: { equals: name, mode: 'insensitive' } }
    });
  }

  async findRestaurantById(id: string) {
    return prisma.restaurant.findUnique({ where: { id } });
  }

  async createAdminWithRestaurant(username: string, passwordHash: string, restaurantName: string) {
    return prisma.$transaction(async (tx) => {
      const user = await tx.adminUser.create({
        data: { username, passwordHash, role: AdminRole.ADMIN }
      });
      const restaurant = await tx.restaurant.create({
        data: { name: restaurantName, ownerId: user.id }
      });
      return tx.adminUser.update({
        where: { id: user.id },
        data: { restaurantId: restaurant.id }
      });
    });
  }

  async updateRefreshToken(userId: string, refreshTokenHash: string | null) {
    return prisma.adminUser.update({
      where: { id: userId },
      data: { refreshTokenHash }
    });
  }

  async updateRole(userId: string, role: AdminRole) {
    return prisma.adminUser.update({
      where: { id: userId },
      data: { role },
      select: { id: true, username: true, role: true }
    });
  }

  async deleteById(userId: string) {
    return prisma.adminUser.delete({ where: { id: userId } });
  }
}
