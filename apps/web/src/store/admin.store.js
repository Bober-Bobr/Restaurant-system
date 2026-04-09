import { create } from 'zustand';
import { defaultLocale } from '../utils/translate';
export const useAdminStore = create((set) => ({
    locale: defaultLocale,
    setLocale: (locale) => {
        set({ locale });
    }
}));
