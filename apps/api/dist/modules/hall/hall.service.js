import createHttpError from 'http-errors';
export class HallService {
    hallRepository;
    constructor(hallRepository) {
        this.hallRepository = hallRepository;
    }
    async listHalls(restaurantId, params) {
        return this.hallRepository.list(restaurantId, params);
    }
    async countHalls(restaurantId) {
        return this.hallRepository.count(restaurantId);
    }
    async createHall(restaurantId, payload) {
        const existing = await this.hallRepository.getByName(restaurantId, payload.name);
        if (existing)
            throw createHttpError(409, 'Hall with this name already exists');
        return this.hallRepository.create(restaurantId, payload);
    }
    async updateHall(restaurantId, id, payload) {
        const existing = await this.hallRepository.getById(id);
        if (!existing)
            throw createHttpError(404, 'Hall not found');
        if (payload.name && payload.name !== existing.name) {
            const nameTaken = await this.hallRepository.getByName(restaurantId, payload.name);
            if (nameTaken)
                throw createHttpError(409, 'Hall with this name already exists');
        }
        return this.hallRepository.updateById(id, payload);
    }
    async getHallDetails(id) {
        const hall = await this.hallRepository.getById(id);
        if (!hall)
            throw createHttpError(404, 'Hall not found');
        return hall;
    }
    async deleteHall(id) {
        const existing = await this.hallRepository.getById(id);
        if (!existing)
            throw createHttpError(404, 'Hall not found');
        await this.hallRepository.deleteById(id);
    }
}
