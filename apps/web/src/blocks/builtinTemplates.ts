import type { Block, BlockType } from './types';
import { newBlockId } from './types';
import type { SectionAnimation } from '../services/guestInvitation.service';
import type { DesignKind, DesignTheme } from '../services/designTemplate.service';

// A picked design = the blocks + theme applied into the editor. Built-in
// (ready-made) templates carry a `builtin` id and aren't stored/deletable.
export type PickedDesign = { blocks: Block[]; theme: DesignTheme };

export type BuiltinTemplate = {
  id: string;
  name: string;
  blocks: Block[];
  theme: DesignTheme;
};

function b(type: BlockType, props: Record<string, unknown>, anim: SectionAnimation): Block {
  return { id: newBlockId(), type, props, anim };
}

// ── Ready-made "Wedding · САВЛАТ И ЖАСМИНА" invitation ───────────────────────
// Recreates the reference screenshots: hero couple, dear-guest, venue + map,
// timing schedule, countdown, RSVP and contacts. Photos are left empty for the
// manager to upload their own; everything else is editable per block.
function weddingInvitation(): BuiltinTemplate {
  return {
    id: 'builtin-wedding-classic',
    name: 'Свадьба · Классика',
    theme: {
      accentColor: '#1a1a1a',
      backgroundColor: '#ffffff',
      backgroundImageUrl: null,
      musicUrl: null,
      trailTemplate: 'hearts',
      trailColor: '#1a1a1a',
    },
    blocks: [
      b('hero', { title: 'САВЛАТ И ЖАСМИНА', subtitle: 'ЛИСТАЙТЕ ВНИЗ', imageUrl: '' }, { type: 'zoom', durationMs: 1000, delayMs: 0 }),

      b('heading', { text: 'ДОРОГОЙ ГОСТЬ', align: 'center' }, { type: 'fade', durationMs: 800, delayMs: 0 }),
      b('text', {
        text: 'Мы приглашаем вас присоединиться к нам, чтобы отпраздновать начало нашего нового совместного пути.\nВаше присутствие сделает наш особенный день ещё более запоминающимся.',
        align: 'center',
      }, { type: 'fade', durationMs: 800, delayMs: 120 }),
      b('divider', {}, { type: 'fade', durationMs: 500, delayMs: 0 }),
      b('heading', { text: 'SAVLAT & JASMINA', align: 'center' }, { type: 'fade', durationMs: 800, delayMs: 0 }),

      b('text', { text: 'РЕСТОРАН', align: 'center' }, { type: 'slide-up', durationMs: 700, delayMs: 0 }),
      b('heading', { text: 'FOTIMA SULTAN', align: 'center' }, { type: 'slide-up', durationMs: 700, delayMs: 80 }),
      b('heading', { text: '05 · 06 · 26', align: 'center' }, { type: 'zoom', durationMs: 700, delayMs: 0 }),
      b('image', { url: '', rounded: false }, { type: 'fade', durationMs: 700, delayMs: 0 }),
      b('map', { label: 'КАРТА', address: 'Fotima Sultan, Tashkent' }, { type: 'fade', durationMs: 600, delayMs: 0 }),

      b('timing', {
        title: 'TIMING',
        items: [
          { time: '18:40', label: 'СБОР ГОСТЕЙ' },
          { time: '19:00', label: 'НАЧАЛО ТОРЖЕСТВА' },
          { time: '20:00', label: 'ВЫСТУПЛЕНИЕ АРТИСТОВ' },
          { time: '21:00', label: 'СВАДЕБНЫЙ ТОРТ' },
          { time: '21:25', label: 'СВАДЕБНЫЙ ВАЛЬС' },
          { time: '23:00', label: 'ЗАВЕРШЕНИЕ ВЕЧЕРА' },
        ],
      }, { type: 'slide-left', durationMs: 800, delayMs: 0 }),

      b('countdown', { targetAt: null, label: 'ДО ВСТРЕЧИ ЧЕРЕЗ:' }, { type: 'zoom', durationMs: 800, delayMs: 0 }),

      b('rsvp', { title: 'ПОДТВЕРДИТЕ ПРИСУТСТВИЕ' }, { type: 'slide-up', durationMs: 800, delayMs: 0 }),

      // Brand + social circles (telegram / phone / instagram) close the page.
      b('heading', { text: 'INVITE UZ', align: 'center' }, { type: 'fade', durationMs: 700, delayMs: 0 }),
      b('contacts', {
        title: '',
        telegramUrl: 'https://t.me/invite_uz',
        phone: '+998 77 122 70 72',
        instagramUrl: 'https://instagram.com/invite_uz',
      }, { type: 'fade', durationMs: 700, delayMs: 120 }),
    ],
  };
}

