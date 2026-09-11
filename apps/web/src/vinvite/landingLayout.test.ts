import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Four layout rules on the marketing page that are invisible to every other
 * check in the suite, and each of which was a real defect.
 *
 * These read source rather than render, and that is a known limit: the things
 * they describe are decided by LAYOUT, so the source can only be asked whether
 * the mechanism is still present. Each one was verified in a real browser by
 * measuring the rendered boxes — the numbers are in the comments — and these
 * exist to notice if the mechanism is later removed.
 */
const DIR = __dirname;
const CSS = readFileSync(join(DIR, 'vinvite.css'), 'utf8');
const LANDING = readFileSync(join(DIR, 'LandingPage.tsx'), 'utf8');

/** A named CSS rule's body. The selector is given literally and escaped here. */
function rule(selector: string): string {
  const re = new RegExp(`${selector.replace(/[.[\]='*+?^$(){}|\\/-]/g, (c) => `\\${c}`)}\\s*\\{([^}]*)\\}`);
  return re.exec(CSS)?.[1] ?? '';
}

/**
 * Source with comments removed.
 *
 * These files explain their own machinery at length — including, in two places,
 * naming the API that must NOT be used — so prose must not be able to fail a
 * check about code.
 */
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/[^\n]*/g, '$1');
const LANDING_CODE = strip(LANDING);

describe('the hero headline keeps its spaces', () => {
  /**
   * `.vi-lp-word` is `display: inline-block`, and a space at the END of an
   * inline-block's content is trailing whitespace on that box's last line — so
   * CSS removes it and the words render flush against one another. Measured
   * before the fix: "которые" ended at x=303 and "запомнят" began at x=302.
   *
   * The fix is that the separator lives OUTSIDE the inline-block, in the
   * parent's inline flow.
   */
  it('puts the separator outside the inline-block', () => {
    const at = LANDING.indexOf('const word = (w: string');
    expect(at, 'the word-by-word headline is gone').toBeGreaterThan(-1);
    const body = LANDING.slice(at, at + 700);
    // The space must follow the CLOSING tag of the word span, not sit inside it.
    expect(
      body,
      'the space is back inside `.vi-lp-word`, where CSS discards it and the '
      + 'words run together',
    ).toMatch(/<\/span>\{' '\}/);
    expect(body, 'a space inside the inline-block renders as nothing')
      .not.toMatch(/\{w\}<\/span>\{' '\}\s*<\/span>/);
  });

  it('and does not reach for a non-breaking space instead', () => {
    // That would also have shown a gap, and would have been wrong: the headline
    // has to wrap on a phone, and `&nbsp;` is the instruction not to.
    const at = LANDING.indexOf('const word = (w: string');
    expect(LANDING.slice(at, at + 700)).not.toContain('\\u00a0');
    expect(LANDING.slice(at, at + 700)).not.toContain('&nbsp;');
  });

  it('still keeps .vi-lp-word an inline-block', () => {
    // Guards the check above from becoming vacuous: if the class ever stopped
    // being an inline-block the trailing-space trap would not apply, and the
    // reasoning recorded here would be describing something that no longer
    // exists.
    expect(rule('.vi-lp-word')).toContain('inline-block');
  });
});

describe('the closing call to action is gone', () => {
  it('is not rendered', () => {
    expect(LANDING, 'the "Ready to invite everyone?" section is back').not.toContain('FinalCta');
    expect(LANDING).not.toContain('lp_final_title');
  });
});

