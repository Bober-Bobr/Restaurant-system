import type { Request, Response } from 'express';
import { AdminRole } from '@prisma/client';
import { RestaurantRepository } from './restaurant.repository.js';
import { createRestaurantSchema, updateRestaurantSchema } from './restaurant.schema.js';
import { RestaurantService } from './restaurant.service.js';

const service = new RestaurantService(new RestaurantRepository());

export class RestaurantController {
  async list(request: Request, response: Response) {
    const admin = request.admin!;
    if (admin.role === AdminRole.OWNER) {
      response.json(await service.listForOwner(admin.id));
      return;
    }
    if (admin.restaurantId) {
      response.json(await service.listForStaff(admin.restaurantId));
      return;
    }
    // JWT is stale — look up from DB
    response.json(await service.listForStaffByUserId(admin.id));
  }

  async create(request: Request, response: Response) {
    const data = createRestaurantSchema.parse(request.body);
    const restaurant = await service.create(request.admin!.id, data);
    response.status(201).json(restaurant);
  }

  async update(request: Request, response: Response) {
    const data = updateRestaurantSchema.parse(request.body);
    const restaurant = await service.update(request.admin!.id, String(request.params.id), data);
    response.json(restaurant);
  }

  async remove(request: Request, response: Response) {
    await service.remove(request.admin!.id, String(request.params.id));
    response.status(204).send();
  }
}
