import { prisma } from '../../db/prisma.js';
export class AuthRepository {
    async countAdmins() {
        return prisma.adminUser.count();
    }
    async findByUsername(username) {
        return prisma.adminUser.findUnique({ where: { username } });
    }
    async findById(id) {
        return prisma.adminUser.findUnique({ where: { id } });
    }
    async create(username, passwordHash) {
        return prisma.adminUser.create({
            data: { username, passwordHash }
        });
    }
    async updateRefreshToken(userId, refreshTokenHash) {
        return prisma.adminUser.update({
            where: { id: userId },
            data: { refreshTokenHash }
        });
    }
}
