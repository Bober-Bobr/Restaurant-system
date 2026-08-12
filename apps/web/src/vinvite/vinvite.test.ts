import { describe, expect, it } from 'vitest';
import { groupByTier, telegramHref, instagramHref, TIER_ORDER } from './pricing';
import { splitWorks, visibleTemplates, EMPTY_SHOWCASE, COVER_SLOTS_DESKTOP, COVER_SLOTS_MOBILE } from './promoShowcase';
import { whenMode } from './templates/utils';
import { commitValue } from '../components/ui/NumberField';
import type { PromoWork } from './api';
import type { TemplateDefinition } from './templates/types';

// The v-invite product's pure decisions: what the price list shows, what the
// marketing page shows, and two input helpers shared across the builders.

const tpl = (id: string) => ({ id } as TemplateDefinition);

describe('grouping templates into price tiers', () => {
  it('files each template under its tier', () => {
    const { buckets } = groupByTier(
      [tpl('a'), tpl('b')],
      new Map([['a', { tier: 'PREMIUM' as const }], ['b', { tier: 'STANDARD' as const }]]),
    );
    expect(buckets.PREMIUM.map((t) => t.id)).toEqual(['a']);
    expect(buckets.STANDARD.map((t) => t.id)).toEqual(['b']);
  });

  it('keeps an unpriced template visible instead of dropping it', () => {
    // Shipping a new template must not make it silently vanish from the price
    // list until somebody remembers to categorise it.
    const { unassigned } = groupByTier([tpl('new-one')], new Map());
    expect(unassigned.map((t) => t.id)).toEqual(['new-one']);
  });

  it('treats a tier this build does not know as unassigned', () => {
    const { unassigned } = groupByTier([tpl('a')], new Map([['a', { tier: 'PLATINUM' as never }]]));
    expect(unassigned.map((t) => t.id)).toEqual(['a']);
  });

  it('preserves the administrator\'s order within a tier', () => {
    // Not the pricing map's insertion order — the showcase order they arranged.
    const pricing = new Map([['b', { tier: 'STANDARD' as const }], ['a', { tier: 'STANDARD' as const }]]);
    const { buckets } = groupByTier([tpl('a'), tpl('b')], pricing);
    expect(buckets.STANDARD.map((t) => t.id)).toEqual(['a', 'b']);
  });

  it('offers the three tiers cheapest-first', () => {
    expect(TIER_ORDER).toEqual(['STANDARD', 'PREMIUM', 'LUXURY']);
  });
});

describe('contact handles', () => {
  // The field has never said which form it wants, so all three are accepted.
  it('accepts a bare handle, an @handle or a full URL', () => {
    expect(telegramHref('vconnect')).toBe('https://t.me/vconnect');
    expect(telegramHref('@vconnect')).toBe('https://t.me/vconnect');
    expect(telegramHref('https://t.me/vconnect')).toBe('https://t.me/vconnect');

    expect(instagramHref('vconnect')).toBe('https://instagram.com/vconnect');
    expect(instagramHref('@vconnect')).toBe('https://instagram.com/vconnect');
    expect(instagramHref('http://instagram.com/vconnect')).toBe('http://instagram.com/vconnect');
  });

  it('ignores stray whitespace', () => {
    expect(telegramHref('  @vconnect  ')).toBe('https://t.me/vconnect');
  });
});

describe('the promotional showcase', () => {
  const work = (slug: string, onCover = false) => ({ slug, onCover, title: slug } as unknown as PromoWork);

  it('shows the starred invitations on the cover', () => {
    const { works, cover } = splitWorks([work('a'), work('b', true), work('c', true)]);
    expect(works).toHaveLength(3);
    expect(cover.map((w) => w.slug)).toEqual(['b', 'c']);
  });

  it('falls back to the front of the list when nothing is starred', () => {
    // The hero can never render blank.
    const { cover } = splitWorks([work('a'), work('b')]);
    expect(cover.map((w) => w.slug)).toEqual(['a', 'b']);
  });

  it('renders fewer cover cards on a phone than on a desktop', () => {
    // Two rotated iframes get clipped on a phone.
    expect(COVER_SLOTS_MOBILE).toBeLessThan(COVER_SLOTS_DESKTOP);
    expect(COVER_SLOTS_MOBILE).toBeGreaterThan(0);
  });

  it('hides only the templates the administrator hid', () => {
    const all = [tpl('a'), tpl('b'), tpl('c')];
    expect(visibleTemplates({ ...EMPTY_SHOWCASE, hiddenIds: ['b'] }, all).map((t) => t.id)).toEqual(['a', 'c']);
  });

  it('shows a template mentioned in no list at all', () => {
    // Same rule as the price list: shipping a new design must not hide it
    // until someone re-saves this screen.
    const all = [tpl('a'), tpl('brand-new')];
    expect(visibleTemplates(EMPTY_SHOWCASE, all).map((t) => t.id)).toEqual(['a', 'brand-new']);
  });
});

describe('a schedule entry\'s "when"', () => {
  // A programme wants a clock; "Our story" wants years. Which input the builder
  // shows is stored per entry, and inferred for entries saved before it existed.
  it('honours an explicit choice', () => {
    expect(whenMode({ time: '2018', mode: 'time' } as never)).toBe('time');
    expect(whenMode({ time: '19:00', mode: 'text' } as never)).toBe('text');
  });

  it('infers a clock time', () => {
    for (const time of ['19:00', '9:05', '00:00']) {
      expect(whenMode({ time } as never)).toBe('time');
    }
  });

  it('infers free text', () => {
    for (const time of ['2018', 'Spring 2018', 'Summer', '19:00-20:00']) {
      expect(whenMode({ time } as never)).toBe('text');
    }
  });

  it('keeps the clock for an empty value, which is what most schedules are', () => {
    expect(whenMode({ time: '' } as never)).toBe('time');
    expect(whenMode({ time: '   ' } as never)).toBe('time');
    expect(whenMode({} as never)).toBe('time');
  });
});

describe('a number field you can actually empty', () => {
  // `Number('') === 0`, so clearing the box used to write 0 straight back and
  // the digit could not be deleted.
  it('commits nothing for an empty box', () => {
    expect(commitValue('')).toBeNull();
    expect(commitValue('   ')).toBeNull();
  });

  it('commits a number', () => {
    expect(commitValue('0')).toBe(0);
    expect(commitValue('42')).toBe(42);
    expect(commitValue('-3')).toBe(-3);
    expect(commitValue('1.5')).toBe(1.5);
  });

  it('commits nothing for text that is not a number', () => {
    for (const text of ['abc', '1px', '--', 'Infinity!']) expect(commitValue(text)).toBeNull();
  });

  it('distinguishes a typed zero from an empty box', () => {
    // The whole bug in one line: both used to arrive as 0.
    expect(commitValue('0')).toBe(0);
    expect(commitValue('')).toBeNull();
  });
});
