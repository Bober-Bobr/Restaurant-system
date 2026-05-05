import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Locale, defaultLocale } from '../utils/translate';

type AdminState = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
};

export const useAdminStore = create<AdminState>()(
  persist(
    (set) => ({
      locale: defaultLocale,
      setLocale: (locale) => set({ locale }),
    }),
    { name: 'banquet-admin-settings' }
  )
);