describe('both sliders centre what the reader is on', () => {
  /**
   * A card snapping to the LEFT edge was the complaint. Centring needs two
   * things, and neither works alone:
   *
   *   · `scroll-snap-align: center`, which decides where a flick comes to rest;
   *   · a side gutter of half a rail minus half a card, which is the ONLY way
   *     the first and last cards can reach the middle — without it they can be
   *     scrolled to no further than the rail's own extent.
   */
  it('the work gallery snaps to centre', () => {
    expect(rule('.vi-slider-slide'), 'the gallery snaps to the left edge again')
      .toMatch(/scroll-snap-align:\s*center/);
  });

  it('the work gallery has a gutter, and only when it overflows', () => {
    // Unconditional, a gallery of four on a wide screen strands one card in the
    // middle with a screen of nothing beside it — measured: 456px of empty
    // gutter. So the gutter is a class, and the class is decided by measuring.
    expect(rule('.vi-slider-rail.is-centred'), 'the centring gutter is gone')
      .toMatch(/padding-inline:.*50%/);
    expect(LANDING, 'nothing decides whether the gutter is needed').toContain('needsGutter');
    expect(LANDING, 'the gutter is no longer measured against the available width')
      .toContain('el.parentElement?.clientWidth');
  });

  it('the tier carousel snaps to centre and is always guttered', () => {
    // Always, unlike the gallery: the whole point of the control is comparing a
    // rung with the ones on either side of it, so the chosen card belongs in the
    // middle even when all three would fit in a row.
    expect(rule('.vi-tiercard')).toMatch(/scroll-snap-align:\s*center/);
    expect(rule('.vi-tierslider-rail')).toMatch(/padding:.*50%/);
  });

  it('brings a chosen tier to the middle without dragging the page', () => {
    // `scrollIntoView` scrolls every scrollable ancestor, so on first paint it
    // would take the whole page down to the price list.
    const at = LANDING_CODE.indexOf('function TierSlider');
    const body = LANDING_CODE.slice(at, at + 2000);
    expect(body, 'nothing scrolls the chosen tier into the middle').toContain('rail.scrollTo(');
    expect(body, 'scrollIntoView would drag the page as well').not.toContain('scrollIntoView');
    expect(body, 'the centre is no longer computed from the card and the rail')
      .toMatch(/card\.offsetLeft\s*-\s*\(rail\.clientWidth\s*-\s*card\.clientWidth\)\s*\/\s*2/);
  });

  it('honours reduced motion at the specificity that actually wins', () => {
    /**
     * A real bug this file caught. `.vi-tierslider-rail.is-settled` sets
     * `scroll-behavior: smooth` and is two classes; the reduced-motion override
     * was one class, so it lost — and the people who explicitly asked for no
     * motion were the only ones who could not turn it off.
     */
    const rm = /@media \(prefers-reduced-motion: reduce\)\s*\{([\s\S]*?)\n\}/g;
    // Comments stripped. The rule below is explained in a comment that names
    // the very selector being checked for, so without this the prose satisfies
    // the check and the guard passes against the bug it exists to catch.
    const blocks = strip([...CSS.matchAll(rm)].map((m) => m[1]).join('\n'));
    expect(blocks, 'nothing disables the smooth scroll under reduced motion')
      .toMatch(/scroll-behavior:\s*auto/);
    expect(
      blocks,
      'the override is written at a lower specificity than `.vi-tierslider-rail'
      + '.is-settled`, so it loses and reduced motion is ignored',
    ).toContain('.vi-tierslider-rail.is-settled');
  });
});

describe('the price list sells tiers, not designs', () => {
  it('offers a tier as the choice', () => {
    expect(LANDING).toContain('onSelectTier');
    expect(LANDING, 'the URL no longer carries the chosen tier').toMatch(/next\.set\('tier'/);
  });

  it('does not let a design be selected', () => {
    // The whole point of the change. A design opens a preview and nothing else.
    expect(LANDING, 'DesignRow is back — designs are selectable again').not.toContain('DesignRow');
    expect(LANDING, 'a select action reappeared on a design').not.toContain("t('lp_select')");
  });

  it('still resolves an old ?template= link to a tier', () => {
    // The retired /pricing page's links carry one and have been shared. Landing
    // on the right shelf is the nearest honest thing to what the link promised.
    const at = LANDING.indexOf('const selectedTier = useMemo');
    const body = LANDING.slice(at, at + 500);
    expect(body, 'a shared ?template= link now lands on nothing')
      .toMatch(/params\.get\('template'\)/);
    expect(body).toContain('tierOf(');
  });

  it('draws the ladder from the tier rather than from a picture', () => {
    // One mark for Standard, three for Luxury. Generated, so it cannot fall out
    // of step with the order of the tiers.
    // The generation, not the name: leaving `TIER_MARKS` declared while the
    // markup stops using it would pass a check that only greps for the word.
    expect(LANDING_CODE, 'the marks are no longer generated from the tier')
      .toMatch(/Array\.from\(\s*\{\s*length:\s*TIER_MARKS\[tier\]/);
    expect(CSS, 'the marks have no style').toContain('.vi-tiercard-marks');
    // Each rung is dressed differently, and it is driven by the data attribute
    // rather than by three hand-written card components.
    for (const tier of ['PREMIUM', 'LUXURY']) {
      expect(CSS, `${tier} is not dressed differently from the rung below it`)
        .toContain(`[data-tier='${tier}']`);
    }
  });
});
