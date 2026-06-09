import axios from 'axios';

const apiRoot = (): string =>
  (import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api').replace(/\/$/, '');

export type PublicRestaurantSummary = {
  id: string;
  name: string;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  history?: string | null;
  logoUrl: string | null;
  backgroundImageUrl?: string | null;
  companyName?: string | null;
};

export const publicRestaurantService = {
  async get(restaurantId: string): Promise<{ id: string; name: string; logoUrl: string | null }> {
    const { data } = await axios.get(`${apiRoot()}/public/restaurant`, { params: { restaurantId } });
    return data;
  },
  async listAll(): Promise<PublicRestaurantSummary[]> {
    const { data } = await axios.get(`${apiRoot()}/public/restaurants`);
    return data;
  }
};
