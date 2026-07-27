import createHttpError from 'http-errors';
import type { Prisma } from '@prisma/client';
import { NfcPlaqueRepository } from './nfcPlaque.repository.js';

type PlaquePayload = Partial<{
  businessName: string;
  slug: string;
  blocks: unknown[];
  isPublished: boolean;
  [key: string]: unknown;
}>;

export class NfcPlaqueService {
  constructor(private readonly repo: NfcPlaqueRepository) {}

  async listMine(createdById: string) {
    return this.repo.listByCreator(createdById);
  }

  // Every mutating path goes through this: a maker may only touch plaques they
  // created. CHIEF_ADMIN bypasses the ownership check.
  private async ownedOrThrow(id: string, userId: string, isChief: boolean) {
    const plaque = await this.repo.findById(id);
    if (!plaque) throw createHttpError(404, 'Plaque not found');
    if (!isChief && plaque.createdById !== userId) throw createHttpError(404, 'Plaque not found');
    return plaque;
  }

  async getOne(id: string, userId: string, isChief: boolean) {
    return this.ownedOrThrow(id, userId, isChief);
  }

  async create(createdById: string, payload: PlaquePayload) {
    const slug = String(payload.slug);
    if (await this.repo.slugTaken(slug)) throw createHttpError(409, 'This address is already taken');
    const { blocks, ...rest } = payload;
    return this.repo.create({
      ...(rest as Prisma.NfcPlaqueUncheckedCreateInput),
      slug,
      businessName: String(payload.businessName),
      blocks: (blocks ?? []) as Prisma.InputJsonValue,
      createdById,
    });
  }

  async update(id: string, userId: string, isChief: boolean, payload: PlaquePayload) {
    await this.ownedOrThrow(id, userId, isChief);
    if (payload.slug && (await this.repo.slugTaken(String(payload.slug), id))) {
      throw createHttpError(409, 'This address is already taken');
    }
    const { blocks, ...rest } = payload;
    const data = { ...(rest as Prisma.NfcPlaqueUncheckedUpdateInput) };
    if (blocks !== undefined) data.blocks = blocks as Prisma.InputJsonValue;
    return this.repo.update(id, data);
  }

  async remove(id: string, userId: string, isChief: boolean) {
    await this.ownedOrThrow(id, userId, isChief);
    await this.repo.delete(id);
  }

  // Public: only a PUBLISHED plaque is readable without auth.
  async publicBySlug(slug: string) {
    const plaque = await this.repo.findBySlug(slug);
    if (!plaque || !plaque.isPublished) throw createHttpError(404, 'Plaque not found');
    return plaque;
  }

  // Builder-side availability check for the slug field.
  async slugAvailable(slug: string, excludeId?: string) {
    return !(await this.repo.slugTaken(slug, excludeId));
  }
}
