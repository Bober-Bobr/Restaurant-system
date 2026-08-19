import html from './template.html?raw';
import { RichRenderer } from '../RichRenderer';
import type { TemplateDefinition, TemplateField, TemplateFieldGroup } from '../types';

// ── "Paris" — a Parisian wedding ────────────────────────────────────────────
// The second template built around a film: the hero is a video of French doors
// opening onto the city, and the title lands letter by letter as they finish.
// It shares the Château's engine — the same reveal rig, parallax caps, calendar
// and reply doors — but tells its story differently.
//
// The difference worth knowing: the Château gives you a portrait and a pair of
// captioned plates; Paris runs THREE alternating rows, each a plate and a
// passage, because this design is a nine-year story in a city rather than a
// single afternoon at a house. A row with nothing written in it hides itself.
//
// The artwork — the doors, the garden, the street, the balcony, the Seine, the
// tower, the mirror hall, the table — is part of the design rather than a set
// of slots, so it ships bundled in apps/web/public/paris/ and is addressed
// through `window.__ORIGIN__`.
//
// The ONE exception is the gallery. Those eight plates are placeholders: they
// keep the album from standing empty on a fresh invitation, and the moment the
// honoree uploads a photo of their own, theirs replace all of them.
//
// Defaults are written in English first — the design is a Paris wedding and
// reads that way — with ru and uz filled so the language bar works out of the
// box. uz avoids apostrophes, per the repo convention.

