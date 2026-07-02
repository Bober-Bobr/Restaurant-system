import type { Event, EventMenuConfig } from '../types/domain';
import { httpClient } from './http';

export const eventService = {
  async list(params?: { restaurantId?: string }) {
    const { data } = await httpClient.get<Event[]>('/events', { params });
    return data;
  },
  async create(payload: {
    customerName: string;
    customerPhone?: string;
    secondCustomerName?: string;
    secondCustomerPhone?: string;
    eventDate: string;
    guestCount: number;
    status?: Event['status'];
    eventType?: Event['eventType'];
    region?: Event['region'];
    hallId?: string;
    tableCategoryId?: string;
    childrenTableCategoryId?: string;
    childrenCount?: number;
    menuConfig?: EventMenuConfig;
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
    secondCustomerName?: string;
    secondCustomerPhone?: string;
    eventDate: string;
    guestCount: number;
    status?: Event['status'];
    eventType?: Event['eventType'];
    region?: Event['region'];
    hallId?: string;
    tableCategoryId?: string;
    childrenTableCategoryId?: string;
    childrenCount?: number;
    menuConfig?: EventMenuConfig;
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
