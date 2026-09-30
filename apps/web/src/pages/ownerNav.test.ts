import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { locales, translate, type TranslationKey } from '../utils/translate';

// ── The owner cabinet's navigation ──────────────────────────────────────────
// The cabinet has no DOM test (the web suite covers the logic behind the
// screens, not rendering), so this reads the source — the house style where
// there is no database and no DOM, as `translate.test.ts` and
// `shellSettings.test.ts` already do.
//
// What it is holding down: the four destinations are rendered TWICE, once as a
// row of tabs and once inside the mobile menu, and below 720px the row is not
// merely awkward but gone — `.adm-bg` clips horizontally rather than scrolling,
// so a tab off the right edge cannot be reached at all. A page that reaches one
// rendering and not the other is therefore a page that does not exist on a
// phone.

const SOURCE = readFileSync(join(__dirname, 'OwnerCabinetPage.tsx'), 'utf8');

/**
 * The opening JSX tag containing `anchor`, from its `<` to its `>`.
 *
 * Needed because the button and the panel carry the SAME attributes — both are
 * labelled `menu_navigation` — so asserting a string appears anywhere in the
 * file passes with either one deleted. A break-check is what showed that up.
 */
const openingTag = (anchor: string): string => {
  const at = SOURCE.indexOf(anchor);
  expect(at).toBeGreaterThan(-1);
  const open = SOURCE.lastIndexOf('<', at);
  const close = SOURCE.indexOf('>', at);
  expect(open).toBeGreaterThan(-1);
  expect(close).toBeGreaterThan(open);
  return SOURCE.slice(open, close + 1);
};

/** The `<style>{`…`}</style>` block at the foot of the page. */
const styleBlock = (): string => {
  const start = SOURCE.indexOf('<style>{`');
  const end = SOURCE.indexOf('`}</style>');
  expect(start).toBeGreaterThan(-1);
  expect(end).toBeGreaterThan(start);
  return SOURCE.slice(start + '<style>{`'.length, end);
};

