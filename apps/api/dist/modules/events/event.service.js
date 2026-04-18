import createHttpError from 'http-errors';
export class EventService {
    eventRepository;
    constructor(eventRepository) {
        this.eventRepository = eventRepository;
    }
    mapEventToExternalId(event) {
        const { eventNumber, ...rest } = event;
        return { ...rest, id: eventNumber };
    }
    async listEvents(restaurantId, params) {
        const events = await this.eventRepository.list(restaurantId, params);
        return events.map((event) => this.mapEventToExternalId(event));
    }
    async createEvent(restaurantId, payload) {
        const event = await this.eventRepository.create(restaurantId, payload);
        return this.mapEventToExternalId(event);
    }
    async updateEvent(restaurantId, eventId, payload) {
        const existingEvent = await this.eventRepository.getByNumber(restaurantId, eventId);
        if (!existingEvent)
            throw createHttpError(404, 'Event not found');
        const updateData = {
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
        const updatedEvent = await this.eventRepository.updateByNumber(restaurantId, eventId, updateData);
        return this.mapEventToExternalId(updatedEvent);
    }
    async getEventDetails(restaurantId, eventId) {
        const event = await this.eventRepository.getByNumber(restaurantId, eventId);
        if (!event)
            throw createHttpError(404, 'Event not found');
        return this.mapEventToExternalId(event);
    }
    async deleteEvent(restaurantId, eventId) {
        const existingEvent = await this.eventRepository.getByNumber(restaurantId, eventId);
        if (!existingEvent)
            throw createHttpError(404, 'Event not found');
        await this.eventRepository.deleteByNumber(restaurantId, eventId);
    }
}
