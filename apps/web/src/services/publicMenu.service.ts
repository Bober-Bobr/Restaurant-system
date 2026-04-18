import axios from 'axios';
import type { MenuItem } from '../types/domain';

const publicMenuUrl = (): string => {
  const apiRoot = (import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api').replace(/\/$/, '');
  return `${apiRoot}/public/menu-items`;
};

export const publicMenuService = {
  async listActive(restaurantId: string): Promise<MenuItem[]> {
    const { data } = await axios.get<MenuItem[]>(publicMenuUrl(), { params: { restaurantId } });
    return data;
  }
};
