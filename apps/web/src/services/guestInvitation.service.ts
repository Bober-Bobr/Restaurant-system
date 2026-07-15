import axios from 'axios';
import { httpClient } from './http';

export type TrailTemplate = 'sparkle' | 'hearts' | 'candy';

export type AnimationType =
  | 'none'
  | 'fade'
  | 'slide-up'
  | 'slide-down'
  | 'slide-left'
  | 'slide-right'
  | 'zoom'
  | 'blur'
  | 'flip';

export type SectionAnimation = {
  type: AnimationType;
  durationMs?: number;
  delayMs?: number;
};

export type TimingItem = { time: string; label: string };

// Section keys that can be animated independently in the wedding renderer.
export const ANIMATABLE_SECTIONS = [
  'hero',
  'greeting',
  'venue',
  'timing',
  'rsvp',
  'countdown',
  'contacts',
] as const;
export type SectionKey = (typeof ANIMATABLE_SECTIONS)[number];

export type GuestInvitation = {
  id: string;
  slug: string;
  createdById: string | null;

  // Freeform WYSIWYG block layout (empty → legacy fixed renderer is used).
  blocks?: import('../blocks/types').Block[];

  accentColor: string | null;
  backgroundColor: string | null;
  backgroundImageUrl: string | null;
  textColor: string | null;
  musicUrl: string | null;
  trailTemplate: TrailTemplate;
  trailColor: string | null;

  coupleNames: string | null;
  heroSubtitle: string | null;
  heroImageUrl: string | null;

  greetingTitle: string | null;
  greetingMessage: string | null;
  coupleSignature: string | null;

  venueLabel: string | null;
  venueName: string | null;
  eventDate: string | null;
  venueImageUrl: string | null;
  mapAddress: string | null;
  mapButtonLabel: string | null;

  timingTitle: string | null;
  timingItems: TimingItem[];

  countdownAt: string | null;
  countdownLabel: string | null;

  telegramUrl: string | null;
  phone: string | null;
  instagramUrl: string | null;
  brandLabel: string | null;

  rsvpTitle: string | null;
  rsvpEnabled: boolean;

  sectionAnimations: Partial<Record<SectionKey, SectionAnimation>>;

  isPublished: boolean;
  createdAt: string;
  updatedAt: string;

  // Present only in the manager list endpoint.
  _count?: { rsvps: number };
};

export type GuestInvitationRsvp = {
  id: string;
  guestName: string;
  attending: boolean;
  createdAt: string;
};

const apiRoot = (): string =>
  (import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api').replace(/\/$/, '');

export const guestInvitationService = {
  async listMine(): Promise<GuestInvitation[]> {
    const { data } = await httpClient.get<GuestInvitation[]>('/guest-invitations');
    return data;
  },
  async get(id: string): Promise<GuestInvitation> {
    const { data } = await httpClient.get<GuestInvitation>(`/guest-invitations/${id}`);
    return data;
  },
  async create(payload: Partial<GuestInvitation> & { slug: string }): Promise<GuestInvitation> {
    const { data } = await httpClient.post<GuestInvitation>('/guest-invitations', payload);
    return data;
  },
  async update(id: string, payload: Partial<GuestInvitation>): Promise<GuestInvitation> {
    const { data } = await httpClient.patch<GuestInvitation>(`/guest-invitations/${id}`, payload);
    return data;
  },
  async remove(id: string): Promise<void> {
    await httpClient.delete(`/guest-invitations/${id}`);
  },
  async listRsvps(id: string): Promise<GuestInvitationRsvp[]> {
    const { data } = await httpClient.get<GuestInvitationRsvp[]>(`/guest-invitations/${id}/rsvps`);
    return data;
  },

  // Public (no auth)
  async publicBySlug(slug: string): Promise<GuestInvitation> {
    const { data } = await axios.get<GuestInvitation>(`${apiRoot()}/public/guest-invitations/${slug}`);
    return data;
  },
  async submitRsvp(slug: string, payload: { guestName: string; attending: boolean }): Promise<void> {
    await axios.post(`${apiRoot()}/public/guest-invitations/${slug}/rsvp`, payload);
  },
};
