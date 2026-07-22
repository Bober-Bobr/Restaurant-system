import type { Request, Response } from 'express';
import createHttpError from 'http-errors';
import { InvitationRepository } from './invitation.repository.js';
import { createInvitationSchema, updateInvitationSchema, invitationRequestSchema } from './invitation.schema.js';
import { forwardSubmission } from '../telegram/telegram.service.js';

const repo = new InvitationRepository();

// Convert undefined → null for JSON columns so Prisma replaces, not skips.
function normalizeJsonFields(input: Record<string, unknown>) {
  const out = { ...input };
  if ('countdownAt' in out && typeof out.countdownAt === 'string') {
    out.countdownAt = new Date(out.countdownAt as string);
  }
  return out;
}

export class InvitationController {
  async listByRestaurant(request: Request, response: Response) {
    const restaurantId = String(request.query.restaurantId ?? '').trim();
    if (!restaurantId) {
      response.status(400).json({ message: 'restaurantId required' });
      return;
    }
    response.json(await repo.listByRestaurant(restaurantId));
  }

  // All flyer projects created by the signed-in manager.
  async listMine(request: Request, response: Response) {
    const admin = request.admin!;
    response.json(await repo.listByCreator(admin.id));
  }

  async getByEvent(request: Request, response: Response) {
    const eventIdOrNumber = String(request.params.eventId);
    const restaurantId = String(request.query.restaurantId ?? '').trim();
    if (!restaurantId) {
      response.status(400).json({ message: 'restaurantId required' });
      return;
    }
    const cuid = await repo.resolveEventId(eventIdOrNumber, restaurantId);
    if (!cuid) {
      response.status(404).json({ message: 'Event not found' });
      return;
    }
    const invitation = await repo.findByEventId(cuid);
    if (!invitation) {
      response.status(404).json({ message: 'No invitation for this event' });
      return;
    }
    response.json(invitation);
  }

  async getById(request: Request, response: Response) {
    const invitation = await repo.findById(String(request.params.id));
    if (!invitation) {
      response.status(404).json({ message: 'Not found' });
      return;
    }
    response.json(invitation);
  }

  async create(request: Request, response: Response) {
    const admin = request.admin!;
    const data = createInvitationSchema.parse(request.body);
    const slugTaken = await repo.existsSlug(data.slug);
    if (slugTaken) throw createHttpError(409, 'Slug already in use');

    const resolvedEventId = await repo.resolveEventId(data.eventId, data.restaurantId);
    if (data.eventId && !resolvedEventId) {
      throw createHttpError(404, 'Event not found for this restaurant');
    }

    const created = await repo.create({
      ...normalizeJsonFields(data),
      eventId: resolvedEventId,
      createdById: admin.id,
      menuItems: (data.menuItems ?? []) as unknown as object,
      galleryPhotos: (data.galleryPhotos ?? []) as unknown as object,
      blocks: (data.blocks ?? []) as unknown as object,
    } as never);
    response.status(201).json(created);
  }

  async update(request: Request, response: Response) {
    const id = String(request.params.id);
    const data = updateInvitationSchema.parse(request.body);
    if (data.slug) {
      const taken = await repo.existsSlug(data.slug, id);
      if (taken) throw createHttpError(409, 'Slug already in use');
    }
    const updated = await repo.update(id, {
      ...normalizeJsonFields(data),
      ...(data.menuItems !== undefined ? { menuItems: data.menuItems as unknown as object } : {}),
      ...(data.galleryPhotos !== undefined ? { galleryPhotos: data.galleryPhotos as unknown as object } : {}),
      ...(data.blocks !== undefined ? { blocks: data.blocks as unknown as object } : {}),
    } as never);
    response.json(updated);
  }

  async remove(request: Request, response: Response) {
    await repo.delete(String(request.params.id));
    response.status(204).send();
  }

  // Public: by slug
  async publicBySlug(request: Request, response: Response) {
    const invitation = await repo.findBySlug(String(request.params.slug));
    if (!invitation || !invitation.isPublished) {
      response.status(404).json({ message: 'Not found' });
      return;
    }
    response.json(invitation);
  }

  // Manager: leads captured from this flyer's form block.
  async listRequests(request: Request, response: Response) {
    response.json(await repo.listRequests(String(request.params.id)));
  }

  // Public: a visitor submits the flyer's "form" block (call-back request).
  async submitRequest(request: Request, response: Response) {
    const invitation = await repo.findBySlug(String(request.params.slug));
    if (!invitation || !invitation.isPublished) {
      response.status(404).json({ message: 'Not found' });
      return;
    }
    const data = invitationRequestSchema.parse(request.body);
    const created = await repo.addRequest(invitation.id, data);
    // Forward to any Telegram chats subscribed to this flyer — best-effort, never
    // block or fail the guest's submission on it.
    void forwardSubmission(invitation.id, data).catch(() => undefined);
    response.status(201).json({ ok: true, id: created.id });
  }
}
