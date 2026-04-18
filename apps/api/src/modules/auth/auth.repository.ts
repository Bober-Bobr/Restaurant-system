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
