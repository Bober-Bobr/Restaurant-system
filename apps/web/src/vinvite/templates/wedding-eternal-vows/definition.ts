import html from './template.html?raw';
import { RichRenderer } from '../RichRenderer';
import type { TemplateDefinition, TemplateField, TemplateFieldGroup } from '../types';

// ── "Eternal Vows" marble-pavilion wedding template ─────────────────────────
// A pavilion above still water at golden hour. Two threads of light enter from
// opposite edges, orbit one another and resolve into two interlocked rings; the
// pair turns once, the light opens, and the rings settle into the gap between
// the two names, where they stay. A single champagne thread then runs the whole
// height of the page and fills as the guest reads — invitation card → the day's
// particulars → the couple's story → gallery → countdown → RSVP.
// Ivory · marble · champagne · brushed gold. No pure black anywhere.

const groups: TemplateFieldGroup[] = [
  { key: 'couple', labelKey: 'tg_couple', icon: '💍', section: 'top' },
  { key: 'invite', labelKey: 'tg_invite', icon: '✉️', section: 'invitation' },
  { key: 'datetime', labelKey: 'tg_datetime', icon: '🗓', section: 'countdown' },
  { key: 'venue', labelKey: 'tg_venue', icon: '📍', section: 'details' },
  { key: 'details', labelKey: 'tg_details', icon: '📋', section: 'details' },
  { key: 'schedule', labelKey: 'tg_story', icon: '🕐', section: 'chronicle' },
  { key: 'gallery', labelKey: 'tg_gallery', icon: '📷', section: 'memories' },
  { key: 'music', labelKey: 'tg_music', icon: '🎵' },
  { key: 'visibility', labelKey: 'tg_visibility', icon: '👁' },
];

