import type { Request, Response } from 'express';
import { PerformerService } from './performer.service.js';
import { parseKind } from './performer.kind.js';
import {
  updatePerformerProfileSchema, performerEventSchema, updatePerformerEventSchema,
  createPerformerBookingSchema, bookingDecisionSchema,
} from './performer.schema.js';

const service = new PerformerService();

// Everything here is scoped to the signed-in performer or host: the id comes
// from the token, never from the request, so one account can never read or
// change another's calendar or bookings.
export class PerformerController {
  async getMyProfile(request: Request, response: Response) {
    response.json(await service.getOrCreateProfile(request.admin!.id));
  }

  async updateMyProfile(request: Request, response: Response) {
    const data = updatePerformerProfileSchema.parse(request.body);
    response.json(await service.updateProfile(request.admin!.id, data));
  }

  async listMyEvents(request: Request, response: Response) {
    response.json(await service.listEvents(request.admin!.id));
  }

  async createMyEvent(request: Request, response: Response) {
    const data = performerEventSchema.parse(request.body);
    response.status(201).json(await service.createEvent(request.admin!.id, data));
  }

  async updateMyEvent(request: Request, response: Response) {
    const data = updatePerformerEventSchema.parse(request.body);
    response.json(await service.updateEvent(request.admin!.id, String(request.params.id), data));
  }

  async removeMyEvent(request: Request, response: Response) {
    await service.removeEvent(request.admin!.id, String(request.params.id));
    response.status(204).send();
  }

  async listMyBookings(request: Request, response: Response) {
    response.json(await service.listBookings(request.admin!.id));
  }

  async myPendingCount(request: Request, response: Response) {
    response.json({ count: await service.pendingBookingCount(request.admin!.id) });
  }

  async decideBooking(request: Request, response: Response) {
    const { status } = bookingDecisionSchema.parse(request.body);
    response.json(await service.decideBooking(request.admin!.id, String(request.params.id), status));
  }

  // ── Public ─────────────────────────────────────────────────────────────────
  // `?kind=host` selects the hosts block; anything else (including a missing
  // parameter) means performers, which is what callers predating hosts send.
  async listPublic(request: Request, response: Response) {
    const date = typeof request.query.date === 'string' ? request.query.date : undefined;
    response.json(await service.listPublic(parseKind(request.query.kind), date || undefined));
  }

  async getPublic(request: Request, response: Response) {
    response.json(await service.getPublic(parseKind(request.query.kind), String(request.params.id)));
  }

  async createBooking(request: Request, response: Response) {
    const data = createPerformerBookingSchema.parse(request.body);
    response.status(201).json(await service.createBooking(data));
  }
}
