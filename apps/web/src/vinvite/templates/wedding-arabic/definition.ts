import html from './template.html?raw';
import { RichRenderer } from '../RichRenderer';
import type { TemplateDefinition, TemplateField, TemplateFieldGroup } from '../types';

// ── "Golden Hour Envelope" Arabic luxury wedding template ────────────────────
// Envelope gate (wax seal → flap → letter slides out & unfolds) → golden-hour
// hero → invitation card → venue/date/time + map → our story → photo gallery → countdown →
// RSVP → V-invite attribution. Warm ivory · champagne gold · deep coffee.

const groups: TemplateFieldGroup[] = [
  { key: 'couple', labelKey: 'tg_couple', icon: '💍', section: 'hero' },
  { key: 'couple2', labelKey: 'tg_couple2', icon: '💞', section: 'hero' },
  { key: 'invite', labelKey: 'tg_invite', icon: '✉️', section: 'invitation' },
  { key: 'datetime', labelKey: 'tg_datetime', icon: '🗓', section: 'countdown' },
  { key: 'venue', labelKey: 'tg_venue', icon: '📍', section: 'details' },
  { key: 'story', labelKey: 'tg_story', icon: '💞', section: 'story' },
  { key: 'gallery', labelKey: 'tg_gallery', icon: '📷', section: 'gallery' },
  { key: 'music', labelKey: 'tg_music', icon: '🎵' },
  { key: 'visibility', labelKey: 'tg_visibility', icon: '👁' },
];

const fields: TemplateField[] = [
  { key: 'groom', path: 'couple.groom', type: 'localized-text', group: 'couple', labelKey: 'fld_groom' },
  { key: 'bride', path: 'couple.bride', type: 'localized-text', group: 'couple', labelKey: 'fld_bride' },

  // A DOUBLE WEDDING — two couples married in one evening. Both optional, and
  // asked for in the order the page prints them, groom first like the pair
  // above. Left empty the design renders exactly as it did before them.
  { key: 'groom2', path: 'couple.groom2', type: 'localized-text', group: 'couple2', labelKey: 'fld_groom' },
  { key: 'bride2', path: 'couple.bride2', type: 'localized-text', group: 'couple2', labelKey: 'fld_bride' },

  { key: 'inviteText', path: 'invite.text', type: 'localized-textarea', group: 'invite', labelKey: 'fld_invite_text' },

  // Convention: the first datetime field is the event date, which the dashboard
  // reads for the date line and the "days left" counter. The picker sets the
  // time too, and the template derives both the date and the time display.
  { key: 'dateISO', path: 'event.dateISO', type: 'datetime', group: 'datetime', labelKey: 'fld_datetime' },

  { key: 'venueName', path: 'venue.name', type: 'localized-text', group: 'venue', labelKey: 'fld_venue_name' },
  { key: 'address', path: 'venue.address', type: 'localized-text', group: 'venue', labelKey: 'fld_address' },
  { key: 'mapUrl', path: 'venue.mapUrl', type: 'text', group: 'venue', labelKey: 'fld_map_url', placeholder: 'https://yandex.uz/maps/…' },

  // The story is its own section, separate from the photographs. Emptying the
  // text removes the section, as does its visibility switch.
  { key: 'storyText', path: 'story.text', type: 'localized-textarea', group: 'story', labelKey: 'fld_text' },

  { key: 'gallery', path: 'gallery', type: 'gallery', group: 'gallery', labelKey: 'tg_gallery' },

  { key: 'music', path: 'music.url', type: 'audio', group: 'music', labelKey: 'tg_music' },

  // Block visibility: hidden.<key> === true switches the section off.
  { key: 'v_message', path: 'hidden.message', type: 'toggle', group: 'visibility', labelKey: 'sec_message' },
  { key: 'v_details', path: 'hidden.details', type: 'toggle', group: 'visibility', labelKey: 'sec_details' },
  { key: 'v_story', path: 'hidden.story', type: 'toggle', group: 'visibility', labelKey: 'sec_story' },
  { key: 'v_gallery', path: 'hidden.gallery', type: 'toggle', group: 'visibility', labelKey: 'sec_gallery' },
  { key: 'v_countdown', path: 'hidden.countdown', type: 'toggle', group: 'visibility', labelKey: 'sec_countdown' },
  { key: 'v_rsvp', path: 'hidden.rsvp', type: 'toggle', group: 'visibility', labelKey: 'sec_rsvp' },
  { key: 'v_music', path: 'hidden.music', type: 'toggle', group: 'visibility', labelKey: 'sec_music' },
];

const defaultConfig = {
  couple: {
    groom: { ru: 'Зайд', uz: 'Zayd', en: 'Zayd' },
    bride: { ru: 'Лейла', uz: 'Layla', en: 'Layla' },
    // The second pair is EMPTY by default: a double wedding is the exception,
    // and a sample name here would have to be deleted by everybody else.
    groom2: {},
    bride2: {},
  },
  invite: {
    text: {
      ru: 'Два сердца — одно обещание.\nПриглашаем вас разделить радость нашего союза\nпод золотым светом и открытыми арками.',
      uz: 'Ikki yurak — bitta vada.\nOltin nur va ochiq ravoqlar ostida\nittifoqimiz quvonchini biz bilan bolishing.',
      en: 'Two hearts, one promise.\nWe invite you to share in the joy of our union\nbeneath golden light and open arches.',
    },
  },
  event: {
    dateISO: '2027-11-13T18:30:00',
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
  // An invitation saved before this section existed has no story text, and
  // the section stays hidden for it.
  story: {
    text: {
      ru: 'Мы встретились случайно — на свадьбе друзей, под такими же золотыми арками.\nОдин разговор превратился в вечер, а вечер — в годы.\nТеперь мы хотим, чтобы в самый важный день вы были рядом.',
      uz: 'Biz tasodifan uchrashdik — dostlarimizning toyida, xuddi shunday oltin ravoqlar ostida.\nBir suhbat butun oqshomga, oqshom esa yillarga aylandi.\nEndi eng muhim kunimizda siz yonimizda bolishingizni istaymiz.',
      en: 'We met by chance — at a friends’ wedding, beneath golden arches much like these.\nOne conversation became an evening, and the evening became years.\nNow we would love you beside us on the day that matters most.',
    },
  },
  // Photos the couple uploads. While the list is empty the section shows six
  // gold-arch placeholder plates drawn in the template; the first photo
  // replaces all of them. Only hidden.gallery takes the section away.
  gallery: [] as { image: string; caption: Record<string, string> }[],
  music: { url: '' },
  // Sections switched off in the builder (all visible by default).
  hidden: {} as Record<string, boolean>,
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
  sectionIds: ['hero', 'invitation', 'details', 'story', 'gallery', 'countdown', 'rsvp'],
  accentVars: ['--gold', '--gold-deep', '--gold-soft', '--bronze'],
};
