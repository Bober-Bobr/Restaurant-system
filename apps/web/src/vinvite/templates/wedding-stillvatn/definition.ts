import html from './template.html?raw';
import { RichRenderer } from '../RichRenderer';
import type { TemplateDefinition, TemplateField, TemplateFieldGroup } from '../types';

// ── "Stillvatn" — a quiet wedding by the water ──────────────────────────────
// The calmest thing in the catalog, and the only one that is not built around a
// film: it opens on a photograph of dew and pushes slowly into it, so nothing
// is waiting on a download.
//
// The design is a WALK. Eleven full-bleed scenes — the lake, the forest, the
// meadow, the river, the waterfall, the rain, the ceremony, the table, the
// rings, the valley, the sunset — alternate with narrow pages of prose. That
// length is the point; this is meant to be scrolled slowly.
//
// Two mechanics belong to this template alone:
//
//  · GROWING STEMS. Small plants draw themselves beside the opening words as
//    they come into view, stroke by stroke.
//  · THE FOLDED CARD. The date is a piece of paper with a deckle edge whose
//    top leaf falls open, revealing the day, the month and the year — all
//    three still read from the event date.
//
// The air carries three different things — pollen, petals and dandelion seeds,
// each drifting at its own speed — and scrolling stirs them like wind.
//
// Artwork is part of the design rather than a set of slots: it ships bundled in
// apps/web/public/stillvatn/ and is addressed through `window.__ORIGIN__`.
// There is no gallery field; the walk is the gallery.
//
// Defaults are written in English first, with ru and uz filled so the language
// bar works out of the box. uz avoids apostrophes, per the repo convention.

const groups: TemplateFieldGroup[] = [
  { key: 'couple', labelKey: 'tg_couple', icon: '💍', section: 'hero' },
  { key: 'invite', labelKey: 'tg_invite', icon: '✉️', section: 'invite' },
  { key: 'datetime', labelKey: 'tg_datetime', icon: '🗓', section: 'date' },
  { key: 'venue', labelKey: 'tg_venue', icon: '📍', section: 'details' },
  { key: 'story', labelKey: 'tg_story', icon: '💞', section: 'story' },
  { key: 'day', labelKey: 'sec_theday', icon: '🌤', section: 'theday' },
  { key: 'ridge', labelKey: 'sec_ridge', icon: '⛰', section: 'ridge' },
  { key: 'scenes', labelKey: 'sec_walk', icon: '🥾', section: 'meadow' },
  { key: 'details', labelKey: 'tg_details', icon: '📋', section: 'details' },
  { key: 'finale', labelKey: 'sec_final', icon: '🥂', section: 'final' },
  { key: 'music', labelKey: 'tg_music', icon: '🎵' },
  { key: 'visibility', labelKey: 'tg_visibility', icon: '👁' },
];

