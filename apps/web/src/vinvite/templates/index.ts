import { birthdayMidnightTemplate } from './birthday-midnight/definition';
import { birthdayPrestigeTemplate } from './birthday-prestige/definition';
import { birthdayTuscanTemplate } from './birthday-tuscan/definition';
import { weddingArabicTemplate } from './wedding-arabic/definition';
import { weddingCelestialTemplate } from './wedding-celestial/definition';
import { weddingEternalVowsTemplate } from './wedding-eternal-vows/definition';
import { weddingKeepsakeTemplate } from './wedding-keepsake/definition';
import { getPath } from './utils';
import type { RichDesignData, TemplateCategory, TemplateDefinition } from './types';

// Registry of first-party rich templates, grouped by category on the chooser.
export const RICH_TEMPLATES: TemplateDefinition[] = [
  birthdayTuscanTemplate,
  birthdayMidnightTemplate,
  birthdayPrestigeTemplate,
  weddingArabicTemplate,
  weddingCelestialTemplate,
  weddingEternalVowsTemplate,
  weddingKeepsakeTemplate,
];

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

// The event's ISO date for a rich design, read from its template's first
// datetime field (convention: every template exposes the main date that way).
// Used by the dashboard cards for the date line and the "days left" counter.
export function richEventDateISO(design: RichDesignData): string | null {
  const tpl = getTemplate(design.templateId);
  const dateField = tpl?.fields.find((f) => f.type === 'datetime');
  if (!dateField) return null;
  const v = getPath(design.config, dateField.path);
  return typeof v === 'string' && v ? v : null;
}
