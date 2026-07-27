import axios from 'axios';
import type { ExtraService } from '../types/domain';

const publicExtraServicesUrl = (): string => {
  const apiRoot = (import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api').replace(/\/$/, '');
  return `${apiRoot}/public/extra-services`;
};

export const publicExtraServiceService = {
  async listActive(restaurantId: string): Promise<ExtraService[]> {
    const { data } = await axios.get<ExtraService[]>(publicExtraServicesUrl(), { params: { restaurantId } });
    return data;
  }
};
