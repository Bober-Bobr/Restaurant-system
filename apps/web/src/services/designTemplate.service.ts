import { httpClient } from './http';
import type { Block } from '../blocks/types';

export type DesignKind = 'flyer' | 'invitation';

export type DesignTheme = {
  accentColor?: string | null;
  backgroundColor?: string | null;
  backgroundImageUrl?: string | null;
  musicUrl?: string | null;
  trailTemplate?: string | null;
  trailColor?: string | null;
};

export type DesignTemplate = {
  id: string;
  ownerId: string | null;
  name: string;
  kind: DesignKind;
  blocks: Block[];
  theme: DesignTheme;
  createdAt: string;
};

export const designTemplateService = {
  async listMine(kind?: DesignKind): Promise<DesignTemplate[]> {
    const { data } = await httpClient.get<DesignTemplate[]>('/design-templates', { params: kind ? { kind } : {} });
    return data;
  },
  async create(payload: { name: string; kind: DesignKind; blocks: Block[]; theme: DesignTheme }): Promise<DesignTemplate> {
    const { data } = await httpClient.post<DesignTemplate>('/design-templates', payload);
    return data;
  },
  async remove(id: string): Promise<void> {
    await httpClient.delete(`/design-templates/${id}`);
  },
};
