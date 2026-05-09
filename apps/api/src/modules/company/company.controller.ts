import type { Request, Response } from 'express';
import { CompanyRepository } from './company.repository.js';
import { CompanyService } from './company.service.js';
import { createCompanySchema, updateCompanySchema } from './company.schema.js';

const service = new CompanyService(new CompanyRepository());

export class CompanyController {
  async getMine(request: Request, response: Response) {
    const company = await service.getMine(request.admin!.id);
    response.json(company ?? null);
  }

  async create(request: Request, response: Response) {
    const data = createCompanySchema.parse(request.body);
    const company = await service.create(request.admin!.id, data);
    response.status(201).json(company);
  }

  async update(request: Request, response: Response) {
    const data = updateCompanySchema.parse(request.body);
    const company = await service.update(request.admin!.id, data);
    response.json(company);
  }
}
