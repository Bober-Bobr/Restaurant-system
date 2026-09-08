import createHttpError from 'http-errors';
import { HallRepository, type CreateHallData } from './hall.repository.js';
import type { Section } from '../../utils/section.js';

export class HallService {
  constructor(private readonly hallRepository: HallRepository) {}

  /**
   * A hall fetched by id alone belongs to whichever section created it, and the
   * id is the only thing the caller supplies on the detail/update/delete paths.
   * So every one of them re-checks the section before doing anything.
   *
   * It answers 404, not 403: "not yours" and "not there" must look identical, or
   * the error code itself tells a supervisor which ids belong to the banquet
   * side. Same reasoning as the restaurant scoping around it.
   */
  private async getInSection(id: string, section: Section) {
    const hall = await this.hallRepository.getById(id);
    if (!hall || hall.section !== section) throw createHttpError(404, 'Hall not found');
    return hall;
  }

  async listHalls(restaurantId: string, section: Section, params?: { skip: number; take: number }) {
    return this.hallRepository.list(restaurantId, section, params);
  }

  async countHalls(restaurantId: string, section: Section) {
    return this.hallRepository.count(restaurantId, section);
  }

  async createHall(restaurantId: string, section: Section, payload: CreateHallData) {
    const existing = await this.hallRepository.getByName(restaurantId, section, payload.name);
    if (existing) throw createHttpError(409, 'Hall with this name already exists');
    return this.hallRepository.create(restaurantId, section, payload);
  }

  async updateHall(restaurantId: string, section: Section, id: string, payload: Partial<CreateHallData>) {
    const existing = await this.getInSection(id, section);

    if (payload.name && payload.name !== existing.name) {
      const nameTaken = await this.hallRepository.getByName(restaurantId, section, payload.name);
      if (nameTaken) throw createHttpError(409, 'Hall with this name already exists');
    }
    return this.hallRepository.updateById(id, payload);
  }

  async getHallDetails(id: string, section: Section) {
    return this.getInSection(id, section);
  }

  async deleteHall(id: string, section: Section) {
    await this.getInSection(id, section);
    await this.hallRepository.deleteById(id);
  }
}
