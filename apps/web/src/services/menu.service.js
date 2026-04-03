import { httpClient } from './http';
export const menuService = {
    async list() {
        const { data } = await httpClient.get('/menu-items');
        return data;
    },
    async listAllForAdmin() {
        const { data } = await httpClient.get('/menu-items/admin/all');
        return data;
    },
    async create(payload) {
        const { data } = await httpClient.post('/menu-items', payload);
        return data;
    },
    async update(menuItemId, payload) {
        const { data } = await httpClient.patch(`/menu-items/${menuItemId}`, payload);
        return data;
    },
    async remove(menuItemId) {
        await httpClient.delete(`/menu-items/${menuItemId}`);
    },
    async assignToEvent(eventId, menuItemId, quantity) {
        await httpClient.post(`/menu-items/events/${eventId}/selections`, { menuItemId, quantity });
    }
};
