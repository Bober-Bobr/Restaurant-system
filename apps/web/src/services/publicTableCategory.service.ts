import axios from 'axios';
import { DEFAULT_SECTION, type Section } from '../utils/section';
import type { TableCategory } from '../types/domain';

const publicTableCategoriesUrl = (): string => {
  const apiRoot = (import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api').replace(/\/$/, '');
  return `${apiRoot}/public/table-categories`;
};

export const publicTableCategoryService = {
  async listActive(restaurantId: string, section: Section = DEFAULT_SECTION): Promise<TableCategory[]> {
    const { data } = await axios.get<TableCategory[]>(publicTableCategoriesUrl(), { params: { restaurantId, section } });
    return data;
  }
};