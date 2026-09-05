import createHttpError from 'http-errors';
import { ExtraServiceRepository, type CreateExtraServiceData } from './extraService.repository.js';

export class ExtraServiceService {
  constructor(private readonly repository: ExtraServiceRepository) {}

  async listServices(restaurantId: string, params?: { skip: number; take: number }) {
    return this.repository.list(restaurantId, params);
  }

  async createService(restaurantId: string, payload: CreateExtraServiceData) {
    return this.repository.create(restaurantId, payload);
  }

  // Updates are scoped to the caller's restaurant so one tenant cannot touch
  // another's services by guessing an id.
  async updateService(restaurantId: string, id: string, payload: Partial<CreateExtraServiceData>) {
    const existing = await this.repository.getById(id);
    if (!existing || existing.restaurantId !== restaurantId) throw createHttpError(404, 'Service not found');
    return this.repository.updateById(id, payload);
  }

  async getServiceDetails(restaurantId: string, id: string) {
    const service = await this.repository.getById(id);
    if (!service || service.restaurantId !== restaurantId) throw createHttpError(404, 'Service not found');
    return service;
  }

  async deleteService(restaurantId: string, id: string) {
    const existing = await this.repository.getById(id);
    if (!existing || existing.restaurantId !== restaurantId) throw createHttpError(404, 'Service not found');
    await this.repository.deleteById(id);
  }
}
