import axios from 'axios';
import { httpClient } from './http';

export type Brand = 'vconnect' | 'vinvite';
export type PlatformContact = { brand: Brand; phone: string; telegram: string };

const apiRoot = (): string =>
  (import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api').replace(/\/$/, '');

// Public read — used by every published flyer/invitation, so it must not
// require a session. Failure is non-fatal: the page simply shows no contacts.
export async function fetchPlatformContacts(): Promise<Record<Brand, PlatformContact>> {
  const out: Record<Brand, PlatformContact> = {
    vconnect: { brand: 'vconnect', phone: '', telegram: '' },
    vinvite: { brand: 'vinvite', phone: '', telegram: '' },
  };
  try {
    const { data } = await axios.get<PlatformContact[]>(`${apiRoot()}/public/platform-contacts`);
    for (const row of data) {
      if (row && (row.brand === 'vconnect' || row.brand === 'vinvite')) out[row.brand] = row;
    }
  } catch {
    /* non-fatal: the page simply shows no contacts */
  }
  return out;
}

// v-menu CHIEF_ADMIN: the v-connect block shown on flyers.
export const platformContactService = {
  async get() {
    const { data } = await httpClient.get<PlatformContact>('/platform-contacts');
    return data;
  },
  async save(payload: { phone: string; telegram: string }) {
    const { data } = await httpClient.patch<PlatformContact>('/platform-contacts', payload);
    return data;
  },
};
