import axios from 'axios';
const apiRoot = () => (import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api').replace(/\/$/, '');
export const publicRestaurantService = {
    async get(restaurantId) {
        const { data } = await axios.get(`${apiRoot()}/public/restaurant`, { params: { restaurantId } });
        return data;
    },
    async listAll() {
        const { data } = await axios.get(`${apiRoot()}/public/restaurants`);
        return data;
    }
};
