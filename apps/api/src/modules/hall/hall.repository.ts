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
  async list(params: { skip: number; take: number }) {
    return prisma.hall.findMany({
      ...params,
      orderBy: { name: 'asc' }
    });
  }

  async listActive() {
    return prisma.hall.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' }
    });
  }

  async count() {
    return prisma.hall.count();
  }

  async create(payload: CreateHallData) {
    return prisma.hall.create({ data: payload });
  }

  async updateById(id: string, payload: Prisma.HallUpdateInput) {
    return prisma.hall.update({
      where: { id },
      data: payload
    });
  }

  async getById(id: string) {
    return prisma.hall.findUnique({ where: { id } });
  }

  async getByName(name: string) {
    return prisma.hall.findUnique({ where: { name } });
  }

  async deleteById(id: string) {
    return prisma.hall.delete({ where: { id } });
  }
}
