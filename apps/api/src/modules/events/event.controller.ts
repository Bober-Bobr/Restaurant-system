import type { Request, Response } from 'express';
import { getPagination } from '../../utils/http.js';
import { EventRepository } from './event.repository.js';
import { createEventSchema, eventIdSchema, updateEventSchema } from './event.schema.js';
import { EventService } from './event.service.js';

const eventService = new EventService(new EventRepository());

export class EventController {
  async list(request: Request, response: Response) {
    const restaurantId = request.restaurantId!;
    const pagination = getPagination(request);
    response.json(await eventService.listEvents(restaurantId, pagination));
  }

  async create(request: Request, response: Response) {
    const restaurantId = request.restaurantId!;
    const payload = createEventSchema.parse(request.body);
    const event = await eventService.createEvent(restaurantId, {
      ...payload,
      eventDate: new Date(payload.eventDate)
    });
    response.status(201).json(event);
  }

  async update(request: Request, response: Response) {
    const restaurantId = request.restaurantId!;
    const { eventId } = eventIdSchema.parse(request.params);
    const payload = updateEventSchema.parse(request.body);
    const event = await eventService.updateEvent(restaurantId, eventId, {
      ...payload,
      eventDate: payload.eventDate ? new Date(payload.eventDate) : undefined
    });
    response.json(event);
  }

  async getById(request: Request, response: Response) {
    const restaurantId = request.restaurantId!;
    const { eventId } = eventIdSchema.parse(request.params);
    response.json(await eventService.getEventDetails(restaurantId, eventId));
  }

  async remove(request: Request, response: Response) {
    const restaurantId = request.restaurantId!;
    const { eventId } = eventIdSchema.parse(request.params);
    await eventService.deleteEvent(restaurantId, eventId);
    response.status(204).send();
  }
}
