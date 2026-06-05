import createHttpError from 'http-errors';
export class CompanyService {
    repo;
    constructor(repo) {
        this.repo = repo;
    }
    async listMine(ownerId) {
        return this.repo.findAllByOwnerId(ownerId);
    }
    async create(ownerId, data) {
        return this.repo.create(ownerId, data);
    }
    async updateOwn(ownerId, id, data) {
        const company = await this.repo.findById(id);
        if (!company)
            throw createHttpError(404, 'Company not found');
        if (company.ownerId !== ownerId)
            throw createHttpError(403, 'Forbidden');
        return this.repo.update(id, data);
    }
    async deleteOwn(ownerId, id) {
        const company = await this.repo.findById(id);
        if (!company)
            throw createHttpError(404, 'Company not found');
        if (company.ownerId !== ownerId)
            throw createHttpError(403, 'Forbidden');
        return this.repo.deleteById(id);
    }
    async listAllWithDetails() {
        return this.repo.findAllWithDetails();
    }
    async deleteAsChief(id) {
        return this.repo.deleteById(id);
    }
}
