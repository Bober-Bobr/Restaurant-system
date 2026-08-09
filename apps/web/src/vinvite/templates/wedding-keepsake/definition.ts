import html from './template.html?raw';
import { RichRenderer } from '../RichRenderer';
import type { TemplateDefinition, TemplateField, TemplateFieldGroup } from '../types';

// ── "The Keepsake" scratch-and-reveal wedding template ──────────────────────
// A folded stationery card opens, and the invitation's particulars are hidden
// beneath champagne-metallic panels the guest physically scratches away with a
// finger (or a click-drag). Six cards carry the occasion, the day, the place,
// the hour, the attire and the reply; a seventh, larger one holds a private
// note from the couple. Ivory paper, burgundy wine, brushed gold.
//
// The six cards are bound to the SAME config values as the plain "particulars"
// section below them — the scratch panels are a way of reading the invitation,
// not a second copy of it that could drift out of step.

const groups: TemplateFieldGroup[] = [
  { key: 'couple', labelKey: 'tg_couple', icon: '💍', section: 'top' },
  { key: 'invite', labelKey: 'tg_invite', icon: '✉️', section: 'scratch' },
  { key: 'datetime', labelKey: 'tg_datetime', icon: '🗓', section: 'countdown' },
  { key: 'venue', labelKey: 'tg_venue', icon: '📍', section: 'details' },
  { key: 'details', labelKey: 'tg_details', icon: '📋', section: 'details' },
  { key: 'secret', labelKey: 'tg_secret', icon: '🤫', section: 'secret' },
  { key: 'gallery', labelKey: 'tg_gallery', icon: '📷', section: 'gallery' },
  { key: 'music', labelKey: 'tg_music', icon: '🎵' },
  { key: 'visibility', labelKey: 'tg_visibility', icon: '👁' },
];

