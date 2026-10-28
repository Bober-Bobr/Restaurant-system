import html from './template.html?raw';
import { RichRenderer } from '../RichRenderer';
import type { TemplateDefinition, TemplateField, TemplateFieldGroup } from '../types';

// ── "Wedding in Zermatt" — an alpine wedding, set as a Swiss notice ──────────
// The fifth design built around a film, and the first drawn as a typographic
// SYSTEM rather than as a romantic one: a strict twelve-column grid, numbered
// sections, labels small and tracked, metadata in the margins (an altitude, a
// figure number beneath every photograph) and the order of the day printed as
// a railway departure board whose rows flap down as the table arrives. Ivory,
// forest, slate and stone; one high-contrast serif; the warmth comes from the
// mountains.
//
// Four things worth knowing before editing it:
//
// · THE DE / FR / IT LABELS ARE THE DESIGN. Switzerland's own three languages
//   head every section in all three of our dictionaries, the way the Paris
//   design keeps "Entrez" — translating "Ankündigung" would be translating the
//   scenery. What DOES translate is the fourth line of the announcement, which
//   is the reader's own language, and every label and control around it.
// · THE PAGE IS SEALED on the opening film until the invitation is opened, and
//   the seal is put on from script, never in the markup, so a dead script
//   leaves an ordinary scrollable page. Any scroll, swipe or key opens it, so
//   nobody can be trapped on the cover.
// · EVERY VIEWPORT-TALL SECTION CARRIES A PORTRAIT PLATE as well as a landscape
//   one, and the opening film has a portrait cut. A 16:9 picture in a 9:16
//   phone screen shows about a quarter of itself; `<picture>` chooses on the
//   aspect ratio of the screen, which is the thing that actually decides the
//   crop, and only one of the two films is ever downloaded.
// · THE VENUE PLATE IS THE ONE PHOTOGRAPH THE HONOREE OWNS. Everything else is
//   part of the design and ships bundled in apps/web/public/zermatt/, addressed
//   through `window.__ORIGIN__`; the chalet beside the address carries
//   `data-photo="venue.image"`, so a couple can show the house they are
//   actually marrying at. It defaults to empty, so nothing already published
//   changes.
//
// Defaults are written in English first — an alpine wedding told in English —
// with ru and uz complete so the language bar works out of the box. uz avoids
// apostrophes, per the repo convention.

const groups: TemplateFieldGroup[] = [
  { key: 'couple', labelKey: 'tg_couple', icon: '💍', section: 'hero' },
  { key: 'couple2', labelKey: 'tg_couple2', icon: '💞', section: 'hero' },
  { key: 'datetime', labelKey: 'tg_datetime', icon: '🗓', section: 'details' },
  { key: 'invite', labelKey: 'tg_invite', icon: '✉️', section: 'announce' },
  { key: 'story', labelKey: 'tg_story', icon: '🏔', section: 'story' },
  { key: 'schedule', labelKey: 'tg_schedule', icon: '🕰', section: 'details' },
  { key: 'venue', labelKey: 'tg_venue', icon: '📍', section: 'place' },
  { key: 'ceremony', labelKey: 'sec_ceremony', icon: '🌿', section: 'ceremony' },
  { key: 'details', labelKey: 'tg_details', icon: '📋', section: 'ceremony' },
  { key: 'celebration', labelKey: 'sec_celebration', icon: '🥂', section: 'celebration' },
  { key: 'rsvp', labelKey: 'tg_rsvp', icon: '✍️', section: 'rsvp' },
  { key: 'finale', labelKey: 'sec_final', icon: '🏔', section: 'finale' },
  { key: 'music', labelKey: 'tg_music', icon: '🎵' },
  { key: 'visibility', labelKey: 'tg_visibility', icon: '👁' },
];

