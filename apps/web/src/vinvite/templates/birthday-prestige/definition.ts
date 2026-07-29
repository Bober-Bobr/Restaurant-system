import html from './template.html?raw';
import { RichRenderer } from '../RichRenderer';
import type { TemplateDefinition, TemplateField, TemplateFieldGroup } from '../types';

// ── "Prestige Evening" birthday template ─────────────────────────────────────
// The page is a theatre: heavy velvet drapes hold the screen until the guest
// presses ENTER, they part, warm light spills through and the camera advances
// into the room. Editorial register — numbered chapters, hairline rules, one
// ivory paper letter as the only light surface in the house.
// Overture → room → welcome → ledger of particulars → itinerary → gallery →
// the letter → countdown → reply → closing.

const groups: TemplateFieldGroup[] = [
  { key: 'visibility', labelKey: 'tg_visibility', icon: '👁' },
  { key: 'honoree', labelKey: 'tg_honoree', icon: '🎂', section: 'room' },
  { key: 'invite', labelKey: 'tg_invite', icon: '✉️', section: 'welcome' },
  { key: 'datetime', labelKey: 'tg_datetime', icon: '🗓', section: 'details' },
  { key: 'venue', labelKey: 'tg_venue', icon: '📍', section: 'details' },
  { key: 'schedule', labelKey: 'tg_schedule', icon: '🕐', section: 'evening' },
  { key: 'gallery', labelKey: 'tg_gallery', icon: '📷', section: 'gallery' },
  { key: 'dress', labelKey: 'tg_dress', icon: '👗', section: 'details' },
  { key: 'gifts', labelKey: 'tg_gifts', icon: '🎁', section: 'letter' },
  { key: 'contacts', labelKey: 'tg_contacts', icon: '☎️', section: 'close' },
  { key: 'music', labelKey: 'tg_music', icon: '🎵' },
];

