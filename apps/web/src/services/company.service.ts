import { httpClient } from './http';

export type Company = {
  id: string;
  name: string;
  logoUrl: string | null;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
};

export type CompanyWithDetails = Company & {
  owner: { id: string; username: string };
  restaurants: {
    id: string;
    name: string;
    address: string | null;
    logoUrl: string | null;
    ownerId: string;
    createdAt: string;
  }[];
};

export const companyService = {
  async listAll(): Promise<CompanyWithDetails[]> {
    const { data } = await httpClient.get<CompanyWithDetails[]>('/companies');
    return data;
  },
  async getMine(): Promise<Company | null> {
    const { data } = await httpClient.get<Company | null>('/companies/mine');
    return data;
  },
  async deleteCompany(id: string): Promise<void> {
    await httpClient.delete(`/companies/${id}`);
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
