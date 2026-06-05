import { prisma } from '../../db/prisma.js';
export class CompanyRepository {
    async findAllByOwnerId(ownerId) {
        return prisma.company.findMany({
            where: { ownerId },
            orderBy: { createdAt: 'asc' },
        });
    }
    async findById(id) {
        return prisma.company.findUnique({ where: { id } });
    }
    async create(ownerId, data) {
        return prisma.company.create({ data: { ...data, ownerId } });
    }
    async update(id, data) {
        return prisma.company.update({ where: { id }, data });
    }
    async findAll() {
        return prisma.company.findMany({ orderBy: { createdAt: 'asc' } });
    }
    async findAllWithDetails() {
        return prisma.company.findMany({
            orderBy: { createdAt: 'asc' },
            include: {
                owner: { select: { id: true, username: true } },
                restaurants: { orderBy: { createdAt: 'asc' } },
            },
        });
    }
    async deleteById(id) {
        return prisma.company.delete({ where: { id } });
    }
}
