import { prisma } from '../../db/prisma.js';
import type { Section } from '../../utils/section.js';

export type CreateExtraServiceData = {
  name: string;
  description?: string | null;
  priceCents?: number;
  media?: string[];
  isActive?: boolean;
  sortOrder?: number;
};

/**
 * Extra services belong to a restaurant AND to a section — Banquet and Small
 * Banquets sell different add-ons. `section` is required on every read and write
 * so a caller cannot omit it and silently get both sections back.
 */
export class ExtraServiceRepository {
  async list(restaurantId: string, section: Section, params?: { skip: number; take: number }) {
    return prisma.extraService.findMany({
      ...(params ?? {}),
      where: { restaurantId, section },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  }

  async listActive(restaurantId: string, section: Section) {
    return prisma.extraService.findMany({
      where: { restaurantId, section, isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  }

  async count(restaurantId: string, section: Section) {
    return prisma.extraService.count({ where: { restaurantId, section } });
  }

  async create(restaurantId: string, section: Section, payload: CreateExtraServiceData) {
    const { media, ...rest } = payload;
    return prisma.extraService.create({ data: { ...rest, media: media ?? [], restaurantId, section } });
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
