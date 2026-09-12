import { describe, expect, it } from 'vitest';
import {
  TIER_BENEFITS, TIER_ORDER, TIER_PRICE_CENTS, telegramHref, instagramHref,
} from './pricing';
import { splitWorks, visibleTemplates, EMPTY_SHOWCASE } from './promoShowcase';
import { viDict } from './i18n';
import { whenMode } from './templates/utils';
import { commitValue } from '../components/ui/NumberField';
import type { PromoWork, TemplateTier } from './api';
import type { TemplateDefinition } from './templates/types';

// The v-invite product's pure decisions: what the price list shows, what the
// marketing page shows, and two input helpers shared across the builders.

const tpl = (id: string) => ({ id } as TemplateDefinition);

describe('what a category costs and what it buys', () => {
  /**
   * The price moved from the design to the CATEGORY.
   *
   * It used to live per template on `InviteTemplateOverride.priceCents` — twelve
   * figures to keep in step for a shop that quotes three, and a customer
   * choosing a tier could be shown whichever design inside it happened to be
   * cheapest. `groupByTier` and `sellableTemplates` sorted designs for that list
   * and are gone with it.
   */
  it('prices all three categories, cheapest first', () => {
    expect(TIER_ORDER).toEqual(['STANDARD', 'PREMIUM', 'LUXURY']);
    for (const tier of TIER_ORDER) {
      expect(TIER_PRICE_CENTS[tier], `${tier} has no price`).toBeGreaterThan(0);
    }
    const prices = TIER_ORDER.map((tier) => TIER_PRICE_CENTS[tier]);
    expect([...prices].sort((a, b) => a - b), 'the ladder does not climb').toEqual(prices);
  });

  it('keeps the prices in tiyin, like every other price here', () => {
    // A figure typed in so'm would quote a hundredth of the real price, and
    // nothing downstream would notice: `formatSum` divides by 100 either way.
    for (const tier of TIER_ORDER) {
      expect(TIER_PRICE_CENTS[tier] % 100, `${tier} is not a whole so'm`).toBe(0);
      expect(TIER_PRICE_CENTS[tier], `${tier} looks like so'm, not tiyin`).toBeGreaterThanOrEqual(100_000);
    }
  });

  it('gives every category something to show for the money', () => {
    for (const tier of TIER_ORDER) {
      expect(TIER_BENEFITS[tier].length, `${tier} lists no benefits`).toBeGreaterThan(0);
    }
  });

  it('makes each rung include the one below it', () => {
    /**
     * The ladder has to be literal, because that is the whole argument for
     * paying more. Premium must not quietly DROP something Standard has — a
     * dearer tier offering less is the one thing a price list cannot do — so
     * every benefit of a cheaper tier has to reappear in the dearer ones, or be
     * deliberately replaced by an upgrade of the same thing.
     */
    const UPGRADES: Record<string, string> = { anim: 'anim_pro' };
    for (let i = 1; i < TIER_ORDER.length; i += 1) {
      const below = TIER_BENEFITS[TIER_ORDER[i - 1]!]!;
      const here = new Set(TIER_BENEFITS[TIER_ORDER[i]!]!);
      const lost = below.filter((key) => !here.has(key) && !here.has(UPGRADES[key] ?? ''));
      expect(lost, `${TIER_ORDER[i]} costs more than ${TIER_ORDER[i - 1]} but drops: ${lost.join(', ')}`)
        .toEqual([]);
    }
  });

  it('grows as it climbs', () => {
    // Same list at a higher price is not a tier, it is a markup.
    for (let i = 1; i < TIER_ORDER.length; i += 1) {
      const below = TIER_BENEFITS[TIER_ORDER[i - 1]!]!;
      const here = TIER_BENEFITS[TIER_ORDER[i]!]!;
      const same = below.length === here.length && below.every((k, j) => k === here[j]);
      expect(same, `${TIER_ORDER[i]} offers exactly what ${TIER_ORDER[i - 1]} does`).toBe(false);
    }
  });

  it('names a benefit string that actually exists, in every language', () => {
    // The keys are suffixes resolved as `pricing_b_<key>`; a typo renders the
    // raw key on the marketing page rather than failing.
    for (const tier of TIER_ORDER) {
      for (const key of TIER_BENEFITS[tier]) {
        for (const lang of ['en', 'ru', 'uz'] as const) {
          const full = `pricing_b_${key}`;
          expect(full in viDict[lang], `${full} is missing from ${lang}`).toBe(true);
        }
      }
    }
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
