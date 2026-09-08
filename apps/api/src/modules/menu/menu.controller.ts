import type { Request, Response } from 'express';
import { EventRepository } from '../events/event.repository.js';
import { eventIdSchema } from '../events/event.schema.js';
import { arrangementSchema, assignSelectionSchema, createMenuItemSchema, menuItemIdSchema, settingsSchema, updateMenuItemSchema } from './menu.schema.js';
import { MenuRepository } from './menu.repository.js';
import { MenuService } from './menu.service.js';
import { resolveMenuScope, type MenuScope } from '../../utils/excludedCategories.js';
import { DEFAULT_SECTION, type Section } from '../../utils/section.js';

const menuService = new MenuService(new MenuRepository(), new EventRepository());

const sectionOf = (request: Request) => request.section ?? DEFAULT_SECTION;

// Each section reads the shared dish table through its OWN list of switched-off
// categories, so the default scope follows the caller's section rather than
// being fixed at 'banquet'. The catering arrangement screen still asks for its
// own product explicitly, and an explicit `?scope=` always wins — this only
// decides what a caller who named none meant.
const SCOPE_BY_SECTION: Record<Section, MenuScope> = {
  BANQUET: 'banquet',
  SMALL_BANQUET: 'smallBanquet',
};

const menuScopeOf = (request: Request) =>
  resolveMenuScope(request.query.scope, SCOPE_BY_SECTION[sectionOf(request)]);

export class MenuController {
  async list(request: Request, response: Response) {
    response.json(await menuService.listMenuItems(request.restaurantId!, menuScopeOf(request)));
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

  async saveArrangement(request: Request, response: Response) {
    const payload = arrangementSchema.parse(request.body);
    response.json(await menuService.saveArrangement(request.restaurantId!, payload));
  }

  async getSettings(request: Request, response: Response) {
    response.json(await menuService.getSettings(request.restaurantId!));
  }

  async saveSettings(request: Request, response: Response) {
    const payload = settingsSchema.parse(request.body);
    response.json(await menuService.saveSettings(request.restaurantId!, payload));
  }

  async remove(request: Request, response: Response) {
    const { menuItemId } = menuItemIdSchema.parse(request.params);
    await menuService.deleteMenuItem(menuItemId);
    response.status(204).send();
  }

  async assignSelection(request: Request, response: Response) {
    const { eventId } = eventIdSchema.parse(request.params);
    const payload = assignSelectionSchema.parse(request.body);
    const selection = await menuService.assignMenuItemToEvent(request.restaurantId!, sectionOf(request), eventId, payload);
    response.status(201).json(selection);
  }
}
