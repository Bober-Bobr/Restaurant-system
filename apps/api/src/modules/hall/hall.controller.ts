import type { Request, Response } from 'express';
import { getPagination } from '../../utils/http.js';
import { HallRepository } from './hall.repository.js';
import { createHallSchema, hallIdSchema, updateHallSchema } from './hall.schema.js';
import { HallService } from './hall.service.js';

const hallService = new HallService(new HallRepository());

export class HallController {
  async list(request: Request, response: Response) {
    const pagination = getPagination(request);
    const halls = await hallService.listHalls(pagination);

    response.json(halls);
  }

  async create(request: Request, response: Response) {
    const payload = createHallSchema.parse(request.body);
    const hall = await hallService.createHall(payload);

    response.status(201).json(hall);
  }

  async update(request: Request, response: Response) {
    const { id } = hallIdSchema.parse(request.params);
    const payload = updateHallSchema.parse(request.body);
    const hall = await hallService.updateHall(id, payload);

    response.json(hall);
  }

  async getById(request: Request, response: Response) {
    const { id } = hallIdSchema.parse(request.params);
    const hall = await hallService.getHallDetails(id);

    response.json(hall);
  }

  async remove(request: Request, response: Response) {
    const { id } = hallIdSchema.parse(request.params);
    await hallService.deleteHall(id);

    response.status(204).send();
  }
}
