import html from './template.html?raw';
import { RichRenderer } from '../RichRenderer';
import type { TemplateDefinition, TemplateField, TemplateFieldGroup } from '../types';

// ── "Château" — a French country-house wedding ──────────────────────────────
// The first template built around a film: the hero is a video of the estate
// gates swinging open, and the title lands letter by letter as they finish. The
// artwork below it — the drive, the rose arch, the staircase, the fountain, the
// ballroom, the garden at dusk — is part of the design rather than a set of
// slots, so it ships bundled in apps/web/public/chateau/ and is addressed
// through `window.__ORIGIN__`.
//
// The ONE exception is the gallery. Those seven plates are placeholders: they
// keep the album from standing empty on a fresh invitation, and the moment the
// honoree uploads a photo of their own, theirs replace all of them.
//
// Defaults are written in English first — the design is a Loire château and
// reads that way — with ru and uz filled so the language bar works out of the
// box. uz avoids apostrophes, per the repo convention.

const groups: TemplateFieldGroup[] = [
  { key: 'couple', labelKey: 'tg_couple', icon: '💍', section: 'hero' },
  { key: 'invite', labelKey: 'tg_invite', icon: '✉️', section: 'invite' },
  { key: 'datetime', labelKey: 'tg_datetime', icon: '🗓', section: 'calendar' },
  { key: 'venue', labelKey: 'tg_venue', icon: '📍', section: 'estate' },
  { key: 'story', labelKey: 'tg_story', icon: '💞', section: 'couple' },
  { key: 'day', labelKey: 'sec_theday', icon: '🕯', section: 'story' },
  { key: 'ceremony', labelKey: 'sec_ceremony', icon: '🌿', section: 'ceremony' },
  { key: 'details', labelKey: 'tg_details', icon: '📋', section: 'details' },
  { key: 'schedule', labelKey: 'tg_schedule', icon: '🕰', section: 'details' },
  { key: 'gallery', labelKey: 'tg_gallery', icon: '📷', section: 'gallery' },
  { key: 'finale', labelKey: 'sec_final', icon: '🥂', section: 'finale' },
  { key: 'music', labelKey: 'tg_music', icon: '🎵' },
  { key: 'visibility', labelKey: 'tg_visibility', icon: '👁' },
];

