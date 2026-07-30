import axios from 'axios';
import { httpClient } from './http';

const apiRoot = (): string =>
  (import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api').replace(/\/$/, '');

export type PerformerProfile = {
  id: string;
  userId: string;
  displayName: string;
  craft: string | null;
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
  status: 'PENDING' | 'ACCEPTED' | 'DECLINED';
  eventNumber: number | null;
  createdAt: string;
};

export type PerformerEventInput = {
  eventDate: string;
  eventTime: string;
  title: string;
  note?: string | null;
};

// Signed-in performer managing their own profile, calendar and inbox.
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
  craft: string | null;
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
  craft: string | null;
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
  restaurantId?: string | null;
  eventNumber?: number | null;
};

export const publicPerformerService = {
  async list(date?: string) {
    const { data } = await axios.get<PublicPerformer[]>(`${apiRoot()}/public/performers`, {
      params: date ? { date } : undefined,
    });
    return data;
  },
  async get(id: string) {
    const { data } = await axios.get<PublicPerformerDetail>(`${apiRoot()}/public/performers/${id}`);
    return data;
  },
  async book(payload: PerformerBookingPayload) {
    const { data } = await axios.post<{ id: string }>(`${apiRoot()}/public/performer-bookings`, payload);
    return data;
  },
};
