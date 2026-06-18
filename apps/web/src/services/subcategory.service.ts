import type { Subcategory } from '../types/domain';
import { httpClient } from './http';

export const subcategoryService = {
  async list() {
    const { data } = await httpClient.get<Subcategory[]>('/subcategories');
    return data;
  },
  async create(payload: { name: string; category: Subcategory['category']; sortOrder?: number; hidden?: boolean }) {
    const { data } = await httpClient.post<Subcategory>('/subcategories', payload);
    return data;
  },
  async update(id: string, payload: Partial<{ name: string; category: Subcategory['category']; sortOrder: number; hidden: boolean }>) {
    const { data } = await httpClient.patch<Subcategory>(`/subcategories/${id}`, payload);
    return data;
  },
  async remove(id: string) {
    await httpClient.delete(`/subcategories/${id}`);
  },
  async saveArrangement(order: { id: string; sortOrder: number }[]) {
    const { data } = await httpClient.put('/subcategories/arrangement', { order });
    return data;
  },
};
