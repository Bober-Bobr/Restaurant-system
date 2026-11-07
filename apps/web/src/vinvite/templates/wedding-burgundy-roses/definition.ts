import html from './template.html?raw';
import { RichRenderer } from '../RichRenderer';
import type { TemplateDefinition, TemplateField, TemplateFieldGroup } from '../types';

// ── "Royal Burgundy Roses" ───────────────────────────────────────────────────
// The page opens on a sealed envelope in burgundy and ivory, a wax seal on the
// point of its flap among a spray of roses. Tapped, the seal gives, the flap
// swings back, the card rises out of the pocket and opens out to fill the
// screen. Below it: a vertical film of a palace fountain as white doves take
// flight, the announcement under an arch of roses, the details on velvet
// beside a gilded painting, a gallery of three framed "paintings", the dress
// code in blush, a countdown, a reply card and a candlelit closing scene.
//
// Every photograph is bundled (public/burgundy-roses/) and every one of them
// can be replaced by the couple's own — `data-photo` names the config path,
// and an empty path keeps the bundled plate. The film is the design's own and
// stays.

const groups: TemplateFieldGroup[] = [
  { key: 'couple', labelKey: 'tg_couple', icon: '💍', section: 'announce' },
  { key: 'couple2', labelKey: 'tg_couple2', icon: '💞', section: 'announce' },
  { key: 'invite', labelKey: 'tg_invite', icon: '✉️', section: 'announce' },
  { key: 'film', labelKey: 'sec_film', icon: '🕊', section: 'film' },
  { key: 'datetime', labelKey: 'tg_datetime', icon: '🗓', section: 'countdown' },
  { key: 'venue', labelKey: 'tg_venue', icon: '📍', section: 'place' },
  { key: 'gallery', labelKey: 'tg_gallery', icon: '🖼', section: 'gallery' },
  { key: 'dress', labelKey: 'tg_dress', icon: '👗', section: 'dress' },
  { key: 'rsvp', labelKey: 'tg_rsvp', icon: '💌', section: 'rsvp' },
  { key: 'final', labelKey: 'sec_final', icon: '🌹', section: 'finale' },
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

  // The card that opens out of the envelope: the line above the names and the
  // one below; then the announcement's own message and its photograph.
  { key: 'kicker', path: 'invite.kicker', type: 'localized-text', group: 'invite', labelKey: 'fld_kicker' },
  { key: 'line', path: 'invite.line', type: 'localized-text', group: 'invite', labelKey: 'fld_sub' },
  { key: 'inviteText', path: 'invite.text', type: 'localized-textarea', group: 'invite', labelKey: 'fld_invite_text' },
  { key: 'inviteImage', path: 'invite.image', type: 'image', group: 'invite', labelKey: 'fld_photo' },

  { key: 'tagline', path: 'film.tagline', type: 'localized-text', group: 'film', labelKey: 'fld_sub' },

  // Convention: the first datetime field is the event date, which the dashboard
  // reads for the date line and the "days left" counter.
  { key: 'dateISO', path: 'event.dateISO', type: 'datetime', group: 'datetime', labelKey: 'fld_datetime' },
  { key: 'countdownImage', path: 'countdown.image', type: 'image', group: 'datetime', labelKey: 'fld_photo' },

  { key: 'venueName', path: 'venue.name', type: 'localized-text', group: 'venue', labelKey: 'fld_venue_name' },
  { key: 'address', path: 'venue.address', type: 'localized-text', group: 'venue', labelKey: 'fld_address' },
  { key: 'mapUrl', path: 'venue.mapUrl', type: 'text', group: 'venue', labelKey: 'fld_map_url', placeholder: 'https://yandex.uz/maps/…' },
  { key: 'venueCaption', path: 'venue.caption', type: 'localized-text', group: 'venue', labelKey: 'fld_caption' },
  { key: 'venueImage', path: 'venue.image', type: 'image', group: 'venue', labelKey: 'fld_photo' },

  { key: 'galleryTitle', path: 'gallery.title', type: 'localized-text', group: 'gallery', labelKey: 'fld_title' },
  { key: 'photo1', path: 'gallery.photo1', type: 'image', group: 'gallery', labelKey: 'fld_photo' },
  { key: 'cap1', path: 'gallery.cap1', type: 'localized-text', group: 'gallery', labelKey: 'fld_caption' },
  { key: 'photo2', path: 'gallery.photo2', type: 'image', group: 'gallery', labelKey: 'fld_photo' },
  { key: 'cap2', path: 'gallery.cap2', type: 'localized-text', group: 'gallery', labelKey: 'fld_caption' },
  { key: 'photo3', path: 'gallery.photo3', type: 'image', group: 'gallery', labelKey: 'fld_photo' },
  { key: 'cap3', path: 'gallery.cap3', type: 'localized-text', group: 'gallery', labelKey: 'fld_caption' },
  { key: 'galleryNote', path: 'gallery.note', type: 'localized-text', group: 'gallery', labelKey: 'fld_text' },

  { key: 'dressTitle', path: 'dress.title', type: 'localized-text', group: 'dress', labelKey: 'fld_dress_title' },
  { key: 'dressText', path: 'dress.text', type: 'localized-textarea', group: 'dress', labelKey: 'fld_dress_note' },
  { key: 'dressColors', path: 'dress.colors', type: 'palette', group: 'dress', labelKey: 'fld_dress_colors' },
  { key: 'dressImage', path: 'dress.image', type: 'image', group: 'dress', labelKey: 'fld_photo' },

  { key: 'replyBy', path: 'rsvp.by', type: 'localized-text', group: 'rsvp', labelKey: 'fld_reply_by' },

  { key: 'finaleText', path: 'finale.text', type: 'localized-textarea', group: 'final', labelKey: 'fld_final' },
  { key: 'finaleImage', path: 'finale.image', type: 'image', group: 'final', labelKey: 'fld_photo' },

  { key: 'music', path: 'music.url', type: 'audio', group: 'music', labelKey: 'tg_music' },

  // Block visibility: hidden.<key> === true switches the section off.
  { key: 'v_film', path: 'hidden.film', type: 'toggle', group: 'visibility', labelKey: 'sec_film' },
  { key: 'v_place', path: 'hidden.place', type: 'toggle', group: 'visibility', labelKey: 'sec_venue' },
  { key: 'v_gallery', path: 'hidden.gallery', type: 'toggle', group: 'visibility', labelKey: 'sec_gallery' },
  { key: 'v_dress', path: 'hidden.dress', type: 'toggle', group: 'visibility', labelKey: 'sec_dress' },
  { key: 'v_countdown', path: 'hidden.countdown', type: 'toggle', group: 'visibility', labelKey: 'sec_countdown' },
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
      ru: 'приглашают вас разделить с ними день свадьбы',
      uz: 'sizni toy kunlarini birga nishonlashga taklif qiladi',
      en: 'invite you to celebrate their wedding',
    },
    text: {
      ru: 'С переполненными сердцами мы приглашаем вас разделить день, когда мы пообещаем друг другу «навсегда», — вечер роз, свечей и праздника.',
      uz: 'Yuraklarimiz toliq quvonch bilan, bir-birimizga abadiyat vadasini beradigan kunni biz bilan bolishishga taklif qilamiz — atirgullar, shamlar va bayram kechasi.',
      en: 'With full hearts, we invite you to share the day we promise each other forever — an evening of roses, candlelight and celebration.',
    },
    // Empty: the bundled photograph stands until the couple uploads their own.
    image: '',
  },
  film: {
    tagline: { ru: 'Любовь обретает крылья', uz: 'Muhabbat qanot yozadi', en: 'Love takes flight' },
  },
  event: {
    dateISO: '2027-09-18T17:00:00',
  },
  countdown: { image: '' },
  venue: {
    name: { ru: 'Дворец роз', uz: 'Atirgullar saroyi', en: 'The Rose Palace' },
    address: {
      ru: 'Ташкент, улица Садовая, 12',
      uz: 'Toshkent, Bogbon kochasi, 12',
      en: '12 Garden Street, Tashkent',
    },
    mapUrl: '',
    caption: { ru: 'Вечер при свечах', uz: 'Sham yorugidagi kecha', en: 'An evening by candlelight' },
    image: '',
  },
  gallery: {
    title: { ru: 'Портреты обещания', uz: 'Vada portretlari', en: 'Portraits of a promise' },
    photo1: '',
    cap1: { ru: 'Розовый сад', uz: 'Atirgul bogi', en: 'The rose garden' },
    photo2: '',
    cap2: { ru: 'Рука об руку', uz: 'Qol ushlashib', en: 'Hand in hand' },
    photo3: '',
    cap3: { ru: 'Парадная лестница', uz: 'Saroy zinapoyasi', en: 'The grand staircase' },
    note: {
      ru: 'Три мгновения в рамах — как картины, которыми они однажды станут.',
      uz: 'Ramkadagi uch lahza — bir kun aylanadigan suratlari kabi.',
      en: 'Three moments, framed like the paintings they will one day become.',
    },
  },
  dress: {
    title: { ru: 'Black tie', uz: 'Black tie', en: 'Black tie' },
    text: {
      ru: 'Пожалуйста, оденьтесь к элегантному вечеру. Наша палитра — бордовый, винный, пудровый и шампань: нам будет приятно увидеть её в ваших нарядах.',
      uz: 'Iltimos, nafis kechaga mos kiyining. Bizning ranglarimiz — toq qizil, vino rangi, pushti va shampan: ularni liboslaringizda korishdan xursand bolamiz.',
      en: 'Please dress for an elegant evening. Our palette is burgundy, wine, blush and champagne — we would love to see it in your outfits.',
    },
    colors: ['#5A1424', '#8E1B2E', '#C98B8B', '#EBDDC4', '#F2DCD5'],
    image: '',
  },
  rsvp: {
    by: { ru: '1 августа 2027', uz: '2027-yil 1-avgust', en: '1 August 2027' },
  },
  finale: {
    text: {
      ru: 'Мы не можем дождаться, когда отпразднуем вместе с вами.',
      uz: 'Siz bilan birga bayram qilishni intiqlik bilan kutamiz.',
      en: 'We cannot wait to celebrate with you.',
    },
    image: '',
  },
  music: { url: '' },
  // Sections switched off in the builder (all visible by default).
  hidden: {} as Record<string, boolean>,
};

export const weddingBurgundyRosesTemplate: TemplateDefinition = {
  id: 'wedding-burgundy-roses',
  category: 'wedding',
  nameKey: 'tpl_wedding_burgundy_roses',
  cover: '🌹',
  accent: '#7A1F33',
  html,
  defaultConfig,
  fields,
  groups,
  Renderer: RichRenderer,
  // These must match the real element ids in template.html — the Design+ runtime
  // anchors by getElementById and silently skips a section it cannot find.
  sectionIds: ['film', 'announce', 'place', 'gallery', 'dress', 'countdown', 'rsvp', 'finale'],
  // The gold family, so the Design+ accent picker recolours the rules, the
  // labels on velvet and the frames as one; the burgundy is the ground.
  accentVars: ['--gold', '--gold-lt', '--gold-dk'],
};
