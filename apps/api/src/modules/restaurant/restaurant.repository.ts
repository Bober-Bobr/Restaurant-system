import { prisma } from '../../db/prisma.js';

export class RestaurantRepository {
  async findAllByOwner(ownerId: string) {
    return prisma.restaurant.findMany({
      where: { ownerId },
      orderBy: { createdAt: 'asc' }
    });
  }

  async findById(id: string) {
    return prisma.restaurant.findUnique({ where: { id } });
  }

  async findByStaffUserId(userId: string) {
    const user = await prisma.adminUser.findUnique({
      where: { id: userId },
      select: { restaurantId: true }
    });
    if (!user?.restaurantId) return null;
    return prisma.restaurant.findUnique({ where: { id: user.restaurantId } });
  }

  async create(ownerId: string, data: { name: string; address?: string; logoUrl?: string }) {
    return prisma.restaurant.create({ data: { ...data, ownerId } });
  }

  async update(id: string, data: { name?: string; address?: string; logoUrl?: string }) {
    return prisma.restaurant.update({ where: { id }, data });
  }

  async findAll() {
    return prisma.restaurant.findMany({ orderBy: { createdAt: 'asc' } });
  }

  async delete(id: string) {
    return prisma.restaurant.delete({ where: { id } });
  }
}
