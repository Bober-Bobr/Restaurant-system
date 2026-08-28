import axios from 'axios';
import type { MenuItem, MenuScope } from '../types/domain';

const publicMenuUrl = (): string => {
  const apiRoot = (import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api').replace(/\/$/, '');
  return `${apiRoot}/public/menu-items`;
};

export const publicMenuService = {
  // `scope` picks which product's excluded-category list applies. This endpoint
  // serves the public catering and food-service sites AND the banquet tablet,
  // which is why the caller has to say. Default is the public sites.
  async listActive(restaurantId: string, scope: MenuScope = 'catering'): Promise<MenuItem[]> {
    const { data } = await axios.get<MenuItem[]>(publicMenuUrl(), { params: { restaurantId, scope } });
    return data;
  }
};
