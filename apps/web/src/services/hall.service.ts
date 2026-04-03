import type { Hall } from '../types/domain';
import { httpClient } from './http';

export const hallService = {
  async list() {
    const { data } = await httpClient.get<Hall[]>('/halls');
    return data;
  },
  async create(payload: {
    name: string;
    capacity: number;
    description?: string;
    photoUrl?: string;
    isActive?: boolean;
  }) {
    const { data } = await httpClient.post<Hall>('/halls', payload);
    return data;
  },
  async update(id: string, payload: Partial<Omit<Hall, 'id'>>) {
    const { data } = await httpClient.patch<Hall>(`/halls/${id}`, payload);
    return data;
  },
  async remove(id: string) {
    await httpClient.delete(`/halls/${id}`);
  }
};
