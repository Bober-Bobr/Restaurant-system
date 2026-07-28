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
  | 'quotes' // list of { author, text (localized) } — wishes / testimonials
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
export type QuoteItem = { author: string; text: LocalizedText };

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
  // Studio contact details rendered under the "developed by" credit. Global to
  // the platform and editable only by a SYSTEM_ADMIN — never per invitation.
  contacts?: { phone: string; telegram: string; instagram: string };
  // Guest-facing published mode enables the RSVP → server bridge.
  onRsvp?: (payload: RsvpPayload) => Promise<void>;
  // Editor mode: a border-radius/frame hint, and it disables RSVP persistence.
  interactive?: boolean;
  // Design+ editing: overlay elements become draggable inside the iframe and
  // report their new position here (percent within their anchor). `kf` is set
  // when a motion-path keyframe marker was dragged (index into element.path).
  adminEdit?: boolean;
  onAdminMove?: (id: string, x: number, y: number, kf?: number) => void;
  // Design+ editing: play motion-path animations in the editor preview
  // (paused by default so elements stay under the cursor while dragging).
  adminPlay?: boolean;
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
  // Section element ids a system admin can anchor overlay elements to / restyle
  // (see AdminLayer). Order = page order.
  sectionIds?: string[];
  // CSS custom properties that carry the template's accent color — the Design+
  // "accent" picker overrides all of them, scoped to the chosen section.
  accentVars?: string[];
};

// ── Design+ (system-admin) overlay layer ─────────────────────────────────────
// Stored inside the project's rich config as `config.adminLayer`; rendered by
// the shared admin runtime injected into every template's iframe. Regular
// users never see the editing UI, but the layer renders for every visitor.

export type AdminElementAnim = 'none' | 'float' | 'pulse' | 'spin' | 'fade-in' | 'slide-up' | 'zoom';

// One stop on an element's motion path. Position is percent within the anchor
// (same space as the element's base x/y); rotate/scale/opacity are optional
// per-stop overrides. The element's own x/y/rotate act as keyframe №1.
export type AdminKeyframe = {
  x: number;
  y: number;
  rotate?: number;
  scale?: number;
  opacity?: number;
};

export type AdminElement = {
  id: string;
  type: 'photo' | 'video';
  src: string;
  // Section element id to anchor into, or 'fixed' for viewport-fixed.
  anchor: string;
  // Percent-based placement (center point) and width; ignored when `cover`.
  x?: number;
  y?: number;
  w?: number;
  rotate?: number;
  opacity?: number;
  radius?: number;
  z?: number;
  // Fill the whole anchored section (e.g. a video cover behind the hero).
  cover?: boolean;
  anim?: AdminElementAnim;
  animDur?: number;
  animDelay?: number;
  // Motion path: the element travels base → path[0] → path[1] → … with a CSS
  // keyframe animation generated by the admin runtime.
  path?: AdminKeyframe[];
  pathDur?: number; // seconds for a full pass (default 6)
  pathEase?: 'linear' | 'ease' | 'ease-in-out';
  pathMode?: 'loop' | 'alternate' | 'once';
};

export type AdminSectionStyle = {
  section: string;
  background?: string;
  text?: string;
  // Explicit CSS custom-property overrides (the editor writes the template's
  // accentVars here so the runtime stays template-agnostic).
  vars?: Record<string, string>;
};

// Full-page falling-particle overlay. `custom` draws an uploaded image; in
// `scroll` mode particles only fall while the guest scrolls the page.
export type AdminParticlePreset = 'none' | 'confetti' | 'snow' | 'hearts' | 'sparkles' | 'petals' | 'custom';

export type AdminParticles = {
  preset: AdminParticlePreset;
  src?: string; // particle image (preset === 'custom')
  count?: number; // 5..120, default 40
  size?: number; // base size px, default 14
  speed?: number; // fall speed multiplier 0.2..3, default 1
  mode?: 'always' | 'scroll';
  // Colour override; empty = the preset's own palette.
  color?: string;
};

// Trail following the guest's cursor/finger: preset shapes (same set as the
// falling particles) or a custom uploaded image.
export type AdminTrail = {
  preset: AdminParticlePreset;
  src?: string; // trail image (preset === 'custom')
  size?: number; // base size px, default 14
  density?: number; // particles emitted per move, 1..6, default 2
  // Colour override; empty = the preset's own palette.
  color?: string;
};

export type AdminLayer = {
  elements?: AdminElement[];
  styles?: AdminSectionStyle[];
  particles?: AdminParticles;
  trail?: AdminTrail;
};
