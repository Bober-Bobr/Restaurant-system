import axios from 'axios';
import { httpClient } from './http';
const apiRoot = () => (import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api').replace(/\/$/, '');
export const invitationService = {
    async listByRestaurant(restaurantId) {
        const { data } = await httpClient.get('/invitations', { params: { restaurantId } });
        return data;
    },
    async byEvent(eventId, restaurantId) {
        try {
            const { data } = await httpClient.get(`/invitations/by-event/${eventId}`, { params: { restaurantId } });
            return data;
        }
        catch (e) {
            if (axios.isAxiosError(e) && e.response?.status === 404)
                return null;
            throw e;
        }
    },
    async get(id) {
        const { data } = await httpClient.get(`/invitations/${id}`);
        return data;
    },
    async create(payload) {
        const { data } = await httpClient.post('/invitations', payload);
        return data;
    },
    async update(id, payload) {
        const { data } = await httpClient.patch(`/invitations/${id}`, payload);
        return data;
    },
    async remove(id) {
        await httpClient.delete(`/invitations/${id}`);
    },
    async publicBySlug(slug) {
        const { data } = await axios.get(`${apiRoot()}/public/invitations/${slug}`);
        return data;
    },
};
