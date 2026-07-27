import type { Block } from '../blocks/types';
import type { DesignTheme } from './designTemplate.service';
import { httpClient } from './http';

export type NfcPlaque = {
  id: string;
  slug: string;
  businessName: string;
  blocks: Block[];
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
} & DesignTheme;

export type NfcPlaquePayload = Partial<Omit<NfcPlaque, 'id' | 'createdAt' | 'updatedAt'>>;

export const nfcPlaqueService = {
  async listMine() {
    const { data } = await httpClient.get<NfcPlaque[]>('/nfc-plaques');
    return data;
  },
  async get(id: string) {
    const { data } = await httpClient.get<NfcPlaque>(`/nfc-plaques/${id}`);
    return data;
  },
  async create(payload: NfcPlaquePayload & { businessName: string; slug: string }) {
    const { data } = await httpClient.post<NfcPlaque>('/nfc-plaques', payload);
    return data;
  },
  async update(id: string, payload: NfcPlaquePayload) {
    const { data } = await httpClient.patch<NfcPlaque>(`/nfc-plaques/${id}`, payload);
    return data;
  },
  async remove(id: string) {
    await httpClient.delete(`/nfc-plaques/${id}`);
  },
  async slugAvailable(slug: string, excludeId?: string) {
    const { data } = await httpClient.get<{ available: boolean }>('/nfc-plaques/slug-available', {
      params: { slug, ...(excludeId ? { excludeId } : {}) },
    });
    return data.available;
  },
};
