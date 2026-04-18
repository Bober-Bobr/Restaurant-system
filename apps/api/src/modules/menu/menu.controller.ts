import type { Request, Response } from 'express';
import { EventRepository } from '../events/event.repository.js';
import { eventIdSchema } from '../events/event.schema.js';
import { assignSelectionSchema, createMenuItemSchema, menuItemIdSchema, updateMenuItemSchema } from './menu.schema.js';
import { MenuRepository } from './menu.repository.js';
import { MenuService } from './menu.service.js';

const menuService = new MenuService(new MenuRepository(), new EventRepository());

export class MenuController {
  async list(request: Request, response: Response) {
    response.json(await menuService.listMenuItems(request.restaurantId!));
  }

  async listAll(request: Request, response: Response) {
    response.json(await menuService.listAllMenuItems(request.restaurantId!));
  }

  async create(request: Request, response: Response) {
    const payload = createMenuItemSchema.parse(request.body);
    response.status(201).json(await menuService.createMenuItem(request.restaurantId!, payload));
  }

  async update(request: Request, response: Response) {
    const { menuItemId } = menuItemIdSchema.parse(request.params);
    const payload = updateMenuItemSchema.parse(request.body);
    response.json(await menuService.updateMenuItem(menuItemId, payload));
  }

  async remove(request: Request, response: Response) {
    const { menuItemId } = menuItemIdSchema.parse(request.params);
    await menuService.deleteMenuItem(menuItemId);
    response.status(204).send();
  }

  async assignSelection(request: Request, response: Response) {
    const { eventId } = eventIdSchema.parse(request.params);
    const payload = assignSelectionSchema.parse(request.body);
    const selection = await menuService.assignMenuItemToEvent(request.restaurantId!, eventId, payload);
    response.status(201).json(selection);
  }
}
