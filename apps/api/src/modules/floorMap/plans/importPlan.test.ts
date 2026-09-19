import { describe, expect, it } from 'vitest';
import { FLOOR_PLANS } from './index.js';
import { matchRestaurant, planProblems, planSeats } from './importPlan.js';
import { sangizarStreet } from './sangizarStreet.js';

const RESTAURANTS = [
  { id: 'r1', name: 'Sangizar' },
  { id: 'r2', name: 'Sangizar Lounge' },
  { id: 'r3', name: 'Registon' },
  { id: 'r4', name: 'Afsona' },
];

describe('choosing the restaurant a plan goes into', () => {
  it('an exact name wins over names that merely contain it', () => {
    // "Sangizar" is inside "Sangizar Lounge" too; the exact one is meant.
    expect(matchRestaurant(RESTAURANTS, 'sangizar ')).toEqual({ ok: true, restaurant: RESTAURANTS[0] });
  });

  it('an id always works', () => {
    expect(matchRestaurant(RESTAURANTS, 'r2')).toEqual({ ok: true, restaurant: RESTAURANTS[1] });
  });

  it('a single partial match is accepted', () => {
    expect(matchRestaurant(RESTAURANTS, 'regis')).toEqual({ ok: true, restaurant: RESTAURANTS[2] });
  });

  it('two partial matches are refused and both listed — a plan in the wrong restaurant is eighty wrong tables', () => {
    const match = matchRestaurant(RESTAURANTS, 'sang');
    expect(match.ok).toBe(false);
    if (!match.ok) {
      expect(match.reason).toBe('ambiguous');
      expect(match.candidates.map((r) => r.id)).toEqual(['r1', 'r2']);
    }
  });

  it('no match lists every restaurant so the right spelling can be copied', () => {
    const match = matchRestaurant(RESTAURANTS, 'Сангизар');
    expect(match).toMatchObject({ ok: false, reason: 'none' });
    if (!match.ok) expect(match.candidates).toHaveLength(4);
    // An empty query is no match at all, not "everything contains it".
    expect(matchRestaurant(RESTAURANTS, '  ')).toMatchObject({ ok: false, reason: 'none' });
  });
});

describe('the ready-made plans', () => {
  for (const plan of Object.values(FLOOR_PLANS)) {
    it(`${plan.id} passes the rules the API applies to a supervisor's own edits`, () => {
      expect(planProblems(plan)).toEqual([]);
    });
  }

  it('a broken plan is described, not loaded', () => {
    const broken = {
      ...sangizarStreet,
      tables: [...sangizarStreet.tables, { ...sangizarStreet.tables[0] }, { ...sangizarStreet.tables[1], label: 'x', seats: 99 }],
    };
    const problems = planProblems(broken);
    expect(problems.some((p) => p.includes('used twice'))).toBe(true);
    expect(problems.some((p) => p.includes('(x)'))).toBe(true);
  });

  it('Sangizar Street is an outdoor area with the zones on the sheet, and none of its handwriting', () => {
    expect(sangizarStreet.kind).toBe('OUTDOOR');
    const labels = sangizarStreet.features.map((f) => f.label).filter(Boolean);
    for (const zone of ['Терраса', 'Бунгал', 'Сцена', 'Ц. бассейн', 'Слад. бар', 'New zal', 'Центр сцена', 'Ц. стар. бар']) {
      expect(labels, zone).toContain(zone);
    }
    // The pen notes were one evening's bookings: names, phones, head counts.
    const text = JSON.stringify(sangizarStreet);
    expect(text).not.toMatch(/\d{2}[- ]?\d{3}[- ]?\d{2}[- ]?\d{2}/); // phone numbers
    // Not \b: in JS it only knows ASCII letters, so `\d+ч\b` never matches "4ч".
    const HEAD_COUNT = /\d+\s?ч(?![а-яё])|\dх\+/i;
    expect('гость 4ч +').toMatch(HEAD_COUNT); // the guard itself works
    expect(text).not.toMatch(HEAD_COUNT);
    expect(planSeats(sangizarStreet)).toBeGreaterThan(200);
  });
});
