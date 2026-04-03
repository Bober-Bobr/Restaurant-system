import { httpClient } from './http';
export const hallService = {
    async list() {
        const { data } = await httpClient.get('/halls');
        return data;
    },
    async create(payload) {
        const { data } = await httpClient.post('/halls', payload);
        return data;
    },
    async update(id, payload) {
        const { data } = await httpClient.patch(`/halls/${id}`, payload);
        return data;
    },
    async remove(id) {
        await httpClient.delete(`/halls/${id}`);
    }
};
