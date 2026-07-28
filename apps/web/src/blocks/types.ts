import type { SectionAnimation } from '../services/guestInvitation.service';
import type { TranslationKey } from '../utils/translate';

// ── Freeform WYSIWYG block model ─────────────────────────────────────────────
// A design (flyer or invitation) is an ordered list of blocks. Props are
// type-specific but stored loosely; the renderer/settings read them defensively.

export type BlockType =
  | 'hero'
  | 'heading'
  | 'text'
  | 'image'
  | 'video'
  | 'button'
  | 'countdown'
  | 'timing'
  | 'gallery'
  | 'menu'
  | 'link'
  | 'socials'
  | 'contacts'
  | 'rsvp'
  | 'form'
  | 'savecontact'
  | 'map'
  | 'promo'
  | 'html'
  | 'divider'
  | 'vccontact';

export type BlockProps = Record<string, unknown>;

export type Block = {
  id: string;
  type: BlockType;
  props: BlockProps;
  anim?: SectionAnimation;
  // Hidden blocks show dimmed in the builder but are not rendered on the page.
  hidden?: boolean;
};

export type ButtonAction = { kind: 'link' | 'phone' | 'telegram' | 'map'; value: string };
export type GalleryItem = { photoUrl: string; videoUrl?: string | null };
export type MenuShowcaseItem = { number: number; name: string; photoUrl?: string | null };
export type SocialLink = { label: string; url: string };

export type TimingItem = { time: string; label: string };

export type FieldType = 'text' | 'textarea' | 'html' | 'image' | 'video' | 'color' | 'datetime' | 'boolean' | 'number' | 'gallery' | 'menu' | 'socials' | 'timing' | 'action' | 'select';

export type BlockFieldDef = {
  key: string;
  labelKey: TranslationKey;
  type: FieldType;
  placeholder?: string;
  options?: { value: string; labelKey: TranslationKey }[];
};

export type BlockDef = {
  type: BlockType;
  icon: string;
  labelKey: TranslationKey;
  defaultProps: BlockProps;
  defaultAnim: SectionAnimation;
  fields: BlockFieldDef[];
};

let counter = 0;
export function newBlockId(): string {
  counter += 1;
  return `b_${Date.now().toString(36)}_${counter}`;
}

