import type { Request, Response } from 'express';
import createHttpError from 'http-errors';
import { GuestInvitationRepository } from './guestInvitation.repository.js';
import {
  createGuestInvitationSchema,
  updateGuestInvitationSchema,
  rsvpSchema,
} from './guestInvitation.schema.js';

const repo = new GuestInvitationRepository();

// Date strings → Date so Prisma stores DateTime columns correctly.
function normalizeDates(input: Record<string, unknown>) {
  const out = { ...input };
  for (const key of ['eventDate', 'countdownAt']) {
    if (key in out && typeof out[key] === 'string') out[key] = new Date(out[key] as string);
  }
  return out;
}

export class GuestInvitationController {
  // ── Manager-facing ──────────────────────────────────────────────────────
  async listMine(request: Request, response: Response) {
    const admin = request.admin!;
    response.json(await repo.listByCreator(admin.id));
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
    const data = createGuestInvitationSchema.parse(request.body);
    if (await repo.existsSlug(data.slug)) throw createHttpError(409, 'Slug already in use');

    const created = await repo.create({
      ...normalizeDates(data),
      createdById: admin.id,
      timingItems: (data.timingItems ?? []) as unknown as object,
      sectionAnimations: (data.sectionAnimations ?? {}) as unknown as object,
    } as never);
    response.status(201).json(created);
  }

  async update(request: Request, response: Response) {
    const id = String(request.params.id);
    const data = updateGuestInvitationSchema.parse(request.body);
    if (data.slug && (await repo.existsSlug(data.slug, id))) {
      throw createHttpError(409, 'Slug already in use');
    }
    const updated = await repo.update(id, {
      ...normalizeDates(data),
      ...(data.timingItems !== undefined ? { timingItems: data.timingItems as unknown as object } : {}),
      ...(data.sectionAnimations !== undefined
        ? { sectionAnimations: data.sectionAnimations as unknown as object }
        : {}),
    } as never);
    response.json(updated);
  }

  async remove(request: Request, response: Response) {
    await repo.delete(String(request.params.id));
    response.status(204).send();
  }

  async listRsvps(request: Request, response: Response) {
    response.json(await repo.listRsvps(String(request.params.id)));
  }

  // ── Public ──────────────────────────────────────────────────────────────
  async publicBySlug(request: Request, response: Response) {
    const invitation = await repo.findBySlug(String(request.params.slug));
    if (!invitation || !invitation.isPublished) {
      response.status(404).json({ message: 'Not found' });
      return;
    }
    response.json(invitation);
  }

  async submitRsvp(request: Request, response: Response) {
    const invitation = await repo.findBySlug(String(request.params.slug));
    if (!invitation || !invitation.isPublished) {
      response.status(404).json({ message: 'Not found' });
      return;
    }
    if (!invitation.rsvpEnabled) throw createHttpError(400, 'RSVP is closed');
    const data = rsvpSchema.parse(request.body);
    const created = await repo.addRsvp(invitation.id, data);
    response.status(201).json({ ok: true, id: created.id });
  }
}
