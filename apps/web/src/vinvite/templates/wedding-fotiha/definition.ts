import html from './template.html?raw';
import { RichRenderer } from '../RichRenderer';
import type { TemplateDefinition, TemplateField, TemplateFieldGroup } from '../types';

// ── "Oq Fotiha" — the Fotiha to'y ───────────────────────────────────────────
// A fotiha to'y is the Uzbek betrothal: the two families meet, the elders read
// the Fatiha over the match, and a round loaf is broken to seal it. It is NOT
// the wedding, and it is not an evening party — it is an afternoon at somebody's
// house. Three things follow from that and make this design different from the
// other twelve:
//
//   · no countdown. A fotiha is arranged within weeks, and the page is about
//     the blessing rather than the wait;
//   · the page names both FAMILIES, not only the couple, because that is what
//     the ceremony actually joins. No other template asks for them;
//   · the dasturxon is the programme. A fotiha has no running order of first
//     dance and cake, it has a laid table.
//
// Defaults are written in Uzbek FIRST — this design will almost always be read
// in uz — with ru and en filled so the language bar works out of the box, and
// the uz strings avoid apostrophes like every uz string in this product.

const groups: TemplateFieldGroup[] = [
  { key: 'couple', labelKey: 'tg_couple', icon: '💍', section: 'top' },
  { key: 'invite', labelKey: 'tg_invite', icon: '✉️', section: 'top' },
  { key: 'blessing', labelKey: 'tg_blessing', icon: '🤲', section: 'blessing' },
  { key: 'datetime', labelKey: 'tg_datetime', icon: '🗓', section: 'details' },
  { key: 'families', labelKey: 'tg_families', icon: '👪', section: 'families' },
  { key: 'dasturxon', labelKey: 'tg_dasturxon', icon: '🍞', section: 'dasturxon' },
  { key: 'venue', labelKey: 'tg_venue', icon: '📍', section: 'venue' },
  { key: 'details', labelKey: 'tg_details', icon: '📋', section: 'details' },
  { key: 'gallery', labelKey: 'tg_gallery', icon: '📷', section: 'gallery' },
  { key: 'music', labelKey: 'tg_music', icon: '🎵' },
  { key: 'visibility', labelKey: 'tg_visibility', icon: '👁' },
];