const fields: TemplateField[] = [
  // The short names carry the cover; the full names sign the announcement.
  // Blank full names fall back to the short ones rather than leaving the
  // invitation unsigned. The GROOM comes first everywhere both names appear.
  { key: 'groom', path: 'couple.groom', type: 'localized-text', group: 'couple', labelKey: 'fld_groom' },
  { key: 'bride', path: 'couple.bride', type: 'localized-text', group: 'couple', labelKey: 'fld_bride' },
  { key: 'groomFull', path: 'couple.groomFull', type: 'localized-text', group: 'couple', labelKey: 'fld_name' },
  { key: 'brideFull', path: 'couple.brideFull', type: 'localized-text', group: 'couple', labelKey: 'fld_name' },

  // A second bride and groom — two couples married the same evening. With
  // these empty nothing on the page changes: no cluster, no separator, no
  // class on <html>.
  { key: 'groom2', path: 'couple.groom2', type: 'localized-text', group: 'couple2', labelKey: 'fld_groom' },
  { key: 'bride2', path: 'couple.bride2', type: 'localized-text', group: 'couple2', labelKey: 'fld_bride' },
  { key: 'groomFull2', path: 'couple.groomFull2', type: 'localized-text', group: 'couple2', labelKey: 'fld_name' },
  { key: 'brideFull2', path: 'couple.brideFull2', type: 'localized-text', group: 'couple2', labelKey: 'fld_name' },

  // THE FIRST `datetime` FIELD IS THE EVENT DATE, by convention: the dashboard
  // reads it for the date line and the "days left" counter. Everything on the
  // page that says when — the cover, the display date, the four weekday
  // readings, the countdown and the ceremony's own row — is derived from it.
  { key: 'date', path: 'event.dateISO', type: 'datetime', group: 'datetime', labelKey: 'fld_datetime' },

  { key: 'kicker', path: 'invite.kicker', type: 'localized-text', group: 'invite', labelKey: 'fld_kicker' },
  { key: 'amp', path: 'invite.amp', type: 'localized-text', group: 'invite', labelKey: 'fld_together' },
  { key: 'lede', path: 'invite.lede', type: 'localized-textarea', group: 'invite', labelKey: 'fld_invite_text' },

  { key: 'storyTitle', path: 'story.title', type: 'localized-text', group: 'story', labelKey: 'fld_title' },
  { key: 'storyBody', path: 'story.body', type: 'localized-textarea', group: 'story', labelKey: 'fld_text' },
  { key: 'storyQuote', path: 'story.quote', type: 'localized-textarea', group: 'story', labelKey: 'fld_quote' },
  // The altitudes in the margins. They are metadata, not scenery: a reader
  // who knows the mountains reads them, and a couple marrying somewhere else
  // clears them and the margin goes quiet.
  { key: 'storyAlt', path: 'story.altitude', type: 'localized-text', group: 'story', labelKey: 'fld_label' },
  { key: 'eveningTitle', path: 'evening.title', type: 'localized-text', group: 'story', labelKey: 'fld_sub' },

  { key: 'schedule', path: 'schedule', type: 'schedule', group: 'schedule', labelKey: 'tg_schedule' },

  { key: 'venueName', path: 'venue.name', type: 'localized-text', group: 'venue', labelKey: 'fld_venue_name' },
  { key: 'venueAddress', path: 'venue.address', type: 'localized-textarea', group: 'venue', labelKey: 'fld_address' },
  { key: 'venueTown', path: 'venue.town', type: 'localized-text', group: 'venue', labelKey: 'fld_city' },
  { key: 'venueRegion', path: 'venue.region', type: 'localized-text', group: 'venue', labelKey: 'fld_region' },
  { key: 'venueCountry', path: 'venue.country', type: 'localized-text', group: 'venue', labelKey: 'fld_label' },
  { key: 'venueAltitude', path: 'venue.altitude', type: 'localized-text', group: 'venue', labelKey: 'fld_sub' },
  { key: 'venueMap', path: 'venue.mapUrl', type: 'text', group: 'venue', labelKey: 'fld_map_url' },
  // The one replaceable plate. Declared as an `image` field because that is
  // what gets an uploaded `/uploads/...` path absolutized against the API
  // origin — the template runs on an opaque origin, where a relative URL
  // resolves to nothing at all.
  { key: 'venueImage', path: 'venue.image', type: 'image', group: 'venue', labelKey: 'fld_photo' },

  { key: 'cerLede', path: 'ceremony.lede', type: 'localized-textarea', group: 'ceremony', labelKey: 'fld_invite_text' },
  { key: 'cerWeather', path: 'ceremony.weather', type: 'localized-textarea', group: 'ceremony', labelKey: 'fld_text' },

  { key: 'dress', path: 'dress.title', type: 'localized-text', group: 'details', labelKey: 'fld_dress_title' },
  { key: 'travel', path: 'travel.title', type: 'localized-text', group: 'details', labelKey: 'fld_travel' },
  { key: 'stay', path: 'stay.title', type: 'localized-text', group: 'details', labelKey: 'fld_stay' },

  { key: 'celTitle', path: 'celebration.title', type: 'localized-text', group: 'celebration', labelKey: 'fld_title' },
  { key: 'celBody', path: 'celebration.body', type: 'localized-textarea', group: 'celebration', labelKey: 'fld_text' },
  { key: 'celAlt', path: 'celebration.altitude', type: 'localized-text', group: 'celebration', labelKey: 'fld_label' },

  { key: 'rsvpLede', path: 'rsvp.lede', type: 'localized-textarea', group: 'rsvp', labelKey: 'fld_rsvp_lede' },
  { key: 'rsvpBy', path: 'rsvp.by', type: 'localized-text', group: 'rsvp', labelKey: 'fld_reply_by' },

  { key: 'finaleTitle', path: 'finale.title', type: 'localized-text', group: 'finale', labelKey: 'fld_title' },
  { key: 'finaleMsg', path: 'finale.message', type: 'localized-textarea', group: 'finale', labelKey: 'fld_final' },
  { key: 'finaleAlt', path: 'finale.altitude', type: 'localized-text', group: 'finale', labelKey: 'fld_label' },

  { key: 'music', path: 'music.url', type: 'audio', group: 'music', labelKey: 'tg_music' },

  // Every switchable block. The value is the HIDDEN flag, so an untouched
  // config shows everything.
  { key: 'v_story', path: 'hidden.story', type: 'toggle', group: 'visibility', labelKey: 'sec_story' },
  { key: 'v_details', path: 'hidden.details', type: 'toggle', group: 'visibility', labelKey: 'sec_details' },
  { key: 'v_countdown', path: 'hidden.countdown', type: 'toggle', group: 'visibility', labelKey: 'sec_countdown' },
  { key: 'v_place', path: 'hidden.place', type: 'toggle', group: 'visibility', labelKey: 'sec_venue' },
  { key: 'v_ceremony', path: 'hidden.ceremony', type: 'toggle', group: 'visibility', labelKey: 'sec_ceremony' },
  { key: 'v_evening', path: 'hidden.evening', type: 'toggle', group: 'visibility', labelKey: 'sec_evening' },
  { key: 'v_celebration', path: 'hidden.celebration', type: 'toggle', group: 'visibility', labelKey: 'sec_celebration' },
  { key: 'v_rsvp', path: 'hidden.rsvp', type: 'toggle', group: 'visibility', labelKey: 'sec_rsvp' },
  { key: 'v_music', path: 'hidden.music', type: 'toggle', group: 'visibility', labelKey: 'sec_music' },
];