const groups: TemplateFieldGroup[] = [
  { key: 'couple', labelKey: 'tg_couple', icon: '💍', section: 'hero' },
  { key: 'invite', labelKey: 'tg_invite', icon: '✉️', section: 'invite' },
  { key: 'datetime', labelKey: 'tg_datetime', icon: '🗓', section: 'calendar' },
  { key: 'venue', labelKey: 'tg_venue', icon: '📍', section: 'details' },
  { key: 'story', labelKey: 'tg_story', icon: '💞', section: 'story' },
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
  // The word between the two names. "et" by default, because that is the joke
  // this design is telling; blank falls back to the chrome's own "and".
  { key: 'amp', path: 'invite.amp', type: 'localized-text', group: 'couple', labelKey: 'fld_label' },

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

  // Three acts. Each is a heading and a passage beside its own plate; leaving
  // both blank drops that row from the page.
  { key: 'storyEyebrow', path: 'story.eyebrow', type: 'localized-text', group: 'story', labelKey: 'fld_kicker' },
  { key: 'storyTitle', path: 'story.title', type: 'localized-text', group: 'story', labelKey: 'fld_sub' },
  { key: 'oneTitle', path: 'story.oneTitle', type: 'localized-text', group: 'story', labelKey: 'fld_label' },
  { key: 'oneText', path: 'story.oneText', type: 'localized-textarea', group: 'story', labelKey: 'fld_text' },
  { key: 'twoTitle', path: 'story.twoTitle', type: 'localized-text', group: 'story', labelKey: 'fld_label' },
  { key: 'twoText', path: 'story.twoText', type: 'localized-textarea', group: 'story', labelKey: 'fld_text' },
  { key: 'threeTitle', path: 'story.threeTitle', type: 'localized-text', group: 'story', labelKey: 'fld_label' },
  { key: 'threeText', path: 'story.threeText', type: 'localized-textarea', group: 'story', labelKey: 'fld_text' },

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
  // Empty by design: the album falls back to the eight bundled plates, and the
  // first photo added here replaces all of them.
  { key: 'gallery', path: 'gallery', type: 'gallery', group: 'gallery', labelKey: 'tg_gallery' },

  { key: 'finaleTitle', path: 'finale.title', type: 'localized-text', group: 'finale', labelKey: 'fld_sub' },
  { key: 'finaleMsg', path: 'finale.message', type: 'localized-textarea', group: 'finale', labelKey: 'fld_final' },

  { key: 'music', path: 'music.url', type: 'audio', group: 'music', labelKey: 'tg_music' },

  // Block visibility: hidden.<key> === true switches the section off.
  { key: 'v_arrival', path: 'hidden.arrival', type: 'toggle', group: 'visibility', labelKey: 'sec_arrival' },
  { key: 'v_story', path: 'hidden.story', type: 'toggle', group: 'visibility', labelKey: 'sec_story' },
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
    bride: { en: 'Camille', ru: 'Камиль', uz: 'Kamil' },
    groom: { en: 'Antoine', ru: 'Антуан', uz: 'Antuan' },
    brideFull: { en: 'Camille Lefèvre', ru: 'Камиль Лефевр', uz: 'Kamil Lefevr' },
    groomFull: { en: 'Antoine Duval', ru: 'Антуан Дюваль', uz: 'Antuan Dyuval' },
  },
  invite: {
    kicker: {
      en: 'Together with their families',
      ru: 'Вместе со своими семьями',
      uz: 'Oilalari bilan birgalikda',
    },
    // The French "and", which is half the charm of the hero.
    amp: { en: 'et', ru: 'et', uz: 'et' },
    // Empty on purpose — see the field comment above.
    meta: { en: '', ru: '', uz: '' },
    lede: {
      en: 'We are getting married in the city where we got hopelessly lost on our first afternoon, and we would like you lost there with us.',
      ru: 'Мы женимся в городе, где безнадёжно заблудились в первый же день, и очень хотим заблудиться там вместе с вами.',
      uz: 'Biz birinchi kuniyoq butunlay adashib ketgan shaharda turmush quramiz va siz ham biz bilan birga adashishingizni istaymiz.',
    },
  },
  arrival: {
    caption: {
      en: 'Past the doors, the garden opens',
      ru: 'За дверями открывается сад',
      uz: 'Eshiklardan otilsa, bog ochiladi',
    },
  },
  event: {
    dateISO: '2026-06-13T18:00:00',
  },
  calendar: {
    title: {
      en: 'One Saturday in June',
      ru: 'Одна суббота в июне',
      uz: 'Iyundagi bir shanba',
    },
    note: {
      en: 'Ceremony at six · Dinner and dancing until late',
      ru: 'Церемония в шесть · Ужин и танцы до поздней ночи',
      uz: 'Marosim soat oltida · Ziyofat va raqslar tungacha',
    },
  },
  venue: {
    name: { en: 'Hôtel de Sévigné', ru: 'Отель де Севинье', uz: 'Sevinye qasri' },
    region: { en: 'Paris, France', ru: 'Париж, Франция', uz: 'Parij, Fransiya' },
  },
  story: {
    eyebrow: {
      en: 'Nine years, one city',
      ru: 'Девять лет, один город',
      uz: 'Toqqiz yil, bitta shahar',
    },
    title: {
      en: 'How we got here',
      ru: 'Как мы к этому пришли',
      uz: 'Bu yerga qanday keldik',
    },
    oneTitle: {
      en: 'A wrong turn near Saint-Sulpice',
      ru: 'Неверный поворот у Сен-Сюльпис',
      uz: 'Sen-Syulpis yonidagi notogri burilish',
    },
    oneText: {
      en: 'Antoine was certain the river was to the left. It was not. Two hours and one very good bakery later, Camille stopped correcting him, which is roughly where this all began.',
      ru: 'Антуан был уверен, что река слева. Она была не слева. Через два часа и одну очень хорошую пекарню Камиль перестала его поправлять — примерно с этого всё и началось.',
      uz: 'Antuan daryo chap tomonda deb ishonardi. Unday emas edi. Ikki soat va bitta ajoyib nonvoyxonadan keyin Kamil uni tuzatishni bas qildi, hammasi taxminan oshandan boshlangan.',
    },
    twoTitle: {
      en: 'A balcony on the rue de Verneuil',
      ru: 'Балкон на улице Верней',
      uz: 'Vernei kochasidagi ayvon',
    },
    twoText: {
      en: 'Four floors up, one temperamental radiator, and a geranium that refused to die. We lived there six years and learned to eat dinner at ten like everyone else.',
      ru: 'Четвёртый этаж, капризная батарея и герань, которая отказывалась погибать. Мы прожили там шесть лет и научились ужинать в десять, как все.',
      uz: 'Tortinchi qavat, injiq radiator va olishni istamagan bitta gultojixoraz. U yerda olti yil yashadik va hamma qatori soat ontda ovqatlanishni organdik.',
    },
    threeTitle: {
      en: 'The question, on the Pont Neuf',
      ru: 'Вопрос, на Новом мосту',
      uz: 'Savol, Pon-Nef kopriginda',
    },
    threeText: {
      en: 'Asked badly, in the wind, twice, because the first time nobody heard. The answer was immediate and has not been revisited since.',
      ru: 'Задан неудачно, на ветру, дважды — потому что в первый раз его никто не услышал. Ответ был мгновенным и с тех пор не пересматривался.',
      uz: 'Shamolda, ikki marta va uncha chiroyli emas soraldi, chunki birinchi safar hech kim eshitmadi. Javob darhol berildi va shundan beri ozgarmadi.',
    },
  },
  ceremony: {
    title: { en: 'Beneath the tower, at six', ru: 'Под башней, в шесть', uz: 'Minora ostida, soat oltida' },
    caption: {
      en: 'Vows in the garden of the Hôtel de Sévigné, with the tower over our shoulders.',
      ru: 'Клятвы в саду отеля де Севинье, а башня — у нас за плечами.',
      uz: 'Qasamlar Sevinye qasri bogida, minora esa yelkamiz ortida.',
    },
  },
  details: {
    dateNote: {
      en: 'Doors from five o’clock. Paris in June is warm at six and cool by eleven — bring a wrap.',
      ru: 'Двери открыты с пяти. Париж в июне тёплый в шесть и прохладный к одиннадцати — возьмите накидку.',
      uz: 'Eshiklar soat beshdan ochiq. Iyun Parijida soat oltida iliq, ontbirda salqin boladi, yengil kiyim oling.',
    },
    ceremony: {
      en: 'The garden, Hôtel de Sévigné, 7ᵉ',
      ru: 'Сад отеля де Севинье, 7-й округ',
      uz: 'Sevinye qasri bogi, 7-tuman',
    },
    ceremonyNote: {
      en: 'Outdoors on gravel and grass. A block heel will serve you far better than a stiletto.',
      ru: 'На улице, гравий и трава. Устойчивый каблук подойдёт гораздо лучше шпильки.',
      uz: 'Ochiq havoda, shagal va maysa ustida. Pastak poshna ingichka poshnadan kora ancha qulay boladi.',
    },
    reception: {
      en: 'The Mirror Hall & terrace',
      ru: 'Зеркальный зал и терраса',
      uz: 'Oynali zal va ayvon',
    },
    receptionNote: {
      en: 'Dinner beneath the chandeliers, then dancing on the terrace above the rooftops.',
      ru: 'Ужин под люстрами, затем танцы на террасе над крышами.',
      uz: 'Qandillar ostida kechki ovqat, sungra tomlar uzra ayvonda raqslar.',
    },
  },
  dress: {
    title: { en: 'Black tie', ru: 'Чёрный галстук', uz: 'Tantanali kiyim' },
    note: {
      en: 'Long dresses and dinner jackets. Burgundy, champagne and deep green if you want to match the flowers.',
      ru: 'Длинные платья и смокинги. Бордо, шампань и глубокий зелёный — если хотите совпасть с цветами.',
      uz: 'Uzun koylaklar va smokinglar. Gullarga mos tushmoqchi bolsangiz: marun, shampan va toq yashil.',
    },
  },
  travel: {
    title: { en: 'Métro Rue du Bac, then five minutes', ru: 'Метро Рю-дю-Бак, затем пять минут', uz: 'Ryu-dyu-Bak metrosi, sungra besh daqiqa' },
    note: {
      en: 'Taxis struggle on the rue de Verneuil after six. The walk from Solférino is prettier anyway.',
      ru: 'После шести такси с трудом проезжают по улице Верней. Да и пешком от Сольферино красивее.',
      uz: 'Oltidan keyin taksilar Vernei kochasida qiynaladi. Solferinodan piyoda yurish baribir chiroyliroq.',
    },
  },
  stay: {
    title: { en: 'Rooms held in the 7ᵉ', ru: 'Номера в 7-м округе', uz: '7-tumanda band qilingan xonalar' },
    note: {
      en: 'We have a small block at the Hôtel Lenox and the Bellechasse until the first of April.',
      ru: 'Мы забронировали несколько номеров в Hôtel Lenox и Bellechasse до первого апреля.',
      uz: 'Hôtel Lenox va Bellechasse mehmonxonalarida bir nechta xona birinchi aprelgacha band qilingan.',
    },
  },
  rsvp: {
    lede: {
      en: 'Kindly by the first of April.',
      ru: 'Пожалуйста, ответьте до первого апреля.',
      uz: 'Iltimos, birinchi aprelgacha javob bering.',
    },
  },
  // The running order printed under the particulars. `mode: 'time'` keeps the
  // clock input in the builder rather than the free-text one.
  schedule: [
    { time: '17:00', mode: 'time', label: { en: 'Doors open · champagne in the courtyard', ru: 'Двери открываются · шампанское во дворе', uz: 'Eshiklar ochiladi · hovlida shampan' } },
    { time: '18:00', mode: 'time', label: { en: 'Ceremony in the garden', ru: 'Церемония в саду', uz: 'Bogda marosim' } },
    { time: '18:45', mode: 'time', label: { en: 'Photographs and apéritif by the fountain', ru: 'Фотографии и аперитив у фонтана', uz: 'Favvora yonida suratlar va aperitiv' } },
    { time: '20:30', mode: 'time', label: { en: 'Dinner in the Mirror Hall', ru: 'Ужин в Зеркальном зале', uz: 'Oynali zalda kechki ovqat' } },
    { time: '23:00', mode: 'time', label: { en: 'First dance · dancing on the terrace', ru: 'Первый танец · танцы на террасе', uz: 'Birinchi raqs · ayvonda raqslar' } },
    { time: '02:00', mode: 'time', label: { en: 'Soupe à l’oignon, and goodnight', ru: 'Луковый суп — и спокойной ночи', uz: 'Piyoz shorvasi va xayrli tun' } },
  ] as { time: string; mode: string; label: Record<string, string> }[],
  gallery_title: {
    en: 'A walk through our Paris',
    ru: 'Прогулка по нашему Парижу',
    uz: 'Bizning Parij boylab sayr',
  },
  // Empty: the album falls back to the bundled plates until the honoree uploads
  // photos of their own, at which point theirs replace all of them.
  gallery: [] as { image: string; caption: Record<string, string> }[],
  finale: {
    title: { en: 'Come to Paris', ru: 'Приезжайте в Париж', uz: 'Parijga keling' },
    message: {
      en: 'Bring nothing but an appetite and comfortable shoes. The flowers are handled.',
      ru: 'Возьмите с собой только аппетит и удобную обувь. Цветы мы берём на себя.',
      uz: 'Ishtaha va qulay poyabzaldan boshqa hech narsa kerak emas. Gullar bizdan.',
    },
  },
  music: { url: '' },
  // Sections switched off in the builder (all visible by default).
  hidden: {} as Record<string, boolean>,
};

export const weddingParisTemplate: TemplateDefinition = {
  id: 'wedding-paris',
  category: 'wedding',
  nameKey: 'tpl_wedding_paris',
  cover: '🗼',
  accent: '#B08D4F',
  html,
  defaultConfig,
  fields,
  groups,
  Renderer: RichRenderer,
  // These must match the real element ids in template.html — the Design+ runtime
  // anchors by getElementById and silently skips a section it cannot find.
  sectionIds: ['hero', 'arrival', 'invite', 'story', 'ceremony', 'calendar', 'details', 'gallery', 'finale'],
  // The engraved gold only. The dusty rose and the burgundy are the flowers and
  // the ribbon drawn through the design; recolouring them with a picked accent
  // would take the roses with them.
  accentVars: ['--gold', '--gold-lt'],
};
