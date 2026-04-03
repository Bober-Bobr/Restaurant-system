import { httpClient } from './http';
export const pricingService = {
    async getByEventId(eventId) {
        const { data } = await httpClient.get(`/pricing/events/${eventId}`);
        return data;
    }
};
