import { httpClient } from './http';
export const tableCategoryService = {
    async list() {
        const { data } = await httpClient.get('/table-categories');
        return data;
    },
    async create(payload) {
        const { data } = await httpClient.post('/table-categories', payload);
        return data;
    },
    async update(id, payload) {
        const { data } = await httpClient.patch(`/table-categories/${id}`, payload);
        return data;
    },
    async remove(id) {
        await httpClient.delete(`/table-categories/${id}`);
    }
};
