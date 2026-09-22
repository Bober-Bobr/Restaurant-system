import type { Request, Response } from 'express';
import { DEFAULT_SECTION } from '../../utils/section.js';
import { FloorMapRepository } from './floorMap.repository.js';
import {
  createAreaSchema, createTableSchema, idSchema, updateAreaSchema, updateTableSchema,
} from './floorMap.schema.js';
import { FloorMapService } from './floorMap.service.js';

const service = new FloorMapService(new FloorMapRepository());

// Both set by `requireRestaurant`, which the router is mounted behind.
const scope = (request: Request) => [request.restaurantId!, request.section ?? DEFAULT_SECTION] as const;

export class FloorMapController {
  async get(request: Request, response: Response) {
    response.json(await service.getMap(...scope(request)));
  }

  async createArea(request: Request, response: Response) {
    const payload = createAreaSchema.parse(request.body);
    response.status(201).json(await service.createArea(...scope(request), payload));
  }

  async updateArea(request: Request, response: Response) {
    const { id } = idSchema.parse(request.params);
    const payload = updateAreaSchema.parse(request.body);
    response.json(await service.updateArea(...scope(request), id, payload));
  }

  async saveDefaultLayout(request: Request, response: Response) {
    const { id } = idSchema.parse(request.params);
    response.json(await service.saveDefaultLayout(...scope(request), id));
  }

  async restoreDefaultLayout(request: Request, response: Response) {
    const { id } = idSchema.parse(request.params);
    response.json(await service.restoreDefaultLayout(...scope(request), id));
  }

  async createTable(request: Request, response: Response) {
    const payload = createTableSchema.parse(request.body);
    response.status(201).json(await service.createTable(...scope(request), payload));
  }

  async updateTable(request: Request, response: Response) {
    const { id } = idSchema.parse(request.params);
    const payload = updateTableSchema.parse(request.body);
    response.json(await service.updateTable(...scope(request), id, payload));
  }

  async deleteTable(request: Request, response: Response) {
    const { id } = idSchema.parse(request.params);
    await service.deleteTable(...scope(request), id);
    response.status(204).send();
  }
}
