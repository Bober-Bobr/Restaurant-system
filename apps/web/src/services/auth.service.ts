import type { AdminRole } from '../store/auth.store';
import { httpClient } from './http';

export type AuthResponse = {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  username: string;
  role: AdminRole;
  restaurantId: string | null;
};

export type AdminUser = {
  id: string;
  username: string;
  role: AdminRole;
  restaurantId: string | null;
  createdAt: string;
};

export const authService = {
  async login(username: string, password: string) {
    const { data } = await httpClient.post<AuthResponse>('/auth/login', { username, password });
    return data;
  },
  async register(username: string, password: string, role?: AdminRole, restaurantId?: string) {
    const { data } = await httpClient.post<AuthResponse>('/auth/register', {
      username,
      password,
      ...(role ? { role } : {}),
      ...(restaurantId ? { restaurantId } : {})
    });
    return data;
  },
  async refresh(refreshToken: string) {
    const { data } = await httpClient.post<AuthResponse>('/auth/refresh', { refreshToken });
    return data;
  },
  async logout() {
    try {
      await httpClient.post('/auth/logout', {});
    } catch {
      // Continue logging out even if this fails
    }
  },
  async getMe() {
    const { data } = await httpClient.get<{ id: string; username: string; role: AdminRole }>('/auth/me');
    return data;
  },
  async listUsers() {
    const { data } = await httpClient.get<AdminUser[]>('/auth/users');
    return data;
  },
  async deleteUser(id: string) {
    await httpClient.delete(`/auth/users/${id}`);
  },
  async updateUserRole(id: string, role: AdminRole) {
    const { data } = await httpClient.patch<AdminUser>(`/auth/users/${id}/role`, { role });
    return data;
  }
};
