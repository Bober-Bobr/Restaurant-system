import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ADMIN_RUNTIME } from './templates/adminRuntime';

const html = (id: string) => readFileSync(join(__dirname, 'templates', id, 'template.html'), 'utf8');

/**
 * A template runs in a srcdoc frame, and a srcdoc document resolves a relative
 * URL against the PARENT page's address. So a plain <a href="#place"> means
 * "https://v-invite.uz/<name>#place": following it navigated the invitation's
 * own frame away to the v-invite page, which in the sandbox draws as a blank
 * screen. Zermatt's menu, Dolce Vita's contents list and Tuscan's section dots
 * all did it. Measured in the real preview frame, the frame's address became the
 * builder's own URL; after the fix it stays about:srcdoc and scrolls.
 */
describe('an in-page link scrolls instead of navigating the frame away', () => {
  it('the shared runtime intercepts every #-link, once, for every template', () => {
    expect(ADMIN_RUNTIME).toMatch(/function guardInPageLinks\(\)/);
    expect(ADMIN_RUNTIME).toMatch(/function boot\(\)\{[^}]*guardInPageLinks\(\)/);
    expect(ADMIN_RUNTIME).toContain(`closest('a[href^="#"]')`);
    expect(ADMIN_RUNTIME).toMatch(/e\.preventDefault\(\);[\s\S]{0,200}scrollIntoView/);
  });

  it('yields to a template that handles its own links', () => {
    // Zermatt has to break its seal before scrolling; the runtime must not
    // scroll a second time underneath it.
    expect(ADMIN_RUNTIME).toMatch(/if \(e\.defaultPrevented\) return;/);
    expect(html('wedding-zermatt')).toMatch(/closest\('a\[href\^="#"\]'\)[\s\S]{0,80}e\.preventDefault\(\)/);
  });
});

describe('Zermatt\'s phone menu is the whole screen', () => {
  it('drops the bar\'s blur while open, because a backdrop-filter re-contains a fixed panel', () => {
    // With the blur on, the bar is the containing block for the fixed panel:
    // measured, a 400x100 panel with links spilling off both ends of the bar.
    expect(html('wedding-zermatt')).toMatch(/\.nav\.menu-open\{-webkit-backdrop-filter:none;backdrop-filter:none\}/);
  });
});

describe('Lantern Night\'s uploaded photos have a height in every engine', () => {
  const source = html('wedding-samarkand');

  it('a photo tile is a self-sizing box, never a button sized by aspect-ratio', () => {
    // The photos were buttons whose only child is an absolutely placed image;
    // where aspect-ratio is not applied to a button they had no height, so the
    // uploads vanished while the (div) stand-ins drew.
    expect(source).toContain("tile.className = 'album__item is-photo reveal'");
    expect(source).toContain("b.className = 'album__hit'");
    expect(source).not.toMatch(/b\.className = 'album__item/);
  });

  it('keeps a 3:4 tile where aspect-ratio is missing altogether', () => {
    expect(source).toMatch(/@supports not \(aspect-ratio:1\/1\)\{\.album__item\{height:0;padding-top:133\.333%\}\}/);
  });
});
