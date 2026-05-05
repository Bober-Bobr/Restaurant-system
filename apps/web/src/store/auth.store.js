import { create } from 'zustand';
import { persist } from 'zustand/middleware';
export const useAuthStore = create()(persist((set) => ({
    accessToken: null,
    refreshToken: null,
    username: null,
    role: null,
    restaurantId: null,
    restaurantName: null,
    expiresAt: null,
    setTokens: (accessToken, refreshToken, expiresIn) => set({ accessToken, refreshToken, expiresAt: Date.now() + expiresIn }),
    setAuth: (accessToken, refreshToken, username, expiresIn, role, restaurantId, restaurantName = null) => set({ accessToken, refreshToken, username, role, restaurantId, restaurantName, expiresAt: Date.now() + expiresIn }),
    logout: () => set({ accessToken: null, refreshToken: null, username: null, role: null, restaurantId: null, restaurantName: null, expiresAt: null })
}), { name: 'banquet-admin-auth' }));
