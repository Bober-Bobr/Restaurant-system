import createHttpError from 'http-errors';
import { HallRepository, type CreateHallData } from './hall.repository.js';

export class HallService {
  constructor(private readonly hallRepository: HallRepository) {}

  async listHalls(params: { skip: number; take: number }) {
    return this.hallRepository.list(params);
  }

  async countHalls() {
    return this.hallRepository.count();
  }

  async createHall(payload: CreateHallData) {
    const existing = await this.hallRepository.getByName(payload.name);
    if (existing) {
      throw createHttpError(409, 'Hall with this name already exists');
    }

    return this.hallRepository.create(payload);
  }

  async updateHall(id: string, payload: Partial<CreateHallData>) {
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

  async getHallDetails(id: string) {
    const hall = await this.hallRepository.getById(id);

    if (!hall) {
      throw createHttpError(404, 'Hall not found');
    }

    return hall;
  }

  async deleteHall(id: string) {
    const existing = await this.hallRepository.getById(id);

    if (!existing) {
      throw createHttpError(404, 'Hall not found');
    }

    await this.hallRepository.deleteById(id);
  }
}
