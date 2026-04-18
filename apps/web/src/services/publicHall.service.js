import axios from 'axios';
const publicHallsUrl = () => {
    const apiRoot = (import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api').replace(/\/$/, '');
    return `${apiRoot}/public/halls`;
};
export const publicHallService = {
    async listActive(restaurantId) {
        const { data } = await axios.get(publicHallsUrl(), { params: { restaurantId } });
        return data;
    }
};
