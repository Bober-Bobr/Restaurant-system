import html from './template.html?raw';
import { RichRenderer } from '../RichRenderer';
import type { TemplateDefinition, TemplateField, TemplateFieldGroup } from '../types';

// ── "Golden Arch" Arabic-style wedding template ──────────────────────────────
// Envelope opening → arch hero with both names → invitation card → venue/date/
// time + map → photo gallery → countdown → RSVP → V-invite attribution.
// Warm palette only (ivory, sand, champagne, gold, bronze).

const groups: TemplateFieldGroup[] = [
  { key: 'couple', labelKey: 'tg_couple', icon: '💍' },
  { key: 'invite', labelKey: 'tg_invite', icon: '✉️' },
  { key: 'datetime', labelKey: 'tg_datetime', icon: '🗓' },
  { key: 'venue', labelKey: 'tg_venue', icon: '📍' },
  { key: 'gallery', labelKey: 'tg_gallery', icon: '📷' },
  { key: 'music', labelKey: 'tg_music', icon: '🎵' },
];

const fields: TemplateField[] = [
  { key: 'groom', path: 'couple.groom', type: 'localized-text', group: 'couple', labelKey: 'fld_groom' },
  { key: 'bride', path: 'couple.bride', type: 'localized-text', group: 'couple', labelKey: 'fld_bride' },

  { key: 'inviteText', path: 'invite.text', type: 'localized-textarea', group: 'invite', labelKey: 'fld_invite_text' },

  // Convention: the first datetime field is the event date, which the dashboard
  // reads for the date line and the "days left" counter. The picker sets the
  // time too, and the template derives both the date and the time display.
  { key: 'dateISO', path: 'event.dateISO', type: 'datetime', group: 'datetime', labelKey: 'fld_datetime' },

  { key: 'venueName', path: 'venue.name', type: 'localized-text', group: 'venue', labelKey: 'fld_venue_name' },
  { key: 'address', path: 'venue.address', type: 'localized-text', group: 'venue', labelKey: 'fld_address' },
  { key: 'mapUrl', path: 'venue.mapUrl', type: 'text', group: 'venue', labelKey: 'fld_map_url', placeholder: 'https://yandex.uz/maps/…' },

  { key: 'gallery', path: 'gallery', type: 'gallery', group: 'gallery', labelKey: 'tg_gallery' },

  { key: 'music', path: 'music.url', type: 'audio', group: 'music', labelKey: 'tg_music' },
];

const defaultConfig = {
  couple: {
    groom: { ru: 'Зайд', uz: 'Zayd', en: 'Zayd' },
    bride: { ru: 'Лейла', uz: 'Layla', en: 'Layla' },
  },
  invite: {
    text: {
      ru: 'Два сердца — одно обещание.\nПриглашаем вас разделить радость нашего союза\nпод золотым светом и открытыми арками.',
      uz: 'Ikki yurak — bitta vada.\nOltin nur va ochiq ravoqlar ostida\nittifoqimiz quvonchini biz bilan bolishing.',
      en: 'Two hearts, one promise.\nWe invite you to share in the joy of our union\nbeneath golden light and open arches.',
    },
  },
  event: {
    dateISO: '2026-11-15T18:30:00',
  },
  venue: {
    name: { ru: 'Дворец «Аль-Каср»', uz: '«Al-Qasr» saroyi', en: 'Al-Qasr Palace' },
    address: {
      ru: 'Мраморный зал, Сады Старого города',
      uz: 'Marmar zal, Eski shahar boglari',
      en: 'Grand Marble Hall, Old City Gardens',
    },
    mapUrl: '',
  },
  // Photos the couple uploads; an empty list hides the gallery section.
  gallery: [] as { image: string; caption: Record<string, string> }[],
  music: { url: '' },
};

export const weddingArabicTemplate: TemplateDefinition = {
  id: 'wedding-arabic',
  category: 'wedding',
  nameKey: 'tpl_wedding_arabic',
  cover: '🕌',
  accent: '#C79A52',
  html,
  defaultConfig,
  fields,
  groups,
  Renderer: RichRenderer,
};
