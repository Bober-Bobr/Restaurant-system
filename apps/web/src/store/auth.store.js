import { create } from 'zustand';
import { persist } from 'zustand/middleware';
export const useAuthStore = create()(persist((set) => ({
    accessToken: null,
    refreshToken: null,
    username: null,
    expiresAt: null,
    setTokens: (accessToken, refreshToken, expiresIn) => set({
        accessToken,
        refreshToken,
        expiresAt: Date.now() + expiresIn
    }),
    setAuth: (accessToken, refreshToken, username, expiresIn) => set({
        accessToken,
        refreshToken,
        username,
        expiresAt: Date.now() + expiresIn
    }),
    logout: () => set({
        accessToken: null,
        refreshToken: null,
        username: null,
        expiresAt: null
    })
}), { name: 'banquet-admin-auth' }));
