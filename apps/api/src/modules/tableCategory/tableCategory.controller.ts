import type { Request, Response } from 'express';
import { getOptionalPagination } from '../../utils/http.js';
import { DEFAULT_SECTION } from '../../utils/section.js';
import { TableCategoryRepository } from './tableCategory.repository.js';
import {
  createTableCategorySchema,
  tableCategoryArrangementSchema,
  tableCategoryIdSchema,
  updateTableCategorySchema
} from './tableCategory.schema.js';
import { TableCategoryService } from './tableCategory.service.js';

const tableCategoryService = new TableCategoryService(new TableCategoryRepository());

// Set by `requireRestaurant`, which every route here runs behind.
const sectionOf = (request: Request) => request.section ?? DEFAULT_SECTION;

export class TableCategoryController {
  async list(request: Request, response: Response) {
    // No page asked for means the whole set — see getOptionalPagination.
    const pagination = getOptionalPagination(request);
    response.json(await tableCategoryService.listTableCategories(request.restaurantId!, sectionOf(request), pagination));
  }

  async listAll(request: Request, response: Response) {
    response.json(await tableCategoryService.listAllTableCategories(request.restaurantId!, sectionOf(request)));
  }

  async saveArrangement(request: Request, response: Response) {
    const { order } = tableCategoryArrangementSchema.parse(request.body);
    response.json(await tableCategoryService.saveArrangement(request.restaurantId!, sectionOf(request), order));
  }

  async create(request: Request, response: Response) {
    const payload = createTableCategorySchema.parse(request.body);
    response.status(201).json(await tableCategoryService.createTableCategory(request.restaurantId!, sectionOf(request), payload));
  }

  async update(request: Request, response: Response) {
    const { id } = tableCategoryIdSchema.parse(request.params);
    const payload = updateTableCategorySchema.parse(request.body);
    response.json(await tableCategoryService.updateTableCategory(request.restaurantId!, sectionOf(request), id, payload));
  }

  async getById(request: Request, response: Response) {
    const { id } = tableCategoryIdSchema.parse(request.params);
    response.json(await tableCategoryService.getTableCategoryDetails(id, sectionOf(request)));
  }

  async remove(request: Request, response: Response) {
    const { id } = tableCategoryIdSchema.parse(request.params);
    await tableCategoryService.deleteTableCategory(id, sectionOf(request));
    response.status(204).send();
  }
}
