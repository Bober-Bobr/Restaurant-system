import html from './template.html?raw';
import { RichRenderer } from '../RichRenderer';
import type { TemplateDefinition, TemplateField, TemplateFieldGroup } from '../types';

// ── "Samarkand" — an Eastern wedding by lantern light ───────────────────────
// The third film-led design, and the darkest thing in the catalog: the page
// opens in blackness and is lit outward from a single flame.
//
// Two mechanics belong to this template alone:
//
//  · THE GARDEN JOURNEY. A sticky, scroll-driven descent through six scenes —
//    the portal, the fountain, the lantern garden, the painted vault, the
//    table, the dancing — cross-fading as the guest scrolls, each with its own
//    line of text. It is what this design has instead of a photo album.
//  · THE LANTERN RAIL. Scroll progress drawn as a column of lamps down the
//    right edge, each catching light as its section passes. Built only from
//    sections that are actually on the page, so a lamp can never scroll
//    somebody to a section they switched off.
//
// The date is a PLAQUE rather than a calendar: two ornate shutters swing back
// on the day, the month and the year. All three still come from the event date,
// so moving the wedding moves them together.
//
// Artwork is part of the design rather than a set of slots — it ships bundled
// in apps/web/public/samarkand/ and is addressed through `window.__ORIGIN__`.
// There is no gallery field: the journey is the gallery.
//
// Defaults are written in Uzbek first — this is a Samarkand nikoh — with ru and
// en filled so the language bar works out of the box. uz avoids apostrophes,
// per the repo convention.