const fields: TemplateField[] = [
  { key: 'bride', path: 'couple.bride', type: 'localized-text', group: 'couple', labelKey: 'fld_bride' },
  { key: 'groom', path: 'couple.groom', type: 'localized-text', group: 'couple', labelKey: 'fld_groom' },
  // The word between the names, set in the handwriting face.
  { key: 'amp', path: 'invite.amp', type: 'localized-text', group: 'couple', labelKey: 'fld_label' },

  // Left empty by default: the opening then prints the formatted event date,
  // which cannot go stale when the date is changed.
  { key: 'meta', path: 'invite.meta', type: 'localized-text', group: 'invite', labelKey: 'fld_time_text' },
  { key: 'lede', path: 'invite.lede', type: 'localized-textarea', group: 'invite', labelKey: 'fld_invite_text' },

  // Convention: the first datetime field is the event date. Everything dated on
  // the page comes from it — the opening line, the first words, the card's
  // three lines, the details row and the footer.
  { key: 'dateISO', path: 'event.dateISO', type: 'datetime', group: 'datetime', labelKey: 'fld_datetime' },
  { key: 'cardTitle', path: 'card.title', type: 'localized-text', group: 'datetime', labelKey: 'fld_sub' },
  { key: 'cardNote', path: 'card.note', type: 'localized-text', group: 'datetime', labelKey: 'fld_time_note' },

  { key: 'venueName', path: 'venue.name', type: 'localized-text', group: 'venue', labelKey: 'fld_venue_name' },

  // The three quiet pages. Each has a handwritten line above its heading; a
  // page with neither heading nor prose removes itself.
  { key: 'storyHand', path: 'story.hand', type: 'localized-text', group: 'story', labelKey: 'fld_kicker' },
  { key: 'storyTitle', path: 'story.title', type: 'localized-text', group: 'story', labelKey: 'fld_sub' },
  { key: 'storyOne', path: 'story.one', type: 'localized-textarea', group: 'story', labelKey: 'fld_text' },
  { key: 'storyTwo', path: 'story.two', type: 'localized-textarea', group: 'story', labelKey: 'fld_desc' },

  { key: 'dayHand', path: 'day.hand', type: 'localized-text', group: 'day', labelKey: 'fld_kicker' },
  { key: 'dayTitle', path: 'day.title', type: 'localized-text', group: 'day', labelKey: 'fld_sub' },
  { key: 'dayOne', path: 'day.one', type: 'localized-textarea', group: 'day', labelKey: 'fld_text' },
  { key: 'dayTwo', path: 'day.two', type: 'localized-textarea', group: 'day', labelKey: 'fld_desc' },

  { key: 'ridgeHand', path: 'ridge.hand', type: 'localized-text', group: 'ridge', labelKey: 'fld_kicker' },
  { key: 'ridgeTitle', path: 'ridge.title', type: 'localized-text', group: 'ridge', labelKey: 'fld_sub' },
  { key: 'ridgeText', path: 'ridge.text', type: 'localized-textarea', group: 'ridge', labelKey: 'fld_text' },

  // One line drifting over each scene of the walk, in page order. A blank line
  // leaves the photograph to speak for itself.
  { key: 'sLake', path: 'scenes.lake', type: 'localized-text', group: 'scenes', labelKey: 'fld_caption' },
  { key: 'sForest', path: 'scenes.forest', type: 'localized-text', group: 'scenes', labelKey: 'fld_caption' },
  { key: 'sMeadow', path: 'scenes.meadow', type: 'localized-text', group: 'scenes', labelKey: 'fld_caption' },
  { key: 'sRiver', path: 'scenes.river', type: 'localized-text', group: 'scenes', labelKey: 'fld_caption' },
  { key: 'sWaterfall', path: 'scenes.waterfall', type: 'localized-text', group: 'scenes', labelKey: 'fld_caption' },
  { key: 'sRain', path: 'scenes.rain', type: 'localized-text', group: 'scenes', labelKey: 'fld_caption' },
  { key: 'sCeremony', path: 'scenes.ceremony', type: 'localized-text', group: 'scenes', labelKey: 'fld_caption' },
  { key: 'sTable', path: 'scenes.table', type: 'localized-text', group: 'scenes', labelKey: 'fld_caption' },
  { key: 'sRings', path: 'scenes.rings', type: 'localized-text', group: 'scenes', labelKey: 'fld_caption' },
  { key: 'sValley', path: 'scenes.valley', type: 'localized-text', group: 'scenes', labelKey: 'fld_caption' },
  { key: 'sSunset', path: 'scenes.sunset', type: 'localized-text', group: 'scenes', labelKey: 'fld_caption' },

  { key: 'whenNote', path: 'details.whenNote', type: 'localized-text', group: 'details', labelKey: 'fld_time_note' },
  { key: 'where', path: 'details.where', type: 'localized-text', group: 'details', labelKey: 'fld_venue_name' },
  { key: 'whereNote', path: 'details.whereNote', type: 'localized-text', group: 'details', labelKey: 'fld_travel_note' },
  { key: 'detCeremony', path: 'details.ceremony', type: 'localized-text', group: 'details', labelKey: 'fld_label' },
  { key: 'detCeremonyNote', path: 'details.ceremonyNote', type: 'localized-text', group: 'details', labelKey: 'fld_desc' },
  { key: 'after', path: 'details.after', type: 'localized-text', group: 'details', labelKey: 'fld_label' },
  { key: 'afterNote', path: 'details.afterNote', type: 'localized-text', group: 'details', labelKey: 'fld_desc' },
  { key: 'wear', path: 'wear.title', type: 'localized-text', group: 'details', labelKey: 'fld_dress_title' },
  { key: 'wearNote', path: 'wear.note', type: 'localized-text', group: 'details', labelKey: 'fld_dress_note' },
  { key: 'stay', path: 'stay.title', type: 'localized-text', group: 'details', labelKey: 'fld_stay' },
  { key: 'stayNote', path: 'stay.note', type: 'localized-text', group: 'details', labelKey: 'fld_stay_note' },
  { key: 'rsvpLede', path: 'rsvp.lede', type: 'localized-text', group: 'details', labelKey: 'fld_rsvp_lede' },

  { key: 'finaleTitle', path: 'finale.title', type: 'localized-text', group: 'finale', labelKey: 'fld_sub' },
  { key: 'finaleMsg', path: 'finale.message', type: 'localized-textarea', group: 'finale', labelKey: 'fld_final' },
  { key: 'finaleSign', path: 'finale.sign', type: 'localized-text', group: 'finale', labelKey: 'fld_label' },

  { key: 'music', path: 'music.url', type: 'audio', group: 'music', labelKey: 'tg_music' },

  // Block visibility: hidden.<key> === true switches the section off.
  { key: 'v_walk', path: 'hidden.walk', type: 'toggle', group: 'visibility', labelKey: 'sec_walk' },
  { key: 'v_story', path: 'hidden.story', type: 'toggle', group: 'visibility', labelKey: 'sec_story' },
  { key: 'v_theday', path: 'hidden.theday', type: 'toggle', group: 'visibility', labelKey: 'sec_theday' },
  { key: 'v_ridge', path: 'hidden.ridge', type: 'toggle', group: 'visibility', labelKey: 'sec_ridge' },
  { key: 'v_date', path: 'hidden.date', type: 'toggle', group: 'visibility', labelKey: 'sec_calendar' },
  { key: 'v_details', path: 'hidden.details', type: 'toggle', group: 'visibility', labelKey: 'sec_details' },
  { key: 'v_rsvp', path: 'hidden.rsvp', type: 'toggle', group: 'visibility', labelKey: 'sec_rsvp' },
  { key: 'v_music', path: 'hidden.music', type: 'toggle', group: 'visibility', labelKey: 'sec_music' },
];