const fields: TemplateField[] = [
  // The groom is asked for first because the page prints him first — a form
  // that asks in the other order is how the two get typed into the wrong boxes.
  { key: 'groom', path: 'couple.groom', type: 'localized-text', group: 'couple', labelKey: 'fld_groom' },
  { key: 'bride', path: 'couple.bride', type: 'localized-text', group: 'couple', labelKey: 'fld_bride' },

  { key: 'gateTitle', path: 'invite.gateTitle', type: 'localized-text', group: 'invite', labelKey: 'fld_title' },
  { key: 'occasion', path: 'invite.occasion', type: 'localized-text', group: 'invite', labelKey: 'fld_kicker' },
  { key: 'lede', path: 'invite.lede', type: 'localized-textarea', group: 'invite', labelKey: 'fld_invite_text' },
  { key: 'closing', path: 'invite.closing', type: 'localized-textarea', group: 'invite', labelKey: 'fld_final' },

  // The ceremony the day is named after.
  { key: 'blessingText', path: 'blessing.text', type: 'localized-textarea', group: 'blessing', labelKey: 'fld_quote' },
  { key: 'blessingBy', path: 'blessing.by', type: 'localized-text', group: 'blessing', labelKey: 'fld_author' },

  // Convention: the FIRST datetime field is the event date, which the dashboard
  // reads for the date line and the "days left" counter.
  { key: 'dateISO', path: 'event.dateISO', type: 'datetime', group: 'datetime', labelKey: 'fld_datetime' },
  { key: 'timeText', path: 'event.timeText', type: 'localized-text', group: 'datetime', labelKey: 'fld_time_text' },
  { key: 'timeNote', path: 'event.timeNote', type: 'localized-text', group: 'datetime', labelKey: 'fld_time_note' },

  { key: 'familiesTitle', path: 'families.title', type: 'localized-text', group: 'families', labelKey: 'fld_title' },
  { key: 'familiesLede', path: 'families.lede', type: 'localized-text', group: 'families', labelKey: 'fld_sub' },
  { key: 'groomFamily', path: 'families.groomName', type: 'localized-text', group: 'families', labelKey: 'fld_name' },
  { key: 'groomParents', path: 'families.groomParents', type: 'localized-text', group: 'families', labelKey: 'fld_desc' },
  { key: 'brideFamily', path: 'families.brideName', type: 'localized-text', group: 'families', labelKey: 'fld_name' },
  { key: 'brideParents', path: 'families.brideParents', type: 'localized-text', group: 'families', labelKey: 'fld_desc' },

  { key: 'dasturxonTitle', path: 'dasturxon.title', type: 'localized-text', group: 'dasturxon', labelKey: 'fld_title' },
  { key: 'dasturxonLede', path: 'dasturxon.lede', type: 'localized-text', group: 'dasturxon', labelKey: 'fld_sub' },
  // A schedule field, but it is a TABLE rather than a running order: the "time"
  // column holds a clock time or free text, which is what the type already
  // allows, so a cloth reads "12:00 · the loaf is broken" or "Choy · tea".
  { key: 'dasturxonItems', path: 'dasturxon.items', type: 'schedule', group: 'dasturxon', labelKey: 'tg_dasturxon' },

  { key: 'venueName', path: 'venue.name', type: 'localized-text', group: 'venue', labelKey: 'fld_venue_name' },
  { key: 'address', path: 'venue.address', type: 'localized-text', group: 'venue', labelKey: 'fld_address' },
  { key: 'mapUrl', path: 'venue.mapUrl', type: 'text', group: 'venue', labelKey: 'fld_map_url', placeholder: 'https://yandex.uz/maps/…' },

  { key: 'detailsTitle', path: 'details.title', type: 'localized-text', group: 'details', labelKey: 'fld_title' },
  { key: 'dress', path: 'dress.title', type: 'localized-text', group: 'details', labelKey: 'fld_dress_title' },
  { key: 'dressNote', path: 'dress.note', type: 'localized-text', group: 'details', labelKey: 'fld_dress_note' },
  { key: 'rsvpTitle', path: 'rsvp.title', type: 'localized-text', group: 'details', labelKey: 'fld_title' },
  { key: 'rsvpLede', path: 'rsvp.lede', type: 'localized-text', group: 'details', labelKey: 'fld_rsvp_lede' },

  { key: 'galleryTitle', path: 'gallery_title', type: 'localized-text', group: 'gallery', labelKey: 'fld_title' },
  { key: 'gallery', path: 'gallery', type: 'gallery', group: 'gallery', labelKey: 'tg_gallery' },

  { key: 'music', path: 'music.url', type: 'audio', group: 'music', labelKey: 'tg_music' },

  // The value at each path is the HIDDEN flag, so an unset config shows
  // everything — a fresh invitation is complete rather than empty.
  { key: 'hideBlessing', path: 'hidden.blessing', type: 'toggle', group: 'visibility', labelKey: 'tg_blessing' },
  { key: 'hideDetails', path: 'hidden.details', type: 'toggle', group: 'visibility', labelKey: 'tg_details' },
  { key: 'hideFamilies', path: 'hidden.families', type: 'toggle', group: 'visibility', labelKey: 'tg_families' },
  { key: 'hideDasturxon', path: 'hidden.dasturxon', type: 'toggle', group: 'visibility', labelKey: 'tg_dasturxon' },
  { key: 'hideGallery', path: 'hidden.gallery', type: 'toggle', group: 'visibility', labelKey: 'tg_gallery' },
  { key: 'hideVenue', path: 'hidden.venue', type: 'toggle', group: 'visibility', labelKey: 'tg_venue' },
  { key: 'hideRsvp', path: 'hidden.rsvp', type: 'toggle', group: 'visibility', labelKey: 'tg_rsvp' },
];

