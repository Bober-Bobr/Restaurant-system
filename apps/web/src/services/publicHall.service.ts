import axios from 'axios';
import { DEFAULT_SECTION, type Section } from '../utils/section';
import type { Hall } from '../types/domain';

const publicHallsUrl = (): string => {
  const apiRoot = (import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api').replace(/\/$/, '');
  return `${apiRoot}/public/halls`;
};

export const publicHallService = {
  async listActive(restaurantId: string, section: Section = DEFAULT_SECTION): Promise<Hall[]> {
    const { data } = await axios.get<Hall[]>(publicHallsUrl(), { params: { restaurantId, section } });
    return data;
  }
};