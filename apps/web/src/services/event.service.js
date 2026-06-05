import { httpClient } from './http';
export const eventService = {
    async list(params) {
        const { data } = await httpClient.get('/events', { params });
        return data;
    },
    async create(payload) {
        const { data } = await httpClient.post('/events', payload);
        return data;
    },
    async update(eventId, payload) {
        const { data } = await httpClient.patch(`/events/${eventId}`, payload);
        return data;
    },
    async remove(eventId) {
        await httpClient.delete(`/events/${eventId}`);
    }
};