// ── Ready-made "Restaurant · MADINABEK" flyer ───────────────────────────────
// Mirrors the reference flyer top-to-bottom: hero art + countdown, menu ticker +
// static menu photo, performing artist, restaurant carousel, lead form, then the
// contacts group (contacts / save-contact / socials) separated by icon dividers,
// and finally the gift-promo section with the phone CTA and logo footer.
// Dark/gold theme; photos left empty for the manager.
function restaurantFlyer(): BuiltinTemplate {
  const PHONE = '+998 77 122 70 72';
  const divider = () => b('divider', { shape: 'icon', text: '' }, { type: 'fade', durationMs: 400, delayMs: 0 });
  return {
    id: 'builtin-restaurant-flyer',
    name: 'Ресторан · Тёмный',
    theme: {
      accentColor: '#c9a42c',
      backgroundColor: '#0d0d0d',
      backgroundImageUrl: null,
      musicUrl: null,
    },
    blocks: [
      // Hero art (welcome / wedding-day poster) + event countdown
      b('hero', { title: 'Добро пожаловать', subtitle: 'WEDDING DAY', imageUrl: '' }, { type: 'zoom', durationMs: 900, delayMs: 0 }),
      b('countdown', { targetAt: null, label: '' }, { type: 'zoom', durationMs: 800, delayMs: 0 }),

      // Menu section: scrolling ticker + static menu photo + bottom ticker
      b('heading', { text: 'МЕНЮ 🍽', align: 'center', marquee: true }, { type: 'fade', durationMs: 700, delayMs: 0 }),
      b('image', { url: '', rounded: false }, { type: 'fade', durationMs: 700, delayMs: 0 }),
      b('heading', { text: 'MEGA MENU НА ОДНОГО ЧЕЛОВЕКА 🔥', align: 'center', marquee: true }, { type: 'fade', durationMs: 700, delayMs: 0 }),

      // Restaurant image carousel + call-back form
      b('heading', { text: 'НАШ РЕСТОРАН', align: 'center' }, { type: 'fade', durationMs: 700, delayMs: 0 }),
      b('gallery', { items: [] }, { type: 'fade', durationMs: 700, delayMs: 0 }),
      b('form', {
        title: 'ПЛАНИРУЕТЕ МЕРОПРИЯТИЕ?',
        subtitle: 'Оставьте номер телефона — администратор перезвонит вам',
        buttonLabel: '',
        showMessage: true,
      }, { type: 'slide-up', durationMs: 800, delayMs: 0 }),

      // Contacts group, separated by icon dividers like the reference
      divider(),
      b('contacts', { title: 'НАШИ КОНТАКТЫ', telegramUrl: 'https://t.me/madinabek', phone: PHONE, instagramUrl: '' }, { type: 'fade', durationMs: 700, delayMs: 0 }),
      divider(),
      b('savecontact', { label: 'СОХРАНИТЬ КОНТАКТЫ', name: '', phone: PHONE }, { type: 'fade', durationMs: 600, delayMs: 0 }),
      divider(),
      b('socials', {
        title: 'ПОДПИСЫВАЙТЕСЬ НА НАШИ СТРАНИЦЫ',
        links: [
          { label: '@madinabek_restaurant_by_havas', url: 'https://instagram.com/madinabek_restaurant_by_havas' },
          { label: '@tohiriy_by_havas_restaurant', url: 'https://instagram.com/tohiriy_by_havas_restaurant' },
          { label: '@emir_by_havas', url: 'https://instagram.com/emir_by_havas' },
          { label: '@afsona_by_havas', url: 'https://instagram.com/afsona_by_havas' },
          { label: '@grand_turon_by_havas', url: 'https://instagram.com/grand_turon_by_havas' },
        ],
      }, { type: 'fade', durationMs: 700, delayMs: 80 }),
      divider(),

      // Gift section + phone CTA + logo footer (photo instead of a promo block)
      b('heading', { text: 'ПОЛУЧИТЕ ПОДАРОК', align: 'center' }, { type: 'fade', durationMs: 700, delayMs: 0 }),
      b('image', { url: '', rounded: true }, { type: 'zoom', durationMs: 800, delayMs: 0 }),
      b('text', { text: '📞 Чтобы получить онлайн-пригласительное, позвоните по указанному номеру и назовите промокод: #MBEK78', align: 'center' }, { type: 'fade', durationMs: 600, delayMs: 0 }),
      b('button', { label: 'ТЕЛЕФОН', action: { kind: 'phone', value: PHONE } }, { type: 'fade', durationMs: 600, delayMs: 0 }),
      b('text', { text: 'Добро пожаловать — вкус, тепло и гостеприимство ждут вас!\n★★★★★', align: 'center' }, { type: 'fade', durationMs: 700, delayMs: 80 }),
    ],
  };
}

