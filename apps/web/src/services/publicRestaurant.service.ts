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
  categoryOrder?: string[] | null;
  hideSubcategories?: boolean;
  companyName?: string | null;
};

export const publicRestaurantService = {
  async get(restaurantId: string): Promise<{
    id: string; name: string; logoUrl: string | null;
    tabletAccentColor: string | null; tabletBgColor: string | null;
    tabletParticles: string | null; tabletParticlesColor: string | null; tabletParticlesImageUrl: string | null;
    tabletTrailTemplate: string | null; tabletTrailColor: string | null; tabletTrailImageUrl: string | null;
  }> {
    const { data } = await axios.get(`${apiRoot()}/public/restaurant`, { params: { restaurantId } });
    return data;
  },
  async listAll(): Promise<PublicRestaurantSummary[]> {
    const { data } = await axios.get(`${apiRoot()}/public/restaurants`);
    return data;
  }
};
