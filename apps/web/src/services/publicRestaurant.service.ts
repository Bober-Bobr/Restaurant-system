import axios from 'axios';

const publicRestaurantUrl = (): string => {
  const apiRoot = (import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api').replace(/\/$/, '');
  return `${apiRoot}/public/restaurant`;
};

export const publicRestaurantService = {
  async get(restaurantId: string): Promise<{ id: string; name: string; logoUrl: string | null }> {
    const { data } = await axios.get(publicRestaurantUrl(), { params: { restaurantId } });
    return data;
  }
};
