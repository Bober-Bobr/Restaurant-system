import { describe, expect, it } from 'vitest';
import { readdirSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * A state class must belong to ONE thing.
 *
 * `wedding-samarkand` names three unrelated components' open state `open`: the
 * intro header, the date plaque and the reply modal. The intro's rule was
 * written unscoped —
 *
 *     .open{position:relative;height:100svh;…;display:grid;…}
 *
 * — so the moment the plaque opened it was handed a viewport-tall box. With a
 * definite height and its own `aspect-ratio:4/5`, the plaque's WIDTH then
 * followed the height instead of the column: 600px (its max-width) inside a
 * 390px phone, sliced off by `.date{overflow:hidden}`. Measured before the fix
 * the plaque came out 600×800 at every width, desktop included, where 4/5 of
 * 600 is 750.
 *
 * Nothing about this is visible to a type checker, and the smoke test renders
 * in linkedom with no layout, so neither could catch it. These read the CSS.
 */
const TEMPLATES = join(__dirname, 'templates');
const ids = readdirSync(TEMPLATES, { withFileTypes: true })
  .filter((e) => e.isDirectory() && existsSync(join(TEMPLATES, e.name, 'template.html')))
  .map((e) => e.name);

const html = (id: string) => readFileSync(join(TEMPLATES, id, 'template.html'), 'utf8');

describe('a bare state-class rule never reaches another component', () => {
  it('found the templates', () => {
    expect(ids).toContain('wedding-samarkand');
    expect(ids.length).toBeGreaterThan(10);
  });

  // `open`, `shown` and `active` are the names a template is most likely to
  // reuse for two different things, because they describe a state rather than
  // a component. An unscoped rule for one of them is the bug above.
  const SHARED = ['open', 'shown', 'active'];

  for (const id of ids) {
    const source = html(id);
    for (const name of SHARED) {
      // Only when the template actually toggles it from script on more than
      // one element — a template that uses the name once has no collision to
      // have, and a blanket ban would be a rule about nothing.
      const setters = [...source.matchAll(new RegExp(`classList\\.(?:add|toggle)\\('${name}'\\)`, 'g'))].length;
      if (setters < 2) continue;
      it(`${id}: .${name} is scoped to the element it styles`, () => {
        // A rule opening with `.name{` and nothing before it — that is the one
        // that lands on every other component carrying the same state.
        const bare = new RegExp(`(^|[},;]\\s*)\\.${name}\\s*\\{`, 'm');
        expect(source, `an unscoped .${name} rule reaches every element with that class`)
          .not.toMatch(bare);
      });
    }
  }
});

describe('the Lantern Night date plaque', () => {
  const source = html('wedding-samarkand');

  it('gives the intro screen\'s rule to the intro screen only', () => {
    expect(source).toContain('header.open{position:relative;height:100vh;height:100svh');
  });

  it('keeps its 4/5 proportions', () => {
    // The box a reader sees. It only stops being 4/5 when the words need more
    // room, which is the point of the rule below.
    expect(source).toMatch(/\.plaque\{[^}]*aspect-ratio:4\/5/);
  });

  it('grows with its note instead of clipping it', () => {
    // The face is IN FLOW. Absolutely positioned (inset:0) it could only ever
    // be the ratio's height, so a long note — or the same note on a narrow
    // phone, where it takes twice the lines — spilled over the gold border and
    // was cut off by the section's overflow:hidden. Measured at 320px with a
    // long note: the plaque grows to 280×492 and every line is inside it.
    const face = source.slice(source.indexOf('.plaque__face{'));
    const rule = face.slice(0, face.indexOf('}'));
    expect(rule).toContain('position:relative');
    expect(rule).toContain('min-height:100%');
    expect(rule, 'an absolute face cannot grow, and the note is clipped').not.toContain('position:absolute');
  });

  it('and the shutters still span whatever height it settles at', () => {
    // They are what the reader watches swing back; pinned top-to-bottom they
    // cover the face however tall the note makes it.
    const leaf = source.slice(source.indexOf('.plaque__leaf{'));
    expect(leaf.slice(0, leaf.indexOf('}'))).toContain('position:absolute;top:0;bottom:0');
  });
});
