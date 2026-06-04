import axios from 'axios';
import { httpClient } from './http';

export type InvitationMenuItem = {
  number: number;
  name: string;
  photoUrl?: string | null;
};

export type Invitation = {
  id: string;
  slug: string;
  eventId: string | null;
  restaurantId: string;

  promoTitle: string | null;
  promoSubtitle: string | null;
  promoCode: string | null;
  promoImageUrl: string | null;
  promoCodeAlt: string | null;
  promoDescription: string | null;

  telegramUrl: string | null;
  telegramLabel: string | null;

  welcomeTitle: string | null;
  welcomeSubtitle: string | null;
  welcomeImageUrl: string | null;
  welcomeMessage: string | null;

  countdownAt: string | null;
  countdownLabel: string | null;

  menuItems: InvitationMenuItem[];
  galleryPhotos: string[];

  instagramUrl: string | null;
  instagramLabel: string | null;
  phone: string | null;
  contactsTitle: string | null;
  contactVCardUrl: string | null;

  isPublished: boolean;
  createdAt: string;
  updatedAt: string;

  restaurant?: { id: string; name: string; logoUrl: string | null };
  event?: { id: string; customerName: string; eventDate: string } | null;
};

const apiRoot = (): string =>
  (import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api').replace(/\/$/, '');

export const invitationService = {
  async listByRestaurant(restaurantId: string): Promise<Invitation[]> {
    const { data } = await httpClient.get<Invitation[]>('/invitations', { params: { restaurantId } });
    return data;
  },
  async byEvent(eventId: string, restaurantId: string): Promise<Invitation | null> {
    try {
      const { data } = await httpClient.get<Invitation>(`/invitations/by-event/${eventId}`, { params: { restaurantId } });
      return data;
    } catch (e) {
      if (axios.isAxiosError(e) && e.response?.status === 404) return null;
      throw e;
    }
  },
  async get(id: string): Promise<Invitation> {
    const { data } = await httpClient.get<Invitation>(`/invitations/${id}`);
    return data;
  },
  async create(payload: Partial<Invitation> & { slug: string; restaurantId: string }): Promise<Invitation> {
    const { data } = await httpClient.post<Invitation>('/invitations', payload);
    return data;
  },
  async update(id: string, payload: Partial<Invitation>): Promise<Invitation> {
    const { data } = await httpClient.patch<Invitation>(`/invitations/${id}`, payload);
    return data;
  },
  async remove(id: string): Promise<void> {
    await httpClient.delete(`/invitations/${id}`);
  },
  async publicBySlug(slug: string): Promise<Invitation> {
    const { data } = await axios.get<Invitation>(`${apiRoot()}/public/invitations/${slug}`);
    return data;
  },
};
