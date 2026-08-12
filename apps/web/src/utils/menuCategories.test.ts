import { describe, expect, it } from 'vitest';
import { CATEGORY_ORDER, CATEGORY_LABEL_KEY, orderCategories } from './menuCategories';
import { translate, locales } from './translate';

// One copy of the 35-category table serves the live catering site and the new
// food-service site. A gap here shows up as a category with no heading.

describe('the category table', () => {
  it('labels every category', () => {
    for (const category of CATEGORY_ORDER) {
      expect(CATEGORY_LABEL_KEY[category]).toBeTruthy();
    }
  });

  it('has a real translation for every label, in all three languages', () => {
    for (const category of CATEGORY_ORDER) {
      const key = CATEGORY_LABEL_KEY[category];
      for (const locale of locales) {
        // `translate` returns the key itself when a string is missing, which is
        // exactly the state this is looking for.
        expect(translate(key, locale)).not.toBe(key);
      }
    }
  });

  it('lists no category twice', () => {
    expect(new Set(CATEGORY_ORDER).size).toBe(CATEGORY_ORDER.length);
  });

  it('labels nothing that is not in the order', () => {
    for (const key of Object.keys(CATEGORY_LABEL_KEY)) {
      expect(CATEGORY_ORDER).toContain(key);
    }
  });
});

describe('a restaurant\'s own category order', () => {
  it('is used as given', () => {
    const arranged = orderCategories(['GRILL', 'SOUPS']);
    expect(arranged[0]).toBe('GRILL');
    expect(arranged[1]).toBe('SOUPS');
  });

  it('APPENDS the categories the arrangement never mentioned', () => {
    // Otherwise adding a category to the platform hides it from every
    // restaurant that arranged its menu before that category existed.
    const arranged = orderCategories(['GRILL']);
    expect(arranged).toHaveLength(CATEGORY_ORDER.length);
    expect(new Set(arranged).size).toBe(CATEGORY_ORDER.length);
  });

  it('ignores a category that no longer exists', () => {
    const arranged = orderCategories(['BURGERS', 'GRILL']);
    expect(arranged).not.toContain('BURGERS');
    expect(arranged[0]).toBe('GRILL');
  });

  it('falls back to the shipped order when nothing is saved', () => {
    for (const saved of [null, undefined, []]) {
      expect(orderCategories(saved)).toEqual(CATEGORY_ORDER);
    }
  });

  it('never loses or duplicates a category, whatever it is given', () => {
    const arranged = orderCategories(['GRILL', 'GRILL', 'nonsense', 'SOUPS']);
    expect(new Set(arranged).size).toBe(arranged.length);
    for (const category of CATEGORY_ORDER) expect(arranged).toContain(category);
  });
});
