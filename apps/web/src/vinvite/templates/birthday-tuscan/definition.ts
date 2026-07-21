import html from './template.html?raw';
import { RichRenderer } from '../RichRenderer';
import type { TemplateDefinition, TemplateField, TemplateFieldGroup } from '../types';

// ── "Tuscan Evening" birthday template ───────────────────────────────────────
// Envelope opening → day-to-night hero → countdown → details → venue → gallery
// → program timeline → gifts + gift card → RSVP → contacts → starlit finale.

const groups: TemplateFieldGroup[] = [
  { key: 'visibility', labelKey: 'tg_visibility', icon: '👁' },
  { key: 'honoree', labelKey: 'tg_honoree', icon: '🎂' },
  { key: 'invite', labelKey: 'tg_invite', icon: '✉️' },
  { key: 'datetime', labelKey: 'tg_datetime', icon: '🗓' },
  { key: 'venue', labelKey: 'tg_venue', icon: '📍' },
  { key: 'gallery', labelKey: 'tg_gallery', icon: '📷' },
  { key: 'schedule', labelKey: 'tg_schedule', icon: '🕐' },
  { key: 'music', labelKey: 'tg_music', icon: '🎵' },
  { key: 'gifts', labelKey: 'tg_gifts', icon: '🎁' },
  { key: 'contacts', labelKey: 'tg_contacts', icon: '☎️' },
];

const fields: TemplateField[] = [
  // Show/hide switches — the value stored is the HIDDEN flag.
  { key: 'v_age', path: 'hidden.age', type: 'toggle', group: 'visibility', labelKey: 'sec_age' },
  { key: 'v_message', path: 'hidden.message', type: 'toggle', group: 'visibility', labelKey: 'sec_message' },
  { key: 'v_countdown', path: 'hidden.countdown', type: 'toggle', group: 'visibility', labelKey: 'sec_countdown' },
  { key: 'v_details', path: 'hidden.details', type: 'toggle', group: 'visibility', labelKey: 'sec_details' },
  { key: 'v_venue', path: 'hidden.venue', type: 'toggle', group: 'visibility', labelKey: 'sec_venue' },
  { key: 'v_gallery', path: 'hidden.gallery', type: 'toggle', group: 'visibility', labelKey: 'sec_gallery' },
  { key: 'v_program', path: 'hidden.program', type: 'toggle', group: 'visibility', labelKey: 'sec_program' },
  { key: 'v_gifts', path: 'hidden.gifts', type: 'toggle', group: 'visibility', labelKey: 'sec_gifts' },
  { key: 'v_rsvp', path: 'hidden.rsvp', type: 'toggle', group: 'visibility', labelKey: 'sec_rsvp' },
  { key: 'v_contacts', path: 'hidden.contacts', type: 'toggle', group: 'visibility', labelKey: 'sec_contacts' },
  { key: 'v_music', path: 'hidden.music', type: 'toggle', group: 'visibility', labelKey: 'sec_music' },
  { key: 'v_final', path: 'hidden.final', type: 'toggle', group: 'visibility', labelKey: 'sec_final' },

  { key: 'name', path: 'honoree.name', type: 'localized-text', group: 'honoree', labelKey: 'fld_name' },
  { key: 'ageLabel', path: 'honoree.ageLabel', type: 'localized-text', group: 'honoree', labelKey: 'fld_age' },

  { key: 'kicker', path: 'invite.kicker', type: 'localized-text', group: 'invite', labelKey: 'fld_kicker' },
  { key: 'sub', path: 'invite.sub', type: 'localized-text', group: 'invite', labelKey: 'fld_sub' },
  { key: 'text', path: 'invite.text', type: 'localized-textarea', group: 'invite', labelKey: 'fld_text' },
  { key: 'final', path: 'final.message', type: 'localized-textarea', group: 'invite', labelKey: 'fld_final' },

  { key: 'dateISO', path: 'event.dateISO', type: 'datetime', group: 'datetime', labelKey: 'fld_datetime' },
  { key: 'timeNote', path: 'event.timeNote', type: 'localized-text', group: 'datetime', labelKey: 'fld_time_note' },
  { key: 'city', path: 'event.city', type: 'localized-text', group: 'datetime', labelKey: 'fld_city' },

  { key: 'venueName', path: 'venue.name', type: 'localized-text', group: 'venue', labelKey: 'fld_venue_name' },
  { key: 'address', path: 'venue.address', type: 'localized-text', group: 'venue', labelKey: 'fld_address' },
  { key: 'mapUrl', path: 'venue.mapUrl', type: 'text', group: 'venue', labelKey: 'fld_map_url', placeholder: 'https://yandex.uz/maps/…' },
  { key: 'venueImage', path: 'venue.image', type: 'image', group: 'venue', labelKey: 'fld_photo' },
  { key: 'venueDesc', path: 'venue.desc', type: 'localized-textarea', group: 'venue', labelKey: 'fld_desc' },

  { key: 'gallery', path: 'gallery', type: 'gallery', group: 'gallery', labelKey: 'tg_gallery' },

  { key: 'schedule', path: 'schedule', type: 'schedule', group: 'schedule', labelKey: 'tg_schedule' },

  { key: 'music', path: 'music.url', type: 'audio', group: 'music', labelKey: 'tg_music' },

  { key: 'giftsTitle', path: 'gifts.title', type: 'localized-text', group: 'gifts', labelKey: 'fld_gifts_title' },
  { key: 'giftsNote', path: 'gifts.note', type: 'localized-textarea', group: 'gifts', labelKey: 'fld_gifts_note' },
  { key: 'cardNumber', path: 'gifts.cardNumber', type: 'text', group: 'gifts', labelKey: 'fld_card_number', placeholder: '8600 0000 0000 0000' },
  { key: 'cardHolder', path: 'gifts.cardHolder', type: 'text', group: 'gifts', labelKey: 'fld_card_holder', placeholder: 'MADINA KARIMOVA' },

  { key: 'phone', path: 'contacts.phone', type: 'text', group: 'contacts', labelKey: 'fld_phone', placeholder: '+998 90 123 45 67' },
  { key: 'telegram', path: 'contacts.telegram', type: 'text', group: 'contacts', labelKey: 'fld_telegram', placeholder: '@username' },
  { key: 'instagram', path: 'contacts.instagram', type: 'text', group: 'contacts', labelKey: 'fld_instagram', placeholder: '@username' },
];

