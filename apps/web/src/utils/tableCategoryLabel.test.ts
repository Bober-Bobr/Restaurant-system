import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { formatSum } from './currency';
import { tableCategoryLabel, tableCategoryPrice } from './tableCategoryLabel';

const SRC = join(__dirname, '..');
const read = (rel: string) => readFileSync(join(SRC, rel), 'utf8');

const STANDARD = { name: 'Standart', ratePerPerson: 25_000_00 };

describe('a table category is named with its price', () => {
  it('writes the rate per person', () => {
    expect(tableCategoryPrice(STANDARD, 'person')).toBe(`${formatSum(STANDARD.ratePerPerson)} / person`);
  });

  it('puts the name first, then the price', () => {
    // The guest is scanning for the name; the price is what they compare on.
    expect(tableCategoryLabel(STANDARD, 'person')).toBe(`Standart · ${formatSum(STANDARD.ratePerPerson)} / person`);
  });

  it('takes the "person" word from the caller, so it is translated', () => {
    // This file has no locale. The caller holds a bound `t`.
    expect(tableCategoryLabel(STANDARD, 'kishi')).toContain('kishi');
    expect(tableCategoryLabel(STANDARD, 'человек')).toContain('человек');
  });

  it('says nothing clever about a free table', () => {
    // A rate of zero is a real configuration (a package priced elsewhere), and
    // it must read as a price rather than vanish.
    expect(tableCategoryLabel({ name: 'Nahor', ratePerPerson: 0 }, 'person')).toBe(`Nahor · ${formatSum(0)} / person`);
  });
});

describe('the kiosk shows it everywhere the category is named', () => {
  /**
   * A table category IS a price package — `ratePerPerson × guests` is the whole
   * event total. The big chooser slide showed the price, and every screen after
   * it dropped it, so from the moment a guest picked a package the figure they
   * picked it for was off the screen. These are the places that named it.
   */
  const menu = read('pages/TabletMenuPage.tsx');
  const summary = read('pages/TabletSummaryPage.tsx');

  it('in the table-category dropdown', () => {
    expect(menu).toMatch(/<option key=\{tc\.id\} value=\{tc\.id\}>\{tableCategoryLabel\(tc, t\('person'\)\)\}<\/option>/);
  });

  it('in the chip confirming what was chosen', () => {
    expect(menu).toMatch(/tableCategoryLabel\(selectedTableCategory, t\('person'\)\)/);
  });

  it('above the course and included-dish sections, and the table photos', () => {
    // All three render the name through `.rg-label`, so they share one
    // component rather than three copies of the same span.
    expect(menu).toContain('function TablePrice(');
    expect(menu.match(/<TablePrice category=/g)?.length ?? 0).toBeGreaterThanOrEqual(3);
  });

  it('in the summary\'s event overview, for the table and the children\'s table', () => {
    expect(summary).toMatch(/label: t\('table_category'\), value: selectedTableCategory \? tableCategoryLabel\(/);
    expect(summary).toMatch(/label: t\('children_table'\), value: `\$\{tableCategoryLabel\(childrenTableCategory!/);
  });

  it('and no screen formats the rate by hand instead', () => {
    // `formatSum(tc.ratePerPerson)` at a call site is how the separator and the
    // suffix drift apart between the eight places this appears. The two big
    // chooser slides predate the helper and set the price as its own display
    // element, at their own size — those are the exceptions.
    for (const [name, src] of [['menu', menu], ['summary', summary]] as const) {
      const byHand = src.match(/formatSum\((?:tc|tableCategory|selectedTableCategory|category)[.!?]*\.?\w*ratePerPerson\)/g) ?? [];
      expect(byHand.length, `${name}: ${byHand.join(', ')}`).toBeLessThanOrEqual(2);
    }
  });
});
