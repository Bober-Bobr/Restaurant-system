import { Prisma } from '@prisma/client';
import { prisma } from '../../db/prisma.js';

export type CreateHallData = {
  name: string;
  capacity: number;
  description?: string;
  photoUrl?: string;
  isActive?: boolean;
};

export class HallRepository {
  async list(restaurantId: string, params: { skip: number; take: number }) {
    return prisma.hall.findMany({ ...params, where: { restaurantId }, orderBy: { name: 'asc' } });
  }

  async listActive(restaurantId: string) {
    return prisma.hall.findMany({ where: { restaurantId, isActive: true }, orderBy: { name: 'asc' } });
  }

  async count(restaurantId: string) {
    return prisma.hall.count({ where: { restaurantId } });
  }

  async create(restaurantId: string, payload: CreateHallData) {
    return prisma.hall.create({ data: { ...payload, restaurantId } });
  }

  async updateById(id: string, payload: Prisma.HallUpdateInput) {
    return prisma.hall.update({ where: { id }, data: payload });
  }

  async getById(id: string) {
    return prisma.hall.findUnique({ where: { id } });
  }

  async getByName(restaurantId: string, name: string) {
    return prisma.hall.findFirst({ where: { restaurantId, name } });
  }

  async deleteById(id: string) {
    return prisma.hall.delete({ where: { id } });
  }
}