const fields: TemplateField[] = [
  { key: 'bride', path: 'couple.bride', type: 'localized-text', group: 'couple', labelKey: 'fld_bride' },
  { key: 'groom', path: 'couple.groom', type: 'localized-text', group: 'couple', labelKey: 'fld_groom' },

  // The hero's one-line promise, under the date.
  { key: 'promise', path: 'invite.promise', type: 'localized-text', group: 'invite', labelKey: 'fld_promise' },
  { key: 'together', path: 'invite.together', type: 'localized-textarea', group: 'invite', labelKey: 'fld_together' },
  { key: 'verse', path: 'invite.verse', type: 'localized-textarea', group: 'invite', labelKey: 'fld_invite_text' },

  // Convention: the first datetime field is the event date, which the dashboard
  // reads for the date line and the "days left" counter.
  { key: 'dateISO', path: 'event.dateISO', type: 'datetime', group: 'datetime', labelKey: 'fld_datetime' },
  // Written out in words on the card ("half past four in the afternoon"); blank
  // falls back to the formatted clock time from the date above.
  { key: 'timeText', path: 'event.timeText', type: 'localized-text', group: 'datetime', labelKey: 'fld_time_text' },

  { key: 'venueName', path: 'venue.name', type: 'localized-text', group: 'venue', labelKey: 'fld_venue_name' },
  { key: 'address', path: 'venue.address', type: 'localized-text', group: 'venue', labelKey: 'fld_address' },
  { key: 'mapUrl', path: 'venue.mapUrl', type: 'text', group: 'venue', labelKey: 'fld_map_url', placeholder: 'https://yandex.uz/maps/…' },

  // The particulars tiles. Each is a headline plus a smaller note beneath it;
  // leaving both blank simply empties that tile.
  { key: 'dress', path: 'details.dress', type: 'localized-text', group: 'details', labelKey: 'fld_dress' },
  { key: 'dressNote', path: 'details.dressNote', type: 'localized-text', group: 'details', labelKey: 'fld_dress_note' },
  { key: 'stay', path: 'details.stay', type: 'localized-text', group: 'details', labelKey: 'fld_stay' },
  { key: 'stayNote', path: 'details.stayNote', type: 'localized-text', group: 'details', labelKey: 'fld_stay_note' },
  { key: 'travel', path: 'details.travel', type: 'localized-text', group: 'details', labelKey: 'fld_travel' },
  { key: 'travelNote', path: 'details.travelNote', type: 'localized-text', group: 'details', labelKey: 'fld_travel_note' },
  { key: 'gifts', path: 'details.gifts', type: 'localized-text', group: 'details', labelKey: 'fld_gifts' },
  { key: 'giftsNote', path: 'details.giftsNote', type: 'localized-text', group: 'details', labelKey: 'fld_gifts_note' },
  { key: 'replyBy', path: 'details.replyBy', type: 'localized-text', group: 'details', labelKey: 'fld_reply_by' },
  { key: 'rsvpLede', path: 'details.rsvpLede', type: 'localized-text', group: 'details', labelKey: 'fld_rsvp_lede' },

  // The couple's story — each entry becomes a moment branching off the thread.
  // `time` is the when ("Spring 2018"), `label` the moment itself.
  { key: 'schedule', path: 'schedule', type: 'schedule', group: 'schedule', labelKey: 'tg_story' },

  { key: 'gallery', path: 'gallery', type: 'gallery', group: 'gallery', labelKey: 'tg_gallery' },

  { key: 'music', path: 'music.url', type: 'audio', group: 'music', labelKey: 'tg_music' },

  // Block visibility: hidden.<key> === true switches the section off.
  { key: 'v_invitation', path: 'hidden.invitation', type: 'toggle', group: 'visibility', labelKey: 'sec_message' },
  { key: 'v_details', path: 'hidden.details', type: 'toggle', group: 'visibility', labelKey: 'sec_details' },
  { key: 'v_story', path: 'hidden.story', type: 'toggle', group: 'visibility', labelKey: 'sec_story' },
  { key: 'v_gallery', path: 'hidden.gallery', type: 'toggle', group: 'visibility', labelKey: 'sec_gallery' },
  { key: 'v_countdown', path: 'hidden.countdown', type: 'toggle', group: 'visibility', labelKey: 'sec_countdown' },
  { key: 'v_rsvp', path: 'hidden.rsvp', type: 'toggle', group: 'visibility', labelKey: 'sec_rsvp' },
  { key: 'v_music', path: 'hidden.music', type: 'toggle', group: 'visibility', labelKey: 'sec_music' },
];

