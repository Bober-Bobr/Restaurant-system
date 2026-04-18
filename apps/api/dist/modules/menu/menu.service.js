import createHttpError from 'http-errors';
export class MenuService {
    menuRepository;
    eventRepository;
    constructor(menuRepository, eventRepository) {
        this.menuRepository = menuRepository;
        this.eventRepository = eventRepository;
    }
    async listMenuItems(restaurantId) {
        return this.menuRepository.listActive(restaurantId);
    }
    async listAllMenuItems(restaurantId) {
        return this.menuRepository.listAll(restaurantId);
    }
    async createMenuItem(restaurantId, payload) {
        return this.menuRepository.create(restaurantId, payload);
    }
    async updateMenuItem(menuItemId, payload) {
        const existingItem = await this.menuRepository.getById(menuItemId);
        if (!existingItem)
            throw createHttpError(404, 'Menu item not found');
        return this.menuRepository.updateById(menuItemId, payload);
    }
    async deleteMenuItem(menuItemId) {
        const existingItem = await this.menuRepository.getById(menuItemId);
        if (!existingItem)
            throw createHttpError(404, 'Menu item not found');
        await this.menuRepository.deleteById(menuItemId);
    }
    async assignMenuItemToEvent(restaurantId, eventId, payload) {
        const [event, menuItem] = await Promise.all([
            this.eventRepository.getByNumber(restaurantId, eventId),
            this.menuRepository.getById(payload.menuItemId)
        ]);
        if (!event)
            throw createHttpError(404, 'Event not found');
        if (!menuItem || !menuItem.isActive)
            throw createHttpError(404, 'Menu item not found or inactive');
        return this.menuRepository.upsertSelection(event.id, payload.menuItemId, payload.quantity, menuItem.priceCents);
    }
}
