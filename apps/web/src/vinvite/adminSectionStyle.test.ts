import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ADMIN_RUNTIME } from './templates/adminRuntime';
import { ADMIN_FONTS } from './templates/types';

/**
 * Design+ can set a face and a shadow per section.
 *
 * Both were verified in a real render before this file was written: a layer
 * naming `parisienne` + shadow 0.6 produced the two `font-family` rules, the
 * layered `text-shadow`, and one `<link>` to Google Fonts carrying every family
 * the layer used. What is asserted here is the machinery around that, which the
 * render cannot show going wrong:
 *
 *  · the FACE TABLE is the contract. A template runs in a `srcdoc` iframe on an
 *    opaque origin and carries its own font <link>; a family named in CSS but
 *    never fetched does not fail, it silently falls back to the system serif.
 *    So every offerable face must carry the query that fetches it.
 *  · the table is serialised into the runtime from the SAME export the editor
 *    reads. A second hand-kept copy is a copy that eventually disagrees, at
 *    which point a saved layer names a face the runtime cannot fetch.
 *  · the face must not be applied to `#sec *`. Every template sets an explicit
 *    family on its small tracked eyebrows; overriding those puts a connecting
 *    script into tracked uppercase, which comes apart into loose glyphs. That
 *    is the same rule `templateFonts.test.ts` enforces on the templates
 *    themselves, and Design+ must not be a way around it.
 */
/**
 * Comments removed, so the prose explaining this machinery cannot satisfy a
 * check about it.
 *
 * The line-comment half deliberately requires whitespace or a line start in
 * front of the `//`: the naive `\/\/[^\n]*` swallows the rest of any line
 * holding a URL, which here means it deletes the Google Fonts endpoint the
 * runtime fetches from — and then the check for that endpoint fails against
 * code that is perfectly correct.
 */
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/[^\n]*/g, '$1');

const EDITOR = strip(readFileSync(join(__dirname, 'RichEditorPage.tsx'), 'utf8'));
const RT = strip(ADMIN_RUNTIME);

describe('the face table', () => {
  it('is not empty and has unique keys', () => {
    expect(ADMIN_FONTS.length).toBeGreaterThan(4);
    const keys = ADMIN_FONTS.map((f) => f.key);
    expect(new Set(keys).size, 'two faces share a key, so one is unreachable').toBe(keys.length);
  });

  it('knows how to fetch every face it offers', () => {
    // The whole point. A face with neither a query nor a system fallback stack
    // is a face that silently becomes Times New Roman.
    const unfetchable = ADMIN_FONTS.filter((f) => !f.query);
    expect(
      unfetchable.map((f) => f.label),
      'offered with no way to fetch it — it will silently fall back',
    ).toEqual([]);
  });

  it('names the family it fetches first in its own stack', () => {
    for (const f of ADMIN_FONTS) {
      const family = decodeURIComponent((f.query ?? '').split(':')[0]).replace(/\+/g, ' ');
      expect(f.stack, `${f.label}: fetches ${family} but does not use it`)
        .toContain(`"${family}"`);
      expect(f.stack.indexOf(`"${family}"`), `${f.label}: the fetched face is not first`).toBe(0);
    }
  });

  it('ends every stack in a generic, so a failed fetch lands somewhere sane', () => {
    for (const f of ADMIN_FONTS) {
      expect(f.stack, `${f.label} has no generic fallback`)
        .toMatch(/(serif|sans-serif|cursive|monospace)\s*$/);
    }
  });

  it('offers only scripts whose Uzbek diacritics survive', () => {
    // The list checked against `Oʻ` and `gʻ` at display size — the same set
    // templateFonts.test.ts holds. Great Vibes is absent deliberately: it HAS
    // U+02BB and draws it as a tick jammed against the next letter, so
    // `Oʻtkirbek` reads as `Otkirbek`. Adding a script here means rendering
    // those two pairs and looking at the result, not checking coverage.
    const CHECKED = ['Parisienne', 'Sacramento', 'Dancing Script', 'La Belle Aurore', 'Caveat'];
    const scripts = ADMIN_FONTS.filter((f) => /cursive\s*$/.test(f.stack)).map((f) => f.label);
    expect(scripts.length, 'no script faces at all — has the stack format changed?').toBeGreaterThan(0);
    for (const s of scripts) {
      expect(CHECKED, `${s} has not been checked against O' and g'`).toContain(s);
    }
  });
});

