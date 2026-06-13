import { prisma } from '../../db/prisma.js';

export class ReviewRepository {
  async create(data: { restaurantId: string; authorName: string; rating: number; text?: string | null; photoUrl?: string | null }) {
    return prisma.review.create({ data });
  }

  // Public: only approved reviews for a restaurant.
  async listApproved(restaurantId: string) {
    return prisma.review.findMany({
      where: { restaurantId, isApproved: true },
      orderBy: { createdAt: 'desc' },
      select: { id: true, authorName: true, rating: true, text: true, photoUrl: true, createdAt: true },
    });
  }

  // Manager: every review for a restaurant (pending + approved).
  async listAll(restaurantId: string) {
    return prisma.review.findMany({
      where: { restaurantId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(id: string) {
    return prisma.review.findUnique({ where: { id } });
  }

  async setApproved(id: string, isApproved: boolean) {
    return prisma.review.update({ where: { id }, data: { isApproved } });
  }

  async delete(id: string) {
    return prisma.review.delete({ where: { id } });
  }
}
