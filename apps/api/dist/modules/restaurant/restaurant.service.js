import createHttpError from 'http-errors';
export class RestaurantService {
    repo;
    constructor(repo) {
        this.repo = repo;
    }
    async listForOwner(ownerId) {
        return this.repo.findAllByOwner(ownerId);
    }
    async listForStaff(restaurantId) {
        const restaurant = await this.repo.findById(restaurantId);
        return restaurant ? [restaurant] : [];
    }
    async listForStaffByUserId(userId) {
        const restaurant = await this.repo.findByStaffUserId(userId);
        return restaurant ? [restaurant] : [];
    }
    async create(ownerId, data) {
        return this.repo.create(ownerId, data);
    }
    async update(ownerId, id, data) {
        const restaurant = await this.repo.findById(id);
        if (!restaurant)
            throw createHttpError(404, 'Restaurant not found');
        if (restaurant.ownerId !== ownerId)
            throw createHttpError(403, 'Forbidden');
        return this.repo.update(id, data);
    }
    async remove(ownerId, id) {
        const restaurant = await this.repo.findById(id);
        if (!restaurant)
            throw createHttpError(404, 'Restaurant not found');
        if (restaurant.ownerId !== ownerId)
            throw createHttpError(403, 'Forbidden');
        await this.repo.delete(id);
    }
}
