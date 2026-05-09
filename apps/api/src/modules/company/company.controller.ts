import type { Request, Response } from 'express';
import { CompanyRepository } from './company.repository.js';
import { CompanyService } from './company.service.js';
import { createCompanySchema, updateCompanySchema } from './company.schema.js';

const service = new CompanyService(new CompanyRepository());

export class CompanyController {
  async listMine(request: Request, response: Response) {
    const companies = await service.listMine(request.admin!.id);
    response.json(companies);
  }

  async create(request: Request, response: Response) {
    const data = createCompanySchema.parse(request.body);
    const company = await service.create(request.admin!.id, data);
    response.status(201).json(company);
  }

  async updateOwn(request: Request, response: Response) {
    const data = updateCompanySchema.parse(request.body);
    const admin = request.admin!;
    if (admin.role === 'CHIEF_ADMIN') {
      const repo = (service as any).repo;
      const company = await repo.update(String(request.params.id), data);
      response.json(company);
      return;
    }
    const company = await service.updateOwn(admin.id, String(request.params.id), data);
    response.json(company);
  }

  async deleteOwn(request: Request, response: Response) {
    const admin = request.admin!;
    if (admin.role === 'CHIEF_ADMIN') {
      await service.deleteAsChief(String(request.params.id));
    } else {
      await service.deleteOwn(admin.id, String(request.params.id));
    }
    response.status(204).send();
  }

  async listAll(request: Request, response: Response) {
    const companies = await service.listAllWithDetails();
    response.json(companies);
  }

  async deleteAsChief(request: Request, response: Response) {
    await service.deleteAsChief(String(request.params.id));
    response.status(204).send();
  }
}