const fields: TemplateField[] = [
  { key: 'bride', path: 'couple.bride', type: 'localized-text', group: 'couple', labelKey: 'fld_bride' },
  { key: 'groom', path: 'couple.groom', type: 'localized-text', group: 'couple', labelKey: 'fld_groom' },

  { key: 'kicker', path: 'invite.kicker', type: 'localized-text', group: 'invite', labelKey: 'fld_kicker' },
  // Card 01's script line — the "why we are writing" of the invitation.
  { key: 'headline', path: 'invite.headline', type: 'localized-text', group: 'invite', labelKey: 'fld_promise' },
  { key: 'sub', path: 'invite.sub', type: 'localized-text', group: 'invite', labelKey: 'fld_sub' },
  { key: 'verse', path: 'invite.verse', type: 'localized-textarea', group: 'invite', labelKey: 'fld_final' },

  // Convention: the first datetime field is the event date, which the dashboard
  // reads for the date line and the "days left" counter.
  { key: 'dateISO', path: 'event.dateISO', type: 'datetime', group: 'datetime', labelKey: 'fld_datetime' },
  // The hour written out in words ("half past four"); blank falls back to the
  // clock time taken from the date above.
  { key: 'timeText', path: 'event.timeText', type: 'localized-text', group: 'datetime', labelKey: 'fld_time_text' },
  { key: 'dateNote', path: 'event.dateNote', type: 'localized-text', group: 'datetime', labelKey: 'fld_time_note' },

  { key: 'venueName', path: 'venue.name', type: 'localized-text', group: 'venue', labelKey: 'fld_venue_name' },
  { key: 'address', path: 'venue.address', type: 'localized-text', group: 'venue', labelKey: 'fld_address' },
  { key: 'mapUrl', path: 'venue.mapUrl', type: 'text', group: 'venue', labelKey: 'fld_map_url', placeholder: 'https://yandex.uz/maps/…' },

  { key: 'dress', path: 'dress.title', type: 'localized-text', group: 'details', labelKey: 'fld_dress' },
  { key: 'dressNote', path: 'dress.note', type: 'localized-text', group: 'details', labelKey: 'fld_dress_note' },
  { key: 'stay', path: 'details.stay', type: 'localized-text', group: 'details', labelKey: 'fld_stay' },
  { key: 'stayNote', path: 'details.stayNote', type: 'localized-text', group: 'details', labelKey: 'fld_stay_note' },
  { key: 'travel', path: 'details.travel', type: 'localized-text', group: 'details', labelKey: 'fld_travel' },
  { key: 'travelNote', path: 'details.travelNote', type: 'localized-text', group: 'details', labelKey: 'fld_travel_note' },
  { key: 'gifts', path: 'details.gifts', type: 'localized-text', group: 'details', labelKey: 'fld_gifts' },
  { key: 'giftsNote', path: 'details.giftsNote', type: 'localized-text', group: 'details', labelKey: 'fld_gifts_note' },
  // Card 06: the script line, then the deadline beneath it.
  { key: 'rsvpHeadline', path: 'details.rsvpHeadline', type: 'localized-text', group: 'details', labelKey: 'fld_promise' },
  { key: 'replyBy', path: 'details.replyBy', type: 'localized-text', group: 'details', labelKey: 'fld_reply_by' },
  { key: 'rsvpLede', path: 'details.rsvpLede', type: 'localized-text', group: 'details', labelKey: 'fld_rsvp_lede' },

  { key: 'secretTitle', path: 'secret.title', type: 'localized-text', group: 'secret', labelKey: 'fld_secret_title' },
  { key: 'secretNote', path: 'secret.note', type: 'localized-textarea', group: 'secret', labelKey: 'fld_secret_note' },

  { key: 'gallery', path: 'gallery', type: 'gallery', group: 'gallery', labelKey: 'tg_gallery' },

  { key: 'music', path: 'music.url', type: 'audio', group: 'music', labelKey: 'tg_music' },

  // Block visibility: hidden.<key> === true switches the section off.
  { key: 'v_scratch', path: 'hidden.scratch', type: 'toggle', group: 'visibility', labelKey: 'sec_scratch' },
  { key: 'v_secret', path: 'hidden.secret', type: 'toggle', group: 'visibility', labelKey: 'sec_secret' },
  { key: 'v_details', path: 'hidden.details', type: 'toggle', group: 'visibility', labelKey: 'sec_details' },
  { key: 'v_gallery', path: 'hidden.gallery', type: 'toggle', group: 'visibility', labelKey: 'sec_gallery' },
  { key: 'v_countdown', path: 'hidden.countdown', type: 'toggle', group: 'visibility', labelKey: 'sec_countdown' },
  { key: 'v_rsvp', path: 'hidden.rsvp', type: 'toggle', group: 'visibility', labelKey: 'sec_rsvp' },
  { key: 'v_music', path: 'hidden.music', type: 'toggle', group: 'visibility', labelKey: 'sec_music' },
];

