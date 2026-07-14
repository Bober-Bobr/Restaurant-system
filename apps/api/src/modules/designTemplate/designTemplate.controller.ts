import type { Request, Response } from 'express';
import createHttpError from 'http-errors';
import { DesignTemplateRepository } from './designTemplate.repository.js';
import { createDesignTemplateSchema, updateDesignTemplateSchema } from './designTemplate.schema.js';

const repo = new DesignTemplateRepository();

export class DesignTemplateController {
  async listMine(request: Request, response: Response) {
    const admin = request.admin!;
    const kind = typeof request.query.kind === 'string' ? request.query.kind : undefined;
    response.json(await repo.listByOwner(admin.id, kind));
  }

  async create(request: Request, response: Response) {
    const admin = request.admin!;
    const data = createDesignTemplateSchema.parse(request.body);
    const created = await repo.create({
      ownerId: admin.id,
      name: data.name,
      kind: data.kind,
      blocks: (data.blocks ?? []) as unknown as object,
      theme: (data.theme ?? {}) as unknown as object,
    } as never);
    response.status(201).json(created);
  }

  async getById(request: Request, response: Response) {
    const admin = request.admin!;
    const tpl = await repo.findById(String(request.params.id));
    if (!tpl) {
      response.status(404).json({ message: 'Not found' });
      return;
    }
    if (tpl.ownerId && tpl.ownerId !== admin.id) throw createHttpError(403, 'Not your template');
    response.json(tpl);
  }

  // Edit a template in place (name / blocks / theme) or toggle its favorite pin.
  async update(request: Request, response: Response) {
    const admin = request.admin!;
    const tpl = await repo.findById(String(request.params.id));
    if (!tpl) {
      response.status(404).json({ message: 'Not found' });
      return;
    }
    if (tpl.ownerId && tpl.ownerId !== admin.id) throw createHttpError(403, 'Not your template');
    const data = updateDesignTemplateSchema.parse(request.body);
    const updated = await repo.update(tpl.id, {
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.isFavorite !== undefined ? { isFavorite: data.isFavorite } : {}),
      ...(data.blocks !== undefined ? { blocks: data.blocks as unknown as object } : {}),
      ...(data.theme !== undefined ? { theme: data.theme as unknown as object } : {}),
    } as never);
    response.json(updated);
  }

  async remove(request: Request, response: Response) {
    const admin = request.admin!;
    const tpl = await repo.findById(String(request.params.id));
    if (!tpl) {
      response.status(404).json({ message: 'Not found' });
      return;
    }
    if (tpl.ownerId && tpl.ownerId !== admin.id) throw createHttpError(403, 'Not your template');
    await repo.delete(tpl.id);
    response.status(204).send();
  }
}
