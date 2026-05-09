import createHttpError from 'http-errors';
import { CompanyRepository } from './company.repository.js';

export class CompanyService {
  constructor(private readonly repo: CompanyRepository) {}

  async getMine(ownerId: string) {
    return this.repo.findByOwnerId(ownerId);
  }

  async create(ownerId: string, data: { name: string; logoUrl?: string }) {
    const existing = await this.repo.findByOwnerId(ownerId);
    if (existing) throw createHttpError(409, 'You already have a company. Use PATCH to update it.');
    return this.repo.create(ownerId, data);
  }

  async update(ownerId: string, data: { name?: string; logoUrl?: string }) {
    const company = await this.repo.findByOwnerId(ownerId);
    if (!company) throw createHttpError(404, 'Company not found. Create one first.');
    return this.repo.update(company.id, data);
  }
}
