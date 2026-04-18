import type { Request, Response } from 'express';
import { getPagination } from '../../utils/http.js';
import { TableCategoryRepository } from './tableCategory.repository.js';
import {
  createTableCategorySchema,
  tableCategoryIdSchema,
  updateTableCategorySchema
} from './tableCategory.schema.js';
import { TableCategoryService } from './tableCategory.service.js';

const tableCategoryService = new TableCategoryService(new TableCategoryRepository());

export class TableCategoryController {
  async list(request: Request, response: Response) {
    const pagination = getPagination(request);
    response.json(await tableCategoryService.listTableCategories(request.restaurantId!, pagination));
  }

  async create(request: Request, response: Response) {
    const payload = createTableCategorySchema.parse(request.body);
    response.status(201).json(await tableCategoryService.createTableCategory(request.restaurantId!, payload));
  }

  async update(request: Request, response: Response) {
    const { id } = tableCategoryIdSchema.parse(request.params);
    const payload = updateTableCategorySchema.parse(request.body);
    response.json(await tableCategoryService.updateTableCategory(request.restaurantId!, id, payload));
  }

  async getById(request: Request, response: Response) {
    const { id } = tableCategoryIdSchema.parse(request.params);
    response.json(await tableCategoryService.getTableCategoryDetails(id));
  }

  async remove(request: Request, response: Response) {
    const { id } = tableCategoryIdSchema.parse(request.params);
    await tableCategoryService.deleteTableCategory(id);
    response.status(204).send();
  }
}
