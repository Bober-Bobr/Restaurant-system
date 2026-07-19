import { birthdayTuscanTemplate } from './birthday-tuscan/definition';
import type { RichDesignData, TemplateCategory, TemplateDefinition } from './types';

// Registry of first-party rich templates, grouped by category on the chooser.
export const RICH_TEMPLATES: TemplateDefinition[] = [birthdayTuscanTemplate];

export const TEMPLATE_CATEGORIES: { key: TemplateCategory; labelKey: string; icon: string }[] = [
  { key: 'birthday', labelKey: 'cat_birthday', icon: '🎂' },
  { key: 'wedding', labelKey: 'cat_wedding', icon: '💍' },
];

export function getTemplate(id: string): TemplateDefinition | null {
  return RICH_TEMPLATES.find((t) => t.id === id) ?? null;
}

// A rich design is stored in InviteProject.theme as { templateId, languages,
// config }. Block designs never set templateId, so this cleanly discriminates.
export function readRichDesign(theme: unknown): RichDesignData | null {
  if (!theme || typeof theme !== 'object') return null;
  const t = theme as Partial<RichDesignData>;
  if (typeof t.templateId !== 'string' || !t.templateId) return null;
  return {
    templateId: t.templateId,
    languages: Array.isArray(t.languages) && t.languages.length ? t.languages : ['ru'],
    config: (t.config && typeof t.config === 'object' ? t.config : {}) as Record<string, unknown>,
  };
}