// Declared without a type annotation on purpose: `scripts/smoke-template.cjs`
// finds this object by matching `const defaultConfig =` and brace-balancing it,
// and a third declaration shape is a design it would render with NO config at
// all — every binding empty, and the run still green.
const defaultConfig = {
  couple: {
    groom: { en: 'Lukas', ru: 'Лукас', uz: 'Lukas' },
    bride: { en: 'Anna', ru: 'Анна', uz: 'Anna' },
    groomFull: { en: 'Lukas Brunner', ru: 'Лукас Бруннер', uz: 'Lukas Brunner' },
    brideFull: { en: 'Anna Keller', ru: 'Анна Келлер', uz: 'Anna Keller' },
    // A double wedding is entered here; empty means one couple.
    groom2: { en: '', ru: '', uz: '' },
    bride2: { en: '', ru: '', uz: '' },
    groomFull2: { en: '', ru: '', uz: '' },
    brideFull2: { en: '', ru: '', uz: '' },
  },
  // Must stay in the FUTURE: the marketing catalog and the pricing preview
  // both render this config, and a stale date shows a prospective customer a
  // countdown reading 00:00:00:00 under "Today is the day."
  event: { dateISO: '2027-07-17T15:30:00' },
  invite: {
    kicker: {
      en: 'Together with their families',
      ru: 'Вместе со своими семьями',
      uz: 'Oilalari bilan birga',
    },
    // The connector between the two names. Bound rather than literal, so a
    // couple can set "and", "и", "va" — or leave the ampersand.
    amp: { en: '&', ru: '&', uz: '&' },
    lede: {
      en: 'We would love you to join us in the mountains, for one long summer day beneath the Matterhorn.',
      ru: 'Будем счастливы, если вы приедете к нам в горы — на один долгий летний день у подножия Маттерхорна.',
      uz: 'Materhorn etagida bir uzun yoz kunini biz bilan birga togda otkazsangiz, juda xursand bolamiz.',
    },
  },
  story: {
    title: {
      en: 'Up the mountain, together',
      ru: 'В горы — вместе',
      uz: 'Toghga, birga',
    },
    body: {
      en: 'We have walked these meadows every summer since we met. This year we are asking everyone we love to walk them with us.',
      ru: 'Мы ходим по этим лугам каждое лето с тех пор, как познакомились. В этом году мы просим всех, кого любим, пройти по ним вместе с нами.',
      uz: 'Tanishganimizdan buyon har yoz shu yaylovlarda yuramiz. Bu yil esa sevganlarimizning barchasini ozimiz bilan birga yurishga chaqiramiz.',
    },
    quote: {
      en: 'Nothing grand. A path, a meadow, a lake that holds the mountain in it, and the people who matter most.',
      ru: 'Ничего грандиозного. Тропа, луг, озеро, в котором отражается гора, и самые близкие люди.',
      uz: 'Hech qanday dabdaba yoq. Soqmoq, yaylov, togni ozida saqlagan kol va eng yaqin odamlar.',
    },
    altitude: { en: '2’222 m — the high meadow', ru: '2’222 м — высокий луг', uz: '2’222 m — baland yaylov' },
  },
  evening: {
    title: { en: 'And as the light goes', ru: 'А когда уходит свет', uz: 'Yoruglik ketar chogida' },
  },
  schedule: [
    { time: '15:00', mode: 'time', label: { en: 'Guests arrive · chalet terrace', ru: 'Сбор гостей · терраса шале', uz: 'Mehmonlar yigiladi · shale ayvoni' } },
    { time: '15:30', mode: 'time', label: { en: 'Ceremony on the meadow plateau', ru: 'Церемония на горном плато', uz: 'Yaylov maydonida nikoh marosimi' } },
    { time: '16:30', mode: 'time', label: { en: 'Apéro in the meadow', ru: 'Аперитив на лугу', uz: 'Yaylovda aperitiv' } },
    { time: '18:30', mode: 'time', label: { en: 'Dinner on the terrace', ru: 'Ужин на террасе', uz: 'Ayvonda kechki ovqat' } },
    { time: '21:00', mode: 'time', label: { en: 'Music and dancing', ru: 'Музыка и танцы', uz: 'Musiqa va raqslar' } },
    { time: '01:00', mode: 'time', label: { en: 'The last cable car down', ru: 'Последний подъёмник вниз', uz: 'Pastga tushadigan oxirgi arqonli yol' } },
  ] as { time: string; mode: string; label: Record<string, string> }[],
  venue: {
    name: { en: 'Chalet Riedweg', ru: 'Шале Ридвег', uz: 'Shale Riedveg' },
    address: {
      en: 'Riedweg 14, 3920 Zermatt, Valais — reached on foot from the Sunnegga lift.',
      ru: 'Riedweg 14, 3920 Zermatt, Valais — пешком от подъёмника Sunnegga.',
      uz: 'Riedweg 14, 3920 Zermatt, Valais — Sunnegga arqonli yolidan piyoda.',
    },
    town: { en: 'Zermatt', ru: 'Церматт', uz: 'Zermatt' },
    region: { en: 'Valais', ru: 'Вале', uz: 'Valais' },
    country: { en: 'Schweiz', ru: 'Schweiz', uz: 'Schweiz' },
    altitude: { en: '1’608 m ü. M.', ru: '1’608 м над уровнем моря', uz: '1’608 m dengiz sathidan' },
    mapUrl: '',
    // Empty on purpose: the bundled chalet stands until a couple uploads their
    // own venue, so nothing already published changes on the deploy.
    image: '',
  },
  ceremony: {
    lede: {
      en: 'Vows in the open air, on the grass beside the chalet, at the hour the light is kindest.',
      ru: 'Клятвы под открытым небом, на траве у шале, в тот час, когда свет самый мягкий.',
      uz: 'Ochiq havoda, shale yonidagi maysada, yoruglik eng muloyim bolgan paytda aytilgan ahdlar.',
    },
    weather: {
      en: 'Mountain weather changes fast. Bring a warm layer; blankets will be on the benches.',
      ru: 'Погода в горах меняется быстро. Возьмите что-нибудь тёплое — пледы будут на скамьях.',
      uz: 'Togda ob-havo tez ozgaradi. Issiq kiyim oling — skameykalarda adyollar boladi.',
    },
  },
  dress: {
    title: {
      en: 'Black tie, alpine — flat or block heels for the grass',
      ru: 'Black tie по-альпийски — устойчивый каблук для травы',
      uz: 'Alp uslubidagi black tie — maysa uchun tekis poyabzal',
    },
  },
  travel: {
    title: {
      en: 'Train to Zermatt, then the Sunnegga lift — the village itself is car-free',
      ru: 'Поездом до Церматта, затем подъёмник Sunnegga — в деревне нет машин',
      uz: 'Poyezdda Zermattgacha, sungra Sunnegga arqonli yoli — qishloqda avtomobil yoq',
    },
  },
  stay: {
    title: {
      en: 'We have held rooms in the village; ask us and we will send the list',
      ru: 'Мы забронировали номера в деревне — напишите, и мы пришлём список',
      uz: 'Qishloqda xonalar band qildik — yozsangiz, royxatni yuboramiz',
    },
  },
  celebration: {
    title: {
      en: 'One long table, then dancing',
      ru: 'Один длинный стол, потом танцы',
      uz: 'Bitta uzun dasturxon, sungra raqslar',
    },
    body: {
      en: 'Dinner on the terrace from half past six, with wool blankets on the benches and candles down the table. When it gets cold, the party moves inside.',
      ru: 'Ужин на террасе с половины седьмого: шерстяные пледы на скамьях и свечи по всему столу. Когда станет холодно, праздник переедет внутрь.',
      uz: 'Olti yarimdan ayvonda kechki ovqat: skameykalarda jun adyollar, dasturxon boylab shamlar. Sovuq tusha boshlaganda bayram ichkariga kochadi.',
    },
    altitude: { en: '2’222 m — the chalet', ru: '2’222 м — шале', uz: '2’222 m — shale' },
  },
  rsvp: {
    lede: {
      en: 'Please let us know whether you can join us. If you are travelling with children, tell us here and we will plan for them.',
      ru: 'Пожалуйста, сообщите, сможете ли вы приехать. Если вы с детьми — напишите, и мы всё учтём.',
      uz: 'Kela olasizmi — bizga xabar bering. Bolalar bilan kelsangiz, shu yerda yozib qoldiring, hammasini hisobga olamiz.',
    },
    by: { en: 'Kindly reply by 1 May', ru: 'Просим ответить до 1 мая', uz: '1-may gacha javob bersangiz' },
  },
  finale: {
    title: {
      en: 'See you in the mountains',
      ru: 'До встречи в горах',
      uz: 'Toglarda korishguncha',
    },
    message: {
      en: 'Thank you for being part of our story. We cannot wait to share this day with you.',
      ru: 'Спасибо, что вы часть нашей истории. Нам очень хочется разделить этот день с вами.',
      uz: 'Hikoyamizning bir qismi bolganingiz uchun rahmat. Bu kunni siz bilan birga otkazishni juda istaymiz.',
    },
    altitude: { en: '4’478 m — Matterhorn', ru: '4’478 м — Маттерхорн', uz: '4’478 m — Materhorn' },
  },
  music: { url: '' },
  // Sections switched off in the builder (all visible by default).
  hidden: {} as Record<string, boolean>,
};

export const weddingZermattTemplate: TemplateDefinition = {
  id: 'wedding-zermatt',
  category: 'wedding',
  nameKey: 'tpl_wedding_zermatt',
  cover: '🏔',
  accent: '#1F3328',
  html,
  defaultConfig,
  fields,
  groups,
  Renderer: RichRenderer,
  // These must match the real element ids in template.html — the Design+
  // runtime anchors by getElementById and silently skips a section it cannot
  // find.
  sectionIds: ['hero', 'announce', 'story', 'details', 'countdown', 'place', 'ceremony', 'celebration', 'rsvp', 'finale'],
  // The champagne only. The forest, the slate and the stone are the alps drawn
  // through the design — a picked accent in their place would take the
  // mountains with it.
  accentVars: ['--champagne'],
};
