import { create } from 'zustand';
import { Locale, defaultLocale } from '../utils/translate';

type AdminState = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
};

export const useAdminStore = create<AdminState>((set) => ({
  locale: defaultLocale,
  setLocale: (locale) => {
    set({ locale });
  }
}));