import { type EventStatus, type EventType, type Region, Prisma } from '@prisma/client';
import { prisma } from '../../db/prisma.js';
import type { Section } from '../../utils/section.js';

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

const CREATE_RETRIES = 5;

/**
 * A unique violation on the event number specifically — someone else took the
 * number between our read and our write. Any other unique violation (or any
 * other error) is a real fault and must not be retried away.
 */
export function isEventNumberCollision(error: unknown): boolean {
  const e = error as { code?: string; meta?: { target?: unknown } };
  if (e?.code !== 'P2002') return false;
  const target = e.meta?.target;
  const fields = Array.isArray(target) ? target : typeof target === 'string' ? [target] : [];
  return fields.some((f) => String(f).includes('eventNumber'));
}

const eventInclude = {
  hall: true,
  tableCategory: true,
  selections: { include: { menuItem: true } },
  payments: { orderBy: { createdAt: 'asc' } }
} as const;

/**
 * Events belong to a restaurant AND to a section — Banquet bookings and Small
 * Banquets bookings are separate books. Every read is filtered by both and every
 * write stamps the section.
 *
 * `eventNumber` is deliberately NOT re-sequenced per section: it stays unique
 * across the whole restaurant, so the number staff say out loud identifies one
 * booking in that venue. Two bookings both called "13" in one restaurant — one
 * per section — is an operational hazard, and the Chief Admin sees both books.
 */
export class EventRepository {
  // `params` undefined means every event this restaurant has, which is what all
  // six screens listing events actually need: they filter by month, map onto a
  // calendar, total invoices or count badges in the browser, and none of them
  // has a pager. A default page here returned the twenty EARLIEST events and
  // hid every booking made since — see getOptionalPagination.
  async list(restaurantId: string, section: Section, params?: { skip: number; take: number }) {
    return prisma.event.findMany({
      ...(params ?? {}),
      where: { restaurantId, section },
      orderBy: { eventDate: 'asc' },
      include: eventInclude
    });
  }

  async create(restaurantId: string, section: Section, payload: CreateEventData) {
    // The next number is read, then written, so two people booking at the same
    // desk in the same second can both compute it. Postgres refuses the second
    // insert (the number is unique within the restaurant) — take the next one
    // and try again rather than showing a receptionist a failure they cannot
    // act on. Bounded, so a genuinely broken constraint still surfaces.
    for (let attempt = 0; attempt < CREATE_RETRIES; attempt += 1) {
      // Across the WHOLE restaurant, not just this section — see the note on
      // the class. The unique constraint is [restaurantId, eventNumber], so
      // counting within one section would collide with the other's numbers on
      // every insert and burn all the retries below.
      const lastEvent = await prisma.event.findFirst({
        where: { restaurantId },
        orderBy: { eventNumber: 'desc' }
      });
      const nextEventNumber = lastEvent ? lastEvent.eventNumber + 1 : 1;
      try {
        return await prisma.event.create({
          data: { ...payload, restaurantId, section, eventNumber: nextEventNumber },
          include: eventInclude
        });
      } catch (error) {
        if (!isEventNumberCollision(error) || attempt === CREATE_RETRIES - 1) throw error;
      }
    }
    // Unreachable: the loop either returns or rethrows on its last attempt.
    throw new Error('Failed to allocate an event number');
  }

  async updateByNumber(restaurantId: string, section: Section, eventNumber: number, payload: Prisma.EventUncheckedUpdateManyInput) {
    await prisma.event.updateMany({ where: { eventNumber, restaurantId, section }, data: payload });
    return prisma.event.findFirst({ where: { eventNumber, restaurantId, section }, include: eventInclude });
  }

  async getByNumber(restaurantId: string, section: Section, eventNumber: number) {
    return prisma.event.findFirst({
      where: { eventNumber, restaurantId, section },
      include: eventInclude
    });
  }

  async deleteByNumber(restaurantId: string, section: Section, eventNumber: number) {
    return prisma.event.deleteMany({ where: { eventNumber, restaurantId, section } });
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
