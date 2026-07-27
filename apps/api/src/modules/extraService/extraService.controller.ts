import type { Request, Response } from 'express';
import { getPagination } from '../../utils/http.js';
import { ExtraServiceRepository } from './extraService.repository.js';
import { createExtraServiceSchema, extraServiceIdSchema, updateExtraServiceSchema } from './extraService.schema.js';
import { ExtraServiceService } from './extraService.service.js';

const extraServiceService = new ExtraServiceService(new ExtraServiceRepository());

export class ExtraServiceController {
  async list(request: Request, response: Response) {
    const pagination = getPagination(request);
    response.json(await extraServiceService.listServices(request.restaurantId!, pagination));
  }

  async create(request: Request, response: Response) {
    const payload = createExtraServiceSchema.parse(request.body);
    response.status(201).json(await extraServiceService.createService(request.restaurantId!, payload));
  }

  async update(request: Request, response: Response) {
    const { id } = extraServiceIdSchema.parse(request.params);
    const payload = updateExtraServiceSchema.parse(request.body);
    response.json(await extraServiceService.updateService(request.restaurantId!, id, payload));
  }

  async getById(request: Request, response: Response) {
    const { id } = extraServiceIdSchema.parse(request.params);
    response.json(await extraServiceService.getServiceDetails(request.restaurantId!, id));
  }

  async remove(request: Request, response: Response) {
    const { id } = extraServiceIdSchema.parse(request.params);
    await extraServiceService.deleteService(request.restaurantId!, id);
    response.status(204).send();
  }
}
