import type { ExcludedCategories, MenuItem, MenuScope } from '../types/domain';
import { httpClient } from './http';

export type MenuSettings = { excludedCategories: ExcludedCategories; hideSubcategories: boolean };

export const menuService = {
  // `scope` picks which product's excluded-category list applies — the banquet
  // surfaces (events, tablet flow) or the catering arrangement screen.
  async list(scope: MenuScope = 'banquet') {
    const { data } = await httpClient.get<MenuItem[]>('/menu-items', { params: { scope } });
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
  async assignToEvent(eventId: number, menuItemId: string, quantity: number) {
    await httpClient.post(`/menu-items/events/${eventId}/selections`, { menuItemId, quantity });
  },
  async saveArrangement(payload: {
    categoryOrder: MenuItem['category'][];
    dishOrder: { id: string; sortOrder: number }[];
  }) {
    await httpClient.put('/menu-items/arrangement', payload);
  },
  /**
   * Every dish, with ONE system's switch — for the Settings page. `scope` is
   * honoured for the Chief Admin and the Owner only; everyone else gets their
   * own system whatever is sent.
   */
  async getSettingsDishes(scope: MenuScope) {
    const { data } = await httpClient.get<{ scope: MenuScope; dishes: MenuItem[] }>('/menu-items/settings/dishes', { params: { scope } });
    return data;
  },
  async getSettings() {
    const { data } = await httpClient.get<MenuSettings>('/menu-items/settings');
    return data;
  },
  // A scope left out of `excludedCategories` keeps whatever it already held, so
  // saving one product's list never touches the other's.
  async saveSettings(payload: {
    excludedCategories?: Partial<ExcludedCategories>;
    /** Per system: the COMPLETE list of dishes switched off — every other dish is switched back on. */
    disabledDishes?: Partial<Record<MenuScope, string[]>>;
    hideSubcategories?: boolean;
  }) {
    const { data } = await httpClient.put<MenuSettings>('/menu-items/settings', payload);
    return data;
  }
};
