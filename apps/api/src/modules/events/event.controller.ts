import type { Request, Response } from 'express';
import { getOptionalPagination } from '../../utils/http.js';
import { EventRepository } from './event.repository.js';
import { addPaymentSchema, createEventSchema, eventIdSchema, paymentIdSchema, rescheduleEventSchema, updateEventSchema } from './event.schema.js';
import { EventService } from './event.service.js';

const eventService = new EventService(new EventRepository());

export class EventController {
  async list(request: Request, response: Response) {
    const restaurantId = request.restaurantId!;
    // No page asked for means the whole set: every screen that lists events
    // holds the complete list and filters it in the browser.
    response.json(await eventService.listEvents(restaurantId, getOptionalPagination(request)));
  }

  async create(request: Request, response: Response) {
    const restaurantId = request.restaurantId!;
    const payload = createEventSchema.parse(request.body);
    // A blank event is allowed: fall back to safe defaults for the required columns.
    const event = await eventService.createEvent(restaurantId, {
      ...payload,
      customerName: payload.customerName ?? '',
      guestCount: payload.guestCount ?? 0,
      eventDate: payload.eventDate ? new Date(payload.eventDate) : new Date()
    });
    response.status(201).json(event);
  }

  async update(request: Request, response: Response) {
    const restaurantId = request.restaurantId!;
    const { eventId } = eventIdSchema.parse(request.params);
    const payload = updateEventSchema.parse(request.body);
    const event = await eventService.updateEvent(restaurantId, eventId, {
      ...payload,
      eventDate: payload.eventDate ? new Date(payload.eventDate) : undefined,
      // ISO string → Date to set; null passes through to clear the deadline.
      debtDeadline: payload.debtDeadline === undefined
        ? undefined
        : (payload.debtDeadline ? new Date(payload.debtDeadline) : null)
    });
    response.json(event);
  }

  async addPayment(request: Request, response: Response) {
    const restaurantId = request.restaurantId!;
    const { eventId } = eventIdSchema.parse(request.params);
    const { amountCents, note } = addPaymentSchema.parse(request.body);
    const event = await eventService.addPayment(restaurantId, eventId, amountCents, note);
    response.status(201).json(event);
  }

  async removePayment(request: Request, response: Response) {
    const restaurantId = request.restaurantId!;
    const { eventId, paymentId } = paymentIdSchema.parse(request.params);
    const event = await eventService.removePayment(restaurantId, eventId, paymentId);
    response.json(event);
  }

  async reschedule(request: Request, response: Response) {
    const restaurantId = request.restaurantId!;
    const { eventId } = eventIdSchema.parse(request.params);
    const { eventDate } = rescheduleEventSchema.parse(request.body);
    const event = await eventService.rescheduleEvent(restaurantId, eventId, new Date(eventDate));
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
