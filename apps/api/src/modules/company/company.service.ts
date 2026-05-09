import createHttpError from 'http-errors';
import { CompanyRepository } from './company.repository.js';

export class CompanyService {
  constructor(private readonly repo: CompanyRepository) {}

  async listMine(ownerId: string) {
    return this.repo.findAllByOwnerId(ownerId);
  }

  async create(ownerId: string, data: { name: string; logoUrl?: string }) {
    return this.repo.create(ownerId, data);
  }

  async updateOwn(ownerId: string, id: string, data: { name?: string; logoUrl?: string }) {
    const company = await this.repo.findById(id);
    if (!company) throw createHttpError(404, 'Company not found');
    if (company.ownerId !== ownerId) throw createHttpError(403, 'Forbidden');
    return this.repo.update(id, data);
  }

  async deleteOwn(ownerId: string, id: string) {
    const company = await this.repo.findById(id);
    if (!company) throw createHttpError(404, 'Company not found');
    if (company.ownerId !== ownerId) throw createHttpError(403, 'Forbidden');
    return this.repo.deleteById(id);
  }

  async listAllWithDetails() {
    return this.repo.findAllWithDetails();
  }

  async deleteAsChief(id: string) {
    return this.repo.deleteById(id);
  }
}
