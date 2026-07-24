import axios from 'axios';
import { httpClient } from './http';

export type InvitationMenuItem = {
  number: number;
  name: string;
  photoUrl?: string | null;
};

// A gallery item is a still photo that links to an Instagram video.
// Legacy data may store a plain string (photo URL only).
export type InvitationGalleryItem = {
  photoUrl: string;
  videoUrl?: string | null;
};

export type Invitation = {
  id: string;
  slug: string;
  eventId: string | null;
  // null for standalone flyers (restaurant not in the system).
  restaurantId: string | null;

  // Freeform WYSIWYG block layout (empty → legacy fixed renderer is used).
  blocks?: import('../blocks/types').Block[];

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
  galleryPhotos: Array<string | InvitationGalleryItem>;

  instagramUrl: string | null;
  instagramLabel: string | null;
  phone: string | null;
  contactsTitle: string | null;
  contactVCardUrl: string | null;

  accentColor: string | null;
  backgroundColor: string | null;
  backgroundImageUrl: string | null;
  textColor: string | null;
  textScale: number | null;
  particles: string | null;
  particlesImageUrl: string | null;
  particlesColor: string | null;
  trailTemplate: string | null;
  trailColor: string | null;
  trailImageUrl: string | null;
  musicUrl: string | null;

  isPublished: boolean;
  createdAt: string;
  updatedAt: string;

  restaurant?: { id: string; name: string; logoUrl: string | null; company?: { logoUrl: string | null } | null };
  event?: { id: string; customerName: string; eventDate: string } | null;
  _count?: { requests: number };
};

// A call-back lead left by a visitor via the flyer's "form" block.
export type InvitationRequest = {
  id: string;
  invitationId: string;
  name: string;
  phone: string;
  message: string | null;
  createdAt: string;
};

const apiRoot = (): string =>
  (import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api').replace(/\/$/, '');

// Normalize gallery entries (legacy strings or objects) to a consistent shape.
export function normalizeGalleryItems(
  items: Array<string | InvitationGalleryItem> | null | undefined
): InvitationGalleryItem[] {
  return (items ?? []).map((it) =>
    typeof it === 'string' ? { photoUrl: it, videoUrl: null } : { photoUrl: it.photoUrl, videoUrl: it.videoUrl ?? null }
  );
}

export const invitationService = {
  async listByRestaurant(restaurantId: string): Promise<Invitation[]> {
    const { data } = await httpClient.get<Invitation[]>('/invitations', { params: { restaurantId } });
    return data;
  },
  // All flyer projects created by the signed-in manager.
  async listMine(): Promise<Invitation[]> {
    const { data } = await httpClient.get<Invitation[]>('/invitations/mine');
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
  async create(payload: Partial<Invitation> & { slug: string }): Promise<Invitation> {
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
  async listRequests(id: string): Promise<InvitationRequest[]> {
    const { data } = await httpClient.get<InvitationRequest[]>(`/invitations/${id}/requests`);
    return data;
  },
  async submitRequest(slug: string, payload: { name: string; phone: string; message?: string | null }): Promise<void> {
    await axios.post(`${apiRoot()}/public/invitations/${slug}/requests`, payload);
  },

  // ── Telegram forwarding ──
  async telegramStatus(id: string): Promise<TelegramStatus> {
    const { data } = await httpClient.get<TelegramStatus>(`/telegram/flyers/${id}/status`);
    return data;
  },
  async telegramRotate(id: string): Promise<TelegramStatus> {
    const { data } = await httpClient.post<Omit<TelegramStatus, 'enabled'>>(`/telegram/flyers/${id}/rotate`);
    return { ...data, enabled: true };
  },
  async telegramRemoveLink(id: string, linkId: string): Promise<void> {
    await httpClient.delete(`/telegram/flyers/${id}/links/${linkId}`);
  },
};

export type TelegramLink = {
  id: string;
  chatId: string;
  username: string | null;
  firstName: string | null;
  createdAt: string;
};
// `enabled:false` means the server has no bot token configured.
export type TelegramStatus = {
  enabled: boolean;
  code?: string;
  link?: string | null;
  links?: TelegramLink[];
};
