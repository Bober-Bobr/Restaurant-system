import { describe, expect, it } from 'vitest';
import {
  formatSum, formatSumInput, formatWholeSum, groupDigits, parseWholeSum, parseSumToTiyin,
} from './currency';
import { cleanI18n, dishName, dishDescription } from './menuI18n';

// Money is an integer count of TIYIN (1/100 so'm) everywhere in the system. A
// rounding slip here is a wrong invoice, so the boundary between what a user
// types and what is stored gets walked in both directions.

describe('displaying money', () => {
  it('renders tiyin as whole so\'m', () => {
    expect(formatSum(450000000)).toBe("4 500 000 so'm");
    expect(formatSum(0)).toBe("0 so'm");
  });

  it('renders a whole-so\'m figure without dividing again', () => {
    // The ledger already holds so'm, not tiyin — dividing twice would show a
    // hundredth of the real figure.
    expect(formatWholeSum(4500000)).toBe("4 500 000 so'm");
  });

  it('gives an input field a plain number with no separators', () => {
    // Separators in a value bound to <input> would be re-parsed on every keystroke.
    expect(formatSumInput(450000000)).toBe('4500000');
    expect(formatSumInput(0)).toBe('0');
  });
});

describe('reading what a user typed', () => {
  it('accepts a plain figure', () => {
    expect(parseSumToTiyin('45000')).toBe(4500000);
    expect(parseWholeSum('45000')).toBe(45000);
  });

  it('accepts the separators people actually type', () => {
    for (const typed of ['45 000', '45,000', "45'000"]) {
      expect(parseSumToTiyin(typed)).toBe(4500000);
    }
  });

  it('accepts a figure with the currency typed after it', () => {
    expect(parseSumToTiyin("45000 so'm")).toBe(4500000);
    expect(parseSumToTiyin('45000 som')).toBe(4500000);
  });

  it('keeps the fractional part as tiyin', () => {
    expect(parseSumToTiyin('6.50')).toBe(650);
    expect(parseSumToTiyin('0.01')).toBe(1);
  });

  it('rejects an empty or half-typed value rather than reading it as zero', () => {
    // This is what stops the Menu page's autosave writing a price of 0 while
    // somebody is still typing one.
    for (const typed of ['', '   ', '.', 'abc', '45abc']) {
      expect(parseSumToTiyin(typed)).toBeNull();
      expect(parseWholeSum(typed)).toBeNull();
    }
  });

  it('rejects a negative price', () => {
    expect(parseSumToTiyin('-5')).toBeNull();
    expect(parseWholeSum('-5')).toBeNull();
  });

  it('round-trips a whole-so\'m price through the input field unchanged', () => {
    for (const tiyin of [0, 100, 4500000, 999999900]) {
      expect(parseSumToTiyin(formatSumInput(tiyin))).toBe(tiyin);
    }
  });

  it('cannot round-trip sub-so\'m precision, because the field is in so\'m', () => {
    // Worth pinning: an edit of a price carrying stray tiyin rounds it to the
    // nearest so'm. Prices are set in whole so'm, so this is the intended loss —
    // but a future "amount in tiyin" field would inherit it by accident.
    expect(formatSumInput(150)).toBe('2');
    expect(parseSumToTiyin(formatSumInput(150))).toBe(200);
  });
});

describe('grouping digits as they are typed', () => {
  it('inserts a separator every three digits', () => {
    expect(groupDigits('1000000')).toBe('1 000 000');
    expect(groupDigits('100')).toBe('100');
    expect(groupDigits('1000')).toBe('1 000');
  });

  it('ignores whatever else is in the box', () => {
    expect(groupDigits('1a0b0c0')).toBe('1 000');
    expect(groupDigits('')).toBe('');
    expect(groupDigits('abc')).toBe('');
  });
});

describe('per-dish translations', () => {
  const dish = {
    name: 'Lagman', description: 'Noodles',
    nameI18n: { ru: 'Лагман', uz: '  ' },
    descriptionI18n: { ru: 'Лапша' },
  };

  it('uses the active language when there is one', () => {
    expect(dishName(dish, 'ru')).toBe('Лагман');
    expect(dishDescription(dish, 'ru')).toBe('Лапша');
  });

  it('falls back to the base text rather than showing nothing', () => {
    expect(dishName(dish, 'en')).toBe('Lagman');
    expect(dishDescription(dish, 'uz')).toBe('Noodles');
  });

  it('treats a blank translation as no translation', () => {
    // An empty box in the builder must not blank the dish name on the site.
    expect(dishName(dish, 'uz')).toBe('Lagman');
  });

  it('copes with a dish that has no translations at all', () => {
    expect(dishName({ name: 'Plov' }, 'ru')).toBe('Plov');
    expect(dishDescription({ description: undefined }, 'ru')).toBeUndefined();
  });
});

describe('cleaning translations before they are stored', () => {
  it('trims each language', () => {
    expect(cleanI18n({ ru: '  Лагман  ' })).toEqual({ ru: 'Лагман' });
  });

  it('drops blank languages', () => {
    expect(cleanI18n({ ru: 'Лагман', uz: '   ', en: '' })).toEqual({ ru: 'Лагман' });
  });

  it('returns undefined when nothing is set, so no empty object is persisted', () => {
    expect(cleanI18n({})).toBeUndefined();
    expect(cleanI18n({ ru: '  ', uz: '' })).toBeUndefined();
    expect(cleanI18n(null)).toBeUndefined();
    expect(cleanI18n(undefined)).toBeUndefined();
  });

  it('keeps only the three languages the app has', () => {
    expect(cleanI18n({ ru: 'Лагман', fr: 'Nouilles' } as never)).toEqual({ ru: 'Лагман' });
  });
});
