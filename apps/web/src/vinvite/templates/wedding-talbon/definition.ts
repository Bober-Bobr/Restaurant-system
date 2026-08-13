import html from './template.html?raw';
import { RichRenderer } from '../RichRenderer';
import type { TemplateDefinition, TemplateField, TemplateFieldGroup } from '../types';

// ── "Anor va Atlas" — the Talbon celebration ────────────────────────────────
// A talbon is the Uzbek post-wedding gathering the two families hold after the
// nikoh, so this template is not a "will you marry" card: the couple is already
// married and the invitation is to the celebration. That shapes the content —
// no countdown to a vow, a programme for the evening, and both families' venue
// front and centre.
//
// Identity: red satin that moves rather than lies flat, halved pomegranates
// (anor) drawn as a cross-section, islimi ornament, warm gold.
//
// Defaults are written in Uzbek first — this design will almost always be read
// in uz — with ru and en filled so the language bar works out of the box.

const groups: TemplateFieldGroup[] = [
  { key: 'couple', labelKey: 'tg_couple', icon: '💍', section: 'top' },
  { key: 'invite', labelKey: 'tg_invite', icon: '✉️', section: 'top' },
  { key: 'datetime', labelKey: 'tg_datetime', icon: '🗓', section: 'details' },
  { key: 'venue', labelKey: 'tg_venue', icon: '📍', section: 'brand' },
  { key: 'details', labelKey: 'tg_details', icon: '📋', section: 'details' },
  { key: 'schedule', labelKey: 'tg_schedule', icon: '🕰', section: 'program' },
  { key: 'gallery', labelKey: 'tg_gallery', icon: '📷', section: 'gallery' },
  { key: 'music', labelKey: 'tg_music', icon: '🎵' },
  { key: 'visibility', labelKey: 'tg_visibility', icon: '👁' },
];

