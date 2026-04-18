import { httpClient } from './http';

export type Restaurant = {
  id: string;
  name: string;
  address: string | null;
  logoUrl: string | null;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
};

export type CreateRestaurantPayload = {
  name: string;
  address?: string;
  logoUrl?: string;
};

export const restaurantService = {
  async list() {
    const { data } = await httpClient.get<Restaurant[]>('/restaurants');
    return data;
  },
  async create(payload: CreateRestaurantPayload) {
    const { data } = await httpClient.post<Restaurant>('/restaurants', payload);
    return data;
  },
  async update(id: string, payload: Partial<CreateRestaurantPayload>) {
    const { data } = await httpClient.patch<Restaurant>(`/restaurants/${id}`, payload);
    return data;
  },
  async remove(id: string) {
    await httpClient.delete(`/restaurants/${id}`);
  }
};
