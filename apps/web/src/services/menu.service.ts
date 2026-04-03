import type { MenuItem } from '../types/domain';
import { httpClient } from './http';

export const menuService = {
  async list() {
    const { data } = await httpClient.get<MenuItem[]>('/menu-items');
    return data;
  },
  async listAllForAdmin() {
    const { data } = await httpClient.get<MenuItem[]>('/menu-items/admin/all');
    return data;
  },
  async create(payload: Omit<MenuItem, 'id' | 'isActive'> & { isActive?: boolean }) {
    const { data } = await httpClient.post<MenuItem>('/menu-items', payload);
    return data;
  },
  async update(menuItemId: string, payload: Partial<Omit<MenuItem, 'id' | 'isActive'> & { isActive?: boolean }>) {
    const { data } = await httpClient.patch<MenuItem>(`/menu-items/${menuItemId}`, payload);
    return data;
  },
  async remove(menuItemId: string) {
    await httpClient.delete(`/menu-items/${menuItemId}`);
  },
  async assignToEvent(eventId: string, menuItemId: string, quantity: number) {
    await httpClient.post(`/menu-items/events/${eventId}/selections`, { menuItemId, quantity });
  }
};
