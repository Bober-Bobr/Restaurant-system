import type { Event, EventMenuConfig } from '../types/domain';
import { httpClient } from './http';

export const eventService = {
  async list(params?: { restaurantId?: string }) {
    const { data } = await httpClient.get<Event[]>('/events', { params });
    return data;
  },
  async create(payload: {
    customerName?: string;
    customerPhone?: string;
    secondCustomerName?: string;
    secondCustomerPhone?: string;
    eventDate?: string;
    guestCount?: number;
    depositCents?: number;
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
    eventDate?: string;
    guestCount?: number;
    depositCents?: number;
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

  async reschedule(eventId: number, eventDate: string) {
    const { data } = await httpClient.post<Event>(`/events/${eventId}/reschedule`, { eventDate });
    return data;
  },

  // Record a partial (installment) payment towards the invoice; returns the
  // refreshed event including its payments list.
  async addPayment(eventId: number, amountCents: number, note?: string) {
    const { data } = await httpClient.post<Event>(`/events/${eventId}/payments`, { amountCents, note });
    return data;
  },

  async removePayment(eventId: number, paymentId: string) {
    const { data } = await httpClient.delete<Event>(`/events/${eventId}/payments/${paymentId}`);
    return data;
  },

  // Set (ISO string) or clear (null) the debt-settlement deadline.
  async setDebtDeadline(eventId: number, debtDeadline: string | null) {
    const { data } = await httpClient.patch<Event>(`/events/${eventId}`, { debtDeadline });
    return data;
  },

  async remove(eventId: number) {
    await httpClient.delete(`/events/${eventId}`);
  }
};
