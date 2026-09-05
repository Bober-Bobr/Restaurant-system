import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Hall, table category and guest count sit at the top of the kiosk and
 * everything below is derived from them — but they were drawn as three
 * identical grey fields, so a guest halfway through could not tell at a glance
 * which they had already answered.
 *
 * Each now carries an answered / waiting state. Asserted from the source and
 * the stylesheet, in the style of `palette.test.ts`: the suite has no DOM, and
 * what matters is that the state reaches the markup and that the stylesheet
 * draws both halves of it.
 */
const SRC = join(__dirname, '..');
const menu = readFileSync(join(SRC, 'pages', 'TabletMenuPage.tsx'), 'utf8');
const css = readFileSync(join(SRC, 'index.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

describe('the kiosk says which settings have been answered', () => {
  it('all three top-level fields carry the state', () => {
    const picks = menu.match(/<PickField label=\{[^}]+\} answered=\{[^}]+\}>/g) ?? [];
    expect(picks.length, picks.join('\n')).toBe(3);
  });

  it('each reports its own answer, not a shared flag', () => {
    expect(menu).toMatch(/answered=\{!!selectedHallId\}/);
    expect(menu).toMatch(/answered=\{!!selectedTableCategoryId\}/);
    // Zero guests is not an answer — the field starts at 0 and reads as blank.
    expect(menu).toMatch(/answered=\{guestCount > 0\}/);
  });

  it('the wrapper is a <label> around its control', () => {
    // These three had no caption association at all: tapping the caption did
    // nothing and a screen reader read the control unnamed. Wrapping is what
    // fixes both, and is free here because the caption was already adjacent.
    expect(menu).toMatch(/<label className=\{`rg-pick[^`]*\$\{answered \? 'is-set' : 'is-empty'\}`\}>/);
  });

  it('the badge is present in both states, not only when answered', () => {
    // An indicator that appears from nowhere reads as decoration. A ring that
    // fills in reads as a control with two settings.
    expect(menu).toMatch(/<span className="rg-pick-mark" aria-hidden="true">\{answered \? '✓' : ''\}<\/span>/);
    expect(css).toContain('.rg-pick.is-empty .rg-pick-mark');
  });

  it('the stylesheet draws both states, and the tick', () => {
    for (const rule of ['.rg-pick.is-set .rg-input', '.rg-pick.is-empty .rg-input', '.rg-pick-mark']) {
      expect(css, `${rule} is not styled`).toContain(rule);
    }
  });

  it('the two states differ in more than one thing', () => {
    // The first attempt changed a border tint inside the input and nothing
    // else, which is not legible at kiosk distance. The panel itself, its
    // frame, the accent spine and the badge all move as well.
    for (const rule of ['.rg-pick.is-set::before', '.rg-pick.is-empty {', '.rg-pick.is-set {']) {
      expect(css, `${rule} is missing — the states differ only inside the field again`).toContain(rule);
    }
  });

  it('the waiting halo stands down under reduced motion, and on focus', () => {
    // It is the one animated cue here. Everything it signals is also carried by
    // the dashed frame, so switching it off loses nothing.
    const reduced = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce)', css.indexOf('.rg-pick {')));
    expect(reduced.slice(0, 200)).toContain('.rg-pick.is-empty .rg-input { animation: none; }');
    expect(css).toContain('.rg-pick.is-empty .rg-input:focus');
  });

  it('the answered state is painted from the restaurant\'s own accent', () => {
    // The kiosk is themed per restaurant. A literal gold here would be the
    // platform default sitting on someone else\'s brand colour.
    const block = css.slice(css.indexOf('.rg-pick.is-set .rg-input'));
    const body = block.slice(0, block.indexOf('}'));
    expect(body).toContain('--rg-accent');
    expect(body, 'a hex literal in the answered state').not.toMatch(/#[0-9a-f]{3,8}\b/i);
  });

  it('focus still wins over the answered state', () => {
    // Otherwise an answered field looks the same focused and unfocused, which
    // is worse than the grey field this replaces.
    expect(css).toContain('.rg-pick.is-set .rg-input:focus');
  });
});
