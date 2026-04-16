import { create } from 'zustand';
import { persist } from 'zustand/middleware';
export const useAuthStore = create()(persist((set) => ({
    accessToken: null,
    refreshToken: null,
    username: null,
    role: null,
    expiresAt: null,
    setTokens: (accessToken, refreshToken, expiresIn) => set({
        accessToken,
        refreshToken,
        expiresAt: Date.now() + expiresIn
    }),
    setAuth: (accessToken, refreshToken, username, expiresIn, role) => set({
        accessToken,
        refreshToken,
        username,
        role,
        expiresAt: Date.now() + expiresIn
    }),
    logout: () => set({
        accessToken: null,
        refreshToken: null,
        username: null,
        role: null,
        expiresAt: null
    })
}), { name: 'banquet-admin-auth' }));
