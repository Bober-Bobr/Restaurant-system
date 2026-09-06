import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { effectiveRatePerPerson, removedDishesCents } from './tablePricing';

/**
 * A table package is sold at a flat per-person rate covering everything in it. A
 * guest who does not want one of those dishes should not pay for it, so taking a
 * dish off the table takes its own menu price off the rate.
 *
 * Four screens have to agree on that figure — the kiosk's running total, the
 * Summary, the exported PDF and the Events page rebuilding an old booking — and
 * two of them recompute from a stored `menuConfig` rather than from anything the
 * tablet sent. A second copy of the arithmetic would quote a different price on
 * the invoice than the guest agreed to, which is why it lives in one file.
 */
const SRC = join(__dirname, '..');
const read = (rel: string) => readFileSync(join(SRC, rel), 'utf8');

const pi = (id: string, priceCents: number) => ({ id, menuItem: { priceCents } });
const PACKAGE = [pi('a', 30_000_00), pi('b', 12_000_00), pi('c', 8_000_00)];
const TABLE = { ratePerPerson: 250_000_00, packageItems: PACKAGE };

describe('what removing a dish takes off the rate', () => {
  it('is that dish\'s own price', () => {
    expect(removedDishesCents(PACKAGE, ['a'])).toBe(30_000_00);
    expect(effectiveRatePerPerson(TABLE, ['a'])).toBe(220_000_00);
  });

  it('adds up across several', () => {
    expect(effectiveRatePerPerson(TABLE, ['a', 'c'])).toBe(212_000_00);
  });

  it('is nothing at all when nothing was removed', () => {
    // The common case, and it must be byte-identical to the old flat rate.
    expect(effectiveRatePerPerson(TABLE, [])).toBe(TABLE.ratePerPerson);
    expect(effectiveRatePerPerson(TABLE, undefined)).toBe(TABLE.ratePerPerson);
    expect(removedDishesCents(PACKAGE, [])).toBe(0);
  });

  it('ignores an id that is not in this package', () => {
    // A stored config can outlive the package it was built against — a dish
    // deleted from the table since the booking must not deduct anything.
    expect(effectiveRatePerPerson(TABLE, ['gone'])).toBe(TABLE.ratePerPerson);
  });

  it('is keyed on the PACKAGE ITEM, not the dish', () => {
    // The same dish can sit in two slots; removing one slot is not removing both.
    const twice = [pi('slot1', 10_000_00), pi('slot2', 10_000_00)];
    expect(removedDishesCents(twice, ['slot1'])).toBe(10_000_00);
  });

  it('never goes below zero', () => {
    // A package is normally priced BELOW the sum of its dishes — that is the
    // point of a package — so removing enough of them would otherwise turn the
    // rate negative and hand the guest money.
    const cheap = { ratePerPerson: 20_000_00, packageItems: PACKAGE };
    expect(effectiveRatePerPerson(cheap, ['a', 'b', 'c'])).toBe(0);
  });

  it('survives a table with no package at all', () => {
    expect(effectiveRatePerPerson({ ratePerPerson: 100 }, ['a'])).toBe(100);
    expect(effectiveRatePerPerson(null, ['a'])).toBe(0);
    expect(effectiveRatePerPerson(undefined, [])).toBe(0);
  });
});

describe('every screen that prices a table uses the one rule', () => {
  it('the shared calculator applies it', () => {
    const hook = read('hooks/usePriceCalculator.ts');
    // The CALL, not just the import: a hook that imports it and then reads the
    // flat rate anyway would pass a presence check.
    expect(hook).toContain('effectiveRatePerPerson(tableCategory, removedPackageItemIds)');
    expect(hook, 'the flat rate is still being read directly').not.toMatch(
      /tableCategory\.ratePerPerson \* guestCount/,
    );
  });

  it('the kiosk and the Summary both pass what was removed', () => {
    for (const file of ['pages/TabletMenuPage.tsx', 'pages/TabletSummaryPage.tsx']) {
      const call = read(file).slice(read(file).indexOf('usePriceCalculator('));
      expect(call.slice(0, call.indexOf(';')), file).toContain('removedPackageItemIds');
    }
  });

  it('the Events page rebuilds an old booking the same way', () => {
    // It recomputes from the stored menuConfig, so it is the screen most likely
    // to quote a price the guest never agreed to.
    const src = read('utils/eventPdf.ts');
    expect(src).toContain('effectiveRatePerPerson(tableCategory, cfg?.removedPackageItemIds ?? [])');
  });

  it('the removal survives a round trip through the stored config', () => {
    expect(read('types/domain.ts')).toContain('removedPackageItemIds?: string[];');
    // Written on confirm…
    expect(read('pages/TabletSummaryPage.tsx')).toMatch(/replacements,\s*\n\s*removedPackageItemIds,/);
    // …and read back when the Events page reopens the menu flow.
    expect(read('store/tablet.store.ts')).toContain("removedPackageItemIds: cfg?.removedPackageItemIds ?? []");
  });

  it('a removed dish is left out of both documents', () => {
    // It has already been deducted; listing it would tell the kitchen to cook
    // something nobody is paying for.
    for (const file of ['pages/TabletSummaryPage.tsx', 'utils/eventPdf.ts']) {
      expect(read(file), file).toContain('!removed.includes(pi.id)');
    }
  });

  it('the removal is cleared when the table package changes', () => {
    // The ids belong to one package; carrying them to another would deduct
    // prices for slots that are not on the new table.
    const store = read('store/tablet.store.ts');
    const setTable = store.slice(store.indexOf('setTableCategory: (tableCategoryId)'));
    expect(setTable.slice(0, setTable.indexOf('\n  },'))).toContain('removedPackageItemIds: []');
  });

  it('removing a dish drops any free swap made on that slot', () => {
    // The swap is a choice about a dish that is no longer being served.
    expect(read('store/tablet.store.ts')).toContain('if (removing) delete replacements[packageItemId];');
  });
});
