import html from './template.html?raw';
import { RichRenderer } from '../RichRenderer';
import type { TemplateDefinition, TemplateField, TemplateFieldGroup } from '../types';

// ── "The Golden Key" — a secret wedding invitation ──────────────────────────
// The page opens on a sealed gatefold card in the dark. A golden key lies
// across it; tapped, it lifts, turns upright, slides into a medallion lock and
// makes a quarter turn — the lock clicks, sparks, lifts away, and the two
// cover panels swing open on the invitation inside. Below it: an announcement
// in blush, the couple in a gilded frame, the details on ivory paper with a
// countdown, the dress code in dusty rose, a reply card with a lace edge, and
// a candlelit closing scene. Ivory, champagne, antique gold, rose and brown.
//
// Every photograph is bundled (public/golden-key/) and every one of them can
// be replaced by the couple's own — `data-photo` names the config path, and an
// empty path keeps the bundled plate.

const groups: TemplateFieldGroup[] = [
  { key: 'couple', labelKey: 'tg_couple', icon: '💍', section: 'announce' },
  { key: 'couple2', labelKey: 'tg_couple2', icon: '💞', section: 'announce' },
  { key: 'invite', labelKey: 'tg_invite', icon: '✉️', section: 'announce' },
  { key: 'story', labelKey: 'tg_story', icon: '🕯', section: 'story' },
  { key: 'datetime', labelKey: 'tg_datetime', icon: '🗓', section: 'place' },
  { key: 'venue', labelKey: 'tg_venue', icon: '📍', section: 'place' },
  { key: 'dress', labelKey: 'tg_dress', icon: '👗', section: 'dress' },
  { key: 'rsvp', labelKey: 'tg_rsvp', icon: '💌', section: 'rsvp' },
  { key: 'final', labelKey: 'sec_final', icon: '🗝', section: 'finale' },
  { key: 'music', labelKey: 'tg_music', icon: '🎵' },
  { key: 'visibility', labelKey: 'tg_visibility', icon: '👁' },
];

