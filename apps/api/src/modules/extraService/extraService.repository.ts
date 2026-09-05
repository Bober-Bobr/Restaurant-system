import { prisma } from '../../db/prisma.js';

export type CreateExtraServiceData = {
  name: string;
  description?: string | null;
  priceCents?: number;
  media?: string[];
  isActive?: boolean;
  sortOrder?: number;
};

export class ExtraServiceRepository {
  async list(restaurantId: string, params?: { skip: number; take: number }) {
    return prisma.extraService.findMany({
      ...(params ?? {}),
      where: { restaurantId },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  }

  async listActive(restaurantId: string) {
    return prisma.extraService.findMany({
      where: { restaurantId, isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  }

  async count(restaurantId: string) {
    return prisma.extraService.count({ where: { restaurantId } });
  }

  async create(restaurantId: string, payload: CreateExtraServiceData) {
    const { media, ...rest } = payload;
    return prisma.extraService.create({ data: { ...rest, media: media ?? [], restaurantId } });
  }

  async updateById(id: string, payload: Partial<CreateExtraServiceData>) {
    const { media, ...rest } = payload;
    return prisma.extraService.update({
      where: { id },
      data: media === undefined ? rest : { ...rest, media },
    });
  }

  async getById(id: string) {
    return prisma.extraService.findUnique({ where: { id } });
  }

  async deleteById(id: string) {
    return prisma.extraService.delete({ where: { id } });
  }
}
