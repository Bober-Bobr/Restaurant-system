import axios from 'axios';
const publicMenuUrl = () => {
    const apiRoot = (import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api').replace(/\/$/, '');
    return `${apiRoot}/public/menu-items`;
};
export const publicMenuService = {
    async listActive(restaurantId) {
        const { data } = await axios.get(publicMenuUrl(), { params: { restaurantId } });
        return data;
    }
};
