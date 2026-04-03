import createHttpError from 'http-errors';
export class EventService {
    eventRepository;
    constructor(eventRepository) {
        this.eventRepository = eventRepository;
    }
    async listEvents(params) {
        return this.eventRepository.list(params);
    }
    async createEvent(payload) {
        return this.eventRepository.create(payload);
    }
    async updateEvent(eventId, payload) {
        const existingEvent = await this.eventRepository.getById(eventId);
        if (!existingEvent) {
            throw createHttpError(404, 'Event not found');
        }
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
        return this.eventRepository.updateById(eventId, updateData);
    }
    async getEventDetails(eventId) {
        const event = await this.eventRepository.getById(eventId);
        if (!event) {
            throw createHttpError(404, 'Event not found');
        }
        return event;
    }
    async deleteEvent(eventId) {
        const existingEvent = await this.eventRepository.getById(eventId);
        if (!existingEvent) {
            throw createHttpError(404, 'Event not found');
        }
        await this.eventRepository.deleteById(eventId);
    }
}
