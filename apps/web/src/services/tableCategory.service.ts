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
    packageItems?: { menuItemId: string; servings: number }[];
    ratePerPerson: number;
    discountPercent?: number;
    description?: string;
    photoUrl?: string;
    photos?: string[];
    isActive?: boolean;
  }) {
    const { data } = await httpClient.post<TableCategory>('/table-categories', payload);
    return data;
  },
  async update(id: string, payload: Partial<Omit<TableCategory, 'id' | 'packageItems'>> & { packageItems?: { menuItemId: string; servings: number }[] }) {
    const { data } = await httpClient.patch<TableCategory>(`/table-categories/${id}`, payload);
    return data;
  },
  async listAll() {
    const { data } = await httpClient.get<TableCategory[]>('/table-categories/all');
    return data;
  },
  async saveArrangement(order: { id: string; sortOrder: number }[]) {
    await httpClient.put('/table-categories/arrangement', { order });
  },
  async remove(id: string) {
    await httpClient.delete(`/table-categories/${id}`);
  }
};
