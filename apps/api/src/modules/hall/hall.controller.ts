import type { Request, Response } from 'express';
import { getPagination } from '../../utils/http.js';
import { HallRepository } from './hall.repository.js';
import { createHallSchema, hallIdSchema, updateHallSchema } from './hall.schema.js';
import { HallService } from './hall.service.js';

const hallService = new HallService(new HallRepository());

export class HallController {
  async list(request: Request, response: Response) {
    const pagination = getPagination(request);
    response.json(await hallService.listHalls(request.restaurantId!, pagination));
  }

  async create(request: Request, response: Response) {
    const payload = createHallSchema.parse(request.body);
    response.status(201).json(await hallService.createHall(request.restaurantId!, payload));
  }

  async update(request: Request, response: Response) {
    const { id } = hallIdSchema.parse(request.params);
    const payload = updateHallSchema.parse(request.body);
    response.json(await hallService.updateHall(request.restaurantId!, id, payload));
  }

  async getById(request: Request, response: Response) {
    const { id } = hallIdSchema.parse(request.params);
    response.json(await hallService.getHallDetails(id));
  }

  async remove(request: Request, response: Response) {
    const { id } = hallIdSchema.parse(request.params);
    await hallService.deleteHall(id);
    response.status(204).send();
  }
}
