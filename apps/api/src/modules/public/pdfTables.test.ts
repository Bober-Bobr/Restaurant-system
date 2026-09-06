import { describe, expect, it } from 'vitest';
import {
  SERVED_CATEGORIES,
  groupDishesByCategory,
  isServedCategory,
  servedPortions,
  splitServedBlocks,
} from './pdf.service.js';

/**
 * The banquet PDF is the sheet the kitchen works from, and it was laid out in
 * the order the payload happened to be built rather than the order the evening
 * runs in:
 *
 * - a hot appetizer asked for ONE portion at a banquet for two hundred;
 * - a category with both included and paid dishes was printed twice, under the
 *   same heading, in two different halves of the document;
 * - the four courses that are carried out during the evening were split between
 *   the very top and the very bottom, with the whole cold table in between.
 *
 * The layout itself is PDFKit drawing calls, so what is covered here is the
 * arrangement that feeds it — which rows exist, with what quantity, in which
 * block, in which of the two tables.
 */
const label = (category: string) => `label:${category}`;
const dish = (name: string, category: string, servings?: number) => ({
  name,
  category,
  categoryLabel: `label:${category}`,
  ...(servings === undefined ? {} : { servings }),
});

describe('a hot appetizer is one per guest', () => {
  it('takes the head count, not the package servings', () => {
    // The reported bug: `servings` is what the package declares for a dish, and
    // for a hot appetizer that was 1 — so the kitchen was asked for one plate.
    expect(servedPortions(dish('Kebab', 'HOT_APPETIZERS', 1), 200)).toBe(200);
    expect(servedPortions(dish('Kebab', 'HOT_APPETIZERS'), 200)).toBe(200);
  });

  it('leaves every other dish on its declared servings', () => {
    // A salad shared by a table of ten is one bowl, not ten. Only the hot
    // appetizer is plated per head.
    expect(servedPortions(dish('Achichuk', 'SALADS_OIL', 4), 200)).toBe(4);
    expect(servedPortions(dish('Non', 'PASTRY'), 200)).toBe(1);
    expect(servedPortions(dish('Shurpa', 'FIRST_COURSE', 2), 200)).toBe(2);
  });

  it('is zero guests, not one, on a booking with no head count', () => {
    // The Summary page no longer requires a guest count, so this is reachable.
    expect(servedPortions(dish('Kebab', 'HOT_APPETIZERS', 1), 0)).toBe(0);
    expect(servedPortions(dish('Kebab', 'HOT_APPETIZERS', 1), -5)).toBe(0);
  });
});

describe('paid dishes join the block of their own category', () => {
  it('an added salad lands under the salad heading, not a second one', () => {
    const blocks = groupDishesByCategory(
      [dish('Achichuk', 'SALADS_OIL', 4)],
      [{ name: 'Caesar', category: 'SALADS_OIL', qty: 200 }],
      200,
      label,
    );
    expect(blocks).toHaveLength(1);
    expect(blocks[0]!.rows.map((r) => r.name)).toEqual(['Achichuk', 'Caesar']);
  });

  it('what the package gives comes before what was added', () => {
    const blocks = groupDishesByCategory(
      [dish('A', 'PASTRY', 2), dish('B', 'PASTRY', 2)],
      [{ name: 'Paid', category: 'PASTRY', qty: 200 }],
      200,
      label,
    );
    expect(blocks[0]!.rows.map((r) => r.name)).toEqual(['A', 'B', 'Paid']);
  });

  it('a category with only paid dishes still gets a block', () => {
    const blocks = groupDishesByCategory([], [{ name: 'Wine', category: 'ALCOHOL', qty: 12 }], 200, label);
    expect(blocks).toEqual([
      { category: 'ALCOHOL', label: 'label:ALCOHOL', rows: [{ name: 'Wine', category: 'ALCOHOL', qty: '12' }] },
    ]);
  });

  it('a paid dish keeps its own quantity, which is not the head count', () => {
    // Extras are priced per guest by the caller, but a service or an amended
    // order may not be, so the quantity is passed through untouched.
    const blocks = groupDishesByCategory([], [{ name: 'Wine', category: 'ALCOHOL', qty: 12 }], 200, label);
    expect(blocks[0]!.rows[0]!.qty).toBe('12');
  });

  it('blocks keep first-seen order', () => {
    const blocks = groupDishesByCategory(
      [dish('a', 'PASTRY'), dish('b', 'SALADS_OIL')],
      [{ name: 'c', category: 'DESSERT', qty: 1 }, { name: 'd', category: 'PASTRY', qty: 1 }],
      10,
      label,
    );
    expect(blocks.map((b) => b.category)).toEqual(['PASTRY', 'SALADS_OIL', 'DESSERT']);
  });
});

