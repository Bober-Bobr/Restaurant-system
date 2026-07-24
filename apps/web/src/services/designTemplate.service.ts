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
  // Custom trail image (used when trailTemplate = 'custom').
  trailImageUrl?: string | null;
  // Page-wide text color. Applies to every block that doesn't set its own.
  textColor?: string | null;
  // Page-wide text size multiplier (1 = default). Scales all block text.
  textScale?: number | null;
  // Falling particle effect: 'none' | 'confetti' | 'snow' | 'candy' | 'custom'.
  particles?: string | null;
  // Custom falling-particle image (used when particles = 'custom').
  particlesImageUrl?: string | null;
};

export type DesignTemplate = {
  id: string;
  ownerId: string | null;
  name: string;
  kind: DesignKind;
  blocks: Block[];
  theme: DesignTheme;
  isFavorite: boolean;
  createdAt: string;
};

export const designTemplateService = {
  async listMine(kind?: DesignKind): Promise<DesignTemplate[]> {
    const { data } = await httpClient.get<DesignTemplate[]>('/design-templates', { params: kind ? { kind } : {} });
    return data;
  },
  async get(id: string): Promise<DesignTemplate> {
    const { data } = await httpClient.get<DesignTemplate>(`/design-templates/${id}`);
    return data;
  },
  async create(payload: { name: string; kind: DesignKind; blocks: Block[]; theme: DesignTheme }): Promise<DesignTemplate> {
    const { data } = await httpClient.post<DesignTemplate>('/design-templates', payload);
    return data;
  },
  // Edit a template in place (name/blocks/theme) or toggle its favorite pin.
  async update(id: string, payload: Partial<{ name: string; blocks: Block[]; theme: DesignTheme; isFavorite: boolean }>): Promise<DesignTemplate> {
    const { data } = await httpClient.patch<DesignTemplate>(`/design-templates/${id}`, payload);
    return data;
  },
  async remove(id: string): Promise<void> {
    await httpClient.delete(`/design-templates/${id}`);
  },
};