const fields: TemplateField[] = [
  { key: 'bride', path: 'couple.bride', type: 'localized-text', group: 'couple', labelKey: 'fld_bride' },
  { key: 'groom', path: 'couple.groom', type: 'localized-text', group: 'couple', labelKey: 'fld_groom' },
  // The full names carry the portraits under the arches; blank falls back to
  // the short names above rather than leaving a nameless photo.
  { key: 'brideFull', path: 'couple.brideFull', type: 'localized-text', group: 'couple', labelKey: 'fld_name' },
  { key: 'groomFull', path: 'couple.groomFull', type: 'localized-text', group: 'couple', labelKey: 'fld_name' },
  { key: 'bridePhoto', path: 'couple.bridePhoto', type: 'image', group: 'couple', labelKey: 'fld_photo' },
  { key: 'groomPhoto', path: 'couple.groomPhoto', type: 'image', group: 'couple', labelKey: 'fld_photo' },

  { key: 'occasion', path: 'invite.occasion', type: 'localized-text', group: 'invite', labelKey: 'fld_kicker' },
  { key: 'kicker', path: 'invite.kicker', type: 'localized-text', group: 'invite', labelKey: 'fld_sub' },
  { key: 'message', path: 'invite.message', type: 'localized-textarea', group: 'invite', labelKey: 'fld_invite_text' },
  { key: 'closing', path: 'invite.closing', type: 'localized-textarea', group: 'invite', labelKey: 'fld_final' },

  // Convention: the first datetime field is the event date, which the dashboard
  // reads for the date line and the "days left" counter.
  { key: 'dateISO', path: 'event.dateISO', type: 'datetime', group: 'datetime', labelKey: 'fld_datetime' },
  { key: 'dateNote', path: 'event.dateNote', type: 'localized-text', group: 'datetime', labelKey: 'fld_time_note' },
  { key: 'timeText', path: 'event.timeText', type: 'localized-text', group: 'datetime', labelKey: 'fld_time_text' },
  { key: 'timeNote', path: 'event.timeNote', type: 'localized-text', group: 'datetime', labelKey: 'fld_time_note' },

  { key: 'venueName', path: 'venue.name', type: 'localized-text', group: 'venue', labelKey: 'fld_venue_name' },
  { key: 'venueTag', path: 'venue.tagline', type: 'localized-text', group: 'venue', labelKey: 'fld_sub' },
  { key: 'venueLogo', path: 'venue.logo', type: 'image', group: 'venue', labelKey: 'fld_photo' },
  { key: 'address', path: 'venue.address', type: 'localized-text', group: 'venue', labelKey: 'fld_address' },
  { key: 'mapUrl', path: 'venue.mapUrl', type: 'text', group: 'venue', labelKey: 'fld_map_url', placeholder: 'https://yandex.uz/maps/…' },

  { key: 'dress', path: 'dress.title', type: 'localized-text', group: 'details', labelKey: 'fld_dress_title' },
  { key: 'dressNote', path: 'dress.note', type: 'localized-text', group: 'details', labelKey: 'fld_dress_note' },
  { key: 'extra', path: 'extra.title', type: 'localized-text', group: 'details', labelKey: 'fld_label' },
  { key: 'extraNote', path: 'extra.note', type: 'localized-text', group: 'details', labelKey: 'fld_desc' },
  { key: 'rsvpLede', path: 'rsvp.lede', type: 'localized-text', group: 'details', labelKey: 'fld_rsvp_lede' },

  { key: 'schedule', path: 'schedule', type: 'schedule', group: 'schedule', labelKey: 'tg_schedule' },

  { key: 'galleryLede', path: 'gallery_lede', type: 'localized-text', group: 'gallery', labelKey: 'fld_sub' },
  { key: 'gallery', path: 'gallery', type: 'gallery', group: 'gallery', labelKey: 'tg_gallery' },

  { key: 'music', path: 'music.url', type: 'audio', group: 'music', labelKey: 'tg_music' },

  // Block visibility: hidden.<key> === true switches the section off.
  { key: 'v_brand', path: 'hidden.brand', type: 'toggle', group: 'visibility', labelKey: 'sec_venue' },
  { key: 'v_details', path: 'hidden.details', type: 'toggle', group: 'visibility', labelKey: 'sec_details' },
  { key: 'v_program', path: 'hidden.program', type: 'toggle', group: 'visibility', labelKey: 'sec_program' },
  { key: 'v_couple', path: 'hidden.couple', type: 'toggle', group: 'visibility', labelKey: 'sec_story' },
  { key: 'v_gallery', path: 'hidden.gallery', type: 'toggle', group: 'visibility', labelKey: 'sec_gallery' },
  { key: 'v_venue', path: 'hidden.venue', type: 'toggle', group: 'visibility', labelKey: 'sec_venue' },
  { key: 'v_rsvp', path: 'hidden.rsvp', type: 'toggle', group: 'visibility', labelKey: 'sec_rsvp' },
  { key: 'v_music', path: 'hidden.music', type: 'toggle', group: 'visibility', labelKey: 'sec_music' },
];

