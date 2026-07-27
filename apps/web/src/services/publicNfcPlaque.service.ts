import axios from 'axios';
import type { NfcPlaque } from './nfcPlaque.service';

const publicPlaqueUrl = (slug: string): string => {
  const apiRoot = (import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api').replace(/\/$/, '');
  return `${apiRoot}/public/nfc-plaques/${encodeURIComponent(slug)}`;
};

export const publicNfcPlaqueService = {
  async bySlug(slug: string): Promise<NfcPlaque> {
    const { data } = await axios.get<NfcPlaque>(publicPlaqueUrl(slug));
    return data;
  },
};
