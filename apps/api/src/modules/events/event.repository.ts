import { type EventStatus, type EventType, type Region, Prisma } from '@prisma/client';
import { prisma } from '../../db/prisma.js';

export type CreateEventData = {
  customerName: string;
  customerPhone?: string;
  secondCustomerName?: string;
  secondCustomerPhone?: string;
  eventDate: Date;
  guestCount: number;
  depositCents?: number;
  debtDeadline?: Date | null;
  status?: EventStatus;
  eventType?: EventType;
  region?: Region;
  hallId?: string;
  tableCategoryId?: string;
  childrenTableCategoryId?: string;
  childrenCount?: number;
  menuConfig?: Prisma.InputJsonValue;
  notes?: string;
  birthdayPersonName?: string;
  brideName?: string;
  groomName?: string;
  honoreePersonName?: string;
};

const eventInclude = {
  hall: true,
  tableCategory: true,
  selections: { include: { menuItem: true } },
  payments: { orderBy: { createdAt: 'asc' } }
} as const;

export class EventRepository {
  async list(restaurantId: string, params: { skip: number; take: number }) {
    return prisma.event.findMany({
      ...params,
      where: { restaurantId },
      orderBy: { eventDate: 'asc' },
      include: eventInclude
    });
  }

  async create(restaurantId: string, payload: CreateEventData) {
    const lastEvent = await prisma.event.findFirst({
      where: { restaurantId },
      orderBy: { eventNumber: 'desc' }
    });
    const nextEventNumber = lastEvent ? lastEvent.eventNumber + 1 : 1;
    return prisma.event.create({
      data: { ...payload, restaurantId, eventNumber: nextEventNumber },
      include: eventInclude
    });
  }

  async updateByNumber(restaurantId: string, eventNumber: number, payload: Prisma.EventUncheckedUpdateManyInput) {
    await prisma.event.updateMany({ where: { eventNumber, restaurantId }, data: payload });
    return prisma.event.findFirst({ where: { eventNumber, restaurantId }, include: eventInclude });
  }

  async getByNumber(restaurantId: string, eventNumber: number) {
    return prisma.event.findFirst({
      where: { eventNumber, restaurantId },
      include: eventInclude
    });
  }

  async deleteByNumber(restaurantId: string, eventNumber: number) {
    return prisma.event.deleteMany({ where: { eventNumber, restaurantId } });
  }

  // ── Partial (installment) payments towards the event invoice ──

  async addPayment(eventId: string, amountCents: number, note?: string) {
    return prisma.eventPayment.create({ data: { eventId, amountCents, note } });
  }

  async deletePayment(eventId: string, paymentId: string) {
    // Scoped to the event so a payment can't be deleted through another event.
    return prisma.eventPayment.deleteMany({ where: { id: paymentId, eventId } });
  }
}
