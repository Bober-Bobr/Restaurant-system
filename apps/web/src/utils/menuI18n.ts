import type { Locale } from './translate';
import type { DishI18n } from '../types/domain';

type WithName = { name: string; nameI18n?: DishI18n | null };
type WithDescription = { description?: string; descriptionI18n?: DishI18n | null };

// Per-dish name/description fall back to the base text when the active locale has
// no translation (or it's blank).
export function dishName(item: WithName, locale: Locale): string {
  return item.nameI18n?.[locale]?.trim() || item.name;
}

export function dishDescription(item: WithDescription, locale: Locale): string | undefined {
  const translated = item.descriptionI18n?.[locale]?.trim();
  return translated || item.description;
}

// Trim each locale and drop blanks; returns undefined when nothing is set so we
// don't persist empty translation objects.
export function cleanI18n(map: DishI18n | null | undefined): DishI18n | undefined {
  if (!map) return undefined;
  const out: DishI18n = {};
  for (const code of ['en', 'ru', 'uz'] as const) {
    const v = map[code]?.trim();
    if (v) out[code] = v;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}
