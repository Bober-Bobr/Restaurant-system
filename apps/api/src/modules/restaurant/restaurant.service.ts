import createHttpError from 'http-errors';
import { RestaurantRepository } from './restaurant.repository.js';

export class RestaurantService {
  constructor(private readonly repo: RestaurantRepository) {}

  async listForOwner(ownerId: string) {
    return this.repo.findAllByOwner(ownerId);
  }

  async listForStaff(restaurantId: string) {
    const restaurant = await this.repo.findById(restaurantId);
    return restaurant ? [restaurant] : [];
  }

  async listForStaffByUserId(userId: string) {
    const restaurant = await this.repo.findByStaffUserId(userId);
    return restaurant ? [restaurant] : [];
  }

  async create(ownerId: string, data: { name: string; address?: string; logoUrl?: string }) {
    return this.repo.create(ownerId, data);
  }

  async update(ownerId: string, id: string, data: { name?: string; address?: string; logoUrl?: string }) {
    const restaurant = await this.repo.findById(id);
    if (!restaurant) throw createHttpError(404, 'Restaurant not found');
    if (restaurant.ownerId !== ownerId) throw createHttpError(403, 'Forbidden');
    return this.repo.update(id, data);
  }

  async remove(ownerId: string, id: string) {
    const restaurant = await this.repo.findById(id);
    if (!restaurant) throw createHttpError(404, 'Restaurant not found');
    if (restaurant.ownerId !== ownerId) throw createHttpError(403, 'Forbidden');
    await this.repo.delete(id);
  }
}
