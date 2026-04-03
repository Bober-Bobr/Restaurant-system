import type { PricingSummary } from '../types/domain';
import { httpClient } from './http';

export const pricingService = {
  async getByEventId(eventId: string) {
    const { data } = await httpClient.get<PricingSummary>(`/pricing/events/${eventId}`);
    return data;
  }
};