const fields: TemplateField[] = [
  // The short names carry the hero, where they are split into animated letters;
  // the full names sign the invitation itself. Blank full names fall back to
  // the short ones rather than leaving the invitation unsigned.
  { key: 'bride', path: 'couple.bride', type: 'localized-text', group: 'couple', labelKey: 'fld_bride' },
  { key: 'groom', path: 'couple.groom', type: 'localized-text', group: 'couple', labelKey: 'fld_groom' },
  { key: 'brideFull', path: 'couple.brideFull', type: 'localized-text', group: 'couple', labelKey: 'fld_name' },
  { key: 'groomFull', path: 'couple.groomFull', type: 'localized-text', group: 'couple', labelKey: 'fld_name' },

  { key: 'kicker', path: 'invite.kicker', type: 'localized-text', group: 'invite', labelKey: 'fld_kicker' },
  // Left empty by default: the hero then prints the formatted event date, which
  // cannot go stale when the date is changed.
  { key: 'meta', path: 'invite.meta', type: 'localized-text', group: 'invite', labelKey: 'fld_time_text' },
  { key: 'lede', path: 'invite.lede', type: 'localized-textarea', group: 'invite', labelKey: 'fld_invite_text' },
  { key: 'arrivalCaption', path: 'arrival.caption', type: 'localized-text', group: 'invite', labelKey: 'fld_caption' },

  // Convention: the first datetime field is the event date. Everything dated on
  // the page comes from it — the hero line, the invitation, the details tile,
  // the footer, and the calendar's month, weekday columns and lit day.
  { key: 'dateISO', path: 'event.dateISO', type: 'datetime', group: 'datetime', labelKey: 'fld_datetime' },
  { key: 'calTitle', path: 'calendar.title', type: 'localized-text', group: 'datetime', labelKey: 'fld_sub' },
  { key: 'calNote', path: 'calendar.note', type: 'localized-text', group: 'datetime', labelKey: 'fld_time_note' },

  { key: 'venueName', path: 'venue.name', type: 'localized-text', group: 'venue', labelKey: 'fld_venue_name' },
  { key: 'venueRegion', path: 'venue.region', type: 'localized-text', group: 'venue', labelKey: 'fld_city' },

  { key: 'storyEyebrow', path: 'story.eyebrow', type: 'localized-text', group: 'story', labelKey: 'fld_kicker' },
  { key: 'storyTitle', path: 'story.title', type: 'localized-text', group: 'story', labelKey: 'fld_sub' },
  { key: 'storyOne', path: 'story.one', type: 'localized-textarea', group: 'story', labelKey: 'fld_text' },
  { key: 'storyTwo', path: 'story.two', type: 'localized-textarea', group: 'story', labelKey: 'fld_desc' },

  { key: 'dayTitle', path: 'day.title', type: 'localized-text', group: 'day', labelKey: 'fld_sub' },
  { key: 'plateOne', path: 'day.plateOne', type: 'localized-text', group: 'day', labelKey: 'fld_caption' },
  { key: 'plateTwo', path: 'day.plateTwo', type: 'localized-text', group: 'day', labelKey: 'fld_caption' },

  { key: 'ceremonyTitle', path: 'ceremony.title', type: 'localized-text', group: 'ceremony', labelKey: 'fld_sub' },
  { key: 'ceremonyCap', path: 'ceremony.caption', type: 'localized-textarea', group: 'ceremony', labelKey: 'fld_text' },

  { key: 'dateNote', path: 'details.dateNote', type: 'localized-text', group: 'details', labelKey: 'fld_time_note' },
  { key: 'detCeremony', path: 'details.ceremony', type: 'localized-text', group: 'details', labelKey: 'fld_venue_name' },
  { key: 'detCeremonyNote', path: 'details.ceremonyNote', type: 'localized-text', group: 'details', labelKey: 'fld_desc' },
  { key: 'detReception', path: 'details.reception', type: 'localized-text', group: 'details', labelKey: 'fld_label' },
  { key: 'detReceptionNote', path: 'details.receptionNote', type: 'localized-text', group: 'details', labelKey: 'fld_desc' },
  { key: 'dress', path: 'dress.title', type: 'localized-text', group: 'details', labelKey: 'fld_dress_title' },
  { key: 'dressNote', path: 'dress.note', type: 'localized-text', group: 'details', labelKey: 'fld_dress_note' },
  { key: 'travel', path: 'travel.title', type: 'localized-text', group: 'details', labelKey: 'fld_travel' },
  { key: 'travelNote', path: 'travel.note', type: 'localized-text', group: 'details', labelKey: 'fld_travel_note' },
  { key: 'stay', path: 'stay.title', type: 'localized-text', group: 'details', labelKey: 'fld_stay' },
  { key: 'stayNote', path: 'stay.note', type: 'localized-text', group: 'details', labelKey: 'fld_stay_note' },
  { key: 'rsvpLede', path: 'rsvp.lede', type: 'localized-text', group: 'details', labelKey: 'fld_rsvp_lede' },

  { key: 'schedule', path: 'schedule', type: 'schedule', group: 'schedule', labelKey: 'tg_schedule' },

  { key: 'galleryTitle', path: 'gallery_title', type: 'localized-text', group: 'gallery', labelKey: 'fld_sub' },
  // Empty by design: the album falls back to the seven bundled plates, and the
  // first photo added here replaces all of them.
  { key: 'gallery', path: 'gallery', type: 'gallery', group: 'gallery', labelKey: 'tg_gallery' },

  { key: 'finaleTitle', path: 'finale.title', type: 'localized-text', group: 'finale', labelKey: 'fld_sub' },
  { key: 'finaleMsg', path: 'finale.message', type: 'localized-textarea', group: 'finale', labelKey: 'fld_final' },

  { key: 'music', path: 'music.url', type: 'audio', group: 'music', labelKey: 'tg_music' },

  // Block visibility: hidden.<key> === true switches the section off.
  { key: 'v_arrival', path: 'hidden.arrival', type: 'toggle', group: 'visibility', labelKey: 'sec_arrival' },
  { key: 'v_estate', path: 'hidden.estate', type: 'toggle', group: 'visibility', labelKey: 'sec_venue' },
  { key: 'v_couple', path: 'hidden.couple', type: 'toggle', group: 'visibility', labelKey: 'sec_story' },
  { key: 'v_story', path: 'hidden.story', type: 'toggle', group: 'visibility', labelKey: 'sec_theday' },
  { key: 'v_ceremony', path: 'hidden.ceremony', type: 'toggle', group: 'visibility', labelKey: 'sec_ceremony' },
  { key: 'v_calendar', path: 'hidden.calendar', type: 'toggle', group: 'visibility', labelKey: 'sec_calendar' },
  { key: 'v_details', path: 'hidden.details', type: 'toggle', group: 'visibility', labelKey: 'sec_details' },
  { key: 'v_program', path: 'hidden.program', type: 'toggle', group: 'visibility', labelKey: 'sec_program' },
  { key: 'v_gallery', path: 'hidden.gallery', type: 'toggle', group: 'visibility', labelKey: 'sec_gallery' },
  { key: 'v_rsvp', path: 'hidden.rsvp', type: 'toggle', group: 'visibility', labelKey: 'sec_rsvp' },
  { key: 'v_music', path: 'hidden.music', type: 'toggle', group: 'visibility', labelKey: 'sec_music' },
];

