import type { Request, Response } from 'express';
import { getOptionalPagination } from '../../utils/http.js';
import { DEFAULT_SECTION } from '../../utils/section.js';
import { HallRepository } from './hall.repository.js';
import { createHallSchema, hallIdSchema, updateHallSchema } from './hall.schema.js';
import { HallService } from './hall.service.js';

const hallService = new HallService(new HallRepository());

// Set by `requireRestaurant`, which every hall route runs behind. The fallback
// is unreachable in practice and is here so the type is not optional at each
// call site — Banquet is the section every pre-existing caller meant.
const sectionOf = (request: Request) => request.section ?? DEFAULT_SECTION;

export class HallController {
  async list(request: Request, response: Response) {
    // No page asked for means the whole set — see getOptionalPagination.
    const pagination = getOptionalPagination(request);
    response.json(await hallService.listHalls(request.restaurantId!, sectionOf(request), pagination));
  }

  async create(request: Request, response: Response) {
    const payload = createHallSchema.parse(request.body);
    response.status(201).json(await hallService.createHall(request.restaurantId!, sectionOf(request), payload));
  }

  async update(request: Request, response: Response) {
    const { id } = hallIdSchema.parse(request.params);
    const payload = updateHallSchema.parse(request.body);
    response.json(await hallService.updateHall(request.restaurantId!, sectionOf(request), id, payload));
  }

  async getById(request: Request, response: Response) {
    const { id } = hallIdSchema.parse(request.params);
    response.json(await hallService.getHallDetails(id, sectionOf(request)));
  }

  async remove(request: Request, response: Response) {
    const { id } = hallIdSchema.parse(request.params);
    await hallService.deleteHall(id, sectionOf(request));
    response.status(204).send();
  }
}
