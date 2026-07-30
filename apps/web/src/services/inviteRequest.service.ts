import axios from 'axios';

const apiRoot = (): string =>
  (import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api').replace(/\/$/, '');

export type InviteRequestPayload = {
  names: string[];
  eventType: string;
  phone: string;
  cardNumber?: string | null;
  restaurantName: string;
  eventDate: string;
  eventTime: string;
  menu?: string | null;
  photoUrls?: string[];
  dressCode?: string | null;
  restaurantId?: string | null;
  eventNumber?: number | null;
};

// Submitted from the Additional Services page, which is reachable without any
// login — hence a bare axios call rather than the authenticated http client.
export const inviteRequestService = {
  async submit(payload: InviteRequestPayload): Promise<{ id: string; createdAt: string }> {
    const { data } = await axios.post(`${apiRoot()}/public/invite-requests`, payload);
    return data;
  },
  // Uploads a batch in one request and returns the URLs in the same order.
  async uploadPhotos(files: File[]): Promise<string[]> {
    const form = new FormData();
    for (const file of files) form.append('file', file);
    const { data } = await axios.post<{ urls: string[] }>(`${apiRoot()}/public/invite-request-photo`, form);
    return data.urls ?? [];
  },
};
