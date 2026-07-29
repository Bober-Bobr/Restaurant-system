import html from './template.html?raw';
import { RichRenderer } from '../RichRenderer';
import type { TemplateDefinition, TemplateField, TemplateFieldGroup } from '../types';

// ── "Midnight Gold" birthday template ────────────────────────────────────────
// A wrapped gift sits alone in the dark; opening it floods the page with golden
// light and every section after is another surprise from inside.
// Gift-box opening → welcome + name → details (venue / dress / gifts / contacts)
// → programme timeline → memory gallery → wishes deck → countdown → RSVP →
// farewell. Palette arc: midnight → warm ivory → midnight.

const groups: TemplateFieldGroup[] = [
  { key: 'visibility', labelKey: 'tg_visibility', icon: '👁' },
  { key: 'honoree', labelKey: 'tg_honoree', icon: '🎂', section: 'hero' },
  { key: 'invite', labelKey: 'tg_invite', icon: '✉️', section: 'welcome' },
  { key: 'datetime', labelKey: 'tg_datetime', icon: '🗓', section: 'countdown' },
  { key: 'venue', labelKey: 'tg_venue', icon: '📍', section: 'details' },
  { key: 'schedule', labelKey: 'tg_schedule', icon: '🕐', section: 'programme' },
  { key: 'gallery', labelKey: 'tg_gallery', icon: '📷', section: 'memories' },
  { key: 'wishes', labelKey: 'tg_wishes', icon: '💌', section: 'wishes' },
  { key: 'dress', labelKey: 'tg_dress', icon: '👗', section: 'details' },
  { key: 'gifts', labelKey: 'tg_gifts', icon: '🎁', section: 'details' },
  { key: 'contacts', labelKey: 'tg_contacts', icon: '☎️', section: 'final' },
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
  { key: 'v_wishes', path: 'hidden.wishes', type: 'toggle', group: 'visibility', labelKey: 'sec_wishes' },
  { key: 'v_countdown', path: 'hidden.countdown', type: 'toggle', group: 'visibility', labelKey: 'sec_countdown' },
  { key: 'v_rsvp', path: 'hidden.rsvp', type: 'toggle', group: 'visibility', labelKey: 'sec_rsvp' },
  { key: 'v_music', path: 'hidden.music', type: 'toggle', group: 'visibility', labelKey: 'sec_music' },
  { key: 'v_final', path: 'hidden.final', type: 'toggle', group: 'visibility', labelKey: 'sec_final' },

  { key: 'name', path: 'honoree.name', type: 'localized-text', group: 'honoree', labelKey: 'fld_name' },
  // The hero medallion lifts the bare number out of this label ("30 лет" → 30).
  { key: 'ageLabel', path: 'honoree.ageLabel', type: 'localized-text', group: 'honoree', labelKey: 'fld_age' },

  { key: 'kicker', path: 'invite.kicker', type: 'localized-text', group: 'invite', labelKey: 'fld_kicker' },
  { key: 'text', path: 'invite.text', type: 'localized-textarea', group: 'invite', labelKey: 'fld_text' },
  { key: 'final', path: 'final.message', type: 'localized-textarea', group: 'invite', labelKey: 'fld_final' },

  // Convention: the first datetime field is the event date, which the dashboard
  // reads for the date line and the "days left" counter.
  { key: 'dateISO', path: 'event.dateISO', type: 'datetime', group: 'datetime', labelKey: 'fld_datetime' },
  { key: 'timeNote', path: 'event.timeNote', type: 'localized-text', group: 'datetime', labelKey: 'fld_time_note' },

  { key: 'venueName', path: 'venue.name', type: 'localized-text', group: 'venue', labelKey: 'fld_venue_name' },
  { key: 'address', path: 'venue.address', type: 'localized-text', group: 'venue', labelKey: 'fld_address' },
  { key: 'venueDesc', path: 'venue.desc', type: 'localized-text', group: 'venue', labelKey: 'fld_desc' },
  { key: 'mapUrl', path: 'venue.mapUrl', type: 'text', group: 'venue', labelKey: 'fld_map_url', placeholder: 'https://yandex.uz/maps/…' },

  { key: 'schedule', path: 'schedule', type: 'schedule', group: 'schedule', labelKey: 'tg_schedule' },
  { key: 'gallery', path: 'gallery', type: 'gallery', group: 'gallery', labelKey: 'tg_gallery' },
  // The deck of handwritten notes; an empty list hides the section.
  { key: 'wishes', path: 'wishes', type: 'quotes', group: 'wishes', labelKey: 'tg_wishes' },

  { key: 'dressTitle', path: 'dress.title', type: 'localized-text', group: 'dress', labelKey: 'fld_dress_title' },
  { key: 'dressColors', path: 'dress.colors', type: 'palette', group: 'dress', labelKey: 'fld_dress_colors' },
  { key: 'dressNote', path: 'dress.note', type: 'localized-textarea', group: 'dress', labelKey: 'fld_dress_note' },

  { key: 'giftsTitle', path: 'gifts.title', type: 'localized-text', group: 'gifts', labelKey: 'fld_gifts_title' },
  { key: 'cardNumber', path: 'gifts.cardNumber', type: 'text', group: 'gifts', labelKey: 'fld_card_number', placeholder: '8600 0000 0000 0000' },
  { key: 'cardHolder', path: 'gifts.cardHolder', type: 'text', group: 'gifts', labelKey: 'fld_card_holder', placeholder: 'AMIRA KARIMOVA' },

  { key: 'phone', path: 'contacts.phone', type: 'text', group: 'contacts', labelKey: 'fld_phone', placeholder: '+998 90 123 45 67' },
  { key: 'telegram', path: 'contacts.telegram', type: 'text', group: 'contacts', labelKey: 'fld_telegram', placeholder: '@username' },
  { key: 'instagram', path: 'contacts.instagram', type: 'text', group: 'contacts', labelKey: 'fld_instagram', placeholder: '@username' },

  { key: 'music', path: 'music.url', type: 'audio', group: 'music', labelKey: 'tg_music' },
];

