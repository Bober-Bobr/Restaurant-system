import html from './template.html?raw';
import { RichRenderer } from '../RichRenderer';
import type { TemplateDefinition, TemplateField, TemplateFieldGroup } from '../types';

// ── "La Dolce Vita" — a wedding on the Amalfi Coast, set as a magazine ──────
// The fourth design built around a film, and the first that is not shaped like
// an invitation at all: it is shaped like an ISSUE. A masthead over the opening
// shot, a contents list behind the running header, six numbered chapters, a
// picture credit under every plate, the day set as letterpress numerals, the
// particulars as an index with dotted leaders, and a reply COUPON that unfolds
// out of the page rather than a dialog that covers it.
//
// Two consequences of that frame worth knowing before editing it:
//
// · The chapter TITLES are Italian in all three languages, by design. They are
//   the conceit — a magazine called La Dolce Vita whose contents page reads
//   "The destination" is a different magazine — so what translates is the
//   editorial furniture around them: the chapter eyebrow, the contents list's
//   right-hand column, the picture credits and every control.
// · There is no countdown block. This design's answer to "when" is Chapter IV,
//   which sets the day as a letterpress card; a ticking clock beside it would
//   be two devices doing one job, and the quieter one would lose.
//
// The artwork — the terrace, the villa, the east door, the cliff, the lane, the
// balustrade, the hands, the aisle, the table, the roses, the sunset, the dusk
// and the evening — is part of the design rather than a set of slots, so it
// ships bundled in apps/web/public/dolcevita/ and is addressed through
// `window.__ORIGIN__`.
//
// The ONE exception is the journal. Its eight plates are placeholders: they
// keep the strip from standing empty on a fresh invitation, and the moment the
// honoree uploads a photo of their own, theirs replace all of them.
//
// Defaults are written in English first — the design is an Italian wedding
// reported in English — with ru and uz filled so the language bar works out of
// the box. uz avoids apostrophes, per the repo convention.

const groups: TemplateFieldGroup[] = [
  { key: 'couple', labelKey: 'tg_couple', icon: '💍', section: 'hero' },
  { key: 'couple2', labelKey: 'tg_couple2', icon: '💞', section: 'hero' },
  { key: 'invite', labelKey: 'tg_invite', icon: '✉️', section: 'invite' },
  { key: 'datetime', labelKey: 'tg_datetime', icon: '🗓', section: 'calendar' },
  { key: 'venue', labelKey: 'tg_venue', icon: '📍', section: 'details' },
  { key: 'story', labelKey: 'tg_story', icon: '💞', section: 'story' },
  { key: 'ceremony', labelKey: 'sec_ceremony', icon: '🌿', section: 'ceremony' },
  { key: 'details', labelKey: 'tg_details', icon: '📋', section: 'details' },
  { key: 'schedule', labelKey: 'tg_schedule', icon: '🕰', section: 'program' },
  { key: 'gallery', labelKey: 'tg_gallery', icon: '📷', section: 'gallery' },
  { key: 'finale', labelKey: 'sec_final', icon: '🥂', section: 'finale' },
  { key: 'music', labelKey: 'tg_music', icon: '🎵' },
  { key: 'visibility', labelKey: 'tg_visibility', icon: '👁' },
];

