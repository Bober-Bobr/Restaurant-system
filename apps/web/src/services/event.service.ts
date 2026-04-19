import type { Event } from '../types/domain';
import { httpClient } from './http';

export const eventService = {
  async list() {
    const { data } = await httpClient.get<Event[]>('/events');
    return data;
  },
  async create(payload: {
    customerName: string;
    customerPhone?: string;
    eventDate: string;
    guestCount: number;
    status?: Event['status'];
    eventType?: Event['eventType'];
    region?: Event['region'];
    hallId?: string;
    tableCategoryId?: string;
    notes?: string;
    birthdayPersonName?: string;
    brideName?: string;
    groomName?: string;
    honoreePersonName?: string;
  }) {
    const { data } = await httpClient.post<Event>('/events', payload);
    return data;
  },
  async update(eventId: number, payload: Partial<{
    customerName: string;
    customerPhone?: string;
    eventDate: string;
    guestCount: number;
    status?: Event['status'];
    eventType?: Event['eventType'];
    region?: Event['region'];
    hallId?: string;
    tableCategoryId?: string;
    notes?: string;
    birthdayPersonName?: string;
    brideName?: string;
    groomName?: string;
    honoreePersonName?: string;
  }>) {
    const { data } = await httpClient.patch<Event>(`/events/${eventId}`, payload);
    return data;
  },

  async remove(eventId: number) {
    await httpClient.delete(`/events/${eventId}`);
  }
};
