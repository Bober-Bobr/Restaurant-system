/**
 * `position: sticky` pins an element to its nearest SCROLLPORT, not to the
 * window. Any ancestor that is a scroll container silently takes that job over,
 * and the sticky element then comes to rest at the bottom (or top) of that
 * ancestor's box instead — usually the foot of the page, far off screen.
 *
 * `overflow-x: hidden` makes an element a scroll container. `.adm-bg` had it,
 * to clip the two drifting aurora blobs, and it unstuck BOTH the sticky topbar
 * in all five admin layouts and the sticky horizontal scrollbar on the Menu
 * page. Nothing failed; the elements simply stopped sticking.
 *
 * `overflow-x: clip` clips identically and creates no scrollport. Measured in
 * headless Chrome: with `hidden` neither element sticks; with `clip` both do,
 * and no horizontal page scrollbar appears.
 *
 * This reads the real stylesheets, because the bug is a single word in one of
 * them and there is nothing else to observe it in a suite with no browser.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const SRC = join(__dirname, '..');
// Comments are stripped first: this file's own explanation of the bug quotes
// the very declaration it is looking for.
const read = (rel: string) =>
  readFileSync(join(SRC, rel), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

/** The body of the first rule whose selector list contains `selector`. */
function ruleBody(css: string, selector: string): string {
  const re = new RegExp(`(^|\\})[^{}]*(?:^|[,\\s])${selector.replace('.', '\\.')}\\s*(?:,[^{}]*)?\\{([^}]*)\\}`, 'm');
  const m = css.match(re);
  if (!m) throw new Error(`rule for ${selector} not found`);
  return m[2];
}

/** Every scope that hosts a `position: sticky` descendant. */
const STICKY_HOSTS: { file: string; selector: string; sticky: string }[] = [
  { file: 'index.css', selector: '.adm-bg', sticky: '.adm-topbar / .adm-hscroll' },
];

describe('nothing on a sticky element\'s ancestor chain may be a scroll container', () => {
  for (const { file, selector, sticky } of STICKY_HOSTS) {
    it(`${selector} does not turn itself into a scrollport (${sticky} depend on it)`, () => {
      const body = ruleBody(read(file), selector);
      const overflow = [...body.matchAll(/overflow(?:-[xy])?\s*:\s*([^;]+);/g)].map((m) => m[1].trim());
      for (const value of overflow) {
        // `visible` and `clip` are the two that do NOT create a scroll
        // container. `hidden`, `auto` and `scroll` all do.
        expect(
          value,
          `${selector} declares overflow: ${value} — that makes it a scrollport, and ${sticky} would stop sticking to the window`,
        ).toMatch(/^(visible|clip)$/);
      }
    });
  }

  it('the sticky rules the guard is protecting still exist', () => {
    // If a selector above were renamed, the check would keep passing while
    // guarding nothing.
    const css = read('index.css');
    expect(ruleBody(css, '.adm-topbar')).toContain('position: sticky');
    expect(ruleBody(css, '.adm-hscroll')).toContain('position: sticky');
  });

  it('names every stylesheet scope that has a sticky descendant', () => {
    // A new product stylesheet with its own sticky element needs its own row in
    // STICKY_HOSTS; this fails when one appears and nobody added it.
    const sheets = ['index.css', 'vinvite/vinvite.css', 'vconnect/vconnect.css', 'foodsite/foodsite.css'];
    const withSticky = sheets.filter((f) => /position:\s*sticky/.test(read(f)));
    const covered = new Set(STICKY_HOSTS.map((h) => h.file));
    for (const file of withSticky) {
      // vinvite's sticky header sits directly under `.vi-root`, which declares
      // no overflow at all — assert that stays true rather than listing it.
      if (!covered.has(file)) {
        const root = read(file).slice(0, 4000);
        expect(root, `${file} has a sticky rule and its root scope now clips`).not.toMatch(
          /overflow(-x)?\s*:\s*(hidden|auto|scroll)/,
        );
      }
    }
    expect(withSticky.length).toBeGreaterThan(0);
  });

  it('the stylesheets under test exist and were read', () => {
    expect(readdirSync(SRC)).toContain('index.css');
  });
});
