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

/**
 * The same trap one rung up: `position: fixed` resolves against the nearest
 * ancestor carrying a TRANSFORM (or a filter, or paint containment), not
 * against the window — so `inset: 0` silently means "the size of that element".
 *
 * `.adm-page-in` wraps the routed page in all five admin layouts and animated
 * with `animation-fill-mode: both`. `both` keeps the last keyframe applied for
 * ever, and that keyframe says `transform: none` — which, as a keyframe value,
 * computes to the identity MATRIX rather than to `none`. So every admin page
 * carried a transform permanently and no full-screen overlay inside one was
 * fixed to the viewport at all.
 *
 * Measured in headless Chrome, the Small Banquets order sheet on a 5365px page:
 * with `both` the dialog is 390×5312 and centres its card ~2400px down, so a
 * phone shows the backdrop and nothing else — the reported black screen; with
 * `backwards` it is 390×844 at (0, 0) and stays there through a 1210px scroll.
 *
 * NOT a general rule about fill modes: `.reveal` and the invitation templates
 * genuinely need `forwards`, because there the end of the keyframes IS the
 * visible state over a base style of `opacity: 0`. It applies to these two,
 * whose end state is the element's own natural state, so the fill pins nothing
 * but the containing block.
 */
describe('a page wrapper may not become the containing block for fixed overlays', () => {
  const WRAPPERS = ['.adm-page-in', '.adm-stagger > *'];

  for (const selector of WRAPPERS) {
    it(`${selector} does not keep its transform after the animation`, () => {
      const css = read('index.css');
      const re = new RegExp(`(^|\\})\\s*${selector.replace(/[.*>]/g, (c) => '\\' + c)}\\s*\\{([^}]*)\\}`, 'm');
      const body = css.match(re)?.[2];
      expect(body, `rule for ${selector} not found`).toBeTruthy();
      const animation = /animation:\s*([^;]+);/.exec(body!)?.[1] ?? '';
      expect(animation, `${selector} has no animation any more`).toBeTruthy();
      expect(
        animation,
        `${selector} fills ${/\bboth\b/.test(animation) ? 'both' : 'forwards'} — it then keeps the keyframe transform for ever and every position: fixed overlay inside the page is sized to the page instead of the screen`,
      ).not.toMatch(/\b(both|forwards)\b/);
      expect(animation).toMatch(/\bbackwards\b/);
    });
  }

  it('and the keyframes they use really do set a transform', () => {
    // Which is what makes the fill mode matter at all. If the transform ever
    // leaves these keyframes the rule above is harmless rather than wrong, but
    // the reasoning in it would no longer describe the code.
    const css = read('index.css');
    const frames = /@keyframes admPageIn\s*\{([\s\S]*?)\n\}/.exec(css)?.[1] ?? '';
    expect(frames).toContain('transform');
  });

  it('the one overlay that must cover the screen does not rely on any of it', () => {
    // A full-screen dialog should not depend on what is above it in the tree:
    // the next ancestor to grow a transform would break it again, silently,
    // and only on the long pages where it matters most.
    const sheet = readFileSync(join(SRC, 'pages/SmallBanquetOrderSheet.tsx'), 'utf8');
    expect(sheet).toContain("import { createPortal } from 'react-dom'");
    expect(sheet).toMatch(/return createPortal\(\(/);
    expect(sheet).toMatch(/\), document\.body\);/);
    // Its palette travels with it, so leaving the section's token scope costs
    // nothing: `.sb-floor` declares every --adm-* token itself.
    expect(sheet).toContain('className="sb-floor sbo-root"');
    const tokens = read('index.css');
    const floor = /\.sb-floor\s*\{([^}]*)\}/.exec(tokens)?.[1] ?? '';
    for (const token of ['--adm-accent:', '--adm-bg:', '--adm-text:', '--adm-surface:', '--adm-line:']) {
      expect(floor, `.sb-floor does not declare ${token}`).toContain(token);
    }
  });

  it('and it holds the page behind it still while it is open', () => {
    // It covers the screen; without this a scroll that runs off the end of the
    // menu chains to the floor map underneath, which then moves under a finger
    // that is choosing dishes.
    const sheet = readFileSync(join(SRC, 'pages/SmallBanquetOrderSheet.tsx'), 'utf8');
    expect(sheet).toMatch(/document\.body\.style\.overflow = 'hidden';/);
    // Restored to what it WAS, not cleared: this page is not the only thing
    // that may have set it.
    expect(sheet).toMatch(/const previous = document\.body\.style\.overflow;/);
    expect(sheet).toMatch(/return \(\) => \{ document\.body\.style\.overflow = previous; \};/);
  });
});