const defaultConfig = {
  couple: {
    bride: { en: 'Elin', ru: 'Элин', uz: 'Elin' },
    groom: { en: 'Mattis', ru: 'Маттис', uz: 'Mattis' },
  },
  invite: {
    amp: { en: 'and', ru: 'и', uz: 'va' },
    // Empty on purpose — see the field comment above.
    meta: { en: '', ru: '', uz: '' },
    lede: {
      en: 'We are getting married by the water, early, while it is still quiet.',
      ru: 'Мы женимся у воды, рано утром, пока ещё тихо.',
      uz: 'Biz suv boyida, tong sahar, hali jimjitlik chogida turmush quramiz.',
    },
  },
  event: {
    dateISO: '2026-06-06T10:00:00',
  },
  card: {
    title: {
      en: 'One Saturday, at the beginning of summer',
      ru: 'Одна суббота в начале лета',
      uz: 'Yoz boshidagi bir shanba',
    },
    note: {
      en: 'Gathering at nine. Vows at ten, by the lake.',
      ru: 'Собираемся в девять. Клятвы в десять, у озера.',
      uz: 'Toqqizda yigilamiz. Ont soat ontda, kol boyida.',
    },
  },
  venue: {
    name: { en: 'Stillvatn', ru: 'Стиллватн', uz: 'Stillvatn' },
  },
  story: {
    hand: { en: 'how it started', ru: 'как всё началось', uz: 'qanday boshlangan' },
    title: { en: 'Nine summers of walking', ru: 'Девять лет прогулок', uz: 'Toqqiz yozlik sayr' },
    one: {
      en: 'We met on a trail neither of us meant to be on, both of us lost, both pretending not to be. It took four hours to admit it and another two to find the road.',
      ru: 'Мы встретились на тропе, на которую ни один из нас не собирался: оба заблудились и оба делали вид, что нет. Признать это заняло четыре часа, найти дорогу — ещё два.',
      uz: 'Ikkalamiz ham bormoqchi bolmagan soqmoqda uchrashdik: ikkimiz ham adashgan, ikkimiz ham adashmagandek korinardik. Buni tan olishga tort soat, yolni topishga yana ikki soat ketdi.',
    },
    two: {
      en: 'We have been walking ever since — badly prepared, mostly happy, always slightly late.',
      ru: 'С тех пор мы всё идём — плохо подготовленные, в основном счастливые и всегда немного опаздывающие.',
      uz: 'Oshandan beri yurib kelamiz: tayyorgarligimiz yomon, korinishimiz baxtli va doim bir oz kechikamiz.',
    },
  },
  day: {
    hand: { en: 'the day itself', ru: 'сам день', uz: 'kunning ozi' },
    title: { en: 'Small, outdoors, and early', ru: 'Скромно, на воздухе и рано', uz: 'Kichik, ochiq havoda va erta' },
    one: {
      en: 'Thirty of you, wooden chairs on grass, and an arch we are making ourselves out of whatever is flowering that week.',
      ru: 'Тридцать человек, деревянные стулья на траве и арка, которую мы соберём сами из того, что будет цвести на той неделе.',
      uz: 'Ottiz kishi, maysadagi yogoch kursilar va osha hafta gullagan narsalardan ozimiz yasaydigan ravoq.',
    },
    two: {
      en: 'If it rains we will simply be wet. Bring boots and a coat you do not mind ruining.',
      ru: 'Если пойдёт дождь, мы просто промокнем. Возьмите сапоги и куртку, которую не жалко.',
      uz: 'Yomgir yogsa, shunchaki hol bolamiz. Etik va achinmaydigan ustki kiyim olib keling.',
    },
  },
  ridge: {
    hand: { en: 'and then', ru: 'а потом', uz: 'va keyin' },
    title: { en: 'We walk up, if the weather holds', ru: 'Мы поднимемся, если погода позволит', uz: 'Ob-havo koitarsa, tepaga chiqamiz' },
    text: {
      en: 'There is a ridge above the lake, an hour on foot. Anyone who wants to come is welcome. Anyone who would rather stay by the water is more sensible.',
      ru: 'Над озером есть гребень, час пешком. Кто захочет — идёмте с нами. Кто предпочтёт остаться у воды, тот разумнее.',
      uz: 'Kol ustida chokki bor, piyoda bir soat. Xohlagan bemalol qoshilsin. Suv boyida qolishni afzal korgan esa aqlliroq ish qiladi.',
    },
  },
  // One line drifting over each scene of the walk, in page order.
  scenes: {
    lake: { en: 'The water does not move at this hour.', ru: 'В этот час вода не движется.', uz: 'Bu payt suv qimirlamaydi.' },
    forest: { en: 'Under the trees, everything slows down.', ru: 'Под деревьями всё замедляется.', uz: 'Daraxtlar ostida hammasi sekinlashadi.' },
    meadow: { en: 'Two people, and a great deal of sky.', ru: 'Двое — и очень много неба.', uz: 'Ikki kishi va juda kop osmon.' },
    river: { en: 'We will sit for a while before anything begins.', ru: 'Мы посидим немного, прежде чем что-то начнётся.', uz: 'Hammasi boshlanguncha biroz otiramiz.' },
    waterfall: { en: 'There is a small waterfall, if you walk far enough.', ru: 'Если пройти подальше, будет маленький водопад.', uz: 'Uzoqroq yursangiz, kichik sharshara bor.' },
    rain: { en: 'And if it rains, it will smell like this.', ru: 'А если пойдёт дождь, пахнуть будет вот так.', uz: 'Yomgir yogsa, hidi mana shunday boladi.' },
    ceremony: { en: 'Thirty chairs, under the old trees.', ru: 'Тридцать стульев под старыми деревьями.', uz: 'Keksa daraxtlar ostida ottizta kursi.' },
    table: { en: 'One table, and as long as we like.', ru: 'Один стол — и столько времени, сколько захотим.', uz: 'Bitta dasturxon va xohlaganimizcha vaqt.' },
    rings: { en: 'Two rings, and no ceremony to speak of.', ru: 'Два кольца и почти никакой церемонии.', uz: 'Ikkita uzuk va deyarli hech qanday tantana.' },
    valley: { en: 'From the ridge you can see the whole valley.', ru: 'С гребня видно всю долину.', uz: 'Chokkidan butun vodiy koinadi.' },
    sunset: { en: 'And later, when the light goes gold.', ru: 'А позже, когда свет становится золотым.', uz: 'Keyinroq esa, yoruglik oltin tusga kirganda.' },
  },
  details: {
    whenNote: {
      en: 'Coffee from nine. Vows at ten, while the mist is still on the water.',
      ru: 'Кофе с девяти. Клятвы в десять, пока над водой ещё туман.',
      uz: 'Toqqizdan qahva. Ont soat ontda, suv uzra tuman turganda.',
    },
    where: { en: 'Stillvatn, by the lower lake', ru: 'Стиллватн, у нижнего озера', uz: 'Stillvatn, quyi kol boyida' },
    whereNote: {
      en: 'Two hours north, then a gravel track for the last kilometre. We will mark the turning.',
      ru: 'Два часа на север, последний километр — по гравийной дороге. Поворот мы отметим.',
      uz: 'Shimolga ikki soat, songgi kilometr shagal yol. Burilishni belgilab qoyamiz.',
    },
    ceremony: { en: 'Outdoors, on grass', ru: 'На улице, на траве', uz: 'Ochiq havoda, maysada' },
    ceremonyNote: {
      en: 'Under the trees at the water’s edge. Wooden chairs, no aisle to speak of.',
      ru: 'Под деревьями у самой воды. Деревянные стулья, прохода как такового нет.',
      uz: 'Suv boyidagi daraxtlar ostida. Yogoch kursilar, alohida yolak yoq.',
    },
    after: { en: 'A long lunch by the water', ru: 'Долгий обед у воды', uz: 'Suv boyida uzoq tushlik' },
    afterNote: {
      en: 'One table, everything shared, no speeches unless someone insists. Until the light goes.',
      ru: 'Один стол, всё общее, речей не будет — если только кто-нибудь не настоит. До заката.',
      uz: 'Bitta dasturxon, hammasi umumiy, kimdir qattiq turib olmasa nutqlar yoq. Kun botguncha.',
    },
  },
  wear: {
    title: { en: 'Whatever you can walk in', ru: 'То, в чём удобно идти', uz: 'Yurish qulay bolgan narsa' },
    note: {
      en: 'Soft colours if you like. Flat shoes genuinely matter — the ground is uneven and often damp.',
      ru: 'Если хотите — мягкие тона. Плоская обувь действительно важна: земля неровная и часто влажная.',
      uz: 'Xohlasangiz, mayin ranglar. Tekis poyabzal chindan muhim: yer notekis va kop hollarda nam.',
    },
  },
  stay: {
    title: { en: 'Cabins and a field for tents', ru: 'Домики и поле для палаток', uz: 'Uychalar va chodirlar uchun maydon' },
    note: {
      en: 'Eight cabins, first come. Camping is free and the swimming is better than you expect.',
      ru: 'Восемь домиков, кто первый. Кемпинг бесплатный, а купаться лучше, чем вы думаете.',
      uz: 'Sakkizta uycha, kim oldin kelsa. Chodir tekin, suzish esa kutganingizdan yaxshiroq.',
    },
  },
  rsvp: {
    lede: {
      en: 'Whenever you can, before the first of April.',
      ru: 'Когда сможете — до первого апреля.',
      uz: 'Qachon ulgursangiz, birinchi aprelgacha.',
    },
  },
  finale: {
    title: { en: 'Come and be quiet with us', ru: 'Приезжайте помолчать с нами', uz: 'Keling va biz bilan jim boling' },
    message: {
      en: 'Two people, one journey, one peaceful beginning.',
      ru: 'Двое, одна дорога, одно спокойное начало.',
      uz: 'Ikki kishi, bitta yol, bitta tinch boshlanish.',
    },
    sign: { en: 'with love, Elin & Mattis', ru: 'с любовью, Элин и Маттис', uz: 'mehr bilan, Elin va Mattis' },
  },
  music: { url: '' },
  // Sections switched off in the builder (all visible by default).
  hidden: {} as Record<string, boolean>,
};

export const weddingStillvatnTemplate: TemplateDefinition = {
  id: 'wedding-stillvatn',
  category: 'wedding',
  nameKey: 'tpl_wedding_stillvatn',
  cover: '🌾',
  accent: '#6B7A63',
  html,
  defaultConfig,
  fields,
  groups,
  Renderer: RichRenderer,
  // These must match the real element ids in template.html — the Design+ runtime
  // anchors by getElementById and silently skips a section it cannot find.
  // `meadow` is a scene rather than a block, but it anchors the walk.
  sectionIds: ['hero', 'invite', 'story', 'meadow', 'theday', 'date', 'details', 'ridge', 'final'],
  // The sage greens. The gold is a single warm note in the pollen and the
  // paper, and recolouring it with a picked accent would not read as a change.
  accentVars: ['--sage', '--sage-deep', '--olive'],
};