const fields: TemplateField[] = [
  // Show/hide switches — the value stored is the HIDDEN flag, so an unset
  // config means everything is visible.
  { key: 'v_age', path: 'hidden.age', type: 'toggle', group: 'visibility', labelKey: 'sec_age' },
  { key: 'v_message', path: 'hidden.message', type: 'toggle', group: 'visibility', labelKey: 'sec_message' },
  { key: 'v_details', path: 'hidden.details', type: 'toggle', group: 'visibility', labelKey: 'sec_details' },
  { key: 'v_venue', path: 'hidden.venue', type: 'toggle', group: 'visibility', labelKey: 'sec_venue' },
  { key: 'v_dress', path: 'hidden.dress', type: 'toggle', group: 'visibility', labelKey: 'sec_dress' },
  { key: 'v_gifts', path: 'hidden.gifts', type: 'toggle', group: 'visibility', labelKey: 'sec_gifts' },
  { key: 'v_contacts', path: 'hidden.contacts', type: 'toggle', group: 'visibility', labelKey: 'sec_contacts' },
  { key: 'v_program', path: 'hidden.program', type: 'toggle', group: 'visibility', labelKey: 'sec_program' },
  { key: 'v_gallery', path: 'hidden.gallery', type: 'toggle', group: 'visibility', labelKey: 'sec_gallery' },
  { key: 'v_letter', path: 'hidden.letter', type: 'toggle', group: 'visibility', labelKey: 'sec_letter' },
  { key: 'v_countdown', path: 'hidden.countdown', type: 'toggle', group: 'visibility', labelKey: 'sec_countdown' },
  { key: 'v_rsvp', path: 'hidden.rsvp', type: 'toggle', group: 'visibility', labelKey: 'sec_rsvp' },
  { key: 'v_music', path: 'hidden.music', type: 'toggle', group: 'visibility', labelKey: 'sec_music' },
  { key: 'v_final', path: 'hidden.final', type: 'toggle', group: 'visibility', labelKey: 'sec_final' },

  { key: 'name', path: 'honoree.name', type: 'localized-text', group: 'honoree', labelKey: 'fld_name' },
  // Rendered as the italic second line of the hero headline ("at forty").
  { key: 'ageLabel', path: 'honoree.ageLabel', type: 'localized-text', group: 'honoree', labelKey: 'fld_age' },

  { key: 'text', path: 'invite.text', type: 'localized-textarea', group: 'invite', labelKey: 'fld_text' },
  { key: 'letter', path: 'letter.text', type: 'localized-textarea', group: 'invite', labelKey: 'fld_letter' },
  { key: 'final', path: 'final.message', type: 'localized-textarea', group: 'invite', labelKey: 'fld_final' },

  // Convention: the first datetime field is the event date, which the dashboard
  // reads for the date line and the "days left" counter.
  { key: 'dateISO', path: 'event.dateISO', type: 'datetime', group: 'datetime', labelKey: 'fld_datetime' },
  { key: 'dateNote', path: 'event.dateNote', type: 'localized-text', group: 'datetime', labelKey: 'fld_desc' },
  { key: 'timeNote', path: 'event.timeNote', type: 'localized-text', group: 'datetime', labelKey: 'fld_time_note' },

  { key: 'venueName', path: 'venue.name', type: 'localized-text', group: 'venue', labelKey: 'fld_venue_name' },
  { key: 'address', path: 'venue.address', type: 'localized-text', group: 'venue', labelKey: 'fld_address' },
  { key: 'mapUrl', path: 'venue.mapUrl', type: 'text', group: 'venue', labelKey: 'fld_map_url', placeholder: 'https://yandex.uz/maps/…' },

  { key: 'schedule', path: 'schedule', type: 'schedule', group: 'schedule', labelKey: 'tg_schedule' },
  { key: 'gallery', path: 'gallery', type: 'gallery', group: 'gallery', labelKey: 'tg_gallery' },

  { key: 'dressTitle', path: 'dress.title', type: 'localized-text', group: 'dress', labelKey: 'fld_dress_title' },
  { key: 'dressColors', path: 'dress.colors', type: 'palette', group: 'dress', labelKey: 'fld_dress_colors' },
  { key: 'dressNote', path: 'dress.note', type: 'localized-textarea', group: 'dress', labelKey: 'fld_dress_note' },

  { key: 'giftsTitle', path: 'gifts.title', type: 'localized-text', group: 'gifts', labelKey: 'fld_gifts_title' },
  { key: 'cardNumber', path: 'gifts.cardNumber', type: 'text', group: 'gifts', labelKey: 'fld_card_number', placeholder: '8600 0000 0000 0000' },
  { key: 'cardHolder', path: 'gifts.cardHolder', type: 'text', group: 'gifts', labelKey: 'fld_card_holder', placeholder: 'KAMILA YUSUPOVA' },

  { key: 'phone', path: 'contacts.phone', type: 'text', group: 'contacts', labelKey: 'fld_phone', placeholder: '+998 90 123 45 67' },
  { key: 'telegram', path: 'contacts.telegram', type: 'text', group: 'contacts', labelKey: 'fld_telegram', placeholder: '@username' },
  { key: 'instagram', path: 'contacts.instagram', type: 'text', group: 'contacts', labelKey: 'fld_instagram', placeholder: '@username' },

  { key: 'music', path: 'music.url', type: 'audio', group: 'music', labelKey: 'tg_music' },
];

