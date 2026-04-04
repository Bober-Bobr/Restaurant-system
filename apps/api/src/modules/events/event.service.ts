import createHttpError from 'http-errors';
import { EventRepository, type CreateEventData } from './event.repository.js';

export class EventService {
  constructor(private readonly eventRepository: EventRepository) {}

  private mapEventToExternalId(event: any) {
    const { eventNumber, ...rest } = event;
    return { ...rest, id: eventNumber };
  }

  async listEvents(params: { skip: number; take: number }) {
    const events = await this.eventRepository.list(params);
    return events.map((event) => this.mapEventToExternalId(event));
  }

  async createEvent(payload: CreateEventData) {
    const event = await this.eventRepository.create(payload);
    return this.mapEventToExternalId(event);
  }

  async updateEvent(eventId: number, payload: Partial<CreateEventData>) {
    const existingEvent = await this.eventRepository.getByNumber(eventId);

    if (!existingEvent) {
      throw createHttpError(404, 'Event not found');
    }

    const updateData: Record<string, any> = {
      customerName: payload.customerName,
      customerPhone: payload.customerPhone,
      eventDate: payload.eventDate,
      guestCount: payload.guestCount,
      status: payload.status,
      eventType: payload.eventType,
      region: payload.region,
      notes: payload.notes
    };

    if (payload.hallId !== undefined) {
      updateData.hall = payload.hallId ? { connect: { id: payload.hallId } } : { disconnect: true };
    }

    if (payload.tableCategoryId !== undefined) {
      updateData.tableCategory = payload.tableCategoryId
        ? { connect: { id: payload.tableCategoryId } }
        : { disconnect: true };
    }

    const updatedEvent = await this.eventRepository.updateByNumber(eventId, updateData);
    return this.mapEventToExternalId(updatedEvent);
  }

  async getEventDetails(eventId: number) {
    const event = await this.eventRepository.getByNumber(eventId);

    if (!event) {
      throw createHttpError(404, 'Event not found');
    }

    return this.mapEventToExternalId(event);
  }

  async deleteEvent(eventId: number) {
    const existingEvent = await this.eventRepository.getByNumber(eventId);

    if (!existingEvent) {
      throw createHttpError(404, 'Event not found');
    }

    await this.eventRepository.deleteByNumber(eventId);
  }
}
