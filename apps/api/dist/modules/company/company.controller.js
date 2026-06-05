import { CompanyRepository } from './company.repository.js';
import { CompanyService } from './company.service.js';
import { createCompanySchema, updateCompanySchema } from './company.schema.js';
const service = new CompanyService(new CompanyRepository());
export class CompanyController {
    async listMine(request, response) {
        const companies = await service.listMine(request.admin.id);
        response.json(companies);
    }
    async create(request, response) {
        const data = createCompanySchema.parse(request.body);
        const company = await service.create(request.admin.id, data);
        response.status(201).json(company);
    }
    async updateOwn(request, response) {
        const data = updateCompanySchema.parse(request.body);
        const admin = request.admin;
        if ((admin.role === 'CHIEF_ADMIN' || admin.role === 'MANAGER')) {
            const repo = service.repo;
            const company = await repo.update(String(request.params.id), data);
            response.json(company);
            return;
        }
        const company = await service.updateOwn(admin.id, String(request.params.id), data);
        response.json(company);
    }
    async deleteOwn(request, response) {
        const admin = request.admin;
        if ((admin.role === 'CHIEF_ADMIN' || admin.role === 'MANAGER')) {
            await service.deleteAsChief(String(request.params.id));
        }
        else {
            await service.deleteOwn(admin.id, String(request.params.id));
        }
        response.status(204).send();
    }
    async listAll(request, response) {
        const companies = await service.listAllWithDetails();
        response.json(companies);
    }
    async deleteAsChief(request, response) {
        await service.deleteAsChief(String(request.params.id));
        response.status(204).send();
    }
}
