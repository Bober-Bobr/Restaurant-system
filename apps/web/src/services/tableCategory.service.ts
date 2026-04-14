import type { TableCategory } from '../types/domain';
import { httpClient } from './http';

export const tableCategoryService = {
  async list() {
    const { data } = await httpClient.get<TableCategory[]>('/table-categories');
    return data;
  },
  async create(payload: {
    name: string;
    includedCategories: string;
    ratePerPerson: number;
    description?: string;
    photoUrl?: string;
    isActive?: boolean;
  }) {
    const { data } = await httpClient.post<TableCategory>('/table-categories', payload);
    return data;
  },
  async update(id: string, payload: Partial<Omit<TableCategory, 'id'>>) {
    const { data } = await httpClient.patch<TableCategory>(`/table-categories/${id}`, payload);
    return data;
  },
  async remove(id: string) {
    await httpClient.delete(`/table-categories/${id}`);
  }
};