const defaultConfig = {
  couple: {
    bride: { ru: 'Аиша', uz: 'Oysha', en: 'Aisha' },
    groom: { ru: 'Тимур', uz: 'Timur', en: 'Timur' },
  },
  invite: {
    promise: {
      ru: 'Два пути, одно обещание — в павильоне над Чарвакским озером',
      uz: 'Ikki yol, bitta vada — Chorvoq kolidagi pavilonda',
      en: 'Two paths, one promise — at the Pavilion above Lake Charvak',
    },
    together: {
      ru: 'Вместе с семьями просим вас разделить с нами этот день',
      uz: 'Oilalarimiz bilan birga sizni ushbu kunni bolishishga taklif qilamiz',
      en: 'Together with their families request the honour of your presence',
    },
    verse: {
      ru: 'в день, когда мы дадим клятвы над водой,\nи попросим самых близких быть рядом.',
      uz: 'suv uzra qasam ichadigan kunimizda,\neng yaqinlarimizdan yonimizda bolishni soraymiz.',
      en: 'as they make their vows on the water, and ask the people\nthey love most to stand close by.',
    },
  },
  event: {
    dateISO: '2027-05-30T16:30:00',
    timeText: {
      ru: 'Половина пятого пополудни',
      uz: 'Kunduzi tortdan yarim otganda',
      en: 'Half past four in the afternoon',
    },
  },
  venue: {
    name: { ru: 'Павильон, Чарвакское озеро', uz: 'Pavilon, Chorvoq koli', en: 'The Pavilion, Lake Charvak' },
    address: {
      ru: 'Чарвакское водохранилище, Бостанлык. Церемония на террасе у воды, ужин — в оранжерее.',
      uz: 'Chorvoq suv ombori, Bostonliq. Marosim suv boyidagi terrasada, kechki ovqat oranjereyada.',
      en: 'Chorvoq Reservoir, Bostanliq. The ceremony is on the water terrace; dinner follows in the orangery.',
    },
    mapUrl: '',
  },
  details: {
    dress: { ru: 'Торжественный, тёплые тона', uz: 'Tantanali, iliq ranglar', en: 'Formal, warm tones' },
    dressNote: {
      ru: 'Слоновая кость, песочный и шампань. Удобная обувь для террасы.',
      uz: 'Fil suyagi, qum va shampan ranglari. Terrasa uchun qulay poyabzal.',
      en: 'Ivory, sand and champagne. Flat heels for the terrace.',
    },
    stay: { ru: 'Чарвак Лодж', uz: 'Chorvoq Lodge', en: 'Charvak Lodge' },
    stayNote: {
      ru: 'Номера забронированы на наши имена до 1 мая.',
      uz: 'Xonalar 1-mayga qadar bizning nomimizda band qilingan.',
      en: 'Rooms held under our names until 1 May.',
    },
    travel: { ru: 'Автобусы из города', uz: 'Shahardan avtobuslar', en: 'Coaches from the city' },
    travelNote: {
      ru: 'Отправление от гостиницы «Узбекистан» в 14:30, обратно — в полночь.',
      uz: '«Ozbekiston» mehmonxonasidan 14:30 da, qaytish yarim tunda.',
      en: 'Departing Hotel Uzbekistan at 14:30, returning at midnight.',
    },
    gifts: { ru: 'Только ваше присутствие', uz: 'Faqat borligingiz', en: 'Your presence, only' },
    giftsNote: {
      ru: 'Если пожелаете — вклад в дом, который мы строим.',
      uz: 'Agar xohlasangiz — quryotgan uyimizga hissa.',
      en: 'If you wish, a contribution to the house we are building.',
    },
    replyBy: { ru: 'До 1 апреля 2027', uz: '2027-yil 1-aprelgacha', en: 'By 1 April 2027' },
    rsvpLede: {
      ru: 'До первого апреля, чтобы план рассадки можно было написать от руки.',
      uz: 'Birinchi aprelgacha, stol rejasini qol bilan yozishimiz uchun.',
      en: 'By the first of April, so the table plan can be written by hand.',
    },
  },
  // The couple's story; an empty list hides the section.
  schedule: [
    { time: '2018', label: { ru: 'Первая встреча', uz: 'Ilk uchrashuv', en: 'The first meeting' } },
    { time: '2018', label: { ru: 'Первый вечер', uz: 'Ilk kecha', en: 'The first evening' } },
    { time: '2021', label: { ru: 'Своя дверь', uz: 'Oz eshigimiz', en: 'A door of our own' } },
    { time: '2026', label: { ru: 'Тот самый вопрос', uz: 'Osha savol', en: 'The question' } },
    { time: '2027', label: { ru: 'Обещание', uz: 'Vada', en: 'The promise' } },
  ],
  // Photos the couple uploads; an empty list hides the gallery section.
  gallery: [] as { image: string; caption: Record<string, string> }[],
  music: { url: '' },
  // Sections switched off in the builder (all visible by default).
  hidden: {} as Record<string, boolean>,
};

export const weddingEternalVowsTemplate: TemplateDefinition = {
  id: 'wedding-eternal-vows',
  category: 'wedding',
  nameKey: 'tpl_wedding_eternal_vows',
  cover: '💍',
  accent: '#c9a96a',
  html,
  defaultConfig,
  fields,
  groups,
  Renderer: RichRenderer,
  // These must match the real element ids in template.html — the Design+ runtime
  // anchors by getElementById and silently skips a section it cannot find.
  sectionIds: ['top', 'invitation', 'details', 'chronicle', 'memories', 'countdown', 'rsvp'],
  accentVars: ['--gold', '--gold-lt', '--gold-dk'],
};
