import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Locale } from '../utils/translate';

export type InviteUser = {
  id: string;
  email: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  hasPassword: boolean;
  googleLinked: boolean;
  createdAt: string;
};

export type ViUiTheme = 'light' | 'dark';

type VInviteState = {
  accessToken: string | null;
  refreshToken: string | null;
  user: InviteUser | null;
  uiTheme: ViUiTheme;
  locale: Locale;
  setAuth: (accessToken: string, refreshToken: string, user: InviteUser) => void;
  setTokens: (accessToken: string, refreshToken: string) => void;
  setUser: (user: InviteUser) => void;
  setUiTheme: (t: ViUiTheme) => void;
  setLocale: (l: Locale) => void;
  logout: () => void;
};

export const useVInviteStore = create<VInviteState>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      user: null,
      uiTheme: 'light',
      locale: 'ru',
      setAuth: (accessToken, refreshToken, user) => set({ accessToken, refreshToken, user }),
      setTokens: (accessToken, refreshToken) => set({ accessToken, refreshToken }),
      setUser: (user) => set({ user }),
      setUiTheme: (uiTheme) => set({ uiTheme }),
      setLocale: (locale) => set({ locale }),
      logout: () => set({ accessToken: null, refreshToken: null, user: null }),
    }),
    { name: 'vinvite-auth' }
  )
);