const fields: TemplateField[] = [
  { key: 'groom', path: 'couple.groom', type: 'localized-text', group: 'couple', labelKey: 'fld_groom' },
  { key: 'bride', path: 'couple.bride', type: 'localized-text', group: 'couple', labelKey: 'fld_bride' },

  // A DOUBLE WEDDING — two couples married in one evening. Both optional, and
  // asked for groom first, in the order the page prints them.
  { key: 'groom2', path: 'couple.groom2', type: 'localized-text', group: 'couple2', labelKey: 'fld_groom' },
  { key: 'bride2', path: 'couple.bride2', type: 'localized-text', group: 'couple2', labelKey: 'fld_bride' },

  // The card inside the cover: the line above the names and the one below.
  { key: 'kicker', path: 'invite.kicker', type: 'localized-text', group: 'invite', labelKey: 'fld_kicker' },
  { key: 'line', path: 'invite.line', type: 'localized-text', group: 'invite', labelKey: 'fld_sub' },
  { key: 'inviteText', path: 'invite.text', type: 'localized-textarea', group: 'invite', labelKey: 'fld_invite_text' },
  { key: 'inviteImage', path: 'invite.image', type: 'image', group: 'invite', labelKey: 'fld_photo' },

  { key: 'storyCaption', path: 'story.caption', type: 'localized-text', group: 'story', labelKey: 'fld_caption' },
  { key: 'storyImage', path: 'story.image', type: 'image', group: 'story', labelKey: 'fld_photo' },

  // Convention: the first datetime field is the event date, which the dashboard
  // reads for the date line and the "days left" counter.
  { key: 'dateISO', path: 'event.dateISO', type: 'datetime', group: 'datetime', labelKey: 'fld_datetime' },

  { key: 'venueName', path: 'venue.name', type: 'localized-text', group: 'venue', labelKey: 'fld_venue_name' },
  { key: 'address', path: 'venue.address', type: 'localized-text', group: 'venue', labelKey: 'fld_address' },
  { key: 'mapUrl', path: 'venue.mapUrl', type: 'text', group: 'venue', labelKey: 'fld_map_url', placeholder: 'https://yandex.uz/maps/…' },
  { key: 'venueImage', path: 'venue.image', type: 'image', group: 'venue', labelKey: 'fld_photo' },

  { key: 'dressTitle', path: 'dress.title', type: 'localized-text', group: 'dress', labelKey: 'fld_dress_title' },
  { key: 'dressText', path: 'dress.text', type: 'localized-textarea', group: 'dress', labelKey: 'fld_dress_note' },
  { key: 'dressHer', path: 'dress.her', type: 'localized-text', group: 'dress', labelKey: 'fld_dress_her' },
  { key: 'dressHim', path: 'dress.him', type: 'localized-text', group: 'dress', labelKey: 'fld_dress_him' },
  { key: 'dressColors', path: 'dress.colors', type: 'palette', group: 'dress', labelKey: 'fld_dress_colors' },
  { key: 'dressAvoid', path: 'dress.avoid', type: 'localized-text', group: 'dress', labelKey: 'fld_dress_avoid' },

  { key: 'replyBy', path: 'rsvp.by', type: 'localized-text', group: 'rsvp', labelKey: 'fld_reply_by' },
  { key: 'rsvpImage', path: 'rsvp.image', type: 'image', group: 'rsvp', labelKey: 'fld_photo' },

  { key: 'finaleText', path: 'finale.text', type: 'localized-textarea', group: 'final', labelKey: 'fld_final' },
  { key: 'finaleImage', path: 'finale.image', type: 'image', group: 'final', labelKey: 'fld_photo' },

  { key: 'music', path: 'music.url', type: 'audio', group: 'music', labelKey: 'tg_music' },

  // Block visibility: hidden.<key> === true switches the section off.
  { key: 'v_story', path: 'hidden.story', type: 'toggle', group: 'visibility', labelKey: 'sec_story' },
  { key: 'v_place', path: 'hidden.place', type: 'toggle', group: 'visibility', labelKey: 'sec_venue' },
  { key: 'v_countdown', path: 'hidden.countdown', type: 'toggle', group: 'visibility', labelKey: 'sec_countdown' },
  { key: 'v_dress', path: 'hidden.dress', type: 'toggle', group: 'visibility', labelKey: 'sec_dress' },
  { key: 'v_rsvp', path: 'hidden.rsvp', type: 'toggle', group: 'visibility', labelKey: 'sec_rsvp' },
  { key: 'v_final', path: 'hidden.final', type: 'toggle', group: 'visibility', labelKey: 'sec_final' },
  { key: 'v_music', path: 'hidden.music', type: 'toggle', group: 'visibility', labelKey: 'sec_music' },
];

