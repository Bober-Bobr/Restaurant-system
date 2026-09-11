import { describe, expect, it } from 'vitest';
import { RICH_TEMPLATES } from './index';
import { TEMPLATE_META, getTemplateMeta } from './meta';

/**
 * `meta.ts` is a second copy of facts the definitions already hold, and it
 * exists for one reason: importing a definition pulls its `template.html?raw`
 * with it, so asking the registry for twelve NAMES downloads twelve DESIGNS —
 * 374 kB gzipped that the marketing site was paying to draw a price list.
 *
 * A second copy that can drift is worse than the weight, so this is the guard:
 * it imports both (a test can afford the markup) and fails on any disagreement.
 * The same shape as `sectionAgreement.test.ts` and `invoiceAgreement.test.ts`,
 * for the same reason — two copies exist because one side cannot import the
 * other, and something has to notice when they part company.
 */
describe('the metadata agrees with the registry', () => {
  it('lists every design, in the same order', () => {
    // Order is what the price list and the chooser are drawn in, so it is part
    // of the agreement rather than an accident of how the file was typed.
    expect(TEMPLATE_META.map((m) => m.id)).toEqual(RICH_TEMPLATES.map((t) => t.id));
  });

  it.each(RICH_TEMPLATES.map((t) => [t.id, t] as const))('%s', (id, tpl) => {
    const meta = getTemplateMeta(id);
    expect(meta, `${id} ships but has no metadata — the marketing site cannot name it`).toBeTruthy();
    expect(meta!.category, 'category').toBe(tpl.category);
    expect(meta!.nameKey, 'nameKey — the card would show a raw translation key').toBe(tpl.nameKey);
    expect(meta!.cover, 'cover emoji').toBe(tpl.cover);
    // Compared case-insensitively: these are colours, and `#B8924E` and
    // `#b8924e` are the same one. Anything else is a real divergence — the
    // card would be a swatch of a colour the design does not use.
    expect(meta!.accent.toLowerCase(), 'accent').toBe(tpl.accent.toLowerCase());
  });

  it('carries nothing heavy', () => {
    // The whole point. If a field holding markup, a component or a config ever
    // appears here, the module stops being cheap and the split it exists for
    // quietly stops working — with nothing visibly broken to notice.
    const FIELDS = ['id', 'category', 'nameKey', 'cover', 'accent'];
    for (const meta of TEMPLATE_META) {
      expect(Object.keys(meta).sort(), `${meta.id} grew a field`).toEqual([...FIELDS].sort());
      for (const value of Object.values(meta)) {
        expect(typeof value, `${meta.id} holds a non-string`).toBe('string');
        expect((value as string).length, `${meta.id} holds something large`).toBeLessThan(80);
      }
    }
  });

  it('has no metadata for a design that no longer ships', () => {
    const shipped = new Set(RICH_TEMPLATES.map((t) => t.id));
    const orphans = TEMPLATE_META.filter((m) => !shipped.has(m.id)).map((m) => m.id);
    expect(orphans, 'offered on the marketing site but not in the registry').toEqual([]);
  });
});
