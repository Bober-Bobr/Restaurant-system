import createHttpError from 'http-errors';
import { EventRepository, type CreateEventData } from './event.repository.js';

export class EventService {
  constructor(private readonly eventRepository: EventRepository) {}

  async listEvents(params: { skip: number; take: number }) {
    return this.eventRepository.list(params);
  }

  async createEvent(payload: CreateEventData) {
    return this.eventRepository.create(payload);
  }

  async updateEvent(eventId: string, payload: Partial<CreateEventData>) {
    const existingEvent = await this.eventRepository.getById(eventId);

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

    return this.eventRepository.updateById(eventId, updateData);
  }

  async getEventDetails(eventId: string) {
    const event = await this.eventRepository.getById(eventId);

    if (!event) {
      throw createHttpError(404, 'Event not found');
    }

    return event;
  }

  async deleteEvent(eventId: string) {
    const existingEvent = await this.eventRepository.getById(eventId);

    if (!existingEvent) {
      throw createHttpError(404, 'Event not found');
    }

    await this.eventRepository.deleteById(eventId);
  }
}