describe('the runtime applies what the editor offers', () => {
  it('carries the table itself rather than a second copy of it', () => {
    // Serialised from the shared export at build time. If this ever becomes a
    // literal typed out by hand, the two drift and a saved face stops loading.
    for (const f of ADMIN_FONTS) {
      expect(RT, `${f.label} is offered by the editor but unknown to the runtime`)
        .toContain(JSON.stringify(f.key));
      expect(RT).toContain(JSON.stringify(f.stack));
    }
  });

  it('builds one stylesheet link from the faces a layer actually uses', () => {
    expect(RT, 'nothing fetches the chosen face').toContain('fonts.googleapis.com/css2');
    const fn = RT.slice(RT.indexOf('function ensureFonts'));
    expect(fn.slice(0, 1200), 'the link is not keyed on the layer').toContain('LAYER.styles');
    // Rebuilt, not appended to: a face dropped in the editor must stop being
    // fetched, and an unchanged href must not re-request the stylesheet.
    expect(fn.slice(0, 1200), 'a dropped face keeps being fetched').toContain('removeChild');
    expect(fn.slice(0, 1200), 'every config push re-requests the same stylesheet')
      .toMatch(/getAttribute\('href'\)\s*!==/);
  });

  it('applies the face to the section and its headings, and to nothing else', () => {
    const fn = RT.slice(RT.indexOf('function renderStyles'));
    const body = fn.slice(0, fn.indexOf('function kfMarker'));
    expect(body, 'the chosen face is never applied').toContain('font-family:');
    expect(body, 'headings carry the template --display and would ignore an inherited face')
      .toMatch(/sel \+ ' h1,/);
    // The rule that keeps a script out of tracked uppercase eyebrows.
    expect(body, "the face is applied to '#sec *', which flattens the section to one voice")
      .not.toMatch(/sel \+ ' \*'/);
  });

  it('casts the shadow from the section and lets it inherit', () => {
    const fn = RT.slice(RT.indexOf('function shadowCss'));
    expect(fn.slice(0, 700), 'the shadow is not layered').toContain('text-shadow:');
    // Clamped: the slider is 0..1 but a saved layer is JSON and can hold
    // anything, and a depth of 40 is an opaque block under every line.
    expect(fn.slice(0, 700), 'an out-of-range depth is not clamped').toMatch(/Math\.max\(0,\s*Math\.min\(1/);
    // Zero means none, not a shadow at zero opacity that still costs a repaint.
    expect(fn.slice(0, 700), 'a depth of 0 still emits a shadow').toMatch(/if\s*\(\s*!d\s*\)\s*return\s*''/);
  });

  it('never writes a raw family name from the layer into CSS', () => {
    // `font` is a KEY into the table, looked up. Writing s.font straight into a
    // font-family declaration would make a saved layer able to name anything.
    const fn = RT.slice(RT.indexOf('function renderStyles'));
    expect(fn.slice(0, 2000), 'the layer names the family directly')
      .not.toMatch(/font-family:'\s*\+\s*s\.font/);
    expect(fn.slice(0, 2000), 'the face is not looked up in the table').toMatch(/FONTS\[s\.font\]/);
  });
});

describe('the editor offers both controls', () => {
  it('lists the faces from the shared table', () => {
    expect(EDITOR, 'the picker is not built from ADMIN_FONTS').toContain('ADMIN_FONTS.map');
    expect(EDITOR, 'the font is not saved onto the section style').toMatch(/setStyle\([^)]*\{\s*font:/);
  });

  it('is a picker, not a text box', () => {
    // A typed family name is a family nothing fetches; see the table's note.
    const at = EDITOR.indexOf("t('adm_font')");
    expect(at, 'the font control is gone').toBeGreaterThan(-1);
    expect(EDITOR.slice(at, at + 700), 'the face is typed rather than chosen').toContain('<select');
  });

  it('offers the shadow with a colour, and only once there is one', () => {
    expect(EDITOR, 'no shadow control').toMatch(/setStyle\([^)]*\{\s*shadow:/);
    expect(EDITOR, 'the shadow has no colour').toMatch(/setStyle\([^)]*\{\s*shadowColor:/);
    // A colour well beside a slider at zero is a control that does nothing.
    expect(EDITOR, 'the colour shows even with no shadow to colour').toContain('{!!s.shadow && (');
  });

  it('shows each face in its own face', () => {
    // A list of fourteen identical rows does not tell an administrator what
    // they are picking.
    const at = EDITOR.indexOf('ADMIN_FONTS.map');
    expect(EDITOR.slice(at, at + 400)).toContain('fontFamily: f.stack');
  });
});