const defaultConfig = {
  // The cover scene (sky, sun, clouds, mansion) is bundled with the template
  // and deliberately not editable — it is what the design is.
  // Blocks switched off by the honoree (key → true). Empty = everything shown.
  hidden: {} as Record<string, boolean>,
  honoree: {
    name: { ru: 'Мадина', uz: 'Madina', en: 'Madina' },
    ageLabel: { ru: '30 лет', uz: '30 yosh', en: 'Thirty Years' },
  },
  invite: {
    kicker: {
      ru: 'Приглашает вас разделить праздник',
      uz: 'Sizni bayramni birga nishonlashga taklif qiladi',
      en: 'Invites you to share the celebration',
    },
    sub: { ru: 'День рождения', uz: 'Tugilgan kun', en: 'A Birthday Celebration' },
    text: {
      ru: 'Год за годом жизнь дарит нам новые встречи.\nМы соберёмся под вечерним небом,\nчтобы отпраздновать прекрасную дату.',
      uz: 'Yildan yilga hayot bizga yangi uchrashuvlar beradi.\nGozal sanani nishonlash uchun\nkechki osmon ostida yigilamiz.',
      en: 'As the seasons turn once more,\nwe gather beneath the evening sky\nto celebrate a life beautifully lived.',
    },
  },
  final: {
    message: {
      ru: 'С нетерпением жду встречи с вами',
      uz: 'Siz bilan uchrashuvni intiqlik bilan kutaman',
      en: 'I cannot wait to celebrate with you',
    },
  },
  event: {
    dateISO: '2026-09-20T19:00:00',
    timeNote: { ru: '', uz: '', en: '' },
    city: { ru: 'Ташкент', uz: 'Toshkent', en: 'Tashkent' },
  },
  venue: {
    name: { ru: 'Ресторан «Сад»', uz: '«Sad» restorani', en: 'The Garden Hall' },
    address: {
      ru: 'ул. Мирзо Улугбека, 12, Ташкент',
      uz: 'Mirzo Ulugbek kochasi, 12, Toshkent',
      en: '12 Mirzo Ulugbek St, Tashkent',
    },
    mapUrl: '',
    image: '',
    desc: {
      ru: 'Уютный зал с террасой и садом — место, где вечер пройдёт незабываемо.',
      uz: 'Ayvon va bogli shinam zal — kecha unutilmas otadigan joy.',
      en: 'A cosy hall with a terrace and garden — where the evening becomes unforgettable.',
    },
  },
  gallery: [] as { image: string; caption: Record<string, string> }[],
  schedule: [
    { time: '19:00', label: { ru: 'Сбор гостей', uz: 'Mehmonlarni kutib olish', en: 'Welcome drinks' } },
    { time: '19:45', label: { ru: 'Праздничный ужин', uz: 'Bayram kechki ovqati', en: 'Birthday dinner' } },
    { time: '21:00', label: { ru: 'Тосты и поздравления', uz: 'Qadah sozlari va tabriklar', en: 'Toasts & wishes' } },
    { time: '22:00', label: { ru: 'Праздничный торт', uz: 'Bayram torti', en: 'Birthday cake' } },
  ],
  music: { url: '' },
  gifts: {
    title: {
      ru: 'Ваше присутствие — лучший подарок',
      uz: 'Sizning kelishingiz — eng yaxshi sovga',
      en: 'Your presence is the greatest gift',
    },
    note: {
      ru: 'Если вы хотите поздравить нас особенно, будем благодарны за вклад в мечту.',
      uz: 'Agar bizni alohida tabriklamoqchi bolsangiz, orzu sari hissangiz uchun minnatdormiz.',
      en: 'Should you wish to mark the occasion, a contribution to a dream would be treasured.',
    },
    cardNumber: '',
    cardHolder: '',
  },
  contacts: { phone: '', telegram: '', instagram: '' },
};

export const birthdayTuscanTemplate: TemplateDefinition = {
  id: 'birthday-tuscan',
  category: 'birthday',
  nameKey: 'tpl_birthday_tuscan',
  cover: '🏛️',
  accent: '#b08d4f',
  html,
  defaultConfig,
  fields,
  groups,
  Renderer: RichRenderer,
};
