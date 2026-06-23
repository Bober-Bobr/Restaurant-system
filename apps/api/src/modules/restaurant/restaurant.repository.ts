import { prisma } from '../../db/prisma.js';

export class RestaurantRepository {
  async findAllByOwner(ownerId: string) {
    return prisma.restaurant.findMany({
      where: { ownerId },
      orderBy: { createdAt: 'asc' },
      include: { company: { select: { id: true, name: true, logoUrl: true } } }
    });
  }

  async findById(id: string) {
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
        address: true,
        phone: true,
        email: true,
        history: true,
        logoUrl: true,
        backgroundImageUrl: true,
        categoryOrder: true,
        hideSubcategories: true,
        company: { select: { name: true, logoUrl: true } },
      },
    });
  }

  async findByStaffUserId(userId: string) {
    const user = await prisma.adminUser.findUnique({
      where: { id: userId },
      select: { restaurantId: true }
    });
    if (!user?.restaurantId) return null;
    return prisma.restaurant.findUnique({
      where: { id: user.restaurantId },
      include: { company: { select: { id: true, name: true, logoUrl: true } } }
    });
  }

  async create(ownerId: string, data: { name?: string; address?: string; logoUrl?: string; companyId?: string }) {
    let name = (data.name ?? '').trim();
    // A restaurant created without its own name takes on the company's name so it
    // is never blank in listings or the public site.
    if (!name && data.companyId) {
      const company = await prisma.company.findUnique({ where: { id: data.companyId }, select: { name: true } });
      name = company?.name ?? '';
    }
    return prisma.restaurant.create({ data: { ...data, name, ownerId } });
  }

  async update(id: string, data: { name?: string; address?: string; phone?: string | null; email?: string | null; history?: string | null; logoUrl?: string; backgroundImageUrl?: string | null }) {
    return prisma.restaurant.update({ where: { id }, data });
  }

  async findAll() {
    return prisma.restaurant.findMany({
      orderBy: { createdAt: 'asc' },
      include: { company: { select: { id: true, name: true, logoUrl: true } } }
    });
  }

  async delete(id: string) {
    return prisma.restaurant.delete({ where: { id } });
  }
}
