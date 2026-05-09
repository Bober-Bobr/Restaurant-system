import { httpClient } from './http';

export type Company = {
  id: string;
  name: string;
  logoUrl: string | null;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
};

export const companyService = {
  async getMine(): Promise<Company | null> {
    const { data } = await httpClient.get<Company | null>('/companies/mine');
    return data;
  },
  async create(payload: { name: string; logoUrl?: string }): Promise<Company> {
    const { data } = await httpClient.post<Company>('/companies', payload);
    return data;
  },
  async update(payload: { name?: string; logoUrl?: string }): Promise<Company> {
    const { data } = await httpClient.patch<Company>('/companies/mine', payload);
    return data;
  },
};
