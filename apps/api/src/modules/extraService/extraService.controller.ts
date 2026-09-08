import type { Request, Response } from 'express';
import { getOptionalPagination } from '../../utils/http.js';
import { DEFAULT_SECTION } from '../../utils/section.js';
import { ExtraServiceRepository } from './extraService.repository.js';
import { createExtraServiceSchema, extraServiceIdSchema, updateExtraServiceSchema } from './extraService.schema.js';
import { ExtraServiceService } from './extraService.service.js';

const extraServiceService = new ExtraServiceService(new ExtraServiceRepository());

// Set by `requireRestaurant`, which every route here runs behind.
const sectionOf = (request: Request) => request.section ?? DEFAULT_SECTION;

export class ExtraServiceController {
  async list(request: Request, response: Response) {
    // No page asked for means the whole set — see getOptionalPagination.
    const pagination = getOptionalPagination(request);
    response.json(await extraServiceService.listServices(request.restaurantId!, sectionOf(request), pagination));
  }

  async create(request: Request, response: Response) {
    const payload = createExtraServiceSchema.parse(request.body);
    response.status(201).json(await extraServiceService.createService(request.restaurantId!, sectionOf(request), payload));
  }

  async update(request: Request, response: Response) {
    const { id } = extraServiceIdSchema.parse(request.params);
    const payload = updateExtraServiceSchema.parse(request.body);
    response.json(await extraServiceService.updateService(request.restaurantId!, sectionOf(request), id, payload));
  }

  async getById(request: Request, response: Response) {
    const { id } = extraServiceIdSchema.parse(request.params);
    response.json(await extraServiceService.getServiceDetails(request.restaurantId!, sectionOf(request), id));
  }

  async remove(request: Request, response: Response) {
    const { id } = extraServiceIdSchema.parse(request.params);
    await extraServiceService.deleteService(request.restaurantId!, sectionOf(request), id);
    response.status(204).send();
  }
}
