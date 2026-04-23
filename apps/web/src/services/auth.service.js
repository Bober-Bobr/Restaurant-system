import axios from 'axios';
import { httpClient } from './http';
const baseURL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api';
export const authService = {
    async login(username, password) {
        const { data } = await httpClient.post('/auth/login', { username, password });
        return data;
    },
    async publicRegister(username, password, restaurantName) {
        const { data } = await axios.post(`${baseURL}/auth/register`, { username, password, restaurantName });
        return data;
    },
    async register(username, password, role, restaurantId) {
        const { data } = await httpClient.post('/auth/register', {
            username,
            password,
            ...(role ? { role } : {}),
            ...(restaurantId ? { restaurantId } : {})
        });
        return data;
    },
    async refresh(refreshToken) {
        const { data } = await httpClient.post('/auth/refresh', { refreshToken });
        return data;
    },
    async logout() {
        try {
            await httpClient.post('/auth/logout', {});
        }
        catch {
            // Continue logging out even if this fails
        }
    },
    async getMe() {
        const { data } = await httpClient.get('/auth/me');
        return data;
    },
    async listUsers() {
        const { data } = await httpClient.get('/auth/users');
        return data;
    },
    async deleteUser(id) {
        await httpClient.delete(`/auth/users/${id}`);
    },
    async updateUserRole(id, role) {
        const { data } = await httpClient.patch(`/auth/users/${id}/role`, { role });
        return data;
    }
};