const groups: TemplateFieldGroup[] = [
  { key: 'couple', labelKey: 'tg_couple', icon: '💍', section: 'hero' },
  { key: 'invite', labelKey: 'tg_invite', icon: '✉️', section: 'invite' },
  { key: 'datetime', labelKey: 'tg_datetime', icon: '🗓', section: 'date' },
  { key: 'venue', labelKey: 'tg_venue', icon: '📍', section: 'details' },
  { key: 'story', labelKey: 'tg_story', icon: '💞', section: 'couple' },
  { key: 'journey', labelKey: 'sec_journey', icon: '🏛', section: 'journey' },
  { key: 'details', labelKey: 'tg_details', icon: '📋', section: 'details' },
  { key: 'schedule', labelKey: 'tg_schedule', icon: '🕰', section: 'details' },
  { key: 'finale', labelKey: 'sec_final', icon: '🥂', section: 'final' },
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
  // The word between the names — "va" by default. Blank falls back to the
  // chrome's own "and" in whichever language is being read.
  { key: 'amp', path: 'invite.amp', type: 'localized-text', group: 'couple', labelKey: 'fld_label' },

  { key: 'kicker', path: 'invite.kicker', type: 'localized-text', group: 'invite', labelKey: 'fld_kicker' },
  // Left empty by default: the hero then prints the city and the formatted
  // event date, which cannot go stale when the date is changed.
  { key: 'meta', path: 'invite.meta', type: 'localized-text', group: 'invite', labelKey: 'fld_time_text' },
  { key: 'lede', path: 'invite.lede', type: 'localized-textarea', group: 'invite', labelKey: 'fld_invite_text' },
  { key: 'thresholdCap', path: 'threshold.caption', type: 'localized-text', group: 'invite', labelKey: 'fld_caption' },

  // Convention: the first datetime field is the event date. Everything dated on
  // the page comes from it — the hero line, the invitation, the plaque's three
  // lines, the details tile and the footer.
  { key: 'dateISO', path: 'event.dateISO', type: 'datetime', group: 'datetime', labelKey: 'fld_datetime' },
  { key: 'plaqueTitle', path: 'plaque.title', type: 'localized-text', group: 'datetime', labelKey: 'fld_sub' },
  { key: 'plaqueNote', path: 'plaque.note', type: 'localized-text', group: 'datetime', labelKey: 'fld_time_note' },

  { key: 'venueName', path: 'venue.name', type: 'localized-text', group: 'venue', labelKey: 'fld_venue_name' },
  { key: 'venueCity', path: 'venue.city', type: 'localized-text', group: 'venue', labelKey: 'fld_city' },

  // Three plates behind parting silk. Leaving both a heading and its passage
  // blank drops that row from the page.
  { key: 'storyEyebrow', path: 'story.eyebrow', type: 'localized-text', group: 'story', labelKey: 'fld_kicker' },
  { key: 'storyTitle', path: 'story.title', type: 'localized-text', group: 'story', labelKey: 'fld_sub' },
  { key: 'oneTitle', path: 'story.oneTitle', type: 'localized-text', group: 'story', labelKey: 'fld_label' },
  { key: 'oneText', path: 'story.oneText', type: 'localized-textarea', group: 'story', labelKey: 'fld_text' },
  { key: 'twoTitle', path: 'story.twoTitle', type: 'localized-text', group: 'story', labelKey: 'fld_label' },
  { key: 'twoText', path: 'story.twoText', type: 'localized-textarea', group: 'story', labelKey: 'fld_text' },
  { key: 'threeTitle', path: 'story.threeTitle', type: 'localized-text', group: 'story', labelKey: 'fld_label' },
  { key: 'threeText', path: 'story.threeText', type: 'localized-textarea', group: 'story', labelKey: 'fld_text' },

  // One line per scene of the sticky descent, in order.
  { key: 'j1', path: 'journey.one', type: 'localized-text', group: 'journey', labelKey: 'fld_caption' },
  { key: 'j2', path: 'journey.two', type: 'localized-text', group: 'journey', labelKey: 'fld_caption' },
  { key: 'j3', path: 'journey.three', type: 'localized-text', group: 'journey', labelKey: 'fld_caption' },
  { key: 'j4', path: 'journey.four', type: 'localized-text', group: 'journey', labelKey: 'fld_caption' },
  { key: 'j5', path: 'journey.five', type: 'localized-text', group: 'journey', labelKey: 'fld_caption' },
  { key: 'j6', path: 'journey.six', type: 'localized-text', group: 'journey', labelKey: 'fld_caption' },

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

  { key: 'finaleTitle', path: 'finale.title', type: 'localized-text', group: 'finale', labelKey: 'fld_sub' },
  { key: 'finaleMsg', path: 'finale.message', type: 'localized-textarea', group: 'finale', labelKey: 'fld_final' },

  { key: 'music', path: 'music.url', type: 'audio', group: 'music', labelKey: 'tg_music' },

  // Block visibility: hidden.<key> === true switches the section off.
  { key: 'v_threshold', path: 'hidden.threshold', type: 'toggle', group: 'visibility', labelKey: 'sec_arrival' },
  { key: 'v_couple', path: 'hidden.couple', type: 'toggle', group: 'visibility', labelKey: 'sec_story' },
  { key: 'v_date', path: 'hidden.date', type: 'toggle', group: 'visibility', labelKey: 'sec_calendar' },
  { key: 'v_details', path: 'hidden.details', type: 'toggle', group: 'visibility', labelKey: 'sec_details' },
  { key: 'v_program', path: 'hidden.program', type: 'toggle', group: 'visibility', labelKey: 'sec_program' },
  { key: 'v_journey', path: 'hidden.journey', type: 'toggle', group: 'visibility', labelKey: 'sec_journey' },
  { key: 'v_rsvp', path: 'hidden.rsvp', type: 'toggle', group: 'visibility', labelKey: 'sec_rsvp' },
  { key: 'v_music', path: 'hidden.music', type: 'toggle', group: 'visibility', labelKey: 'sec_music' },
];

