import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The marketing page must not download the invitation designs.
 *
 * Every rich template ships as `import html from './template.html?raw'`, so a
 * single value-import of the registry pulls all twelve designs — 374 kB gzipped
 * — into whatever chunk did the importing. Measured on the built bundle with a
 * real browser: `/main` was fetching **2653 kB** to render a hero and a list of
 * names, and **546 kB** once the chain was cut.
 *
 * The failure mode is why this file exists rather than a note in a comment.
 * Adding `import { getTemplate } from './templates'` to the landing page
 * changes nothing you can see: the page still renders, the tests still pass,
 * the layout is identical — and the bundle silently quadruples. It happened
 * twice while this was being written, the second time through
 * `promoShowcase.ts`, which the page calls on its first line and which imported
 * the registry only to use it as a default argument.
 *
 * So the guard is on the IMPORTS, which is where the cost is decided.
 */
const DIR = __dirname;
const read = (f: string) => readFileSync(join(DIR, f), 'utf8');

/** Modules that carry a template's markup, directly or one hop away. */
const HEAVY = [
  './templates',            // the registry — all twelve designs
  './templates/RichRenderer',
  './InviteSiteView',       // dispatches to the registry
  './templateOverrides',    // Design+ configs, only needed to render one
  './LivePreviewModal',     // the lazy boundary itself
];

/**
 * Static (value) imports only.
 *
 * `import type` is erased at build time and costs nothing, which is exactly how
 * the landing page names `PreviewTarget` without pulling the module that
 * defines it — so counting it here would fail a file that is correct.
 */
function valueImports(src: string): string[] {
  const out: string[] = [];
  for (const m of src.matchAll(/^import\s+([^;]*?)\s*from\s*['"]([^'"]+)['"]/gm)) {
    const clause = m[1].trim();
    if (clause.startsWith('type ')) continue;                 // import type { X } from
    if (/^\{\s*type\s[^}]*\}$/.test(clause)) continue;         // import { type X } from
    out.push(m[2]);
  }
  return out;
}

describe('LandingPage.tsx', () => {
  const src = read('LandingPage.tsx');

  it('imports nothing that carries a design with it', () => {
    const offenders = valueImports(src).filter((spec) => HEAVY.includes(spec));
    expect(
      offenders,
      'the marketing page would download all twelve invitation designs to draw a '
      + `list of names — import these lazily or from templates/meta: ${offenders.join(', ')}`,
    ).toEqual([]);
  });

  it('reaches the live renderer through a lazy boundary', () => {
    expect(src, 'the preview is no longer split out').toMatch(
      /lazy\(\s*\(\)\s*=>\s*import\(\s*'\.\/LivePreviewModal'\s*\)/,
    );
    // A lazy component with no Suspense above it throws on first render.
    expect(src, 'nothing catches the lazy boundary').toContain('<Suspense');
  });

  it('draws its cards from the metadata', () => {
    expect(valueImports(src), 'the page has no source of names at all')
      .toContain('./templates/meta');
  });
});

describe('promoShowcase.ts', () => {
  // The leak that survived the first attempt. This module is the first thing
  // the landing page calls, and it imported the registry only to use it as a
  // default argument — which put every design back into the page's chunk with
  // nothing visibly different.
  it('does not reach the registry for a default argument', () => {
    const offenders = valueImports(read('promoShowcase.ts')).filter((s) => HEAVY.includes(s));
    expect(offenders, 'a default argument is pulling in every design').toEqual([]);
  });
});

describe('VInviteApp.tsx', () => {
  const src = read('VInviteApp.tsx');

  it('splits the published invitation off the shell', () => {
    // The shell is shared by the marketing page, the published invitation and
    // the admin. Statically importing the published page put the registry into
    // all three.
    expect(src, 'PublicVInvitePage is back in the shell chunk')
      .toMatch(/lazy\(\s*\(\)\s*=>\s*import\('\.\/PublicVInvitePage'\)/);
    expect(valueImports(src)).not.toContain('./PublicVInvitePage');
  });

  it('splits the builder off too', () => {
    for (const page of ['./EditorPage', './TemplatesPage', './TemplateDesignerPage']) {
      expect(valueImports(src), `${page} is in the shell chunk`).not.toContain(page);
    }
  });

  it('keeps the marketing page and sign-in eager', () => {
    // These are what a logged-out visitor actually asks for. Splitting them
    // would buy nothing and cost a round trip on the two commonest entries.
    expect(valueImports(src)).toContain('./LandingPage');
    expect(valueImports(src)).toContain('./LoginPage');
  });
});

describe('LivePreviewModal.tsx', () => {
  /**
   * The other half of the split: this file is where the weight is allowed to
   * be, so it must actually be carrying it — otherwise the guard above passes
   * while the preview renders nothing.
   *
   * Checked ONE HOP DEEP rather than on this file's own imports. The modal
   * opens a customer's invitation and reaches the registry through
   * `InviteSiteView`, which dispatches rich vs block; asking only about direct
   * imports would have failed a module that is perfectly correct, which is
   * exactly what it did when the design-preview branch was removed.
   */
  it('is the module that holds the renderer', () => {
    const direct = valueImports(read('LivePreviewModal.tsx'));
    const reachable = new Set(direct.flatMap((spec) => (
      spec.startsWith('./') && spec !== './templates'
        ? (() => {
          try { return valueImports(read(`${spec.slice(2)}.tsx`)); } catch { return []; }
        })()
        : [spec]
    )));
    expect(
      reachable.has('./templates'),
      'nothing behind the lazy boundary reaches the template registry, so the '
      + 'preview has nothing to render a rich invitation with',
    ).toBe(true);
  });

  it('is a default export, which is what lazy() needs', () => {
    expect(read('LivePreviewModal.tsx')).toMatch(/export default function LivePreviewModal/);
  });
});
