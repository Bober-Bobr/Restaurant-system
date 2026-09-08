import type { Request, Response } from 'express';
import { getOptionalPagination } from '../../utils/http.js';
import { DEFAULT_SECTION } from '../../utils/section.js';
import { EventRepository } from './event.repository.js';
import { addPaymentSchema, createEventSchema, eventIdSchema, paymentIdSchema, rescheduleEventSchema, updateEventSchema } from './event.schema.js';
import { EventService } from './event.service.js';

const eventService = new EventService(new EventRepository());

// Banquet or Small Banquets. Set by `requireRestaurant` from the caller's ROLE,
// so a supervisor cannot reach a banquet booking by sending its number.
const sectionOf = (request: Request) => request.section ?? DEFAULT_SECTION;

export class EventController {
  async list(request: Request, response: Response) {
    const restaurantId = request.restaurantId!;
    // No page asked for means the whole set: every screen that lists events
    // holds the complete list and filters it in the browser.
    response.json(await eventService.listEvents(restaurantId, sectionOf(request), getOptionalPagination(request)));
  }

  async create(request: Request, response: Response) {
    const restaurantId = request.restaurantId!;
    const payload = createEventSchema.parse(request.body);
    // A blank event is allowed: fall back to safe defaults for the required columns.
    const event = await eventService.createEvent(restaurantId, sectionOf(request), {
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
    const event = await eventService.updateEvent(restaurantId, sectionOf(request), eventId, {
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
    const event = await eventService.addPayment(restaurantId, sectionOf(request), eventId, amountCents, note);
    response.status(201).json(event);
  }

  async removePayment(request: Request, response: Response) {
    const restaurantId = request.restaurantId!;
    const { eventId, paymentId } = paymentIdSchema.parse(request.params);
    const event = await eventService.removePayment(restaurantId, sectionOf(request), eventId, paymentId);
    response.json(event);
  }

  async reschedule(request: Request, response: Response) {
    const restaurantId = request.restaurantId!;
    const { eventId } = eventIdSchema.parse(request.params);
    const { eventDate } = rescheduleEventSchema.parse(request.body);
    const event = await eventService.rescheduleEvent(restaurantId, sectionOf(request), eventId, new Date(eventDate));
    response.json(event);
  }

  async getById(request: Request, response: Response) {
    const restaurantId = request.restaurantId!;
    const { eventId } = eventIdSchema.parse(request.params);
    response.json(await eventService.getEventDetails(restaurantId, sectionOf(request), eventId));
  }

  async remove(request: Request, response: Response) {
    const restaurantId = request.restaurantId!;
    const { eventId } = eventIdSchema.parse(request.params);
    await eventService.deleteEvent(restaurantId, sectionOf(request), eventId);
    response.status(204).send();
  }
}
