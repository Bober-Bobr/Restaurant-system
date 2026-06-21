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

// Built-in templates per designer kind. Rebuilt on each call so block ids are
// fresh when applied into the editor.
export function builtinTemplates(kind: DesignKind): BuiltinTemplate[] {
  if (kind === 'invitation') return [weddingInvitation()];
  return [];
}