const defaultConfig = {
  couple: {
    bride: { en: 'Éloïse', ru: 'Элоиза', uz: 'Eloiza' },
    groom: { en: 'Julien', ru: 'Жюльен', uz: 'Julyen' },
    brideFull: { en: 'Éloïse Marchand', ru: 'Элоиза Маршан', uz: 'Eloiza Marshan' },
    groomFull: { en: 'Julien Rocher', ru: 'Жюльен Роше', uz: 'Julyen Roshe' },
  },
  invite: {
    kicker: {
      en: 'Together with their families',
      ru: 'Вместе со своими семьями',
      uz: 'Oilalari bilan birgalikda',
    },
    // Empty on purpose — see the field comment above.
    meta: { en: '', ru: '', uz: '' },
    lede: {
      en: 'Come and find us at the end of a long gravel drive, where the roses have quite got out of hand and supper runs until the candles give up.',
      ru: 'Найдите нас в конце длинной гравийной аллеи, где розы совсем разрослись, а ужин длится, пока не догорят свечи.',
      uz: 'Bizni uzun shagal yol nihoyasida toping: u yerda atirgullar bemalol osgan, ziyofat esa shamlar songuncha davom etadi.',
    },
  },
  arrival: {
    caption: {
      en: 'Past the gates, the drive opens',
      ru: 'За воротами открывается аллея',
      uz: 'Darvozadan otilsa, yol ochiladi',
    },
  },
  event: {
    dateISO: '2026-09-12T17:00:00',
  },
  calendar: {
    title: {
      en: 'One Saturday in September',
      ru: 'Одна суббота в сентябре',
      uz: 'Sentabrdagi bir shanba',
    },
    note: {
      en: 'Ceremony at five · Dinner and dancing to follow',
      ru: 'Церемония в пять · Затем ужин и танцы',
      uz: 'Marosim soat beshda · Sungra ziyofat va raqslar',
    },
  },
  venue: {
    name: { en: 'Château de Villandreau', ru: 'Шато де Виландро', uz: 'Vilandro qasri' },
    region: { en: 'Loire Valley, France', ru: 'Долина Луары, Франция', uz: 'Luara vodiysi, Fransiya' },
  },
  story: {
    eyebrow: {
      en: 'Nine years, one long garden',
      ru: 'Девять лет, один длинный сад',
      uz: 'Toqqiz yil, bitta uzun bog',
    },
    title: {
      en: 'We met on the wrong train',
      ru: 'Мы встретились не в том поезде',
      uz: 'Biz notogri poyezdda uchrashganmiz',
    },
    one: {
      en: 'Julien was going to Tours. Éloïse was not. By Orléans they had agreed the timetable had been right all along, and there has been very little argument since.',
      ru: 'Жюльен ехал в Тур. Элоиза — нет. К Орлеану они согласились, что расписание всё-таки было право, и с тех пор спорят редко.',
      uz: 'Julyen Turga ketayotgan edi. Eloiza esa yoq. Orleanga yetguncha ikkalasi jadval haq bolganini tan oldi va shundan beri deyarli tortishmaydi.',
    },
    two: {
      en: 'This September we are asking everyone we love to walk up the same drive, in good shoes, and stay far too late.',
      ru: 'В этом сентябре мы зовём всех, кого любим, пройти по той же аллее, в удобной обуви, и остаться до самой ночи.',
      uz: 'Bu sentabrda biz sevganlarimizni osha yoldan yurib kelishga, qulay poyabzalda va tunga qadar qolishga taklif qilamiz.',
    },
  },
  day: {
    title: { en: 'How the day will go', ru: 'Как пройдёт день', uz: 'Kun qanday otadi' },
    plateOne: {
      en: 'Up the west stair, at four',
      ru: 'По западной лестнице, в четыре',
      uz: 'Garbiy zinapoyadan, soat tortda',
    },
    plateTwo: {
      en: 'Champagne at the fountain',
      ru: 'Шампанское у фонтана',
      uz: 'Favvora yonida shampan',
    },
  },
  ceremony: {
    title: { en: 'Beneath the arch', ru: 'Под аркой', uz: 'Ravoq ostida' },
    caption: {
      en: 'Vows at five, in the rose walk. The chairs are on the grass — heels will sink, and nobody will mind.',
      ru: 'Клятвы в пять, в розовой аллее. Стулья стоят на траве — каблуки увязнут, и никто не расстроится.',
      uz: 'Qasamlar soat beshda, atirgul yolida. Kursilar maysada turadi, poshnalar botadi, ammo hech kim xafa bolmaydi.',
    },
  },
  details: {
    dateNote: {
      en: 'Arrive from four o’clock. The gates close at half past four, so do come early.',
      ru: 'Приезжайте с четырёх. Ворота закрываются в половине пятого, так что не опаздывайте.',
      uz: 'Soat tortdan boshlab keling. Darvozalar tort yarimda yopiladi, shuning uchun erta keling.',
    },
    ceremony: {
      en: 'The Rose Walk, Château de Villandreau',
      ru: 'Розовая аллея, Шато де Виландро',
      uz: 'Atirgul yoli, Vilandro qasri',
    },
    ceremonyNote: {
      en: 'Outdoors on grass. There is shade, and umbrellas if the Loire misbehaves.',
      ru: 'На улице, на траве. Есть тень и зонты, если Луара решит иначе.',
      uz: 'Ochiq havoda, maysada. Soya bor, yomgir boladigan bolsa soyabonlar ham bor.',
    },
    reception: {
      en: 'The Orangery & South Terrace',
      ru: 'Оранжерея и южная терраса',
      uz: 'Oranjereya va janubiy ayvon',
    },
    receptionNote: {
      en: 'Dinner under the chandeliers, dancing on the terrace until one.',
      ru: 'Ужин под люстрами, танцы на террасе до часу ночи.',
      uz: 'Qandillar ostida kechki ovqat, ayvonda tungi soat birgacha raqs.',
    },
  },
  dress: {
    title: { en: 'Black tie, garden-proof', ru: 'Чёрный галстук, но для сада', uz: 'Tantanali, ammo bog uchun qulay' },
    note: {
      en: 'Long dresses and dinner jackets. Bring a block heel or a flat — the lawn wins every time.',
      ru: 'Длинные платья и смокинги. Возьмите устойчивый каблук или балетки — газон всегда побеждает.',
      uz: 'Uzun koylaklar va smokinglar. Bargidek pastak poshna yoki tekis poyabzal oling, maysa har doim yengadi.',
    },
  },
  travel: {
    title: { en: 'Two hours from Paris', ru: 'Два часа от Парижа', uz: 'Parijdan ikki soat' },
    note: {
      en: 'Trains to Tours, then a twenty-minute drive. Cars from the station at three and half past three.',
      ru: 'Поезда до Тура, затем двадцать минут на машине. Машины от вокзала в три и в половине четвёртого.',
      uz: 'Turgacha poyezd, sungra yigirma daqiqa yol. Bekatdan mashinalar soat uchda va uch yarimda.',
    },
  },
  stay: {
    title: { en: 'Rooms in the village', ru: 'Номера в деревне', uz: 'Qishloqdagi xonalar' },
    note: {
      en: 'We have held beds at Le Pressoir and the Auberge Sainte-Claire until the first of July.',
      ru: 'Мы забронировали места в Le Pressoir и Auberge Sainte-Claire до первого июля.',
      uz: 'Le Pressoir va Auberge Sainte-Claire mehmonxonalarida joylar birinchi iyulgacha band qilingan.',
    },
  },
  rsvp: {
    lede: {
      en: 'Kindly reply by the first of July.',
      ru: 'Пожалуйста, ответьте до первого июля.',
      uz: 'Iltimos, birinchi iyulgacha javob bering.',
    },
  },
  // The running order printed under the particulars. `mode: 'time'` keeps the
  // clock input in the builder rather than the free-text one.
  schedule: [
    { time: '16:00', mode: 'time', label: { en: 'Gates open · welcome drinks in the courtyard', ru: 'Ворота открываются · напитки во дворе', uz: 'Darvozalar ochiladi · hovlida kutib olish' } },
    { time: '17:00', mode: 'time', label: { en: 'Ceremony in the Rose Walk', ru: 'Церемония в розовой аллее', uz: 'Atirgul yolida marosim' } },
    { time: '17:45', mode: 'time', label: { en: 'Champagne and photographs by the fountain', ru: 'Шампанское и фотографии у фонтана', uz: 'Favvora yonida shampan va suratlar' } },
    { time: '19:30', mode: 'time', label: { en: 'Dinner in the Orangery', ru: 'Ужин в оранжерее', uz: 'Oranjereyada kechki ovqat' } },
    { time: '22:00', mode: 'time', label: { en: 'First dance · dancing on the terrace', ru: 'Первый танец · танцы на террасе', uz: 'Birinchi raqs · ayvonda raqslar' } },
    { time: '01:00', mode: 'time', label: { en: 'Last waltz and a very quiet drive home', ru: 'Последний вальс и очень тихая дорога домой', uz: 'Songgi vals va juda tinch qaytish yoli' } },
  ] as { time: string; mode: string; label: Record<string, string> }[],
  gallery_title: {
    en: 'A walk through the grounds',
    ru: 'Прогулка по усадьбе',
    uz: 'Qasr boylab sayr',
  },
  // Empty: the album falls back to the bundled plates until the honoree uploads
  // photos of their own, at which point theirs replace all of them.
  gallery: [] as { image: string; caption: Record<string, string> }[],
  finale: {
    title: { en: 'We would love you there', ru: 'Мы будем рады видеть вас', uz: 'Sizni kutib qolamiz' },
    message: {
      en: 'Bring nothing but yourself and an appetite. The roses are handled.',
      ru: 'Возьмите с собой только себя и аппетит. Розы мы берём на себя.',
      uz: 'Ozingiz va ishtahangizni olib keling. Atirgullar bizdan.',
    },
  },
  music: { url: '' },
  // Sections switched off in the builder (all visible by default).
  hidden: {} as Record<string, boolean>,
};

export const weddingChateauTemplate: TemplateDefinition = {
  id: 'wedding-chateau',
  category: 'wedding',
  nameKey: 'tpl_wedding_chateau',
  cover: '🏰',
  accent: '#B8924E',
  html,
  defaultConfig,
  fields,
  groups,
  Renderer: RichRenderer,
  // These must match the real element ids in template.html — the Design+ runtime
  // anchors by getElementById and silently skips a section it cannot find.
  sectionIds: ['hero', 'arrival', 'invite', 'estate', 'couple', 'story', 'ceremony', 'calendar', 'details', 'gallery', 'finale'],
  // The engraved gold, not the blush and sage: those two are the florals drawn
  // into the ornament, and recolouring them with a picked accent would take the
  // roses and the leaves with them.
  accentVars: ['--gold', '--gold-lt'],
};
