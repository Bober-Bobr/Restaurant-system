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
// Recreates the reference restaurant flyer: gift promo, phone CTA, welcome,
// countdown, menu showcase, restaurant gallery, lead CTA, contacts and the
// social-pages list. Dark/gold theme; photos left empty for the manager.
function restaurantFlyer(): BuiltinTemplate {
  const PHONE = '+998 77 122 70 72';
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
      b('heading', { text: 'ПОЛУЧИТЕ ПОДАРОК', align: 'center' }, { type: 'fade', durationMs: 700, delayMs: 0 }),
      b('promo', {
        title: 'ОНЛАЙН ПРИГЛАСИТЕЛЬНОЕ',
        imageUrl: '',
        code: '#MBEK78',
        subtitle: 'Чтобы получить онлайн-пригласительное, позвоните по указанному номеру и назовите промокод',
      }, { type: 'zoom', durationMs: 800, delayMs: 0 }),
      b('button', { label: 'ТЕЛЕФОН', action: { kind: 'phone', value: PHONE } }, { type: 'fade', durationMs: 600, delayMs: 0 }),

      b('image', { url: '', rounded: true }, { type: 'fade', durationMs: 700, delayMs: 0 }),
      b('text', { text: 'Добро пожаловать — вкус, тепло и гостеприимство ждут вас!', align: 'center' }, { type: 'fade', durationMs: 700, delayMs: 80 }),

      b('countdown', { targetAt: null, label: '' }, { type: 'zoom', durationMs: 800, delayMs: 0 }),

      b('menu', {
        title: 'МЕНЮ · MENU',
        items: [
          { number: 1, name: 'Самса', photoUrl: null },
          { number: 2, name: 'Долма', photoUrl: null },
          { number: 3, name: 'Мастова', photoUrl: null },
          { number: 4, name: 'Умакай', photoUrl: null },
          { number: 5, name: 'Кичири', photoUrl: null },
        ],
      }, { type: 'slide-up', durationMs: 800, delayMs: 0 }),

      b('heading', { text: 'НАШ РЕСТОРАН', align: 'center' }, { type: 'fade', durationMs: 700, delayMs: 0 }),
      b('gallery', { items: [] }, { type: 'fade', durationMs: 700, delayMs: 0 }),

      b('heading', { text: 'ПЛАНИРУЕТЕ МЕРОПРИЯТИЕ?', align: 'center' }, { type: 'slide-up', durationMs: 700, delayMs: 0 }),
      b('text', { text: 'Оставьте номер телефона — администратор перезвонит вам', align: 'center' }, { type: 'fade', durationMs: 600, delayMs: 80 }),
      b('button', { label: 'ПОЗВОНИТЬ', action: { kind: 'phone', value: PHONE } }, { type: 'fade', durationMs: 600, delayMs: 0 }),

      b('contacts', { title: 'НАШИ КОНТАКТЫ', telegramUrl: 'https://t.me/madinabek', phone: PHONE, instagramUrl: 'https://instagram.com/madinabek_restaurant_by_havas' }, { type: 'fade', durationMs: 700, delayMs: 0 }),

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
    ],
  };
}

// Built-in templates per designer kind. Rebuilt on each call so block ids are
// fresh when applied into the editor.
export function builtinTemplates(kind: DesignKind): BuiltinTemplate[] {
  if (kind === 'invitation') return [weddingInvitation()];
  return [restaurantFlyer()];
}