const defaultConfig = {
  couple: {
    bride: { uz: 'Malika', ru: 'Малика', en: 'Malika' },
    groom: { uz: 'Sardor', ru: 'Сардор', en: 'Sardor' },
    brideFull: { uz: 'Malika Karimova', ru: 'Малика Каримова', en: 'Malika Karimova' },
    groomFull: { uz: 'Sardor Aliyev', ru: 'Сардор Алиев', en: 'Sardor Aliyev' },
    bridePhoto: '',
    groomPhoto: '',
  },
  invite: {
    occasion: { uz: 'Talbon marosimi', ru: 'Талбон', en: 'Talbon celebration' },
    kicker: { uz: 'Xush kelibsiz · Toy muborak', ru: 'Добро пожаловать · Поздравляем', en: 'Welcome · Congratulations' },
    message: {
      uz: 'Farzandlarimiz toyi munosabati bilan otkaziladigan talbon marosimiga sizni chin dildan taklif qilamiz.',
      ru: 'От всего сердца приглашаем вас на талбон в честь свадьбы наших детей.',
      en: 'We warmly invite you to the talbon celebration held in honour of our children.',
    },
    closing: {
      uz: 'Bizning quvonchimizni siz bilan baham korish biz uchun katta sharaf.',
      ru: 'Разделить нашу радость с вами — большая честь для нас.',
      en: 'It would be an honour to share our joy with you.',
    },
  },
  event: {
    dateISO: '2026-10-25T18:00:00',
    dateNote: { uz: 'Yakshanba kuni', ru: 'воскресенье', en: 'a Sunday' },
    timeText: { uz: '', ru: '', en: '' },
    timeNote: { uz: 'kechqurun', ru: 'вечером', en: 'in the evening' },
  },
  venue: {
    name: { uz: 'Registon Palace', ru: 'Registon Palace', en: 'Registon Palace' },
    tagline: {
      uz: 'Milliy taomlar va bazmlar saroyi',
      ru: 'Дворец национальной кухни и торжеств',
      en: 'A palace of national cuisine and celebration',
    },
    logo: '',
    address: {
      uz: 'Amir Temur kochasi 12, Toshkent',
      ru: 'улица Амира Темура 12, Ташкент',
      en: '12 Amir Temur street, Tashkent',
    },
    mapUrl: '',
  },
  dress: {
    title: { uz: 'Bayramona', ru: 'Праздничный', en: 'Festive' },
    note: { uz: 'iliq ranglar xush kelibsiz', ru: 'тёплые тона приветствуются', en: 'warm tones welcome' },
  },
  extra: {
    title: { uz: 'Milliy taomlar va osh', ru: 'Национальные блюда и плов', en: 'National dishes and plov' },
    note: { uz: 'jonli musiqa bilan', ru: 'с живой музыкой', en: 'with live music' },
  },
  rsvp: {
    lede: {
      uz: 'Iltimos, marosimdan oldin javob bering',
      ru: 'Пожалуйста, ответьте до торжества',
      en: 'Please reply before the celebration',
    },
  },
  // The evening's running order. `mode: 'time'` keeps the clock input in the
  // builder — a talbon programme is a schedule, not a list of years.
  schedule: [
    { time: '17:30', mode: 'time', label: { uz: 'Mehmonlar kutib olinadi', ru: 'Встреча гостей', en: 'Guests are welcomed' } },
    { time: '18:00', mode: 'time', label: { uz: 'Tantanali ochilish', ru: 'Торжественное открытие', en: 'The ceremonial opening' } },
    { time: '18:45', mode: 'time', label: { uz: 'Milliy marosim', ru: 'Национальный обряд', en: 'The traditional rites' } },
    { time: '19:30', mode: 'time', label: { uz: 'Ziyofat', ru: 'Угощение', en: 'The feast' } },
    { time: '21:00', mode: 'time', label: { uz: 'Bazm va raqslar', ru: 'Музыка и танцы', en: 'Music and dancing' } },
  ] as { time: string; mode: string; label: Record<string, string> }[],
  gallery_lede: {
    uz: 'Sevgi va quvonchga tola damlar',
    ru: 'Мгновения, полные любви и радости',
    en: 'Moments full of love and joy',
  },
  // Photos the family uploads; an empty list hides the gallery section.
  gallery: [] as { image: string; caption: Record<string, string> }[],
  music: { url: '' },
  // Sections switched off in the builder (all visible by default).
  hidden: {} as Record<string, boolean>,
};

export const weddingTalbonTemplate: TemplateDefinition = {
  id: 'wedding-talbon',
  category: 'wedding',
  nameKey: 'tpl_wedding_talbon',
  cover: '🍎',
  accent: '#8f1d2e',
  html,
  defaultConfig,
  fields,
  groups,
  Renderer: RichRenderer,
  // These must match the real element ids in template.html — the Design+ runtime
  // anchors by getElementById and silently skips a section it cannot find.
  sectionIds: ['top', 'brand', 'details', 'program', 'couple', 'gallery', 'venue', 'rsvp'],
  // The gold family, not the reds. The satin's depth comes from three different
  // reds shading into each other; flattening them to one picked colour would
  // take the fabric with it. Recolouring the ornament is what an accent change
  // usefully does here.
  accentVars: ['--gold', '--gold-lt', '--gold-soft', '--bronze'],
};
