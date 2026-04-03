import { getPagination } from '../../utils/http.js';
import { EventRepository } from './event.repository.js';
import { createEventSchema, eventIdSchema, updateEventSchema } from './event.schema.js';
import { EventService } from './event.service.js';
const eventService = new EventService(new EventRepository());
export class EventController {
    async list(request, response) {
        const pagination = getPagination(request);
        const events = await eventService.listEvents(pagination);
        response.json(events);
    }
    async create(request, response) {
        const payload = createEventSchema.parse(request.body);
        const event = await eventService.createEvent({
            ...payload,
            eventDate: new Date(payload.eventDate)
        });
        response.status(201).json(event);
    }
    async update(request, response) {
        const { eventId } = eventIdSchema.parse(request.params);
        const payload = updateEventSchema.parse(request.body);
        const event = await eventService.updateEvent(eventId, {
            ...payload,
            eventDate: payload.eventDate ? new Date(payload.eventDate) : undefined
        });
        response.json(event);
    }
    async getById(request, response) {
        const { eventId } = eventIdSchema.parse(request.params);
        const event = await eventService.getEventDetails(eventId);
        response.json(event);
    }
    async remove(request, response) {
        const { eventId } = eventIdSchema.parse(request.params);
        await eventService.deleteEvent(eventId);
        response.status(204).send();
    }
}
