import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The gallery's covers are the real invitation, held still.
 *
 * Both rules below are here because breaking either renders a BLANK CARD, and a
 * blank card looks like a loading state rather than a bug — on a marketing page,
 * at the foot, in a section most visitors scroll past. Neither is visible to a
 * type checker and neither fails a render test that only asks whether an iframe
 * exists.
 */
const SRC = readFileSync(join(__dirname, 'templates', 'RichRenderer.tsx'), 'utf8');

/**
 * Source with comments removed.
 *
 * This file explains the `animation: none` trap at length, in prose that names
 * the very string the check below forbids. Without stripping, the explanation
 * satisfies the test and it passes against the bug it exists to catch — the same
 * failure `landingLayout.test.ts` and `adminSectionStyle.test.ts` each hit.
 */
const CODE = SRC.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/[^\n]*/g, '$1');

describe('still mode', () => {
  it('tells the template the reader asked for no motion', () => {
    // The whole mechanism. Every template already branches on this at boot —
    // skipping its intro, revealing every section, and never creating the
    // <source> for the opening film — so shimming the query buys the entire
    // still mode without a second code path in twelve templates.
    expect(CODE, 'the reduced-motion shim is gone').toContain('window.matchMedia = function');
    expect(CODE, 'the shim no longer answers the motion query').toContain('prefers-reduced-motion');
  });

  it('still answers "no-preference" with false', () => {
    /**
     * A shim that returns `matches: true` for ANY motion query would answer
     * `(prefers-reduced-motion: no-preference)` with true as well — and several
     * templates ask it that way round, so they would take the full-motion path
     * and the cover would play its intro after all.
     */
    expect(CODE, 'the shim no longer reads the query text').toMatch(/matches:\s*\/reduce\/\.test\(q\)/);
  });

  it('freezes animations by finishing them, never by removing them', () => {
    /**
     * THE BUG THIS EXISTS FOR, which shipped once and drew four blank cards.
     *
     * Across these templates the VISIBLE state of a revealed section is the END
     * of its keyframes, held by `animation-fill-mode: forwards`, over a base
     * style of `opacity: 0`. `animation: none` therefore does not "stop the
     * motion" — it removes the only thing that ever made the section visible.
     */
    const still = /const STILL_CSS = `([\s\S]*?)`;/.exec(CODE)?.[1] ?? '';
    expect(still, 'the still stylesheet is gone').not.toBe('');
    expect(still, 'animation is being removed rather than fast-forwarded — this renders blank cards')
      .not.toMatch(/animation\s*:\s*none/);
    expect(still, 'nothing shortens the animation').toMatch(/animation-duration:\s*1ms/);
    // A 1ms animation left looping repaints the card for ever, which is the
    // exact cost a still cover is here to avoid.
    expect(still, 'a fast-forwarded animation is still allowed to loop')
      .toMatch(/animation-iteration-count:\s*1/);
  });

  it('applies neither unless still mode was asked for', () => {
    // A published invitation must animate. The shim and the stylesheet are both
    // conditional on the flag, so an accidental unconditional injection would
    // freeze the real thing for every guest.
    expect(CODE).toMatch(/\$\{still \? STILL_SHIM : ''\}/);
    expect(CODE).toMatch(/still \? `<style>\$\{STILL_CSS\}<\/style>` : ''/);
  });
});