const defaultConfig = {
  couple: {
    bride: { ru: 'Изабель', uz: 'Izabel', en: 'Isabel' },
    groom: { ru: 'Марко', uz: 'Marko', en: 'Marco' },
  },
  invite: {
    kicker: {
      ru: 'Вместе со своими семьями',
      uz: 'Oilalari bilan birga',
      en: 'Together with their families',
    },
    headline: {
      ru: 'Сохраните этот день',
      uz: 'Bu kunni saqlab qoling',
      en: 'Save the date',
    },
    sub: {
      ru: 'наша вечность начинается',
      uz: 'abadiyatimiz boshlanadi',
      en: 'our forever begins',
    },
    verse: {
      ru: 'Спасибо, что открыли нашу историю — каждый секрет был написан с мыслью о вас.',
      uz: 'Tariximizni ochganingiz uchun rahmat — har bir sir siz haqingizda oylab yozilgan.',
      en: 'Thank you for uncovering our story — every secret was written with you in mind.',
    },
  },
  event: {
    dateISO: '2027-06-12T16:30:00',
    timeText: {
      ru: 'Половина пятого пополудни',
      uz: 'Kunduzi tortdan yarim otganda',
      en: 'Half past four in the afternoon',
    },
    dateNote: {
      ru: 'суббота, ранняя осень',
      uz: 'shanba, erta kuz',
      en: 'a Saturday in early autumn',
    },
  },
  venue: {
    name: { ru: 'Вилла Серена', uz: 'Serena villasi', en: 'Villa Serena' },
    address: {
      ru: 'Виноградный холм, Бостанлык. Церемония в саду, ужин — в оранжерее.',
      uz: 'Uzumzor tepaligi, Bostonliq. Marosim bogda, kechki ovqat oranjereyada.',
      en: 'Vineyard Hill, Bostanliq. The ceremony is in the garden; dinner follows in the orangery.',
    },
    mapUrl: '',
  },
  dress: {
    title: { ru: 'Торжественный садовый', uz: 'Tantanali bog uslubi', en: 'Formal garden' },
    note: {
      ru: 'Тёплые тона и мягкое золото. Удобная обувь для сада.',
      uz: 'Iliq ranglar va yumshoq oltin. Bog uchun qulay poyabzal.',
      en: 'Warm tones and soft golds. Flat heels for the garden.',
    },
  },
  details: {
    stay: { ru: 'Гостевой дом при вилле', uz: 'Villadagi mehmon uyi', en: 'Rooms at the villa' },
    stayNote: {
      ru: 'Номера забронированы на наши имена до 12 мая.',
      uz: 'Xonalar 12-mayga qadar bizning nomimizda band qilingan.',
      en: 'Rooms held under our names until 12 May.',
    },
    travel: { ru: 'Автобусы из города', uz: 'Shahardan avtobuslar', en: 'Coaches from the city' },
    travelNote: {
      ru: 'Отправление в 14:30, обратно — в полночь.',
      uz: 'Jonash 14:30 da, qaytish yarim tunda.',
      en: 'Departing at 14:30, returning at midnight.',
    },
    gifts: { ru: 'Только ваше присутствие', uz: 'Faqat borligingiz', en: 'Your presence, only' },
    giftsNote: {
      ru: 'Если пожелаете — вклад в дом, который мы строим.',
      uz: 'Agar xohlasangiz — quryotgan uyimizga hissa.',
      en: 'If you wish, a contribution to the house we are building.',
    },
    rsvpHeadline: {
      ru: 'Скажите, что придёте',
      uz: 'Kelishingizni ayting',
      en: "Say you'll come",
    },
    replyBy: { ru: 'До 12 мая 2027', uz: '2027-yil 12-maygacha', en: 'By 12 May 2027' },
    rsvpLede: {
      ru: 'До двенадцатого мая, чтобы план рассадки можно было написать от руки.',
      uz: 'Ok-mayning onikkinchisigacha, stol rejasini qol bilan yozishimiz uchun.',
      en: 'By the twelfth of May, so the table plan can be written by hand.',
    },
  },
  // The private note under the large coating. Emptying it hides the section.
  secret: {
    title: {
      ru: 'Спасибо, что вы — часть нашей истории',
      uz: 'Tariximizning bir qismi bolganingiz uchun rahmat',
      en: 'Thank you for being part of our story',
    },
    note: {
      ru: 'Из всех прожитых дней лучший — тот, который мы разделим с вами. Приходите танцевать с нами, пока не погаснут звёзды.',
      uz: 'Yashagan barcha kunlarimiz ichida eng yaxshisi — siz bilan bolishadiganimiz. Yulduzlar songuncha biz bilan raqsga tushing.',
      en: 'Of all the days we have lived, the best is the one we get to share with you. Come dance with us until the stars give in.',
    },
  },
  // Photos the couple uploads; an empty list hides the gallery section.
  gallery: [] as { image: string; caption: Record<string, string> }[],
  music: { url: '' },
  // Sections switched off in the builder (all visible by default).
  hidden: {} as Record<string, boolean>,
};

export const weddingKeepsakeTemplate: TemplateDefinition = {
  id: 'wedding-keepsake',
  category: 'wedding',
  nameKey: 'tpl_wedding_keepsake',
  cover: '🎟',
  accent: '#7c2e3c',
  html,
  defaultConfig,
  fields,
  groups,
  Renderer: RichRenderer,
  // These must match the real element ids in template.html — the Design+ runtime
  // anchors by getElementById and silently skips a section it cannot find.
  sectionIds: ['top', 'scratch', 'secret', 'details', 'gallery', 'countdown', 'rsvp'],
  // The metallic family, so the Design+ accent picker recolours the coatings as
  // one rather than splitting the paper from the foil.
  accentVars: ['--gold', '--gold-soft', '--bronze'],
};
