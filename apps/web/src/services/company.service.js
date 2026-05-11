import { httpClient } from './http';
export const companyService = {
    async listAll() {
        const { data } = await httpClient.get('/companies');
        return data;
    },
    async listMine() {
        const { data } = await httpClient.get('/companies/mine');
        return data;
    },
    async create(payload) {
        const { data } = await httpClient.post('/companies', payload);
        return data;
    },
    async update(id, payload) {
        const { data } = await httpClient.patch(`/companies/${id}`, payload);
        return data;
    },
    async deleteCompany(id) {
        await httpClient.delete(`/companies/${id}`);
    },
};
