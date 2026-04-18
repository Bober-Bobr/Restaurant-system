import { httpClient } from './http';
export const restaurantService = {
    async list() {
        const { data } = await httpClient.get('/restaurants');
        return data;
    },
    async create(payload) {
        const { data } = await httpClient.post('/restaurants', payload);
        return data;
    },
    async update(id, payload) {
        const { data } = await httpClient.patch(`/restaurants/${id}`, payload);
        return data;
    },
    async remove(id) {
        await httpClient.delete(`/restaurants/${id}`);
    }
};
