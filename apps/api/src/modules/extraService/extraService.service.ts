import createHttpError from 'http-errors';
import { ExtraServiceRepository, type CreateExtraServiceData } from './extraService.repository.js';
import type { Section } from '../../utils/section.js';

export class ExtraServiceService {
  constructor(private readonly repository: ExtraServiceRepository) {}

  // Scoped to the caller's restaurant AND section, so neither another tenant's
  // services nor the other section's can be touched by guessing an id. 404
  // rather than 403 for both: "not yours" and "not there" must look the same, or
  // the status code enumerates the ids that exist.
  private async getScoped(restaurantId: string, section: Section, id: string) {
    const service = await this.repository.getById(id);
    if (!service || service.restaurantId !== restaurantId || service.section !== section) {
      throw createHttpError(404, 'Service not found');
    }
    return service;
  }

  async listServices(restaurantId: string, section: Section, params?: { skip: number; take: number }) {
    return this.repository.list(restaurantId, section, params);
  }

  async createService(restaurantId: string, section: Section, payload: CreateExtraServiceData) {
    return this.repository.create(restaurantId, section, payload);
  }

  async updateService(restaurantId: string, section: Section, id: string, payload: Partial<CreateExtraServiceData>) {
    await this.getScoped(restaurantId, section, id);
    return this.repository.updateById(id, payload);
  }

  async getServiceDetails(restaurantId: string, section: Section, id: string) {
    return this.getScoped(restaurantId, section, id);
  }

  async deleteService(restaurantId: string, section: Section, id: string) {
    await this.getScoped(restaurantId, section, id);
    await this.repository.deleteById(id);
  }
}