// Registry: one entry per block type. `fields` drives the settings panel.
export const BLOCK_DEFS: Record<BlockType, BlockDef> = {
  hero: {
    type: 'hero', icon: '🎀', labelKey: 'block_hero',
    defaultProps: { title: '', subtitle: '', imageUrl: '' },
    defaultAnim: { type: 'zoom', durationMs: 900, delayMs: 0 },
    fields: [
      { key: 'title', labelKey: 'bf_title', type: 'text' },
      { key: 'subtitle', labelKey: 'bf_subtitle', type: 'text' },
      { key: 'imageUrl', labelKey: 'bf_image', type: 'image' },
    ],
  },
  heading: {
    type: 'heading', icon: 'H', labelKey: 'block_heading',
    defaultProps: { text: 'Заголовок', align: 'center', marquee: false },
    defaultAnim: { type: 'fade', durationMs: 700, delayMs: 0 },
    fields: [
      { key: 'text', labelKey: 'bf_text', type: 'text' },
      { key: 'align', labelKey: 'bf_align', type: 'select', options: [
        { value: 'left', labelKey: 'align_left' }, { value: 'center', labelKey: 'align_center' }, { value: 'right', labelKey: 'align_right' },
      ] },
      { key: 'marquee', labelKey: 'bf_marquee', type: 'boolean' },
    ],
  },
  text: {
    type: 'text', icon: '¶', labelKey: 'block_text',
    defaultProps: { text: '', align: 'center' },
    defaultAnim: { type: 'fade', durationMs: 700, delayMs: 0 },
    fields: [
      { key: 'text', labelKey: 'bf_text', type: 'textarea' },
      { key: 'align', labelKey: 'bf_align', type: 'select', options: [
        { value: 'left', labelKey: 'align_left' }, { value: 'center', labelKey: 'align_center' }, { value: 'right', labelKey: 'align_right' },
      ] },
    ],
  },
  image: {
    type: 'image', icon: '🖼', labelKey: 'block_image',
    defaultProps: { url: '', rounded: false, timer: false, timerAt: null, timerLabel: '' },
    defaultAnim: { type: 'fade', durationMs: 700, delayMs: 0 },
    fields: [
      { key: 'url', labelKey: 'bf_image', type: 'image' },
      { key: 'rounded', labelKey: 'bf_rounded', type: 'boolean' },
      // Timer overlaid on the bottom of the photo.
      { key: 'timer', labelKey: 'bf_timer', type: 'boolean' },
      { key: 'timerLabel', labelKey: 'bf_label', type: 'text' },
      { key: 'timerAt', labelKey: 'bf_datetime', type: 'datetime' },
    ],
  },
  // Self-hosted video: uploaded from the device (drag/drop/paste), plays inline.
  video: {
    type: 'video', icon: '🎬', labelKey: 'block_video',
    defaultProps: { url: '', rounded: true, autoplay: true, loop: true, muted: true, controls: true },
    defaultAnim: { type: 'fade', durationMs: 700, delayMs: 0 },
    fields: [
      { key: 'url', labelKey: 'bf_video', type: 'video' },
      { key: 'rounded', labelKey: 'bf_rounded', type: 'boolean' },
      { key: 'autoplay', labelKey: 'bf_autoplay', type: 'boolean' },
      { key: 'loop', labelKey: 'bf_loop', type: 'boolean' },
      { key: 'muted', labelKey: 'bf_muted', type: 'boolean' },
      { key: 'controls', labelKey: 'bf_controls', type: 'boolean' },
    ],
  },
  button: {
    type: 'button', icon: '🔘', labelKey: 'block_button',
    defaultProps: { label: 'Кнопка', action: { kind: 'link', value: '' } },
    defaultAnim: { type: 'fade', durationMs: 600, delayMs: 0 },
    fields: [
      { key: 'label', labelKey: 'bf_label', type: 'text' },
      { key: 'action', labelKey: 'bf_action', type: 'action' },
    ],
  },
  countdown: {
    type: 'countdown', icon: '⏱', labelKey: 'block_countdown',
    defaultProps: { targetAt: null, label: '' },
    defaultAnim: { type: 'zoom', durationMs: 800, delayMs: 0 },
    fields: [
      { key: 'label', labelKey: 'bf_label', type: 'text' },
      { key: 'targetAt', labelKey: 'bf_datetime', type: 'datetime' },
    ],
  },
  timing: {
    type: 'timing', icon: '🕐', labelKey: 'block_timing',
    defaultProps: { title: 'TIMING', items: [] },
    defaultAnim: { type: 'slide-left', durationMs: 800, delayMs: 0 },
    fields: [
      { key: 'title', labelKey: 'bf_title', type: 'text' },
      { key: 'items', labelKey: 'bf_timing', type: 'timing' },
    ],
  },
  gallery: {
    type: 'gallery', icon: '📷', labelKey: 'block_gallery',
    defaultProps: { items: [], autoSlide: false, slideInterval: 4 },
    defaultAnim: { type: 'fade', durationMs: 700, delayMs: 0 },
    fields: [
      { key: 'items', labelKey: 'bf_gallery', type: 'gallery' },
      { key: 'autoSlide', labelKey: 'bf_autoslide', type: 'boolean' },
      { key: 'slideInterval', labelKey: 'bf_slide_interval', type: 'number' },
    ],
  },
  menu: {
    type: 'menu', icon: '🍽', labelKey: 'block_menu',
    defaultProps: { title: 'МЕНЮ', items: [] },
    defaultAnim: { type: 'slide-up', durationMs: 800, delayMs: 0 },
    fields: [
      { key: 'title', labelKey: 'bf_title', type: 'text' },
      { key: 'items', labelKey: 'bf_menu', type: 'menu' },
    ],
  },
  // Single wide link button: label + sub-label + custom background color.
  link: {
    type: 'link', icon: '🔗', labelKey: 'block_link',
    defaultProps: { label: 'КАТЕГОРИЯ СТОЛОВ', sublabel: 'Меню', action: { kind: 'link', value: '' }, color: '#e8792e' },
    defaultAnim: { type: 'fade', durationMs: 600, delayMs: 0 },
    fields: [
      { key: 'label', labelKey: 'bf_label', type: 'text' },
      { key: 'sublabel', labelKey: 'bf_subtitle', type: 'text' },
      { key: 'action', labelKey: 'bf_action', type: 'action' },
      { key: 'color', labelKey: 'bf_color', type: 'color' },
    ],
  },
  socials: {
    type: 'socials', icon: '@', labelKey: 'block_socials',
    defaultProps: { title: '', links: [] },
    defaultAnim: { type: 'fade', durationMs: 700, delayMs: 0 },
    fields: [
      { key: 'title', labelKey: 'bf_title', type: 'text' },
      { key: 'links', labelKey: 'bf_socials', type: 'socials' },
    ],
  },
  contacts: {
    type: 'contacts', icon: '☎', labelKey: 'block_contacts',
    defaultProps: { title: 'НАШИ КОНТАКТЫ', phone: '', telegramUrl: '', instagramUrl: '' },
    defaultAnim: { type: 'fade', durationMs: 700, delayMs: 0 },
    fields: [
      { key: 'title', labelKey: 'bf_title', type: 'text' },
      { key: 'phone', labelKey: 'bf_phone', type: 'text' },
      { key: 'telegramUrl', labelKey: 'bf_telegram', type: 'text' },
      { key: 'instagramUrl', labelKey: 'bf_instagram', type: 'text' },
    ],
  },
  // Contact card for reaching V-connect. Rendered below the flyer's mandatory
  // attribution footer, not in the normal block flow.
  vccontact: {
    type: 'vccontact', icon: '🛠', labelKey: 'bl_vccontact',
    defaultProps: { phone: '', telegram: '', instagram: '' },
    defaultAnim: { type: 'none', durationMs: 0, delayMs: 0 },
    fields: [
      { key: 'phone', labelKey: 'bf_vc_phone', type: 'text' },
      { key: 'telegram', labelKey: 'bf_vc_telegram', type: 'text' },
      { key: 'instagram', labelKey: 'bf_vc_instagram', type: 'text' },
    ],
  },
  rsvp: {
    type: 'rsvp', icon: '✅', labelKey: 'block_rsvp',
    defaultProps: { title: 'ПОДТВЕРДИТЕ ПРИСУТСТВИЕ' },
    defaultAnim: { type: 'slide-up', durationMs: 800, delayMs: 0 },
    fields: [{ key: 'title', labelKey: 'bf_title', type: 'text' }],
  },
  map: {
    type: 'map', icon: '📍', labelKey: 'block_map',
    defaultProps: { label: 'КАРТА', address: '' },
    defaultAnim: { type: 'fade', durationMs: 600, delayMs: 0 },
    fields: [
      { key: 'label', labelKey: 'bf_label', type: 'text' },
      { key: 'address', labelKey: 'bf_address', type: 'text' },
    ],
  },
  promo: {
    type: 'promo', icon: '🎁', labelKey: 'block_promo',
    defaultProps: { title: '', subtitle: '', code: '', imageUrl: '' },
    defaultAnim: { type: 'fade', durationMs: 700, delayMs: 0 },
    fields: [
      { key: 'title', labelKey: 'bf_title', type: 'text' },
      { key: 'imageUrl', labelKey: 'bf_image', type: 'image' },
      { key: 'code', labelKey: 'bf_code', type: 'text' },
      { key: 'subtitle', labelKey: 'bf_subtitle', type: 'textarea' },
    ],
  },
  // Lead-capture form: submits a call-back request to the manager.
  form: {
    type: 'form', icon: '📝', labelKey: 'block_form',
    defaultProps: { title: 'ПЛАНИРУЕТЕ МЕРОПРИЯТИЕ?', subtitle: 'Оставьте номер телефона — администратор перезвонит вам', buttonLabel: '', showMessage: true },
    defaultAnim: { type: 'slide-up', durationMs: 800, delayMs: 0 },
    fields: [
      { key: 'title', labelKey: 'bf_title', type: 'text' },
      { key: 'subtitle', labelKey: 'bf_subtitle', type: 'textarea' },
      { key: 'buttonLabel', labelKey: 'bf_button_label', type: 'text' },
      { key: 'showMessage', labelKey: 'bf_show_message', type: 'boolean' },
    ],
  },
  // "Save contact" button — downloads a vCard with the given name + phone.
  savecontact: {
    type: 'savecontact', icon: '📇', labelKey: 'block_savecontact',
    defaultProps: { label: '', name: '', phone: '' },
    defaultAnim: { type: 'fade', durationMs: 600, delayMs: 0 },
    fields: [
      { key: 'name', labelKey: 'bf_contact_name', type: 'text' },
      { key: 'phone', labelKey: 'bf_phone', type: 'text' },
      { key: 'label', labelKey: 'bf_button_label', type: 'text' },
    ],
  },
  // Raw HTML: renders the manager's own markup verbatim.
  html: {
    type: 'html', icon: '</>', labelKey: 'block_html',
    defaultProps: { html: '' },
    defaultAnim: { type: 'fade', durationMs: 500, delayMs: 0 },
    fields: [
      { key: 'html', labelKey: 'bf_html', type: 'html' },
    ],
  },
  divider: {
    type: 'divider', icon: '—', labelKey: 'block_divider',
    defaultProps: { shape: 'line', text: '' },
    defaultAnim: { type: 'fade', durationMs: 400, delayMs: 0 },
    fields: [
      { key: 'shape', labelKey: 'bf_shape', type: 'select', options: [
        { value: 'spacer', labelKey: 'shape_spacer' }, { value: 'icon', labelKey: 'shape_icon' },
        { value: 'text', labelKey: 'shape_text' }, { value: 'line', labelKey: 'shape_line' },
        { value: 'wave', labelKey: 'shape_wave' }, { value: 'zigzag', labelKey: 'shape_zigzag' },
      ] },
      { key: 'text', labelKey: 'bf_text', type: 'text' },
    ],
  },
};

