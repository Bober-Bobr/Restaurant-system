import axios, { type AxiosError } from 'axios';
import { useAuthStore } from '../store/auth.store';
import { useVInviteStore } from '../vinvite/store';

export const httpClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api'
});

let isRefreshing = false;
let refreshSubscribers: ((token: string) => void)[] = [];

const subscribeToRefresh = (callback: (token: string) => void) => {
  refreshSubscribers.push(callback);
};

const notifyRefreshSubscribers = (token: string) => {
  refreshSubscribers.forEach((callback) => callback(token));
  refreshSubscribers = [];
};

httpClient.interceptors.request.use((config) => {
  const accessToken = useAuthStore.getState().accessToken;
  const inviteToken = useVInviteStore.getState().accessToken;
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  } else if (inviteToken) {
    // v-invite.uz users share upload infrastructure (photos/audio) — their own
    // token authorizes those endpoints.
    config.headers.Authorization = `Bearer ${inviteToken}`;
  } else {
    const legacyKey = import.meta.env.VITE_ADMIN_API_KEY as string | undefined;
    if (legacyKey) {
      config.headers['x-admin-key'] = legacyKey;
    }
  }
  return config;
});

httpClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as any;
    const status = error.response?.status;
    const data = error.response?.data as any;

    // Handle token expiration
    if (status === 401 && data?.code === 'TOKEN_EXPIRED' && !originalRequest._retry) {
      originalRequest._retry = true;

      if (!isRefreshing) {
        isRefreshing = true;
        const refreshToken = useAuthStore.getState().refreshToken;

        // v-invite user (no admin session) → refresh against the vinvite auth.
        if (!refreshToken && useVInviteStore.getState().refreshToken) {
          try {
            const response = await axios.post(
              `${import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api'}/vinvite/auth/refresh`,
              { refreshToken: useVInviteStore.getState().refreshToken }
            );
            const { accessToken, refreshToken: newRefreshToken } = response.data;
            useVInviteStore.getState().setTokens(accessToken, newRefreshToken);
            notifyRefreshSubscribers(accessToken);
            isRefreshing = false;
            originalRequest.headers.Authorization = `Bearer ${accessToken}`;
            return httpClient(originalRequest);
          } catch {
            useVInviteStore.getState().logout();
            isRefreshing = false;
          }
          return Promise.reject(error);
        }

        if (refreshToken) {
          try {
            const response = await axios.post(
              `${import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api'}/auth/refresh`,
              { refreshToken }
            );
            const { accessToken, refreshToken: newRefreshToken, expiresIn } = response.data;
            useAuthStore.getState().setTokens(accessToken, newRefreshToken, expiresIn);
            notifyRefreshSubscribers(accessToken);
            isRefreshing = false;

            // Retry original request
            originalRequest.headers.Authorization = `Bearer ${accessToken}`;
            return httpClient(originalRequest);
          } catch {
            useAuthStore.getState().logout();
            isRefreshing = false;
          }
        } else {
          isRefreshing = false;
        }
      }

      return new Promise((resolve) => {
        subscribeToRefresh((token: string) => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          resolve(httpClient(originalRequest));
        });
      });
    }

    // Logout on unauthorized
    if (status === 401) {
      useAuthStore.getState().logout();
    }

    return Promise.reject(error);
  }
);
