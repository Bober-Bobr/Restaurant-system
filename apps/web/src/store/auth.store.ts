import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type AdminRole = 'OWNER' | 'ADMIN' | 'EMPLOYEE';

type AuthState = {
  accessToken: string | null;
  refreshToken: string | null;
  username: string | null;
  role: AdminRole | null;
  expiresAt: number | null;
  setTokens: (accessToken: string, refreshToken: string, expiresIn: number) => void;
  setAuth: (accessToken: string, refreshToken: string, username: string, expiresIn: number, role: AdminRole) => void;
  logout: () => void;
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      username: null,
      role: null,
      expiresAt: null,
      setTokens: (accessToken, refreshToken, expiresIn) =>
        set({
          accessToken,
          refreshToken,
          expiresAt: Date.now() + expiresIn
        }),
      setAuth: (accessToken, refreshToken, username, expiresIn, role) =>
        set({
          accessToken,
          refreshToken,
          username,
          role,
          expiresAt: Date.now() + expiresIn
        }),
      logout: () =>
        set({
          accessToken: null,
          refreshToken: null,
          username: null,
          role: null,
          expiresAt: null
        })
    }),
    { name: 'banquet-admin-auth' }
  )
);