const defaultConfig = {
  couple: {
    bride: { uz: 'Zarina', ru: 'Зарина', en: 'Zarina' },
    groom: { uz: 'Timur', ru: 'Тимур', en: 'Timur' },
    brideFull: { uz: 'Zarina Rashidova', ru: 'Зарина Рашидова', en: 'Zarina Rashidova' },
    groomFull: { uz: 'Timur Aliyev', ru: 'Тимур Алиев', en: 'Timur Aliyev' },
  },
  invite: {
    kicker: {
      uz: 'Oilalarimiz duosi bilan',
      ru: 'С благословения наших семей',
      en: 'With the blessing of their families',
    },
    amp: { uz: 'va', ru: 'va', en: 'va' },
    // Empty on purpose — see the field comment above.
    meta: { uz: '', ru: '', en: '' },
    lede: {
      uz: 'Chiroqlar ostida biz bilan birga oting. Taom hech kim yeb ulgurmaydigan darajada kop boladi, musiqa esa erta tugamaydi.',
      ru: 'Приходите посидеть с нами под фонарями. Еды будет больше, чем можно съесть, а музыка не смолкнет рано.',
      en: 'Come and sit under the lanterns with us. There will be more food than anyone can finish, and the music will not stop early.',
    },
  },
  threshold: {
    caption: {
      uz: 'Bitta chiroq, keyin yuztasi',
      ru: 'Один фонарь, потом сотня',
      en: 'One lantern, then a hundred',
    },
  },
  event: {
    dateISO: '2026-10-03T19:00:00',
  },
  plaque: {
    title: {
      uz: 'Panellar bir kechada ochiladi',
      ru: 'Панели открываются в один вечер',
      en: 'The panels open on one evening',
    },
    note: {
      uz: 'Chiroqlar oltida yoqiladi. Nikoh yettida.',
      ru: 'Фонари зажигают в шесть. Церемония в семь.',
      en: 'Lanterns lit at six. Ceremony at seven.',
    },
  },
  venue: {
    name: { uz: 'Bogi Nur', ru: 'Баги Нур', en: 'Bagh-i Nur' },
    city: { uz: 'Samarqand', ru: 'Самарканд', en: 'Samarkand' },
  },
  story: {
    eyebrow: { uz: 'Biz haqimizda', ru: 'О нас', en: 'About us' },
    title: {
      uz: 'Bu hovliga qanday keldik',
      ru: 'Как мы пришли в этот двор',
      en: 'How we came to this courtyard',
    },
    oneTitle: {
      uz: 'Yolak va omonat soyabon',
      ru: 'Галерея и одолженный зонт',
      en: 'A corridor, and a borrowed umbrella',
    },
    oneText: {
      uz: 'Soyabon Timurda edi. Zarinada esa yoq, yomgir shu qadar kuchli yogardiki, mangrullik qimmatga tushardi. Ular yolakni ikki marta, keyin uchinchi marta, hech qanday bahonasiz kezib chiqishdi.',
      ru: 'Зонт был у Тимура. У Зарины его не было, а дождь шёл так, что гордость обходилась дорого. Они прошли галерею дважды, потом третий раз — уже без всякого предлога.',
      en: 'Timur was carrying it. Zarina was not, and it was raining hard enough that pride seemed expensive. They walked the length of the arcade twice, then a third time, on no pretext at all.',
    },
    twoTitle: {
      uz: 'Buvisining sozanasi',
      ru: 'Сюзане её бабушки',
      en: 'Her grandmother’s suzani',
    },
    twoText: {
      uz: 'Tort qish davomida tikilgan va ottiz yil qogozga oralgan holda saqlangan. Toy kuni u bizning ortimizda osilib turadi — kechki marosimni tanlaganimizning sababi ham shu: u chiroq yorugida eng chiroyli koradi.',
      ru: 'Вышивалось четыре зимы и тридцать лет хранилось сложенным в бумаге. В этот день оно будет висеть позади нас — собственно, поэтому мы и выбрали вечернюю церемонию: при свете ламп оно выглядит лучше всего.',
      en: 'Stitched over four winters and kept folded in paper for thirty years. It will hang behind us on the day, which is the whole reason we chose an evening ceremony — it looks best by lamplight.',
    },
    threeTitle: {
      uz: 'Tomdagi savol',
      ru: 'Вопрос, на крыше',
      en: 'The question, on a rooftop',
    },
    threeText: {
      uz: 'Vaqti notogri tanlangan edi — azon aytilayotgandi, shuning uchun savolni qaytarishga togri keldi. Ikkinchi marta birinchisidan yaxshiroq chiqdi, javob esa oradagi vaqtda ozgarmagandi.',
      ru: 'Не вовремя — во время азана, так что вопрос пришлось повторить. Второй раз вышел лучше первого, а ответ за это время не изменился.',
      en: 'Badly timed, during the call to prayer, so it had to be repeated. The second asking was better than the first, and the answer had not changed in the interval.',
    },
  },
  // The six scenes of the sticky descent, in order.
  journey: {
    one: { uz: 'Katta darvozadan', ru: 'Через большие ворота', en: 'Through the great door' },
    two: { uz: 'Gulbarglar toplangan favvoradan otib', ru: 'Мимо фонтана, где собираются лепестки', en: 'Past the fountain, where petals gather' },
    three: { uz: 'Chiroqlar past osilgan tomonga', ru: 'Глубже, где фонари висят низко', en: 'Deeper, where the lanterns hang low' },
    four: { uz: 'Naqshli gumbaz ostiga', ru: 'Внутрь, под расписной свод', en: 'Inside, beneath the painted vault' },
    five: { uz: 'Ertalabdan yozilgan dasturxon', ru: 'Стол, накрытый с утра', en: 'The table, laid since morning' },
    six: { uz: 'Va keyin raqslar', ru: 'И потом танцы', en: 'And then the dancing' },
  },
  details: {
    dateNote: {
      uz: 'Kechki toy. Samarqandda oktabr tunlari ontbirdan keyin sovuq boladi — iliq narsa oling.',
      ru: 'Вечерняя свадьба. Октябрьские ночи в Самарканде после одиннадцати холодные — возьмите что-то тёплое.',
      en: 'An evening wedding. October nights in Samarkand turn cold after eleven — bring something warm.',
    },
    ceremony: { uz: 'Hovli, Bogi Nur', ru: 'Двор, Баги Нур', en: 'The courtyard, Bagh-i Nur' },
    ceremonyNote: {
      uz: 'Marosim yettida, chiroqlar ostida. Otirish uchun kursilar ham, gilam va korpachalar ham bor.',
      ru: 'Церемония в семь под фонарями. Есть и стулья, и ковры с курпачами.',
      en: 'Ceremony at seven beneath the lanterns. Seating on carpets and low cushions as well as chairs.',
    },
    reception: { uz: 'Oynali zal va bog', ru: 'Зеркальный зал и сад', en: 'The Mirror Hall & garden' },
    receptionNote: {
      uz: 'Kechki ovqat sakkiz yarimdan, sungra chiroqlar songuncha bogda raqslar.',
      ru: 'Ужин с половины девятого, затем танцы в саду, пока не догорят фонари.',
      en: 'Dinner from half past eight, then dancing in the garden until the lanterns burn down.',
    },
  },
  dress: {
    title: { uz: 'Tantanali, toq ranglar', ru: 'Формально, насыщенные цвета', en: 'Formal, rich colour' },
    note: {
      uz: 'Tanlayotgan bolsangiz: marun, zumrad, olxori va oltin. Poshnasi past poyabzal — hovli koshin va notekis.',
      ru: 'Если выбираете: бордо, изумруд, слива и золото. Каблук плоский или устойчивый — двор выложен плиткой и неровный.',
      en: 'Burgundy, emerald, plum and gold if you are choosing. Flat or block heels — the courtyard is tiled and uneven.',
    },
  },
  travel: {
    title: { uz: 'Markazdan yigirma daqiqa', ru: 'Двадцать минут от центра', en: 'Twenty minutes from the centre' },
    note: {
      uz: 'Mashinalar Registondan besh yarimda va olti chorakda jonaydi. Sharqiy darvoza ichida turargoh bor.',
      ru: 'Машины отходят от Регистана в половине шестого и в четверть седьмого. Парковка внутри восточных ворот.',
      en: 'Cars leave the Registan at half past five and quarter past six. Parking inside the east gate.',
    },
  },
  stay: {
    title: { uz: 'Eski shaharda band qilingan xonalar', ru: 'Номера в старом городе', en: 'Rooms held in the old city' },
    note: {
      uz: 'Bibixonim va Jahongir mehmonxonalarida joylar birinchi avgustgacha band. Ismlarimizni ayting.',
      ru: 'Блок номеров в «Бибиханум» и «Джахонгир» до первого августа. Назовите наши имена.',
      en: 'A block at the Bibikhanum and the Jahongir until the first of August. Mention our names.',
    },
  },
  rsvp: {
    lede: {
      uz: 'Iltimos, birinchi avgustgacha javob bering.',
      ru: 'Пожалуйста, ответьте до первого августа.',
      en: 'Kindly by the first of August.',
    },
  },
  // The running order printed under the particulars. `mode: 'time'` keeps the
  // clock input in the builder rather than the free-text one.
  schedule: [
    { time: '18:00', mode: 'time', label: { uz: 'Chiroqlar yoqiladi · tashqi hovlida choy va shirinlik', ru: 'Зажигают фонари · чай и сладости во внешнем дворе', en: 'Lanterns lit · tea and sweets in the outer court' } },
    { time: '19:00', mode: 'time', label: { uz: 'Ravoqlar ostida nikoh marosimi', ru: 'Церемония никох под арками', en: 'Nikoh ceremony beneath the arches' } },
    { time: '20:00', mode: 'time', label: { uz: 'Duolar va suv quyish marosimi', ru: 'Благословения и обряд с водой', en: 'Blessings, and the pouring of the water' } },
    { time: '20:30', mode: 'time', label: { uz: 'Oynali zalda kechki ovqat', ru: 'Ужин в Зеркальном зале', en: 'Dinner in the Mirror Hall' } },
    { time: '22:30', mode: 'time', label: { uz: 'Bogda musiqa va raqslar', ru: 'Музыка и танцы в саду', en: 'Music and dancing in the garden' } },
    { time: '01:00', mode: 'time', label: { uz: 'Songgi chiroqlar va xayrli tun', ru: 'Последние фонари — и спокойной ночи', en: 'Last of the lanterns, and goodnight' } },
  ] as { time: string; mode: string; label: Record<string, string> }[],
  finale: {
    title: { uz: 'Biz bilan birga boling', ru: 'Приходите и будьте с нами', en: 'Come and be with us' },
    message: {
      uz: 'Hech narsa olib kelmang. Hammasidan ham juda kop boladi.',
      ru: 'Ничего не приносите. Всего и так будет слишком много.',
      en: 'Bring nothing. There will be far too much of everything already.',
    },
  },
  music: { url: '' },
  // Sections switched off in the builder (all visible by default).
  hidden: {} as Record<string, boolean>,
};

export const weddingSamarkandTemplate: TemplateDefinition = {
  id: 'wedding-samarkand',
  category: 'wedding',
  nameKey: 'tpl_wedding_samarkand',
  cover: '🏮',
  accent: '#C9A227',
  html,
  defaultConfig,
  fields,
  groups,
  Renderer: RichRenderer,
  // These must match the real element ids in template.html — the Design+ runtime
  // anchors by getElementById and silently skips a section it cannot find.
  sectionIds: ['hero', 'threshold', 'invite', 'couple', 'date', 'details', 'journey', 'final'],
  // The lantern gold only. The burgundy and the ruby are the silk and the
  // petals; recolouring them with a picked accent would take the fabric with
  // them.
  accentVars: ['--gold', '--gold-lt'],
};
