import type { Request, Response } from 'express';
import { AdminRole } from '@prisma/client';
import { NfcPlaqueRepository } from './nfcPlaque.repository.js';
import { NfcPlaqueService } from './nfcPlaque.service.js';
import {
  createNfcPlaqueSchema,
  nfcPlaqueIdSchema,
  nfcPlaqueSlugParamSchema,
  plaqueSlugSchema,
  updateNfcPlaqueSchema,
} from './nfcPlaque.schema.js';

const service = new NfcPlaqueService(new NfcPlaqueRepository());

function actor(request: Request) {
  return {
    userId: request.admin!.id,
    isChief: request.admin!.role === AdminRole.CHIEF_ADMIN,
  };
}

export class NfcPlaqueController {
  async listMine(request: Request, response: Response) {
    response.json(await service.listMine(request.admin!.id));
  }

  async getById(request: Request, response: Response) {
    const { id } = nfcPlaqueIdSchema.parse(request.params);
    const { userId, isChief } = actor(request);
    response.json(await service.getOne(id, userId, isChief));
  }

  async create(request: Request, response: Response) {
    const payload = createNfcPlaqueSchema.parse(request.body);
    response.status(201).json(await service.create(request.admin!.id, payload));
  }

  async update(request: Request, response: Response) {
    const { id } = nfcPlaqueIdSchema.parse(request.params);
    const payload = updateNfcPlaqueSchema.parse(request.body);
    const { userId, isChief } = actor(request);
    response.json(await service.update(id, userId, isChief, payload));
  }

  async remove(request: Request, response: Response) {
    const { id } = nfcPlaqueIdSchema.parse(request.params);
    const { userId, isChief } = actor(request);
    await service.remove(id, userId, isChief);
    response.status(204).send();
  }

  // GET /nfc-plaques/slug-available?slug=…&excludeId=…
  async slugAvailable(request: Request, response: Response) {
    const parsed = plaqueSlugSchema.safeParse(String(request.query.slug ?? ''));
    if (!parsed.success) { response.json({ available: false, reason: 'invalid' }); return; }
    const excludeId = typeof request.query.excludeId === 'string' ? request.query.excludeId : undefined;
    response.json({ available: await service.slugAvailable(parsed.data, excludeId) });
  }

  // Public (no auth): the published plaque behind an NFC tag.
  async publicBySlug(request: Request, response: Response) {
    const { slug } = nfcPlaqueSlugParamSchema.parse(request.params);
    response.json(await service.publicBySlug(slug));
  }
}
