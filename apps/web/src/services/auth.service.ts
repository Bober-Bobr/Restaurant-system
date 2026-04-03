import { httpClient } from './http';

export type AuthResponse = {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  username: string;
};

export const authService = {
  async login(username: string, password: string) {
    const { data } = await httpClient.post<AuthResponse>('/auth/login', { username, password });
    return data;
  },
  async register(username: string, password: string) {
    const { data } = await httpClient.post<AuthResponse>('/auth/register', { username, password });
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
    const { data } = await httpClient.get<{ id: string; username: string }>('/auth/me');
    return data;
  }
};
