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
    const categories = await tableCategoryService.listTableCategories(pagination);

    response.json(categories);
  }

  async create(request: Request, response: Response) {
    const payload = createTableCategorySchema.parse(request.body);
    const category = await tableCategoryService.createTableCategory(payload);

    response.status(201).json(category);
  }

  async update(request: Request, response: Response) {
    const { id } = tableCategoryIdSchema.parse(request.params);
    const payload = updateTableCategorySchema.parse(request.body);
    const category = await tableCategoryService.updateTableCategory(id, payload);

    response.json(category);
  }

  async getById(request: Request, response: Response) {
    const { id } = tableCategoryIdSchema.parse(request.params);
    const category = await tableCategoryService.getTableCategoryDetails(id);

    response.json(category);
  }

  async remove(request: Request, response: Response) {
    const { id } = tableCategoryIdSchema.parse(request.params);
    await tableCategoryService.deleteTableCategory(id);

    response.status(204).send();
  }
}