const defaultConfig = {
  couple: {
    groom: { ru: 'Александр', uz: 'Aleksandr', en: 'Alexander' },
    bride: { ru: 'София', uz: 'Sofiya', en: 'Sophia' },
    // Empty by default: a double wedding is the exception, and a sample second
    // pair would have to be deleted by everybody else.
    groom2: {},
    bride2: {},
  },
  invite: {
    kicker: { ru: 'Вместе со своими семьями', uz: 'Oilalari bilan birga', en: 'Together with their families' },
    line: {
      ru: 'просят оказать им честь и разделить с ними день свадьбы',
      uz: 'toy kunlarini ular bilan birga otkazishingizni soraydi',
      en: 'request the pleasure of your company at their wedding',
    },
    text: {
      ru: 'С огромной радостью мы приглашаем вас разделить день, когда мы пообещаем друг другу «навсегда», — вечер свечей, роз и праздника.',
      uz: 'Bir-birimizga abadiyat vadasini beradigan kunni biz bilan bolishishga katta quvonch bilan taklif qilamiz — shamlar, atirgullar va bayram kechasi.',
      en: 'With great joy, we invite you to share the day we promise each other forever — an evening of candlelight, roses and celebration.',
    },
    // Empty: the bundled roses stand until the couple uploads their own.
    image: '',
  },
  story: {
    caption: {
      ru: 'Двое, один ключ — и дверь, которую мы откроем вместе.',
      uz: 'Ikki inson, bitta kalit va biz birga ochadigan eshik.',
      en: 'Two people, one key, and a door we will open together.',
    },
    image: '',
  },
  event: {
    dateISO: '2027-06-12T16:00:00',
  },
  venue: {
    name: { ru: 'Старая оранжерея', uz: 'Eski oranjereya', en: 'The Old Orangery' },
    address: {
      ru: 'Ташкент, улица Садовая, 7',
      uz: 'Toshkent, Bogbon kochasi, 7',
      en: '7 Garden Street, Tashkent',
    },
    mapUrl: '',
    image: '',
  },
  dress: {
    title: { ru: 'Black tie, нежно и романтично', uz: 'Black tie, nozik va romantik', en: 'Black tie, softly romantic' },
    text: {
      ru: 'Пожалуйста, оденьтесь для вечера при свечах. Нам будет приятно увидеть цвета роз: шампань, пудровый, пыльную розу и мягкий шалфей.',
      uz: 'Iltimos, sham yorugidagi kechaga mos kiyining. Atirgul ranglarini korishdan xursand bolamiz: shampan, pushti, gard atirgul va yumshoq shalfey.',
      en: 'Please dress for a candlelit evening. We would love to see the colours of the roses: champagne, blush, dusty rose and soft sage.',
    },
    her: {
      ru: 'Платья в пол или элегантные миди. Атлас, шифон, кружево и жемчуг — идеально.',
      uz: 'Uzun yoki nafis midi koylaklar. Atlas, shifon, tor va marvarid juda mos.',
      en: 'Floor-length or elegant midi gowns. Satin, chiffon, lace and pearls are perfect.',
    },
    him: {
      ru: 'Смокинг или тёмный костюм с галстуком или бабочкой.',
      uz: 'Smoking yoki galstuk yoxud kapalak bogichli toq kostyum.',
      en: 'A tuxedo or a dark suit with a tie or bow tie.',
    },
    colors: ['#E8D3AE', '#EBC8BE', '#C9958C', '#A3AE8C', '#4A322A'],
    avoid: {
      ru: 'Белый и цвет слоновой кости, пожалуйста, оставьте невесте.',
      uz: 'Oq va fil suyagi rangini kelinga qoldiring.',
      en: 'Kindly leave white and ivory to the bride.',
    },
  },
  rsvp: {
    by: { ru: '15 мая 2027', uz: '2027-yil 15-may', en: '15 May 2027' },
    image: '',
  },
  finale: {
    text: {
      ru: 'С любовью — до встречи.',
      uz: 'Mehr bilan — korishguncha.',
      en: 'With all our love — we will see you there.',
    },
    image: '',
  },
  music: { url: '' },
  // Sections switched off in the builder (all visible by default).
  hidden: {} as Record<string, boolean>,
};

export const weddingGoldenKeyTemplate: TemplateDefinition = {
  id: 'wedding-golden-key',
  category: 'wedding',
  nameKey: 'tpl_wedding_golden_key',
  cover: '🗝️',
  accent: '#B8893A',
  html,
  defaultConfig,
  fields,
  groups,
  Renderer: RichRenderer,
  // These must match the real element ids in template.html — the Design+ runtime
  // anchors by getElementById and silently skips a section it cannot find.
  sectionIds: ['announce', 'story', 'place', 'countdown', 'dress', 'rsvp', 'finale'],
  // The gold family, so the Design+ accent picker recolours the medallion's
  // light, the rules and the engraved labels as one.
  accentVars: ['--gold', '--gold-lt', '--gold-dk'],
};
