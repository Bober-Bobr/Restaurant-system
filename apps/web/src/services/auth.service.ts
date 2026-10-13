import axios from 'axios';
import type { AdminRole } from '../store/auth.store';
import type { WorkArea } from '../utils/workArea';
import { httpClient } from './http';

const baseURL = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:4000/api';

export type AuthResponse = {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  username: string;
  role: AdminRole;
  restaurantId: string | null;
  restaurantName: string | null;
  /** Which floor this person works — see utils/workArea.ts. */
  workArea?: WorkArea;
};

export type AdminUser = {
  id: string;
  username: string;
  role: AdminRole;
  restaurantId: string | null;
  /** Only the two food-service roles have one. */
  workArea?: WorkArea;
  createdAt: string;
};

export type DeviceSession = {
  id: string;
  userAgent: string | null;
  ipAddress: string | null;
  createdAt: string;
  lastSeenAt: string;
  isCurrent: boolean;
};

export const authService = {
  /**
   * Who am I, and which floor am I on.
   *
   * The floor is asked of the SERVER rather than read from the signed-in
   * session, because a manager may move somebody between floors mid-shift and
   * the screens have to follow — see `useWorkArea`.
   */
  async me() {
    const { data } = await httpClient.get<{ id: string; username: string; role: AdminRole; workArea: WorkArea }>('/auth/me');
    return data;
  },
  /**
   * Move an account between floors. `id` may be `me`; the server decides who
   * may set whose (`canSetWorkArea`, shared in utils/workArea.ts).
   */
  async setWorkArea(id: string, workArea: WorkArea) {
    const { data } = await httpClient.patch<AdminUser>(`/auth/users/${id}/work-area`, { workArea });
    return data;
  },
  async login(username: string, password: string) {
    const { data } = await httpClient.post<AuthResponse>('/auth/login', { username, password });
    return data;
  },
  async publicRegister(username: string, password: string, restaurantName: string) {
    const { data } = await axios.post<AuthResponse>(`${baseURL}/auth/register`, { username, password, restaurantName });
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
  },
  async updateUserRestaurant(id: string, restaurantId: string | null) {
    const { data } = await httpClient.patch<AdminUser>(`/auth/users/${id}/restaurant`, { restaurantId });
    return data;
  },
  async updateUserCredentials(id: string, payload: { username?: string; password?: string }) {
    const { data } = await httpClient.patch<AdminUser>(`/auth/users/${id}/credentials`, payload);
    return data;
  },
  async createUserAsChief(payload: { username: string; password: string; role: AdminRole; restaurantId?: string | null }) {
    const { data } = await httpClient.post<AdminUser>('/auth/users', payload);
    return data;
  },
  async listSessions() {
    const { data } = await httpClient.get<DeviceSession[]>('/auth/sessions');
    return data;
  },
  async revokeSession(id: string) {
    await httpClient.delete(`/auth/sessions/${id}`);
  }
};