// ── Ready-made NFC plaques (v-connect.uz) ───────────────────────────────────
// A plaque is what someone sees one second after tapping their phone on a tag,
// so these stay short: who you are, one line of why, the actions worth taking,
// and the save-contact card. No countdowns, no RSVP, no lead forms.
// The `vccontact` block closes every one — it is the studio's own credit line.

// Warm beige card for a shop, office or studio.
function businessPlaque(): BuiltinTemplate {
  return {
    id: 'builtin-plaque-business',
    name: 'Бизнес · Беж',
    theme: {
      accentColor: '#c8a97a',
      backgroundColor: '#faf7f0',
      textColor: '#1a1817',
      textScale: 1,
      trailTemplate: 'sparkle',
      trailColor: '#c8a97a',
      particles: 'none',
    },
    blocks: [
      b('image', { url: '', rounded: true }, { type: 'zoom', durationMs: 800, delayMs: 0 }),
      b('heading', { text: 'НАЗВАНИЕ КОМПАНИИ', align: 'center' }, { type: 'fade', durationMs: 700, delayMs: 0 }),
      b('text', { text: 'Коротко о том, чем вы занимаетесь — одна-две строки.', align: 'center' }, { type: 'fade', durationMs: 700, delayMs: 100 }),
      b('divider', { shape: 'line', text: '' }, { type: 'fade', durationMs: 400, delayMs: 0 }),

      b('button', { label: 'ПОЗВОНИТЬ', action: { kind: 'phone', value: '' } }, { type: 'slide-up', durationMs: 600, delayMs: 0 }),
      b('button', { label: 'НАПИСАТЬ В TELEGRAM', action: { kind: 'link', value: '' } }, { type: 'slide-up', durationMs: 600, delayMs: 80 }),
      b('savecontact', { label: 'СОХРАНИТЬ КОНТАКТ', name: '', phone: '' }, { type: 'slide-up', durationMs: 600, delayMs: 160 }),

      b('divider', { shape: 'icon', text: '' }, { type: 'fade', durationMs: 400, delayMs: 0 }),
      b('map', { label: 'КАК НАС НАЙТИ', address: '' }, { type: 'fade', durationMs: 600, delayMs: 0 }),
      b('socials', { title: 'МЫ В СОЦСЕТЯХ', links: [] }, { type: 'fade', durationMs: 700, delayMs: 0 }),
      b('vccontact', { phone: '', telegram: '', instagram: '' }, { type: 'none', durationMs: 0, delayMs: 0 }),
    ],
  };
}

