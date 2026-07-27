import type { ExtraService } from '../types/domain';
import { httpClient } from './http';

export type ExtraServicePayload = {
  name?: string;
  description?: string | null;
  priceCents?: number;
  media?: string[];
  isActive?: boolean;
  sortOrder?: number;
};

export const extraServiceService = {
  async list() {
    const { data } = await httpClient.get<ExtraService[]>('/extra-services', { params: { pageSize: 100 } });
    return data;
  },
  async create(payload: ExtraServicePayload & { name: string }) {
    const { data } = await httpClient.post<ExtraService>('/extra-services', payload);
    return data;
  },
  async update(id: string, payload: ExtraServicePayload) {
    const { data } = await httpClient.patch<ExtraService>(`/extra-services/${id}`, payload);
    return data;
  },
  async remove(id: string) {
    await httpClient.delete(`/extra-services/${id}`);
  },
};
