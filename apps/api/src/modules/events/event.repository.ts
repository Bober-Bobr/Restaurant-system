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
        tableCategory: true,
        selections: {
          include: { menuItem: true }
        }
      }
    });
  }

  async create(payload: CreateEventData) {
    const lastEvent = await prisma.event.findFirst({
      orderBy: { eventNumber: 'desc' }
    });

    const nextEventNumber = lastEvent ? lastEvent.eventNumber + 1 : 1;

    return prisma.event.create({
      data: {
        ...payload,
        eventNumber: nextEventNumber
      },
      include: {
        hall: true,
        tableCategory: true,
        selections: {
          include: { menuItem: true }
        }
      }
    });
  }

  async updateByNumber(eventNumber: number, payload: Prisma.EventUpdateInput) {
    return prisma.event.update({
      where: { eventNumber },
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

  async getByNumber(eventNumber: number) {
    return prisma.event.findUnique({
      where: { eventNumber },
      include: {
        hall: true,
        tableCategory: true,
        selections: {
          include: { menuItem: true }
        }
      }
    });
  }

  async deleteByNumber(eventNumber: number) {
    return prisma.event.delete({ where: { eventNumber } });
  }
}
