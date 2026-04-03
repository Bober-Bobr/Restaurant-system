import { EventRepository } from '../events/event.repository.js';
import { eventIdSchema } from '../events/event.schema.js';
import { assignSelectionSchema, createMenuItemSchema, menuItemIdSchema, updateMenuItemSchema } from './menu.schema.js';
import { MenuRepository } from './menu.repository.js';
import { MenuService } from './menu.service.js';
const menuService = new MenuService(new MenuRepository(), new EventRepository());
export class MenuController {
    async list(_request, response) {
        const items = await menuService.listMenuItems();
        response.json(items);
    }
    async listAll(_request, response) {
        const items = await menuService.listAllMenuItems();
        response.json(items);
    }
    async create(request, response) {
        const payload = createMenuItemSchema.parse(request.body);
        const item = await menuService.createMenuItem(payload);
        response.status(201).json(item);
    }
    async update(request, response) {
        const { menuItemId } = menuItemIdSchema.parse(request.params);
        const payload = updateMenuItemSchema.parse(request.body);
        const item = await menuService.updateMenuItem(menuItemId, payload);
        response.json(item);
    }
    async remove(request, response) {
        const { menuItemId } = menuItemIdSchema.parse(request.params);
        await menuService.deleteMenuItem(menuItemId);
        response.status(204).send();
    }
    async assignSelection(request, response) {
        const { eventId } = eventIdSchema.parse(request.params);
        const payload = assignSelectionSchema.parse(request.body);
        const selection = await menuService.assignMenuItemToEvent(eventId, payload);
        response.status(201).json(selection);
    }
}
