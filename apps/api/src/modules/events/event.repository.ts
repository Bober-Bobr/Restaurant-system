import { type EventStatus, type EventType, type Region, Prisma } from '@prisma/client';
import { prisma } from '../../db/prisma.js';

export type CreateEventData = {
  customerName: string;
  customerPhone?: string;
  eventDate: Date;
  guestCount: number;
  status?: EventStatus;
  eventType?: EventType;
  region?: Region;
  hallId?: string;
  tableCategoryId?: string;
  notes?: string;
};

export class EventRepository {
  async list(params: { skip: number; take: number }) {
    return prisma.event.findMany({
      ...params,
      orderBy: { eventDate: 'asc' },
      include: {
        hall: true,
        tableCategory: true
      }
    });
  }

  async create(payload: CreateEventData) {
    return prisma.event.create({
      data: payload,
      include: {
        hall: true,
        tableCategory: true,
        selections: {
          include: { menuItem: true }
        }
      }
    });
  }

  async updateById(eventId: string, payload: Prisma.EventUpdateInput) {
    return prisma.event.update({
      where: { id: eventId },
      data: payload,
      include: {
        hall: true,
        tableCategory: true,
        selections: {
          include: { menuItem: true }
        }
      }
    });
  }

  async getById(eventId: string) {
    return prisma.event.findUnique({
      where: { id: eventId },
      include: {
        hall: true,
        tableCategory: true,
        selections: {
          include: { menuItem: true }
        }
      }
    });
  }

  async deleteById(eventId: string) {
    return prisma.event.delete({ where: { id: eventId } });
  }
}