const defaultConfig = {
  // The drapes, the room and its candlelight are bundled with the template and
  // deliberately not editable — they are what the design is.
  // Blocks switched off by the honoree (key → true). Empty = everything shown.
  hidden: {} as Record<string, boolean>,
  honoree: {
    name: { ru: 'Камила', uz: 'Kamila', en: 'Kamila' },
    ageLabel: { ru: 'в сорок', uz: 'qirq yoshda', en: 'at forty' },
  },
  invite: {
    text: {
      ru: 'Двадцать третьего октября я закрываю десятилетие\nи не хочу делать это тихо. Приходите за светом,\nдлинным столом и обществом, которое собирается\nв одной комнате лишь однажды.',
      uz: 'Yigirma uchinchi oktabrda men on yillikni yopaman\nva buni jimgina qilishni istamayman. Yoruglik, uzun stol\nva faqat bir marta bir xonada yigiladigan davra uchun keling.',
      en: 'On the twenty-third of October I am closing a decade,\nand I would rather not do it quietly. Come for the light,\nthe long table and the company you only find\nin one room once.',
    },
  },
  letter: {
    text: {
      ru: 'Сорок пришли, не спросив, и я вовсе их не боюсь.\n\nМне хотелось не праздника, а комнаты: один стол, тёплый свет и люди, которые остались рядом в каждой из моих версий.\n\nНаденьте то, в чём чувствуете себя дорого. Приходите голодными. Уходите поздно.',
      uz: 'Qirq yosh soramasdan keldi va men undan umuman qorqmayman.\n\nMenga bayram emas, xona kerak edi: bitta stol, iliq yoruglik va mening har bir versiyamda yonimda qolgan odamlar.\n\nOzingizni qimmat his qiladigan kiyim kiying. Och keling. Kech keting.',
      en: 'Forty arrived without asking, and I find I am not frightened of it at all.\n\nWhat I wanted was not a party but a room: one table, warm light, and the people who stayed through every version of me.\n\nWear something you feel expensive in. Arrive hungry. Leave late.',
    },
  },
  final: {
    message: {
      ru: 'Комната небольшая — намеренно.\nТо, что вы в ней, значит очень много.',
      uz: 'Xona ataylab kichik.\nSizning unda bolishingiz juda kop narsani anglatadi.',
      en: 'The room is small on purpose.\nThat you are in it means a great deal.',
    },
  },
  event: {
    dateISO: '2026-10-23T20:00:00',
    dateNote: {
      ru: 'Вечер затянется. Освободите субботу.',
      uz: 'Kecha uzayadi. Shanbani bosh qoldiring.',
      en: 'The evening runs late. Clear the Saturday.',
    },
    timeNote: { ru: '', uz: '', en: '' },
  },
  venue: {
    name: { ru: 'Обсидиановый зал', uz: 'Obsidian zali', en: 'The Obsidian Room' },
    address: {
      ru: 'Отель Марсо · улица Навои, 12, второй этаж',
      uz: 'Marso mehmonxonasi · Navoiy kochasi, 12, ikkinchi qavat',
      en: 'Hotel Marceau · 12 Navoi Street, second floor',
    },
    mapUrl: '',
  },
  schedule: [
    { time: '19:30', label: { ru: 'Прибытие', uz: 'Kelish', en: 'Arrival' } },
    { time: '20:00', label: { ru: 'Приветственные напитки', uz: 'Salomlashuv ichimliklari', en: 'Welcome drinks' } },
    { time: '21:00', label: { ru: 'Ужин', uz: 'Kechki ovqat', en: 'Dinner' } },
    { time: '22:15', label: { ru: 'Тост', uz: 'Qadah sozi', en: 'The toast' } },
    { time: '22:40', label: { ru: 'Торт', uz: 'Tort', en: 'Cake' } },
    { time: '23:00', label: { ru: 'Живая музыка', uz: 'Jonli musiqa', en: 'Live music' } },
    { time: '00:30', label: { ru: 'После полуночи', uz: 'Yarim tundan keyin', en: 'After hours' } },
  ],
  // Photos the honoree uploads; an empty list hides the spread.
  gallery: [] as { image: string; caption: Record<string, string> }[],
  dress: {
    title: { ru: 'Чёрный галстук', uz: 'Qora galstuk', en: 'Black tie' },
    colors: ['#08080A', '#1D1E23', '#8A6B33', '#C6A25E', '#E9DCC3'],
    note: {
      ru: 'Длинное, тёмное или безупречно скроенное.',
      uz: 'Uzun, toq yoki benuqson tikilgan.',
      en: 'Long, dark, or beautifully tailored.',
    },
  },
  gifts: {
    title: {
      ru: 'Без подарков — ваше присутствие и есть подарок',
      uz: 'Sovgasiz — kelishingizning ozi sovga',
      en: 'No gifts — your presence is the gift',
    },
    cardNumber: '',
    cardHolder: '',
  },
  contacts: { phone: '', telegram: '', instagram: '' },
  music: { url: '' },
};

export const birthdayPrestigeTemplate: TemplateDefinition = {
  id: 'birthday-prestige',
  category: 'birthday',
  nameKey: 'tpl_birthday_prestige',
  cover: '🎭',
  accent: '#C6A25E',
  html,
  defaultConfig,
  fields,
  groups,
  Renderer: RichRenderer,
  sectionIds: ['room', 'welcome', 'details', 'evening', 'gallery', 'letter', 'clock', 'rsvp', 'close'],
  accentVars: ['--brass', '--brass-lt'],
};
