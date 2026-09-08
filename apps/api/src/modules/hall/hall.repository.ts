import { Prisma } from '@prisma/client';
import { prisma } from '../../db/prisma.js';
import type { Section } from '../../utils/section.js';

export type CreateHallData = {
  name: string;
  capacity: number;
  description?: string | null;
  photoUrl?: string | null;
  photos?: string[];
  isActive?: boolean;
};

/**
 * Halls belong to a restaurant AND to a section — Banquet or Small Banquets keep
 * separate rooms. `section` is a required argument on every read and write here
 * rather than an optional filter, so a caller cannot omit it and quietly get
 * both sections' halls back. See utils/section.ts.
 */
export class HallRepository {
  async list(restaurantId: string, section: Section, params?: { skip: number; take: number }) {
    return prisma.hall.findMany({ ...(params ?? {}), where: { restaurantId, section }, orderBy: { name: 'asc' } });
  }

  async listActive(restaurantId: string, section: Section) {
    return prisma.hall.findMany({ where: { restaurantId, section, isActive: true }, orderBy: { name: 'asc' } });
  }

  async count(restaurantId: string, section: Section) {
    return prisma.hall.count({ where: { restaurantId, section } });
  }

  async create(restaurantId: string, section: Section, payload: CreateHallData) {
    return prisma.hall.create({ data: { ...payload, restaurantId, section } });
  }

  async updateById(id: string, payload: Prisma.HallUpdateInput) {
    return prisma.hall.update({ where: { id }, data: payload });
  }

  async getById(id: string) {
    return prisma.hall.findUnique({ where: { id } });
  }

  async getByName(restaurantId: string, section: Section, name: string) {
    return prisma.hall.findFirst({ where: { restaurantId, section, name } });
  }

  async deleteById(id: string) {
    return prisma.hall.delete({ where: { id } });
  }
}
