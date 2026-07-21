import type { Locale } from '../../utils/translate';
import type { ComponentType } from 'react';

// ── Rich (first-party) invitation templates ──────────────────────────────────
// A rich template is a self-contained animated design (HTML/CSS/JS authored by
// us) rendered inside a sandboxed iframe and driven entirely by a typed `config`
// object. Unlike the block designer, the whole design is fixed; the honoree only
// edits the config values through a form. This preserves advanced animations
// while keeping every editable field first-class and safe (the template's
// scripts run sandboxed, never on the v-invite.uz origin).

export const LOCALES: Locale[] = ['ru', 'uz', 'en'];

// A piece of text the honoree can enter per language. Missing languages fall
// back to the first non-empty value at render time.
export type LocalizedText = Partial<Record<Locale, string>>;

export function pickLocale(text: LocalizedText | undefined, lang: Locale): string {
  if (!text) return '';
  return text[lang] ?? text.ru ?? text.en ?? text.uz ?? '';
}

// ── Editor field schema ───────────────────────────────────────────────────────
// Each template exposes an ordered list of fields; the design editor renders one
// input per field and writes back into the config at `path` (dot notation).
export type FieldType =
  | 'localized-text' // one text input per active language
  | 'localized-textarea'
  | 'text' // language-neutral (phone, url, card number…)
  | 'datetime'
  | 'image'
  | 'audio'
  | 'gallery' // list of { image, caption (localized) }
  | 'schedule' // list of { time, label (localized) }
  | 'palette' // ordered list of colour swatches (hex strings)
  // Show/hide switch for a block. The value at `path` is the HIDDEN flag
  // (true = hidden), so an unset config means everything is visible.
  | 'toggle';

export type TemplateField = {
  key: string;
  // Where the value lives in the config object (dot path).
  path: string;
  type: FieldType;
  // Section grouping in the editor (e.g. 'hero', 'details', 'gifts').
  group: string;
  labelKey: string; // translate() key for the field label
  placeholder?: string;
};

export type TemplateFieldGroup = {
  key: string;
  labelKey: string;
  icon: string;
};

// Localized gallery / schedule item shapes shared across templates.
export type GalleryItem = { image: string; caption: LocalizedText };
export type ScheduleItem = { time: string; label: LocalizedText };

// The shape persisted per project (in InviteProject.theme JSON). When
// `templateId` is present the project is a rich design; otherwise it's a
// block-based design and this is ignored.
export type RichDesignData = {
  templateId: string;
  // Languages the honoree chose to author (a subset/order of LOCALES).
  languages: Locale[];
  // Template-specific config (see each template's config.ts).
  config: Record<string, unknown>;
};

export type TemplateCategory = 'birthday' | 'wedding' | 'party' | 'corporate';

// Props the parent passes to a template's live React wrapper (the iframe host).
export type RichRendererProps = {
  html: string; // the template's raw HTML (with the __CONFIG__ hook)
  config: Record<string, unknown>;
  languages: Locale[];
  // Guest-facing published mode enables the RSVP → server bridge.
  onRsvp?: (payload: RsvpPayload) => Promise<void>;
  // Editor mode: a border-radius/frame hint, and it disables RSVP persistence.
  interactive?: boolean;
};

export type RsvpPayload = {
  name: string;
  attending: boolean;
  guests: number;
  dietary?: string;
  message?: string;
};

export type TemplateDefinition = {
  id: string;
  category: TemplateCategory;
  nameKey: string;
  // Emoji/label used on the template chooser card.
  cover: string;
  accent: string; // card accent color
  html: string;
  defaultConfig: Record<string, unknown>;
  fields: TemplateField[];
  groups: TemplateFieldGroup[];
  // The renderer component (all templates share RichRenderer; kept for future
  // per-template overrides).
  Renderer: ComponentType<RichRendererProps>;
};
