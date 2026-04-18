import axios from 'axios';
import type { TableCategory } from '../types/domain';

const publicTableCategoriesUrl = (): string => {
  const apiRoot = (import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api').replace(/\/$/, '');
  return `${apiRoot}/public/table-categories`;
};

export const publicTableCategoryService = {
  async listActive(restaurantId: string): Promise<TableCategory[]> {
    const { data } = await axios.get<TableCategory[]>(publicTableCategoriesUrl(), { params: { restaurantId } });
    return data;
  }
};