const defaultConfig = {
  // The gift box, its ribbon and the burst of balloons are bundled with the
  // template and deliberately not editable — they are what the design is.
  // Blocks switched off by the honoree (key → true). Empty = everything shown.
  hidden: {} as Record<string, boolean>,
  honoree: {
    name: { ru: 'Амира', uz: 'Amira', en: 'Amira' },
    ageLabel: { ru: '30 лет', uz: '30 yosh', en: 'Thirty years' },
  },
  invite: {
    kicker: {
      ru: 'Полночное золото\nи один особенный вечер',
      uz: 'Yarim tunda oltin\nva bitta alohida kecha',
      en: 'A Midnight Gold\nCelebration',
    },
    text: {
      ru: 'Тридцать вёсен, тысяча историй и один вечер,\nчтобы отпраздновать каждую из них.\nПриходите такими, какие вы есть.',
      uz: 'Ottiz bahor, mingta hikoya va ularning\nbarchasini nishonlash uchun bitta kecha.\nOzingiz qanday bolsangiz, shunday keling.',
      en: 'Thirty summers, a thousand stories, and one evening\nto celebrate every single one of them.\nCome as you are.',
    },
  },
  final: {
    message: {
      ru: 'Приносите свои лучшие истории. Мы позаботимся о свете, торте и музыке.',
      uz: 'Eng yaxshi hikoyalaringizni olib keling. Yoruglik, tort va musiqa bizdan.',
      en: 'Bring your best stories. We will supply the light, the cake and the music.',
    },
  },
  event: {
    dateISO: '2026-09-12T19:00:00',
    timeNote: { ru: '', uz: '', en: '' },
  },
  venue: {
    name: { ru: 'Гранд Аурелия', uz: 'Grand Aureliya', en: 'The Grand Aurelia' },
    address: {
      ru: 'проспект Амира Темура, 24, Ташкент',
      uz: 'Amir Temur shoh kochasi, 24, Toshkent',
      en: '24 Amir Temur Avenue, Tashkent',
    },
    desc: {
      ru: 'Терраса на крыше и Садовый зал',
      uz: 'Tomdagi ayvon va Bog zali',
      en: 'Rooftop Terrace & Garden Room',
    },
    mapUrl: '',
  },
  schedule: [
    { time: '19:00', label: { ru: 'Встреча и шампанское', uz: 'Kutib olish va shampan', en: 'Welcome & champagne' } },
    { time: '20:30', label: { ru: 'Ужин подан', uz: 'Kechki ovqat', en: 'Dinner is served' } },
    { time: '22:00', label: { ru: 'Церемония торта', uz: 'Tort marosimi', en: 'The cake ceremony' } },
    { time: '22:30', label: { ru: 'Живая музыка', uz: 'Jonli musiqa', en: 'Live music' } },
    { time: '23:15', label: { ru: 'Танцы', uz: 'Raqslar', en: 'Dancing' } },
  ],
  // Photos the honoree uploads; an empty list hides the gallery section.
  gallery: [] as { image: string; caption: Record<string, string> }[],
  wishes: [
    {
      author: 'Лейла',
      text: {
        ru: 'Тридцать выглядят в точности как ты — неспешно, тепло и невозможно не заметить.',
        uz: 'Ottiz yosh aynan senga oxshaydi — shoshmasdan, iliq va etiborsiz qoldirib bolmaydi.',
        en: 'Thirty looks exactly like you — unhurried, warm, and impossible to ignore.',
      },
    },
    {
      author: 'Мама и папа',
      text: {
        ru: 'Ты собираешь людей так, как другие собирают сувениры. Оглянись вокруг в субботу.',
        uz: 'Sen odamlarni boshqalar esdaliklarni yiggani kabi yigasan. Shanba kuni atrofga qara.',
        en: 'You collect people the way others collect souvenirs. Look around the room on Saturday.',
      },
    },
  ] as { author: string; text: Record<string, string> }[],
  dress: {
    title: { ru: 'Полночь и золото', uz: 'Yarim tun va oltin', en: 'Midnight & gold' },
    // Empty list → the swatches simply do not render.
    colors: ['#070A1E', '#23379B', '#4B2A8C', '#D8B268', '#F3E5CB'],
    note: {
      ru: 'Тёмно-синий, шампань или всё, что ловит свет.',
      uz: 'Toq kok, shampan yoki yoruglikni tutadigan har qanday rang.',
      en: 'Navy, champagne or anything that catches light.',
    },
  },
  gifts: {
    title: {
      ru: 'Ваше присутствие — лучший подарок',
      uz: 'Sizning kelishingiz — eng yaxshi sovga',
      en: 'Your presence is the greatest gift',
    },
    cardNumber: '',
    cardHolder: '',
  },
  contacts: { phone: '', telegram: '', instagram: '' },
  music: { url: '' },
};

export const birthdayMidnightTemplate: TemplateDefinition = {
  id: 'birthday-midnight',
  category: 'birthday',
  nameKey: 'tpl_birthday_midnight',
  cover: '🎁',
  accent: '#D8B268',
  html,
  defaultConfig,
  fields,
  groups,
  Renderer: RichRenderer,
  sectionIds: ['hero', 'welcome', 'details', 'programme', 'memories', 'wishes', 'countdown', 'rsvp', 'final'],
  accentVars: ['--gold', '--gold-lt'],
};
