import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type AuthState = {
  accessToken: string | null;
  refreshToken: string | null;
  username: string | null;
  expiresAt: number | null;
  setTokens: (accessToken: string, refreshToken: string, expiresIn: number) => void;
  setAuth: (accessToken: string, refreshToken: string, username: string, expiresIn: number) => void;
  logout: () => void;
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      username: null,
      expiresAt: null,
      setTokens: (accessToken, refreshToken, expiresIn) =>
        set({
          accessToken,
          refreshToken,
          expiresAt: Date.now() + expiresIn
        }),
      setAuth: (accessToken, refreshToken, username, expiresIn) =>
        set({
          accessToken,
          refreshToken,
          username,
          expiresAt: Date.now() + expiresIn
        }),
      logout: () =>
        set({
          accessToken: null,
          refreshToken: null,
          username: null,
          expiresAt: null
        })
    }),
    { name: 'banquet-admin-auth' }
  )
);
