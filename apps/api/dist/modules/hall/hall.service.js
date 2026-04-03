import createHttpError from 'http-errors';
export class HallService {
    hallRepository;
    constructor(hallRepository) {
        this.hallRepository = hallRepository;
    }
    async listHalls(params) {
        return this.hallRepository.list(params);
    }
    async countHalls() {
        return this.hallRepository.count();
    }
    async createHall(payload) {
        const existing = await this.hallRepository.getByName(payload.name);
        if (existing) {
            throw createHttpError(409, 'Hall with this name already exists');
        }
        return this.hallRepository.create(payload);
    }
    async updateHall(id, payload) {
        const existing = await this.hallRepository.getById(id);
        if (!existing) {
            throw createHttpError(404, 'Hall not found');
        }
        if (payload.name && payload.name !== existing.name) {
            const nameTaken = await this.hallRepository.getByName(payload.name);
            if (nameTaken) {
                throw createHttpError(409, 'Hall with this name already exists');
            }
        }
        return this.hallRepository.updateById(id, payload);
    }
    async getHallDetails(id) {
        const hall = await this.hallRepository.getById(id);
        if (!hall) {
            throw createHttpError(404, 'Hall not found');
        }
        return hall;
    }
    async deleteHall(id) {
        const existing = await this.hallRepository.getById(id);
        if (!existing) {
            throw createHttpError(404, 'Hall not found');
        }
        await this.hallRepository.deleteById(id);
    }
}