// All block types, in the order they appear in the Add-block palette.
// `menu` and `promo` are intentionally omitted — a static photo (image block) is
// used instead. Both types are still rendered for back-compat with old designs.
export const PALETTE_ORDER: BlockType[] = [
  'heading', 'text', 'image', 'video', 'button', 'link', 'hero', 'countdown', 'timing', 'gallery', 'map', 'form', 'rsvp', 'savecontact', 'contacts', 'socials', 'html', 'divider', 'vccontact',
];

export function createBlock(type: BlockType): Block {
  const def = BLOCK_DEFS[type];
  return { id: newBlockId(), type, props: structuredClone(def.defaultProps), anim: { ...def.defaultAnim } };
}

// Small typed prop readers used by the renderer/settings.
export const str = (p: BlockProps, k: string, d = ''): string => (typeof p[k] === 'string' ? (p[k] as string) : d);
export const bool = (p: BlockProps, k: string): boolean => p[k] === true;
export const num = (p: BlockProps, k: string, d = 0): number => (typeof p[k] === 'number' && Number.isFinite(p[k]) ? (p[k] as number) : d);

// Per-block font-size multipliers (headings and body), clamped to a safe range
// so a stray value can never blow up or collapse a layout.
export const FONT_SCALE_MIN = 0.6;
export const FONT_SCALE_MAX = 2;
export function fontScale(p: BlockProps, key: 'headingScale' | 'bodyScale'): number {
  const v = num(p, key, 1);
  return Math.max(FONT_SCALE_MIN, Math.min(FONT_SCALE_MAX, v));
}
