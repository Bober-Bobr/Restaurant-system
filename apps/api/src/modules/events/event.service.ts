import createHttpError from 'http-errors';
import { EventRepository, type CreateEventData } from './event.repository.js';

export class EventService {
  constructor(private readonly eventRepository: EventRepository) {}

  private mapEventToExternalId(event: any) {
    const { eventNumber, ...rest } = event;
    return { ...rest, id: eventNumber };
  }

  async listEvents(restaurantId: string, params: { skip: number; take: number }) {
    const events = await this.eventRepository.list(restaurantId, params);
    return events.map((event) => this.mapEventToExternalId(event));
  }

  async createEvent(restaurantId: string, payload: CreateEventData) {
    const event = await this.eventRepository.create(restaurantId, payload);
    return this.mapEventToExternalId(event);
  }

  async updateEvent(restaurantId: string, eventId: number, payload: Partial<CreateEventData>) {
    const existingEvent = await this.eventRepository.getByNumber(restaurantId, eventId);
    if (!existingEvent) throw createHttpError(404, 'Event not found');

    const updateData: Record<string, any> = {
      customerName: payload.customerName,
      customerPhone: payload.customerPhone,
      eventDate: payload.eventDate,
      guestCount: payload.guestCount,
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

    const updatedEvent = await this.eventRepository.updateByNumber(restaurantId, eventId, updateData);
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