// Dark plaque for a cafe, bar or restaurant table tag — menu link first.
function cafePlaque(): BuiltinTemplate {
  return {
    id: 'builtin-plaque-cafe',
    name: 'Кафе · Тёмный',
    theme: {
      accentColor: '#d8b26a',
      backgroundColor: '#101010',
      textColor: '#f4efe4',
      textScale: 1,
      trailTemplate: 'sparkle',
      trailColor: '#d8b26a',
      particles: 'none',
    },
    blocks: [
      b('hero', { title: 'НАЗВАНИЕ', subtitle: 'ДОБРО ПОЖАЛОВАТЬ', imageUrl: '' }, { type: 'zoom', durationMs: 900, delayMs: 0 }),
      b('button', { label: 'ОТКРЫТЬ МЕНЮ', action: { kind: 'link', value: '' } }, { type: 'slide-up', durationMs: 650, delayMs: 0 }),
      b('button', { label: 'ЗАБРОНИРОВАТЬ СТОЛ', action: { kind: 'phone', value: '' } }, { type: 'slide-up', durationMs: 650, delayMs: 80 }),

      b('divider', { shape: 'wave', text: '' }, { type: 'fade', durationMs: 400, delayMs: 0 }),
      b('gallery', { items: [], autoSlide: true, slideInterval: 4 }, { type: 'fade', durationMs: 700, delayMs: 0 }),

      b('heading', { text: 'ЧАСЫ РАБОТЫ', align: 'center' }, { type: 'fade', durationMs: 600, delayMs: 0 }),
      b('text', { text: 'Пн–Вс · 10:00 — 23:00', align: 'center' }, { type: 'fade', durationMs: 600, delayMs: 80 }),

      b('map', { label: 'КАК НАС НАЙТИ', address: '' }, { type: 'fade', durationMs: 600, delayMs: 0 }),
      b('socials', { title: '', links: [] }, { type: 'fade', durationMs: 700, delayMs: 0 }),
      b('savecontact', { label: 'СОХРАНИТЬ КОНТАКТ', name: '', phone: '' }, { type: 'fade', durationMs: 600, delayMs: 0 }),
      b('vccontact', { phone: '', telegram: '', instagram: '' }, { type: 'none', durationMs: 0, delayMs: 0 }),
    ],
  };
}

// A one-screen personal card: photo, name, role, the three ways to reach you.
function personalPlaque(): BuiltinTemplate {
  return {
    id: 'builtin-plaque-personal',
    name: 'Визитка · Минимал',
    theme: {
      accentColor: '#8c7b62',
      backgroundColor: '#ffffff',
      textColor: '#1c1c1c',
      textScale: 1,
      trailTemplate: 'sparkle',
      trailColor: '#8c7b62',
      particles: 'none',
    },
    blocks: [
      b('image', { url: '', rounded: true }, { type: 'zoom', durationMs: 800, delayMs: 0 }),
      b('heading', { text: 'ИМЯ ФАМИЛИЯ', align: 'center' }, { type: 'fade', durationMs: 700, delayMs: 0 }),
      b('text', { text: 'Должность · Компания', align: 'center' }, { type: 'fade', durationMs: 700, delayMs: 100 }),
      b('divider', { shape: 'line', text: '' }, { type: 'fade', durationMs: 400, delayMs: 0 }),
      b('savecontact', { label: 'СОХРАНИТЬ КОНТАКТ', name: '', phone: '' }, { type: 'slide-up', durationMs: 650, delayMs: 0 }),
      b('contacts', { title: '', phone: '', telegramUrl: '', instagramUrl: '' }, { type: 'fade', durationMs: 700, delayMs: 80 }),
      b('vccontact', { phone: '', telegram: '', instagram: '' }, { type: 'none', durationMs: 0, delayMs: 0 }),
    ],
  };
}

// Built-in templates per designer kind. Rebuilt on each call so block ids are
// fresh when applied into the editor.
export function builtinTemplates(kind: DesignKind): BuiltinTemplate[] {
  if (kind === 'invitation') return [weddingInvitation()];
  if (kind === 'plaque') return [businessPlaque(), cafePlaque(), personalPlaque()];
  return [restaurantFlyer()];
}
