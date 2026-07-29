import html from './template.html?raw';
import { RichRenderer } from '../RichRenderer';
import type { TemplateDefinition, TemplateField, TemplateFieldGroup } from '../types';

// ── "Under the Same Stars" celestial-midnight wedding template ───────────────
// Moon-medallion gate (constellation ignites → light blooms) → deep-midnight
// hero → invitation card → the night's details → a comet riding the programme
// meridian → memory gallery → countdown → RSVP → V-invite attribution. One
// continuous starlit night that warms toward a rose dawn at the footer.
// Midnight navy · indigo · violet · platinum · star gold.

const groups: TemplateFieldGroup[] = [
  { key: 'couple', labelKey: 'tg_couple', icon: '💍', section: 'top' },
  { key: 'invite', labelKey: 'tg_invite', icon: '✉️', section: 'invitation' },
  { key: 'datetime', labelKey: 'tg_datetime', icon: '🗓', section: 'countdown' },
  { key: 'venue', labelKey: 'tg_venue', icon: '📍', section: 'details' },
  { key: 'schedule', labelKey: 'tg_schedule', icon: '🕐', section: 'details' },
  { key: 'gallery', labelKey: 'tg_gallery', icon: '📷', section: 'memories' },
  { key: 'music', labelKey: 'tg_music', icon: '🎵' },
  { key: 'visibility', labelKey: 'tg_visibility', icon: '👁' },
];

const fields: TemplateField[] = [
  { key: 'bride', path: 'couple.bride', type: 'localized-text', group: 'couple', labelKey: 'fld_bride' },
  { key: 'groom', path: 'couple.groom', type: 'localized-text', group: 'couple', labelKey: 'fld_groom' },

  { key: 'inviteText', path: 'invite.text', type: 'localized-textarea', group: 'invite', labelKey: 'fld_invite_text' },

  // Convention: the first datetime field is the event date, which the dashboard
  // reads for the date line and the "days left" counter.
  { key: 'dateISO', path: 'event.dateISO', type: 'datetime', group: 'datetime', labelKey: 'fld_datetime' },

  { key: 'venueName', path: 'venue.name', type: 'localized-text', group: 'venue', labelKey: 'fld_venue_name' },
  { key: 'address', path: 'venue.address', type: 'localized-text', group: 'venue', labelKey: 'fld_address' },
  { key: 'mapUrl', path: 'venue.mapUrl', type: 'text', group: 'venue', labelKey: 'fld_map_url', placeholder: 'https://yandex.uz/maps/…' },

  // The evening's programme — rendered as nodes on the comet meridian.
  { key: 'schedule', path: 'schedule', type: 'schedule', group: 'schedule', labelKey: 'tg_schedule' },

  { key: 'gallery', path: 'gallery', type: 'gallery', group: 'gallery', labelKey: 'tg_gallery' },

  { key: 'music', path: 'music.url', type: 'audio', group: 'music', labelKey: 'tg_music' },

  // Block visibility: hidden.<key> === true switches the section off.
  { key: 'v_message', path: 'hidden.message', type: 'toggle', group: 'visibility', labelKey: 'sec_message' },
  { key: 'v_details', path: 'hidden.details', type: 'toggle', group: 'visibility', labelKey: 'sec_details' },
  { key: 'v_program', path: 'hidden.program', type: 'toggle', group: 'visibility', labelKey: 'sec_program' },
  { key: 'v_gallery', path: 'hidden.gallery', type: 'toggle', group: 'visibility', labelKey: 'sec_gallery' },
  { key: 'v_countdown', path: 'hidden.countdown', type: 'toggle', group: 'visibility', labelKey: 'sec_countdown' },
  { key: 'v_rsvp', path: 'hidden.rsvp', type: 'toggle', group: 'visibility', labelKey: 'sec_rsvp' },
  { key: 'v_music', path: 'hidden.music', type: 'toggle', group: 'visibility', labelKey: 'sec_music' },
];

const defaultConfig = {
  couple: {
    bride: { ru: 'Аврора', uz: 'Avrora', en: 'Aurora' },
    groom: { ru: 'Лукас', uz: 'Lukas', en: 'Lucas' },
  },
  invite: {
    text: {
      ru: 'Под звёздами, что видели наше начало,\nмы приглашаем вас разделить с нами\nвечер, где начинается наше «навсегда».',
      uz: 'Boshlanishimizni korgan yulduzlar ostida,\nabadiyatimiz boshlanadigan kechani\nbiz bilan bolishishga taklif qilamiz.',
      en: 'Beneath the stars that watched us begin,\nwe invite you to share the evening\nwhere our forever starts.',
    },
  },
  event: {
    dateISO: '2027-09-20T19:00:00',
  },
  venue: {
    name: { ru: 'Терраса «Обсерватория»', uz: '«Observatoriya» terrasasi', en: 'The Observatory Terrace' },
    address: {
      ru: 'Холм Селесте, 9',
      uz: 'Celeste tepaligi, 9',
      en: 'Celeste Hill 9',
    },
    mapUrl: '',
  },
  // The evening's programme; an empty list hides the section.
  schedule: [
    { time: '19:00', label: { ru: 'Церемония и клятвы', uz: 'Marosim va qasamlar', en: 'Ceremony & vows' } },
    { time: '20:00', label: { ru: 'Ужин под звёздами', uz: 'Yulduzlar ostida kechki ovqat', en: 'Dinner beneath the stars' } },
    { time: '21:30', label: { ru: 'Первый танец', uz: 'Ilk raqs', en: 'The first dance' } },
    { time: '22:00', label: { ru: 'Танцы до рассвета', uz: 'Tong otguncha raqslar', en: 'Dancing until dawn' } },
  ],
  // Photos the couple uploads; an empty list hides the gallery section.
  gallery: [] as { image: string; caption: Record<string, string> }[],
  music: { url: '' },
  // Sections switched off in the builder (all visible by default).
  hidden: {} as Record<string, boolean>,
};

export const weddingCelestialTemplate: TemplateDefinition = {
  id: 'wedding-celestial',
  category: 'wedding',
  nameKey: 'tpl_wedding_celestial',
  cover: '🌙',
  accent: '#e7c66b',
  html,
  defaultConfig,
  fields,
  groups,
  Renderer: RichRenderer,
  // These must match the real element ids in template.html — the Design+ runtime
  // anchors by getElementById and silently skips a section it cannot find.
  // ('hero' and 'gallery' were listed here but the markup calls them top/memories.)
  sectionIds: ['top', 'invitation', 'details', 'story', 'memories', 'countdown', 'rsvp'],
  accentVars: ['--gold', '--star-gold'],
};
