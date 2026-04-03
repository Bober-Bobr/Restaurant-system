import { prisma } from '../../db/prisma.js';

export class AuthRepository {
  async countAdmins() {
    return prisma.adminUser.count();
  }

  async findByUsername(username: string) {
    return prisma.adminUser.findUnique({ where: { username } });
  }

  async findById(id: string) {
    return prisma.adminUser.findUnique({ where: { id } });
  }

  async create(username: string, passwordHash: string) {
    return prisma.adminUser.create({
      data: { username, passwordHash }
    });
  }

  async updateRefreshToken(userId: string, refreshTokenHash: string | null) {
    return prisma.adminUser.update({
      where: { id: userId },
      data: { refreshTokenHash }
    });
  }
}
