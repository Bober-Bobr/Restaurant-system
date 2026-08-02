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

// Identity + module entitlements for a restaurant resolved by its URL slug.
export type PublicRestaurantModules = {
  id: string;
  name: string;
  logoUrl: string | null;
  moduleBanquet: boolean;
  moduleCatering: boolean;
  moduleAddons: boolean;
};

// The full public record: contact/branding fields plus the tablet theme and the
// module entitlements. Resolvable by id (tablet) or by slug (food-service site).
export type PublicRestaurantDetail = PublicRestaurantSummary & {
  tabletAccentColor: string | null; tabletBgColor: string | null;
  tabletParticles: string | null; tabletParticlesColor: string | null; tabletParticlesImageUrl: string | null;
  tabletTrailTemplate: string | null; tabletTrailColor: string | null; tabletTrailImageUrl: string | null;
  moduleBanquet: boolean; moduleCatering: boolean; moduleAddons: boolean;
};

export const publicRestaurantService = {
  async get(restaurantId: string): Promise<PublicRestaurantDetail> {
    const { data } = await axios.get(`${apiRoot()}/public/restaurant`, { params: { restaurantId } });
    return data;
  },
  // One request resolves slug → the whole record, so the food-service site does
  // not need an id-lookup round trip before it can render anything.
  async getBySlug(slug: string): Promise<PublicRestaurantDetail> {
    const { data } = await axios.get(`${apiRoot()}/public/restaurant`, { params: { slug } });
    return data;
  },
  async modulesBySlug(slug: string): Promise<PublicRestaurantModules> {
    const { data } = await axios.get(`${apiRoot()}/public/restaurant-modules`, { params: { slug } });
    return data;
  },
  async listAll(): Promise<PublicRestaurantSummary[]> {
    const { data } = await axios.get(`${apiRoot()}/public/restaurants`);
    return data;
  }
};
