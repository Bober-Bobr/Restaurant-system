import type { Hall } from '../types/domain';
import { httpClient } from './http';

export type HallPayload = {
  name?: string;
  capacity?: number;
  description?: string | null;
  photoUrl?: string | null;
  photos?: string[];
  isActive?: boolean;
};

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
    photos?: string[];
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
  },

  // ── Manager / Chief: scope to a specific restaurant via ?restaurantId= ──
  async listForRestaurant(restaurantId: string) {
    const { data } = await httpClient.get<Hall[]>('/halls', { params: { restaurantId } });
    return data;
  },
  async createForRestaurant(restaurantId: string, payload: HallPayload & { name: string; capacity: number }) {
    const { data } = await httpClient.post<Hall>('/halls', { ...payload, restaurantId });
    return data;
  },
  async updateForRestaurant(restaurantId: string, id: string, payload: HallPayload) {
    const { data } = await httpClient.patch<Hall>(`/halls/${id}`, { ...payload, restaurantId });
    return data;
  },
  async removeForRestaurant(restaurantId: string, id: string) {
    await httpClient.delete(`/halls/${id}`, { params: { restaurantId } });
  },
};
