import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { defaultLocale } from '../utils/translate';
export const useAdminStore = create()(persist((set) => ({
    locale: defaultLocale,
    setLocale: (locale) => set({ locale }),
}), { name: 'banquet-admin-settings' }));
