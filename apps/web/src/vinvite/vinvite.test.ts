import { describe, expect, it } from 'vitest';
import { groupByTier, sellableTemplates, telegramHref, instagramHref, TIER_ORDER } from './pricing';
import { splitWorks, visibleTemplates, EMPTY_SHOWCASE } from './promoShowcase';
import { viDict } from './i18n';
import { whenMode } from './templates/utils';
import { commitValue } from '../components/ui/NumberField';
import type { PromoWork, TemplateTier } from './api';
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

describe('what the public price list may quote', () => {
  /**
   * `sellableTemplates` deliberately REVERSES the rule above, and only for the
   * visitor.
   *
   * `groupByTier` keeps an uncategorised design visible so that shipping a new
   * one cannot make it silently vanish — right for the administrator, who needs
   * to see that something is unpriced. It is wrong for a shop window, where it
   * shows a customer a product with no price and no category and invites them
   * to buy it. So the public site filters first and the admin screens do not.
   */
  const price = (tier: unknown, priceCents: number | null) =>
    ({ tier, priceCents } as { tier: TemplateTier | null; priceCents: number | null });

  it('quotes a design that has both a tier and a price', () => {
    const m = new Map([['a', price('PREMIUM', 150_000_00)]]);
    expect(sellableTemplates([tpl('a')], m).map((t) => t.id)).toEqual(['a']);
  });

  it('drops a design with no tier, even when it is priced', () => {
    const m = new Map([['a', price(null, 150_000_00)]]);
    expect(sellableTemplates([tpl('a')], m)).toEqual([]);
  });

  it('drops a design with no price, even when it is categorised', () => {
    const m = new Map([['a', price('PREMIUM', null)]]);
    expect(sellableTemplates([tpl('a')], m)).toEqual([]);
  });

  it('drops a design nobody has touched at all', () => {
    expect(sellableTemplates([tpl('brand-new')], new Map())).toEqual([]);
  });

  it('keeps a design priced at zero', () => {
    // Free is a price. `priceCents` is nullable precisely so that "given away"
    // stays distinguishable from "never priced", and a falsy check here would
    // collapse the two and hide a design the studio meant to offer.
    const m = new Map([['a', price('STANDARD', 0)]]);
    expect(sellableTemplates([tpl('a')], m).map((t) => t.id)).toEqual(['a']);
  });

  it('drops a tier this build does not know', () => {
    // Same reasoning as groupByTier: an unrecognised tier has no column, so a
    // design carrying one would be quoted into a bucket that is not rendered.
    const m = new Map([['a', price('PLATINUM', 100)]]);
    expect(sellableTemplates([tpl('a')], m)).toEqual([]);
  });

  it('preserves the order it was given', () => {
    const m = new Map([
      ['b', price('STANDARD', 1)], ['a', price('LUXURY', 2)], ['c', price('PREMIUM', 3)],
    ]);
    expect(sellableTemplates([tpl('a'), tpl('b'), tpl('c')], m).map((t) => t.id))
      .toEqual(['a', 'b', 'c']);
  });

  it('leaves the admin-facing grouping alone', () => {
    // The safety valve moved rather than disappeared: groupByTier must still
    // surface an unpriced design, or the person who can price it cannot see it.
    const { unassigned } = groupByTier([tpl('a')], new Map());
    expect(unassigned.map((t) => t.id)).toEqual(['a']);
  });
});

describe('the three v-invite dictionaries', () => {
  /**
   * There was no check on this, and removing a retired section's strings is
   * exactly when it bites: the keys are spread across three separate object
   * literals hundreds of lines apart, and taking a key out of one of them is a
   * silent partial deletion. `viT` falls back rather than throwing, so the
   * survivor renders in whichever language still has it — the reason
   * `translate.test.ts` reads the source rather than calling translate.
   *
   * Done against the real export, not the file, so it covers however the
   * dictionaries come to be written.
   */
  const langs = Object.keys(viDict) as (keyof typeof viDict)[];

  it('offers the same keys in every language', () => {
    expect(langs.sort()).toEqual(['en', 'ru', 'uz']);
    const keysOf = (l: keyof typeof viDict) => Object.keys(viDict[l]).sort();
    const base = keysOf('en');
    for (const lang of langs) {
      const missing = base.filter((k) => !(k in viDict[lang]));
      const extra = keysOf(lang).filter((k) => !base.includes(k));
      expect(missing, `${lang} is missing keys English has`).toEqual([]);
      expect(extra, `${lang} has keys English does not`).toEqual([]);
    }
  });

  it('leaves no string empty', () => {
    // An empty string is not a missing key: the fallback never fires, and the
    // label renders as nothing at all.
    for (const lang of langs) {
      const blank = Object.entries(viDict[lang])
        .filter(([, v]) => typeof v === 'string' && !v.trim())
        .map(([k]) => k);
      expect(blank, `${lang} has blank strings`).toEqual([]);
    }
  });

  it('keeps apostrophes out of the Uzbek strings', () => {
    // A repo-wide convention: uz avoids them, because the modifier letter and
    // the typewriter apostrophe are constantly confused and several of the
    // display faces draw one of them badly.
    const offenders = Object.entries(viDict.uz)
      .filter(([, v]) => typeof v === 'string' && /['’ʻ]/.test(v))
      .map(([k]) => k);
    expect(offenders, 'uz strings must avoid apostrophes').toEqual([]);
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

  it('leads the gallery with the starred invitations', () => {
    // A star used to mean "ride the hero as a live card". The hero renders no
    // cards any more, so it means "show this one first" — the same intent said
    // against what the page actually has, rather than a setting doing nothing.
    const { works, cover } = splitWorks([work('a'), work('b', true), work('c', true)]);
    expect(works.map((w) => w.slug)).toEqual(['b', 'c', 'a']);
    expect(cover.map((w) => w.slug)).toEqual(['b', 'c']);
  });

  it('leaves the order alone when nothing is starred', () => {
    const { works, cover } = splitWorks([work('a'), work('b')]);
    expect(works.map((w) => w.slug)).toEqual(['a', 'b']);
    expect(cover).toEqual([]);
  });

  it('leaves the order alone when everything is starred', () => {
    // A stable partition, not a sort: starring all of them must not reshuffle
    // the order the administrator dragged them into.
    const { works } = splitWorks([work('a', true), work('b', true), work('c', true)]);
    expect(works.map((w) => w.slug)).toEqual(['a', 'b', 'c']);
  });

  it('never loses an invitation', () => {
    const { works } = splitWorks([work('a'), work('b', true), work('c'), work('d', true)]);
    expect(works.map((w) => w.slug).sort()).toEqual(['a', 'b', 'c', 'd']);
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
