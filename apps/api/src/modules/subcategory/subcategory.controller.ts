import type { Request, Response } from 'express';
import { SubcategoryRepository } from './subcategory.repository.js';
import { SubcategoryService } from './subcategory.service.js';
import {
  createSubcategorySchema,
  subcategoryArrangementSchema,
  subcategoryIdSchema,
  updateSubcategorySchema
} from './subcategory.schema.js';

const subcategoryService = new SubcategoryService(new SubcategoryRepository());

export class SubcategoryController {
  async list(request: Request, response: Response) {
    response.json(await subcategoryService.listAll(request.restaurantId!));
  }

  async saveArrangement(request: Request, response: Response) {
    const { order } = subcategoryArrangementSchema.parse(request.body);
    response.json(await subcategoryService.saveArrangement(request.restaurantId!, order));
  }

  async create(request: Request, response: Response) {
    const payload = createSubcategorySchema.parse(request.body);
    response.status(201).json(await subcategoryService.create(request.restaurantId!, payload));
  }

  async update(request: Request, response: Response) {
    const { id } = subcategoryIdSchema.parse(request.params);
    const payload = updateSubcategorySchema.parse(request.body);
    response.json(await subcategoryService.update(request.restaurantId!, id, payload));
  }

  async remove(request: Request, response: Response) {
    const { id } = subcategoryIdSchema.parse(request.params);
    await subcategoryService.remove(id);
    response.status(204).send();
  }
}
