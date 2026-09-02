import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Every screen that downloads a PDF or spreadsheet builds the request body
 * itself, and the restaurant's logo is one of the fields. Two of the three
 * screens never filled it in — `AdminEventsPage` sent a literal `null` and
 * `EmployeeEventsPage` sent nothing at all — and the exporter then substituted a
 * logo bundled in the repo, which was one particular restaurant's. Every other
 * tenant's document went out under that brand.
 *
 * The server no longer substitutes anything, so the worst case is now a plain
 * document. This is the other half: the screens should send the real logo, and
 * a new export screen should not be able to ship with a hardcoded null.
 *
 * Source-reading, in the style of `translate.test.ts`: the suite has no DOM, and
 * what is asserted is which value a call site passes.
 */
const SRC = join(__dirname, '..');
const read = (rel: string) => readFileSync(join(SRC, rel), 'utf8');

const EXPORT_SCREENS = ['pages/AdminEventsPage.tsx', 'pages/EmployeeEventsPage.tsx'];

describe('an exported document carries its own restaurant brand', () => {
  for (const file of EXPORT_SCREENS) {
    it(`${file} sends a real logo, not a hardcoded null`, () => {
      const src = read(file);
      expect(src, `${file} still hardcodes restaurantLogoUrl: null`).not.toMatch(
        /restaurantLogoUrl:\s*null/,
      );
      expect(src, `${file} does not send a logo at all`).toContain('restaurantLogoUrl');
    });

    it(`${file} gets it from the shared hook`, () => {
      // One place decides which logo belongs on a document. Reading it from
      // somewhere else per screen is how two of them ended up with none.
      expect(read(file)).toContain('useRestaurantBranding');
    });
  }

  it('the tablet summary, which was always correct, still sends one', () => {
    // It is the screen that got this right; the fix must not have moved it.
    expect(read('pages/TabletSummaryPage.tsx')).toMatch(/restaurantLogoUrl:\s*restaurantLogoUrl\s*\?\?\s*null/);
  });

  it('the shared hook reads the signed-in restaurant, not a fixed one', () => {
    const hook = read('hooks/useRestaurantBranding.ts');
    expect(hook).toContain('s.restaurantId');
    expect(hook).toContain('publicRestaurantService.get');
  });

  it('no export payload names a logo file in the repo', () => {
    // A client-side fallback would recreate the bug on the other side.
    for (const file of [...EXPORT_SCREENS, 'utils/eventPdf.ts', 'hooks/useRestaurantBranding.ts']) {
      expect(read(file), file).not.toMatch(/logo\.png|assets\/logo/);
    }
  });
});