describe('the four destinations are stated once', () => {
  it('declares them in a single TABS list', () => {
    expect(SOURCE).toMatch(/const TABS: \{ id: Tab; key: [^}]+\}\[\] = \[/);
  });

  it('renders BOTH the wide row and the mobile menu from it', () => {
    // Written out twice, a page added later reaches one of them and is invisible
    // on the other — on a phone, invisible full stop.
    const fromTabs = SOURCE.match(/TABS\.map\(/g) ?? [];
    expect(fromTabs.length).toBe(2);
  });

  it('lists every tab the Tab union allows, so none can be unreachable', () => {
    const union = /type Tab = ([^;]+);/.exec(SOURCE)?.[1] ?? '';
    const declared = [...union.matchAll(/'([a-z]+)'/g)].map((m) => m[1]).sort();
    const listed = [...SOURCE.matchAll(/\{ id: '([a-z]+)', key: '([a-z_]+)' \}/g)].map((m) => m[1]).sort();
    expect(listed).toEqual(declared);
  });

  it('gives each one a label that exists in all three languages', () => {
    const keys = [...SOURCE.matchAll(/\{ id: '[a-z]+', key: '([a-z_]+)' \}/g)].map((m) => m[1] as TranslationKey);
    expect(keys.length).toBeGreaterThanOrEqual(4);
    for (const key of keys) {
      for (const locale of locales) {
        // `translate` falls back to uz, so a missing key returns the key itself.
        expect(translate(key, locale)).not.toBe(key);
      }
    }
  });

  it('closes the menu from ONE place, so a destination added later cannot forget to', () => {
    expect(SOURCE).toMatch(/const goTo = \(next: Tab\) => \{ setTab\(next\); setMenuOpen\(false\); \};/);
    // Both renderings go through it; nothing calls setTab directly any more.
    expect(SOURCE.match(/onClick=\{\(\) => goTo\(one\.id\)\}/g)?.length).toBe(2);
    expect(SOURCE).not.toMatch(/onClick=\{\(\) => setTab\(/);
  });
});

describe('the button says where you are', () => {
  it('labels itself with the CURRENT page, not just an icon', () => {
    // A collapsed nav that shows only three lines takes away the one thing the
    // header still had to say: which page this is.
    expect(SOURCE).toMatch(/owner-burger-label">\{t\(TABS\.find\(\(one\) => one\.id === tab\)!\.key\)\}/);
  });

  it('carries the state and the relationship a screen reader needs', () => {
    expect(openingTag('ref={burgerRef}')).toMatch(/aria-expanded=\{menuOpen\}/);
    expect(openingTag('ref={burgerRef}')).toMatch(/aria-controls="owner-menu"/);
    // The panel it names has to be the panel that exists.
    expect(SOURCE).toMatch(/id="owner-menu"/);
  });

  it('names the button AND the panel, checked on each rather than on the file', () => {
    // Both carry the same label, so asserting the string appears in the source
    // passes with either one deleted — which is how a break-check caught this
    // assertion being useless.
    expect(openingTag('ref={burgerRef}')).toMatch(/aria-label=\{t\('menu_navigation'\)\}/);
    expect(openingTag('id="owner-menu"')).toMatch(/aria-label=\{t\('menu_navigation'\)\}/);
  });

  it('marks the open page with aria-current, not colour alone', () => {
    expect(SOURCE).toMatch(/aria-current=\{tab === one\.id \? 'page' : undefined\}/);
  });
});

describe('the menu can be left', () => {
  it('is not rendered at all while closed', () => {
    // Hidden in CSS it would still be in the tab order and findable by ctrl-F on
    // a desktop where the button is not even shown.
    expect(SOURCE).toMatch(/\{menuOpen && \(/);
  });

  it('closes on Escape and hands focus back to the button', () => {
    // Otherwise focus is left on a node that has just been unmounted, and the
    // next Tab starts again from the top of the document.
    expect(SOURCE).toMatch(/event\.key === 'Escape'/);
    expect(SOURCE).toMatch(/burgerRef\.current\?\.focus\(\)/);
  });

  it('dismisses on POINTERDOWN, not click', () => {
    // A click fires after the press, so a tap that began outside and ended on
    // the panel would close it under the finger.
    expect(SOURCE).toMatch(/addEventListener\('pointerdown'/);
    expect(SOURCE).not.toMatch(/addEventListener\('click', onPointer/);
  });

  it('removes both listeners when it closes', () => {
    expect(SOURCE).toMatch(/removeEventListener\('keydown'/);
    expect(SOURCE).toMatch(/removeEventListener\('pointerdown'/);
  });

  it('leaves a press on the button itself to the button', () => {
    // Without this the outside-dismiss closes the menu on the same press that
    // the toggle then re-opens it with, and the button appears dead.
    expect(SOURCE).toMatch(/burgerRef\.current\?\.contains\(target\)\) return;/);
  });
});

describe('the breakpoint', () => {
  it('swaps the row for the button at ONE width, in both directions', () => {
    // Two different widths would leave a band showing both, or neither.
    const css = styleBlock();
    const rule = /@media \(max-width: 720px\) \{([\s\S]*?)\n        \}/.exec(css)?.[1] ?? '';
    expect(rule).toMatch(/\.owner-nav \{ display: none/);
    expect(rule).toMatch(/\.owner-burger \{[\s\S]*display: inline-flex/);
    // And it is hidden by default, so a desktop never shows both.
    expect(css).toMatch(/\.owner-burger \{ display: none; \}/);
  });

  it('gives the button and every menu row a real tap target', () => {
    const css = styleBlock();
    const heights = [...css.matchAll(/min-height: (\d+)px/g)].map((m) => Number(m[1]));
    expect(heights.length).toBeGreaterThanOrEqual(2);
    for (const height of heights) expect(height).toBeGreaterThanOrEqual(44);
  });

  it('draws the panel opaque', () => {
    // It sits over the page's own cards; anything see-through makes both
    // unreadable at once.
    expect(styleBlock()).toMatch(/\.owner-menu \{[\s\S]*background: #[0-9a-f]{6};/);
  });
});

describe('the style block is a template literal', () => {
  it('contains no backtick, which would end it early', () => {
    // A prose comment written with `code spans` inside this block terminates the
    // template literal and the file stops compiling. That shipped once.
    expect(styleBlock()).not.toContain('`');
  });

  it('hides the wide nav with `!important`, because it is fighting an inline style', () => {
    // The nav carries `style={{ display: 'flex' }}`, and an inline declaration
    // beats any class. This is the one thing that actually collapses the row on
    // a phone, so it is asserted rather than left to be "tidied up" later.
    expect(styleBlock()).toMatch(/\.owner-nav \{ display: none !important; \}/);
  });

  it('reaches for `!important` only inside a media query', () => {
    // Every use in this block exists to beat an inline style in a responsive
    // override — that is the whole reason this page has any. One at the top
    // level would be overriding something it could simply out-specify instead.
    const css = styleBlock();
    const outsideMedia = css.replace(/@media[^{]*\{[\s\S]*\n        \}/g, '');
    expect(outsideMedia).not.toContain('!important');
  });
});
