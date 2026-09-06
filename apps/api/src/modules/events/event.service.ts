import createHttpError from 'http-errors';
import { invoiceOutstandingCents } from '../../utils/invoice.js';
import { EventRepository, type CreateEventData } from './event.repository.js';
import { syncEventToLedger } from './event.ledgerSync.js';

export class EventService {
  constructor(private readonly eventRepository: EventRepository) {}

  /**
   * The shape the API hands out: the event number as `id`, and the two money
   * columns as plain numbers.
   *
   * `depositCents` and `EventPayment.amountCents` are BIGINT (see the schema —
   * a 32-bit tiyin column stops at 21 474 836 so'm), and Prisma hands a BigInt
   * column back as a JavaScript `bigint`. `JSON.stringify` throws outright on
   * one, so leaving them would turn every event response into a 500. A Number is
   * exact to 2^53 tiyin — ninety trillion so'm — so nothing is lost converting
   * at the boundary, and every caller keeps the `number` it already expected.
   */
  private mapEventToExternalId(event: any) {
    if (!event) return event;
    const { eventNumber, ...rest } = event;
    return {
      ...rest,
      id: eventNumber,
      depositCents: Number(rest.depositCents ?? 0),
      payments: Array.isArray(rest.payments)
        ? rest.payments.map((p: any) => ({ ...p, amountCents: Number(p.amountCents) }))
        : rest.payments,
    };
  }

  async listEvents(restaurantId: string, params?: { skip: number; take: number }) {
    const events = await this.eventRepository.list(restaurantId, params);
    return events.map((event) => this.mapEventToExternalId(event));
  }

  async createEvent(restaurantId: string, payload: CreateEventData) {
    const event = await this.eventRepository.create(restaurantId, payload);
    // Mirror the new event into the assigned restaurant manager's expense ledger
    // (morning → Nahor, afternoon → Fotiha, evening → Wedding). Best-effort.
    await syncEventToLedger(event);
    return this.mapEventToExternalId(event);
  }

  async updateEvent(restaurantId: string, eventId: number, payload: Partial<CreateEventData>) {
    const existingEvent = await this.eventRepository.getByNumber(restaurantId, eventId);
    if (!existingEvent) throw createHttpError(404, 'Event not found');

    const updateData: Record<string, any> = {
      customerName: payload.customerName,
      customerPhone: payload.customerPhone,
      secondCustomerName: payload.secondCustomerName,
      secondCustomerPhone: payload.secondCustomerPhone,
      eventDate: payload.eventDate,
      guestCount: payload.guestCount,
      depositCents: payload.depositCents,
      status: payload.status,
      eventType: payload.eventType,
      region: payload.region,
      notes: payload.notes,
      birthdayPersonName: payload.birthdayPersonName,
      brideName: payload.brideName,
      groomName: payload.groomName,
      honoreePersonName: payload.honoreePersonName
    };

    if (payload.hallId !== undefined) {
      updateData.hallId = payload.hallId || null;
    }
    if (payload.tableCategoryId !== undefined) {
      updateData.tableCategoryId = payload.tableCategoryId || null;
    }
    if (payload.childrenTableCategoryId !== undefined) {
      updateData.childrenTableCategoryId = payload.childrenTableCategoryId || null;
    }
    if (payload.childrenCount !== undefined) {
      updateData.childrenCount = payload.childrenCount;
    }
    if (payload.menuConfig !== undefined) {
      updateData.menuConfig = payload.menuConfig;
    }
    if (payload.debtDeadline !== undefined) {
      updateData.debtDeadline = payload.debtDeadline; // Date to set, null to clear
    }

    const updatedEvent = await this.eventRepository.updateByNumber(restaurantId, eventId, updateData);
    // Keep the manager's ledger in sync when details change (e.g. a blank event
    // is filled in after creation, or the guest count / date is edited).
    if (updatedEvent) await syncEventToLedger(updatedEvent);
    return this.mapEventToExternalId(updatedEvent);
  }

  // ── Partial (installment) payments ──

  async addPayment(restaurantId: string, eventId: number, amountCents: number, note?: string) {
    const event = await this.eventRepository.getByNumber(restaurantId, eventId);
    if (!event) throw createHttpError(404, 'Event not found');
    // A payment can never exceed what is left to pay. Without this an invoice
    // could be pushed past its total and sit at a negative balance — money the
    // restaurant appears to owe the customer, arrived at by a typo. The cap is
    // computed HERE, from the stored event, rather than trusted from the caller:
    // a client that reports its own total can raise its own limit.
    const outstanding = invoiceOutstandingCents(event);
    if (amountCents > outstanding) {
      throw createHttpError(
        400,
        outstanding === 0
          ? 'This invoice is already paid in full.'
          : `A payment cannot exceed the outstanding balance (${outstanding} tiyin).`,
      );
    }
    await this.eventRepository.addPayment(event.id, amountCents, note);
    const updated = await this.eventRepository.getByNumber(restaurantId, eventId);
    return this.mapEventToExternalId(updated);
  }

  async removePayment(restaurantId: string, eventId: number, paymentId: string) {
    const event = await this.eventRepository.getByNumber(restaurantId, eventId);
    if (!event) throw createHttpError(404, 'Event not found');
    await this.eventRepository.deletePayment(event.id, paymentId);
    const updated = await this.eventRepository.getByNumber(restaurantId, eventId);
    return this.mapEventToExternalId(updated);
  }

  async rescheduleEvent(restaurantId: string, eventId: number, newDate: Date) {
    const existingEvent = await this.eventRepository.getByNumber(restaurantId, eventId);
    if (!existingEvent) throw createHttpError(404, 'Event not found');

    // Preserve the ORIGINAL date across repeated reschedules: only capture it the
    // first time (when it hasn't been set yet), so we always show the true origin.
    const originalEventDate = existingEvent.originalEventDate ?? existingEvent.eventDate;

    const updatedEvent = await this.eventRepository.updateByNumber(restaurantId, eventId, {
      originalEventDate,
      eventDate: newDate
    });
    // A reschedule moves the event to a new date/slot — mirror it there too.
    if (updatedEvent) await syncEventToLedger(updatedEvent);
    return this.mapEventToExternalId(updatedEvent);
  }

  async getEventDetails(restaurantId: string, eventId: number) {
    const event = await this.eventRepository.getByNumber(restaurantId, eventId);
    if (!event) throw createHttpError(404, 'Event not found');
    return this.mapEventToExternalId(event);
  }

  async deleteEvent(restaurantId: string, eventId: number) {
    const existingEvent = await this.eventRepository.getByNumber(restaurantId, eventId);
    if (!existingEvent) throw createHttpError(404, 'Event not found');
    await this.eventRepository.deleteByNumber(restaurantId, eventId);
  }
}