describe('what is served during the evening goes in its own table, first', () => {
  it('names the four courses, in serving order', () => {
    expect(SERVED_CATEGORIES).toEqual(['HOT_APPETIZERS', 'FIRST_COURSE', 'SECOND_COURSE', 'THIRD_COURSE']);
    // SECOND_COURSE is the main course — the enum is named for when it is
    // served, not for what it is.
    expect(isServedCategory('SECOND_COURSE')).toBe(true);
    expect(isServedCategory('SALADS_OIL')).toBe(false);
  });

  it('lifts them out of the payload order and into serving order', () => {
    // The payload builds hot appetizers first, then the cold table, then the
    // courses — so on the page the courses were pages below the appetizers.
    const blocks = groupDishesByCategory(
      [
        dish('Kebab', 'HOT_APPETIZERS', 1),
        dish('Achichuk', 'SALADS_OIL', 4),
        dish('Shurpa', 'FIRST_COURSE', 1),
        dish('Plov', 'SECOND_COURSE', 1),
        dish('Chak-chak', 'THIRD_COURSE', 1),
      ],
      [],
      120,
      label,
    );
    const { served, rest } = splitServedBlocks(blocks);
    expect(served.map((b) => b.category)).toEqual([
      'HOT_APPETIZERS', 'FIRST_COURSE', 'SECOND_COURSE', 'THIRD_COURSE',
    ]);
    expect(rest.map((b) => b.category)).toEqual(['SALADS_OIL']);
  });

  it('carries the per-guest hot appetizer quantity into that table', () => {
    const { served } = splitServedBlocks(
      groupDishesByCategory([dish('Kebab', 'HOT_APPETIZERS', 1)], [], 120, label),
    );
    expect(served[0]!.rows[0]!.qty).toBe('120');
  });

  it('a paid course is served too, so it joins the top table', () => {
    const { served, rest } = splitServedBlocks(
      groupDishesByCategory([], [{ name: 'Extra plov', category: 'SECOND_COURSE', qty: 40 }], 120, label),
    );
    expect(served.map((b) => b.category)).toEqual(['SECOND_COURSE']);
    expect(served[0]!.rows).toEqual([{ name: 'Extra plov', category: 'SECOND_COURSE', qty: '40' }]);
    expect(rest).toEqual([]);
  });

  it('skips a course nobody chose rather than printing an empty heading', () => {
    const { served } = splitServedBlocks(
      groupDishesByCategory([dish('Plov', 'SECOND_COURSE', 1)], [], 120, label),
    );
    expect(served.map((b) => b.category)).toEqual(['SECOND_COURSE']);
  });

  it('leaves nothing behind — every dish lands in exactly one table', () => {
    const included = [
      dish('Kebab', 'HOT_APPETIZERS', 1), dish('Achichuk', 'SALADS_OIL', 4),
      dish('Non', 'PASTRY', 2), dish('Plov', 'SECOND_COURSE', 1),
    ];
    const additional = [
      { name: 'Caesar', category: 'SALADS_OIL', qty: 120 },
      { name: 'Wine', category: 'ALCOHOL', qty: 12 },
      { name: 'Extra shurpa', category: 'FIRST_COURSE', qty: 30 },
    ];
    const { served, rest } = splitServedBlocks(groupDishesByCategory(included, additional, 120, label));
    const names = [...served, ...rest].flatMap((b) => b.rows.map((r) => r.name));
    expect(names.sort()).toEqual(
      ['Achichuk', 'Caesar', 'Extra shurpa', 'Kebab', 'Non', 'Plov', 'Wine'].sort(),
    );
    // …and in exactly one: no dish is printed under two headings any more.
    expect(new Set(names).size).toBe(names.length);
  });

  it('an empty booking produces neither table', () => {
    const { served, rest } = splitServedBlocks(groupDishesByCategory([], [], 0, label));
    expect(served).toEqual([]);
    expect(rest).toEqual([]);
  });
});