export const weddingFotihaTemplate: TemplateDefinition = {
  id: 'wedding-fotiha',
  category: 'wedding',
  nameKey: 'tpl_wedding_fotiha',
  cover: '🫓',
  accent: '#a8332f',
  html,
  fields,
  groups,
  Renderer: RichRenderer,
  sectionIds: ['top', 'blessing', 'details', 'families', 'dasturxon', 'gallery', 'venue', 'rsvp'],
  // The suzani thread colours the Design+ accent picker replaces. The madder
  // and the saffron are two different jobs — the red carries the headings and
  // the gold the rules and frames — so both are listed; overriding only one
  // would leave a page half-recoloured.
  accentVars: ['--madder', '--saffron', '--saffron-lt'],
  defaultConfig: {
    couple: {
      groom: { uz: 'Oybek', ru: 'Ойбек', en: 'Oybek' },
      bride: { uz: 'Nilufar', ru: 'Нилуфар', en: 'Nilufar' },
    },
    invite: {
      gateTitle: { uz: 'Fotiha toyimizga', ru: 'На нашу фотиху', en: 'To our fotiha' },
      occasion: { uz: 'Fotiha toy', ru: 'Фотиха туй', en: 'The betrothal' },
      lede: {
        uz: 'Ikki xonadon rozi boldi. Sizni ham shu quvonchli kunda dasturxonimiz atrofida korishni istaymiz.',
        ru: 'Две семьи дали согласие. Будем рады видеть вас за нашим дастурханом в этот радостный день.',
        en: 'The two families have agreed. We would be glad to see you at our table on this happy day.',
      },
      closing: {
        uz: 'Kelganingiz uchun oldindan rahmat. Oq yol tilaganlarga ham rahmat.',
        ru: 'Заранее спасибо, что придёте. И спасибо всем, кто пожелает доброго пути.',
        en: 'Thank you in advance for coming, and thank you to everyone who wishes them well.',
      },
    },
    blessing: {
      text: {
        uz: 'Iki yosh baxtli bolsin, xonadonlari tinch, dasturxonlari toq bolsin. Omin.',
        ru: 'Пусть двое будут счастливы, пусть в доме будет покой, а на дастурхане — достаток. Аминь.',
        en: 'May the two be happy, may their home be peaceful and their table full. Amin.',
      },
      by: { uz: 'Oqsoqollar fotihasi', ru: 'Фотиха старейшин', en: 'The elders’ blessing' },
    },
    // Kept in the FUTURE on purpose: the catalog and the pricing preview both
    // render this config, and a date that has passed advertises a design that
    // looks broken. When this goes stale, move it forward a year.
    event: {
      dateISO: '2027-04-11T12:00:00',
      timeText: { uz: '12:00', ru: '12:00', en: '12:00' },
      timeNote: {
        uz: 'Mehmonlar soat on birdan yigiladi.',
        ru: 'Гости собираются с одиннадцати.',
        en: 'Guests gather from eleven.',
      },
    },
    families: {
      title: { uz: 'Ikki xonadon', ru: 'Две семьи', en: 'Two families' },
      lede: {
        uz: 'Fotiha toy ikki yoshni emas, ikki xonadonni qoshadi.',
        ru: 'Фотиха соединяет не только двоих, но и две семьи.',
        en: 'A fotiha joins two households, not only two people.',
      },
      groomName: { uz: 'Rahimovlar xonadoni', ru: 'Семья Рахимовых', en: 'The Rahimov family' },
      groomParents: {
        uz: 'Otasi Anvar aka, onasi Dilorom opa',
        ru: 'Отец — Анвар ака, мать — Дилором опа',
        en: 'His father Anvar, his mother Dilorom',
      },
      brideName: { uz: 'Yusupovlar xonadoni', ru: 'Семья Юсуповых', en: 'The Yusupov family' },
      brideParents: {
        uz: 'Otasi Bahodir aka, onasi Zulfiya opa',
        ru: 'Отец — Баходир ака, мать — Зулфия опа',
        en: 'Her father Bahodir, her mother Zulfiya',
      },
    },
    dasturxon: {
      title: { uz: 'Dasturxon', ru: 'Дастурхан', en: 'The table' },
      lede: {
        uz: 'Kun tartibi emas — dasturxonda nima boladi.',
        ru: 'Не расписание, а то, что будет на дастурхане.',
        en: 'Not a running order — what will be on the table.',
      },
      items: [
        { time: '11:00', mode: 'time', label: { uz: 'Mehmonlar yigiladi, choy quyiladi', ru: 'Гости собираются, разливают чай', en: 'Guests gather, the tea is poured' } },
        { time: '12:00', mode: 'time', label: { uz: 'Oqsoqollar fotiha oqiydi', ru: 'Старейшины читают фотиху', en: 'The elders read the Fatiha' } },
        { time: '12:20', mode: 'time', label: { uz: 'Non sindiriladi', ru: 'Преломляют лепёшку', en: 'The loaf is broken' } },
        { time: '13:00', mode: 'time', label: { uz: 'Osh', ru: 'Плов', en: 'Palov' } },
        { time: '14:30', mode: 'time', label: { uz: 'Sarpo va sovgalar', ru: 'Сарпо и подарки', en: 'Sarpo and the gifts' } },
      ],
    },
    venue: {
      name: { uz: 'Rahimovlar hovlisi', ru: 'Дом Рахимовых', en: 'The Rahimov house' },
      address: {
        uz: 'Samarqand, Registon kochasi 14',
        ru: 'Самарканд, улица Регистан, 14',
        en: '14 Registon Street, Samarkand',
      },
      mapUrl: '',
    },
    details: {
      title: { uz: 'Malumot', ru: 'Информация', en: 'Information' },
    },
    dress: {
      title: { uz: 'Milliy kiyim', ru: 'Национальная одежда', en: 'National dress' },
      note: {
        uz: 'Atlas va adras xush korinadi, ammo majburiy emas.',
        ru: 'Атлас и адрас будут к месту, но это не обязательно.',
        en: 'Atlas and adras are welcome, but nothing is required.',
      },
    },
    rsvp: {
      title: { uz: 'Keladigmisiz?', ru: 'Придёте?', en: 'Will you come?' },
      lede: {
        uz: 'Dasturxonni hisoblab yozishimiz uchun bir enlik xabar bering.',
        ru: 'Напишите пару слов, чтобы мы накрыли стол на всех.',
        en: 'A line from you tells us how to lay the table.',
      },
    },
    gallery_title: { uz: 'Xotiralar', ru: 'Воспоминания', en: 'Memories' },
    gallery: [],
    music: { url: '' },
    hidden: {} as Record<string, boolean>,
  },
};