const fields: TemplateField[] = [
  // The short names carry the cover, where they land letter by letter; the full
  // names sign the invitation in Chapter I. Blank full names fall back to the
  // short ones rather than leaving the invitation unsigned.
  { key: 'groom', path: 'couple.groom', type: 'localized-text', group: 'couple', labelKey: 'fld_groom' },
  { key: 'bride', path: 'couple.bride', type: 'localized-text', group: 'couple', labelKey: 'fld_bride' },
  { key: 'groomFull', path: 'couple.groomFull', type: 'localized-text', group: 'couple', labelKey: 'fld_name' },
  { key: 'brideFull', path: 'couple.brideFull', type: 'localized-text', group: 'couple', labelKey: 'fld_name' },
  // The word between the two names on the cover. Blank falls back to the
  // chrome's own "and".
  { key: 'amp', path: 'invite.amp', type: 'localized-text', group: 'couple', labelKey: 'fld_label' },

  // A DOUBLE WEDDING — two couples married in one evening. All four optional,
  // and asked for groom first, in the order the cover prints them.
  { key: 'groom2', path: 'couple.groom2', type: 'localized-text', group: 'couple2', labelKey: 'fld_groom' },
  { key: 'bride2', path: 'couple.bride2', type: 'localized-text', group: 'couple2', labelKey: 'fld_bride' },
  { key: 'groomFull2', path: 'couple.groomFull2', type: 'localized-text', group: 'couple2', labelKey: 'fld_name' },
  { key: 'brideFull2', path: 'couple.brideFull2', type: 'localized-text', group: 'couple2', labelKey: 'fld_name' },

  // The cover's two lines. `coverLine` is left empty by default, so the hero
  // prints the town and the formatted date instead — which cannot go stale
  // when the date is changed.
  { key: 'coverLine', path: 'invite.coverLine', type: 'localized-text', group: 'invite', labelKey: 'fld_time_text' },
  { key: 'kicker', path: 'invite.kicker', type: 'localized-text', group: 'invite', labelKey: 'fld_kicker' },
  { key: 'lede', path: 'invite.lede', type: 'localized-textarea', group: 'invite', labelKey: 'fld_invite_text' },
  { key: 'body', path: 'invite.body', type: 'localized-textarea', group: 'invite', labelKey: 'fld_text' },
  { key: 'arrivalCaption', path: 'arrival.caption', type: 'localized-text', group: 'invite', labelKey: 'fld_caption' },

  // Convention: the first datetime field is the event date. Everything dated on
  // the page comes from it — the masthead's issue number, the cover lines, the
  // signature in Chapter I, the letterpress card, the particulars and the
  // colophon.
  { key: 'dateISO', path: 'event.dateISO', type: 'datetime', group: 'datetime', labelKey: 'fld_datetime' },
  { key: 'calNote', path: 'calendar.note', type: 'localized-textarea', group: 'datetime', labelKey: 'fld_time_note' },

  { key: 'venueName', path: 'venue.name', type: 'localized-text', group: 'venue', labelKey: 'fld_venue_name' },
  { key: 'venueTown', path: 'venue.town', type: 'localized-text', group: 'venue', labelKey: 'fld_city' },
  { key: 'venueRegion', path: 'venue.region', type: 'localized-text', group: 'venue', labelKey: 'fld_region' },
  { key: 'venueAddress', path: 'venue.address', type: 'localized-text', group: 'venue', labelKey: 'fld_address' },

  // Chapter II is a pull quote and a short passage — the two of them, in their
  // own words, rather than a three-act story. The design gives the quote the
  // largest italic on the page, so it is the one line most people will read.
  { key: 'storyQuote', path: 'story.quote', type: 'localized-textarea', group: 'story', labelKey: 'fld_quote' },
  { key: 'storyBody', path: 'story.body', type: 'localized-textarea', group: 'story', labelKey: 'fld_text' },

  { key: 'ceremonyCap', path: 'ceremony.caption', type: 'localized-text', group: 'ceremony', labelKey: 'fld_caption' },
  { key: 'ceremonyLede', path: 'ceremony.lede', type: 'localized-textarea', group: 'ceremony', labelKey: 'fld_sub' },
  { key: 'ceremonyBody', path: 'ceremony.body', type: 'localized-textarea', group: 'ceremony', labelKey: 'fld_text' },

  // The particulars index. A row whose VALUE is empty is not printed at all —
  // a labelled empty line is worse than a shorter list — so clearing a field
  // is how a couple drops that row.
  { key: 'dateNote', path: 'details.dateNote', type: 'localized-text', group: 'details', labelKey: 'fld_time_note' },
  { key: 'detCeremonyNote', path: 'details.ceremonyNote', type: 'localized-text', group: 'details', labelKey: 'fld_desc' },
  { key: 'detReception', path: 'details.reception', type: 'localized-text', group: 'details', labelKey: 'fld_label' },
  { key: 'detReceptionNote', path: 'details.receptionNote', type: 'localized-text', group: 'details', labelKey: 'fld_desc' },
  { key: 'dress', path: 'dress.title', type: 'localized-text', group: 'details', labelKey: 'fld_dress_title' },
  { key: 'dressNote', path: 'dress.note', type: 'localized-text', group: 'details', labelKey: 'fld_dress_note' },
  { key: 'travel', path: 'travel.title', type: 'localized-text', group: 'details', labelKey: 'fld_travel' },
  { key: 'travelNote', path: 'travel.note', type: 'localized-text', group: 'details', labelKey: 'fld_travel_note' },
  { key: 'stay', path: 'stay.title', type: 'localized-text', group: 'details', labelKey: 'fld_stay' },
  { key: 'stayNote', path: 'stay.note', type: 'localized-text', group: 'details', labelKey: 'fld_stay_note' },
  { key: 'detailsFoot', path: 'details.foot', type: 'localized-textarea', group: 'details', labelKey: 'fld_desc' },

  { key: 'schedule', path: 'schedule', type: 'schedule', group: 'schedule', labelKey: 'tg_schedule' },

  // Empty by design: the journal falls back to the eight bundled plates, and
  // the first photo added here replaces all of them.
  { key: 'gallery', path: 'gallery', type: 'gallery', group: 'gallery', labelKey: 'tg_gallery' },

  { key: 'finaleTitle', path: 'finale.title', type: 'localized-text', group: 'finale', labelKey: 'fld_sub' },
  { key: 'finaleMsg', path: 'finale.message', type: 'localized-textarea', group: 'finale', labelKey: 'fld_final' },
  { key: 'rsvpLede', path: 'rsvp.lede', type: 'localized-text', group: 'finale', labelKey: 'fld_rsvp_lede' },
  { key: 'couponSub', path: 'rsvp.couponSub', type: 'localized-text', group: 'finale', labelKey: 'fld_desc' },

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
    groom: { en: 'Luca', ru: 'Лука', uz: 'Luka' },
    bride: { en: 'Sofia', ru: 'София', uz: 'Sofiya' },
    groomFull: { en: 'Luca Moretti', ru: 'Лука Моретти', uz: 'Luka Moretti' },
    brideFull: { en: 'Sofia Ricci', ru: 'София Риччи', uz: 'Sofiya Richchi' },
    // Empty by default: a double wedding is the exception, and a sample second
    // pair would have to be deleted by everybody else.
    groom2: {},
    bride2: {},
    groomFull2: {},
    brideFull2: {},
  },
  invite: {
    // The Italian "and", which is half of what this cover is saying.
    amp: { en: 'e', ru: 'e', uz: 'e' },
    // Empty on purpose — see the field comment above.
    coverLine: { en: '', ru: '', uz: '' },
    kicker: {
      en: 'A wedding on the coast',
      ru: 'Свадьба на побережье',
      uz: 'Sohildagi nikoh toyi',
    },
    lede: {
      en: 'High above the Amalfi Coast, a villa that has watched the same sea for four hundred years.',
      // No em dash in this one string, deliberately: the lede is the only
      // shipped copy set in the Didone, and a Bodoni em dash at body size is a
      // hairline that all but disappears against the paper. An honoree who
      // types one gets the design's own dash; nothing ships looking broken.
      ru: 'Высоко над Амальфитанским побережьем стоит вилла, которая смотрит на одно и то же море четыреста лет.',
      uz: 'Amalfi sohilidan baland joyda tort yuz yildan buyon ayni shu dengizga qarab turgan villa.',
    },
    body: {
      en: 'We chose Ravello because it is quiet, and because from the terraces the water looks close enough to touch. The road up is steep and winding; the view at the top is worth every bend.',
      ru: 'Мы выбрали Равелло потому, что там тихо, и потому, что с террас вода кажется такой близкой, что до неё можно дотронуться. Дорога наверх крутая и извилистая; вид стоит каждого поворота.',
      uz: 'Ravelloni tanladik, chunki u yerda jimjit va ayvonlardan suv qol choziq masofada korinadi. Yuqoriga olib chiqadigan yol tik va serqatnov; tepadagi manzara har bir burilishga arziydi.',
    },
  },
  arrival: {
    caption: {
      en: 'The lower terrace, three hundred metres above the water.',
      ru: 'Нижняя терраса, триста метров над водой.',
      uz: 'Pastki ayvon, suv sathidan uch yuz metr baland.',
    },
  },
  event: {
    dateISO: '2027-09-11T17:30:00',
  },
  calendar: {
    note: {
      en: 'Doors from five. Please be seated by quarter past.',
      ru: 'Двери открыты с пяти. Просим занять места к четверти шестого.',
      uz: 'Eshiklar soat beshdan ochiq. Iltimos, besh yarimgacha joylashib olinglar.',
    },
  },
  venue: {
    name: { en: 'Villa Serafina', ru: 'Вилла Серафина', uz: 'Serafina villasi' },
    town: { en: 'Ravello', ru: 'Равелло', uz: 'Ravello' },
    region: { en: 'Costiera Amalfitana', ru: 'Costiera Amalfitana', uz: 'Costiera Amalfitana' },
    address: {
      en: 'Via San Giovanni 12, Ravello (SA)',
      ru: 'Via San Giovanni 12, Равелло (SA)',
      uz: 'Via San Giovanni 12, Ravello (SA)',
    },
  },
  story: {
    quote: {
      en: 'We wanted a day that felt less like an event and more like a long Italian afternoon.',
      ru: 'Нам хотелось дня, похожего не на событие, а на долгий итальянский полдень.',
      uz: 'Biz tadbirga emas, uzun italyan tushligiga oxshagan kunni istadik.',
    },
    body: {
      en: 'No ballroom and no stage. A garden, a terrace, the people we love, and enough time for all of it.',
      ru: 'Ни бального зала, ни сцены. Сад, терраса, любимые люди и достаточно времени на всё это.',
      uz: 'Na bazm zali, na sahna. Bog, ayvon, sevimli odamlar va bularning barchasi uchun yetarli vaqt.',
    },
  },
  ceremony: {
    caption: {
      en: 'The olive garden, where the ceremony will be held.',
      ru: 'Оливковый сад, где пройдёт церемония.',
      uz: 'Marosim otkaziladigan zaytun bogi.',
    },
    lede: {
      en: 'A ceremony under the olive trees, then one long table set by hand.',
      ru: 'Церемония под оливами, затем один длинный стол, накрытый вручную.',
      uz: 'Zaytun daraxtlari ostida marosim, sungra qol bilan tuzalgan bitta uzun dasturxon.',
    },
    body: {
      en: 'Expect linen, candles, lemons from the garden, and dinner that lasts as long as the conversation. When it gets dark the lights come on along the terrace and the music begins.',
      ru: 'Лён, свечи, лимоны из сада и ужин, который длится столько же, сколько разговор. Когда стемнеет, вдоль террасы зажгутся огни и начнётся музыка.',
      uz: 'Zigir mato, shamlar, bogdan uzilgan limonlar va suhbat qancha davom etsa, shuncha choziladigan kechki ovqat. Qorongi tushganda ayvon boylab chiroqlar yonadi va musiqa boshlanadi.',
    },
  },
  details: {
    dateNote: {
      en: 'September on the coast is warm at six and cool by eleven — bring a wrap.',
      ru: 'Сентябрь на побережье тёплый в шесть и прохладный к одиннадцати — возьмите накидку.',
      uz: 'Sentabrda sohil soat oltida iliq, ontbirda salqin boladi, yengil kiyim oling.',
    },
    ceremonyNote: {
      en: 'Outdoors on gravel and old stone. A block heel will serve you far better than a stiletto.',
      ru: 'На улице, гравий и старый камень. Устойчивый каблук подойдёт гораздо лучше шпильки.',
      uz: 'Ochiq havoda, shagal va qadimiy tosh ustida. Pastak poshna ingichka poshnadan kora ancha qulay boladi.',
    },
    reception: {
      en: 'From half past seven, the lower terrace',
      ru: 'С половины восьмого, нижняя терраса',
      uz: 'Yetti yarimdan, pastki ayvonda',
    },
    receptionNote: {
      en: 'Dinner at one long table, then dancing until the lights go out.',
      ru: 'Ужин за одним длинным столом, затем танцы, пока не погаснут огни.',
      uz: 'Bitta uzun dasturxonda kechki ovqat, sungra chiroqlar ochguncha raqslar.',
    },
    foot: {
      en: 'More practical details — transport from Naples, rooms in the village — will follow with the formal invitation.',
      ru: 'Остальные практические детали — трансфер из Неаполя, жильё в деревне — придут вместе с официальным приглашением.',
      uz: 'Qolgan amaliy tafsilotlar — Neapoldan transport, qishloqdagi xonalar — rasmiy taklifnoma bilan birga keladi.',
    },
  },
  dress: {
    title: { en: 'Black tie optional', ru: 'Чёрный галстук по желанию', uz: 'Tantanali kiyim, xohishga qarab' },
    note: {
      en: 'Long dresses and linen suits. Ivory, olive and terracotta if you want to match the flowers.',
      ru: 'Длинные платья и льняные костюмы. Слоновая кость, олива и терракота — если хотите совпасть с цветами.',
      uz: 'Uzun koylaklar va zigir kostyumlar. Gullarga mos tushmoqchi bolsangiz: sutrang, zaytun va terrakota.',
    },
  },
  travel: {
    title: { en: 'Naples, then the coast road', ru: 'Неаполь, затем дорога по побережью', uz: 'Neapol, sungra sohil yoli' },
    note: {
      en: 'Ninety minutes from Naples by car, or the ferry to Amalfi and a taxi up. We will send a car list nearer the time.',
      ru: 'Полтора часа из Неаполя на машине или паром до Амальфи и такси наверх. Ближе к дате пришлём список машин.',
      uz: 'Neapoldan mashinada bir yarim soat yoki Amalfiga parom va tepaga taksi. Sanaga yaqin mashinalar royxatini yuboramiz.',
    },
  },
  stay: {
    title: { en: 'Rooms held in the village', ru: 'Номера забронированы в деревне', uz: 'Qishloqda band qilingan xonalar' },
    note: {
      en: 'We have a small block at two hotels on the piazza until the first of July.',
      ru: 'Мы забронировали несколько номеров в двух отелях на площади до первого июля.',
      uz: 'Maydondagi ikki mehmonxonada bir nechta xona birinchi iyulgacha band qilingan.',
    },
  },
  rsvp: {
    lede: {
      en: 'Kindly by the fifteenth of July.',
      ru: 'Пожалуйста, ответьте до пятнадцатого июля.',
      uz: 'Iltimos, on beshinchi iyulgacha javob bering.',
    },
    couponSub: {
      en: 'Fill in a few lines and send it back to us.',
      ru: 'Заполните несколько строк и отправьте нам.',
      uz: 'Bir necha qatorni toldirib, bizga yuboring.',
    },
  },
  // The running order printed as Chapter V's second index. `mode: 'time'`
  // keeps the clock input in the builder rather than the free-text one.
  schedule: [
    { time: '17:00', mode: 'time', label: { en: 'Doors open · prosecco in the courtyard', ru: 'Двери открываются · просекко во дворе', uz: 'Eshiklar ochiladi · hovlida prosekko' } },
    { time: '17:30', mode: 'time', label: { en: 'Ceremony in the olive garden', ru: 'Церемония в оливковом саду', uz: 'Zaytun bogida marosim' } },
    { time: '18:15', mode: 'time', label: { en: 'Photographs and apéritif on the terrace', ru: 'Фотографии и аперитив на террасе', uz: 'Ayvonda suratlar va aperitiv' } },
    { time: '19:30', mode: 'time', label: { en: 'Dinner at the long table', ru: 'Ужин за длинным столом', uz: 'Uzun dasturxonda kechki ovqat' } },
    { time: '22:30', mode: 'time', label: { en: 'First dance · music on the lower terrace', ru: 'Первый танец · музыка на нижней террасе', uz: 'Birinchi raqs · pastki ayvonda musiqa' } },
    { time: '01:30', mode: 'time', label: { en: 'Limoncello, and goodnight', ru: 'Лимончелло — и спокойной ночи', uz: 'Limonchello va xayrli tun' } },
  ] as { time: string; mode: string; label: Record<string, string> }[],
  // Empty: the journal falls back to the bundled plates until the honoree
  // uploads photos of their own, at which point theirs replace all of them.
  gallery: [] as { image: string; caption: Record<string, string> }[],
  finale: {
    title: { en: 'Will you join us by the sea?', ru: 'Приедете к нам на море?', uz: 'Dengiz boyida biz bilan bolasizmi?' },
    message: {
      en: 'Nothing would make the evening more complete than having you there. Bring nothing but an appetite and comfortable shoes — the flowers are handled.',
      ru: 'Ничто не сделает этот вечер полнее, чем ваше присутствие. Возьмите с собой только аппетит и удобную обувь — цветы мы берём на себя.',
      uz: 'Sizning borligingizdan kora bu kechani toliq qiladigan narsa yoq. Ishtaha va qulay poyabzaldan boshqa hech narsa kerak emas, gullar bizdan.',
    },
  },
  music: { url: '' },
  // Sections switched off in the builder (all visible by default).
  hidden: {} as Record<string, boolean>,
};

export const weddingDolceVitaTemplate: TemplateDefinition = {
  id: 'wedding-dolcevita',
  category: 'wedding',
  nameKey: 'tpl_wedding_dolcevita',
  cover: '🍋',
  accent: '#A9533A',
  html,
  defaultConfig,
  fields,
  groups,
  Renderer: RichRenderer,
  // These must match the real element ids in template.html — the Design+
  // runtime anchors by getElementById and silently skips a section it cannot
  // find.
  sectionIds: ['hero', 'invite', 'arrival', 'story', 'ceremony', 'calendar', 'details', 'program', 'gallery', 'finale'],
  // The terracotta only. The wine, the cypress, the olive and the one
  // Mediterranean blue are the coast itself drawn through the design;
  // recolouring them with a picked accent would take the landscape with them.
  accentVars: ['--terracotta'],
};
