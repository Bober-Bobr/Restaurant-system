import axios from 'axios';
import { httpClient } from './http';

const apiRoot = (): string =>
  (import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api').replace(/\/$/, '');

// Performers and hosts are two roles sharing one profile/calendar/booking
// system. The kind selects which block the public reads; the signed-in side
// needs no kind at all, since the token already says which the caller is.
export type ServiceKind = 'performer' | 'host';

export type PerformerProfile = {
  id: string;
  userId: string;
  displayName: string;
  bio: string | null;
  phone: string | null;
  avatarUrl: string | null;
  photos: string[];
  videos: string[];
  isVisible: boolean;
};

export type PerformerEvent = {
  id: string;
  eventDate: string;
  eventTime: string;
  title: string;
  note: string | null;
  // The running order. Hosts fill this in; performers leave it null.
  program: string | null;
  // Set when the entry came from an accepted booking rather than by hand.
  bookingId: string | null;
};

export type PerformerBooking = {
  id: string;
  restaurantName: string;
  contactName: string;
  phone: string;
  eventDate: string;
  eventTime: string;
  eventType: string | null;
  note: string | null;
  // Supplied by the client when booking a host; null for a performer.
  program: string | null;
  status: 'PENDING' | 'ACCEPTED' | 'DECLINED';
  eventNumber: number | null;
  createdAt: string;
};

export type PerformerEventInput = {
  eventDate: string;
  eventTime: string;
  title: string;
  note?: string | null;
  program?: string | null;
};

// Signed-in performer or host managing their own profile, calendar and inbox.
export const performerService = {
  async getProfile() {
    const { data } = await httpClient.get<PerformerProfile>('/performers/me');
    return data;
  },
  async updateProfile(payload: Partial<Omit<PerformerProfile, 'id' | 'userId'>>) {
    const { data } = await httpClient.patch<PerformerProfile>('/performers/me', payload);
    return data;
  },
  async uploadMedia(files: File[]) {
    const form = new FormData();
    for (const file of files) form.append('file', file);
    const { data } = await httpClient.post<{ urls: string[] }>('/performers/me/media', form);
    return data.urls ?? [];
  },

  async listEvents() {
    const { data } = await httpClient.get<PerformerEvent[]>('/performers/me/events');
    return data;
  },
  async createEvent(payload: PerformerEventInput) {
    const { data } = await httpClient.post<PerformerEvent>('/performers/me/events', payload);
    return data;
  },
  async updateEvent(id: string, payload: Partial<PerformerEventInput>) {
    const { data } = await httpClient.patch<PerformerEvent>(`/performers/me/events/${id}`, payload);
    return data;
  },
  async removeEvent(id: string) {
    await httpClient.delete(`/performers/me/events/${id}`);
  },

  async listBookings() {
    const { data } = await httpClient.get<PerformerBooking[]>('/performers/me/bookings');
    return data;
  },
  async pendingCount() {
    const { data } = await httpClient.get<{ count: number }>('/performers/me/bookings/pending-count');
    return data.count;
  },
  async decideBooking(id: string, status: 'ACCEPTED' | 'DECLINED') {
    const { data } = await httpClient.patch<PerformerBooking>(`/performers/me/bookings/${id}`, { status });
    return data;
  },
};

// ── Public side (Additional Services page — no account) ──────────────────────

export type PublicPerformer = {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  photoCount: number;
  videoCount: number;
  // Undefined when no date was supplied, so "free" is distinguishable from
  // "not asked".
  available?: boolean;
};

export type PublicPerformerDetail = {
  id: string;
  displayName: string;
  bio: string | null;
  phone: string | null;
  avatarUrl: string | null;
  photos: string[];
  videos: string[];
};

export type PerformerBookingPayload = {
  performerId: string;
  restaurantName: string;
  contactName: string;
  phone: string;
  eventDate: string;
  eventTime: string;
  eventType?: string | null;
  note?: string | null;
  // Required by the server when the target is a host.
  program?: string | null;
  restaurantId?: string | null;
  eventNumber?: number | null;
};

export const publicPerformerService = {
  async list(kind: ServiceKind, date?: string) {
    const { data } = await axios.get<PublicPerformer[]>(`${apiRoot()}/public/performers`, {
      params: { kind, ...(date ? { date } : {}) },
    });
    return data;
  },
  async get(kind: ServiceKind, id: string) {
    const { data } = await axios.get<PublicPerformerDetail>(`${apiRoot()}/public/performers/${id}`, {
      params: { kind },
    });
    return data;
  },
  // One endpoint for both: the server resolves the target's role and decides
  // whether the programme was required.
  async book(payload: PerformerBookingPayload) {
    const { data } = await axios.post<{ id: string }>(`${apiRoot()}/public/performer-bookings`, payload);
    return data;
  },
};
