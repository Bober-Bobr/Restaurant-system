import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

/**
 * A parallax background must not escape its section.
 *
 * The rich templates give a section its photograph as an absolutely-positioned
 * layer inset by a NEGATIVE amount — `.art-bg { inset: -8% }`, `.scene__img
 * { inset: -10% }` — so the parallax transform has somewhere to travel without
 * exposing an edge. Over it sits a veil (`.art-veil`, `inset: 0`) that tones the
 * photograph down to a background the type can be read against.
 *
 * The veil covers the SECTION. The image is bigger than the section. So a
 * section that does not clip lets that overhang out at full strength, and the
 * viewer sees a raw band of photograph above and below it — in `wedding-chateau`
 * and `wedding-paris`, a strip of the table setting appearing under the calendar
 * block and across the text beneath it.
 *
 * Every other section carrying such a layer already clipped; `.details` was the
 * omission in both. That is exactly the kind of defect that returns the next
 * time a section is added, and it is invisible to the smoke test — linkedom has
 * no layout, so nothing there can observe an overflowing box. Hence a source
 * check: for every section that contains a bleed layer, the section's own rule
 * must clip.
 */
const DIR = join(__dirname, 'templates');
const TEMPLATES = readdirSync(DIR, { withFileTypes: true })
  .filter((e) => e.isDirectory() && existsSync(join(DIR, e.name, 'template.html')))
  .map((e) => e.name);

/** The first class on a `<section class="…">`, which is what carries its rule. */
function sections(src: string): { cls: string; id: string; body: string }[] {
  const out: { cls: string; id: string; body: string }[] = [];
  const re = /<section[^>]*class="([^"]+)"[^>]*>/g;
  for (let m = re.exec(src); m; m = re.exec(src)) {
    const end = src.indexOf('</section>', m.index);
    const tag = m[0];
    const id = /id="([^"]+)"/.exec(tag)?.[1] ?? '(no id)';
    out.push({ cls: m[1].split(/\s+/)[0], id, body: src.slice(m.index + tag.length, end) });
  }
  return out;
}

/**
 * Classes on the section's DIRECT children only.
 *
 * A negative inset resolves against the nearest POSITIONED ancestor, so only a
 * direct child of the section (sections are `position: relative`) can escape the
 * section. A glow nested inside another absolutely-positioned element — the sun
 * halo in `birthday-tuscan`, `.sun-rays { inset: -42% }` — is measured against
 * its own parent and stays where it belongs. Matching it would report a template
 * that is perfectly correct, and a guard that cries wolf gets switched off.
 */
function topLevelClasses(body: string): string[] {
  const out: string[] = [];
  let depth = 0;
  const re = /<(\/?)([a-zA-Z][a-zA-Z0-9]*)([^>]*)>/g;
  const VOID = new Set(['img', 'br', 'hr', 'input', 'source', 'path', 'circle', 'use', 'meta', 'link']);
  for (let m = re.exec(body); m; m = re.exec(body)) {
    const [, slash, tag, attrs] = m;
    if (slash) { depth -= 1; continue; }
    if (depth === 0) {
      const cls = /class="([^"]+)"/.exec(attrs)?.[1];
      if (cls) out.push(...cls.split(/\s+/));
    }
    if (!VOID.has(tag.toLowerCase()) && !attrs.trim().endsWith('/')) depth += 1;
  }
  return out;
}

/** Class names whose rule is absolutely positioned with a negative inset. */
function bleedLayers(src: string): Set<string> {
  const found = new Set<string>();
  const re = /\.([a-zA-Z0-9_-]+)\s*\{([^}]*)\}/g;
  for (let m = re.exec(src); m; m = re.exec(src)) {
    const body = m[2];
    if (!/position\s*:\s*absolute/.test(body)) continue;
    // `inset: -8%`, `inset: -8% 0`, `top: -10%` — any negative offset means the
    // layer is deliberately larger than the box it belongs to.
    if (/(?:inset|top|bottom|left|right)\s*:\s*[^;]*-\d/.test(body)) found.add(m[1]);
  }
  return found;
}

/** Does this class's own rule clip? */
function clips(src: string, cls: string): boolean {
  const re = new RegExp(`\\.${cls}\\s*\\{([^}]*)\\}`, 'g');
  for (let m = re.exec(src); m; m = re.exec(src)) {
    if (/overflow(-[xy])?\s*:\s*(hidden|clip)/.test(m[1])) return true;
  }
  return false;
}

describe.each(TEMPLATES)('%s', (name) => {
  const src = readFileSync(join(DIR, name, 'template.html'), 'utf8');
  const layers = bleedLayers(src);

  it('every section holding an oversized background layer clips it', () => {
    const leaking = sections(src)
      .filter(({ body }) => topLevelClasses(body).some((c) => layers.has(c)))
      .filter(({ cls }) => !clips(src, cls))
      .map(({ id, cls }) => `#${id} (.${cls})`);

    expect(
      leaking,
      `these sections let their background photograph out over the sections around them — `
      + `add overflow:hidden to the section's rule: ${leaking.join(', ')}`,
    ).toEqual([]);
  });
});

describe('the two that were actually broken', () => {
  // Named explicitly as well as covered by the sweep above: the sweep passes
  // vacuously if `bleedLayers` ever stops recognising the pattern (a rewritten
  // `inset` shorthand, say), and then the guard is guarding nothing.
  for (const name of ['wedding-chateau', 'wedding-paris']) {
    it(`${name}: .art-bg is oversized, and .details clips`, () => {
      const src = readFileSync(join(DIR, name, 'template.html'), 'utf8');
      expect(bleedLayers(src), 'the bleed layer is no longer detected').toContain('art-bg');
      expect(clips(src, 'details'), '.details stopped clipping').toBe(true);
      // The veil only covers the section, which is *why* the overhang has to be
      // clipped rather than merely tinted. If this stops being true the fix
      // above may no longer be the right one.
      expect(src).toMatch(/\.art-veil\s*\{[^}]*inset\s*:\s*0/);
    });
  }
});

describe('type over a film keeps a backdrop to stand on', () => {
  // The two heroes that play a film centre their names on it, and the vignette
  // behind them is deliberately CLEAR in the middle so the film shows through.
  // Measured on the real render, the ivory names sat at 2.7:1 against the bright
  // frames and the gold at 1.8:1 — the largest type on the page was the least
  // readable. A pool of shade under the text block took those to 7.1 and 4.7.
  //
  // The backdrop is darkened rather than the type, because the backdrop MOVES:
  // the gates open from a bright frame onto a dusk one, so type dark enough for
  // the opening would vanish seconds later.
  for (const name of ['wedding-chateau', 'wedding-paris']) {
    const src = readFileSync(join(DIR, name, 'template.html'), 'utf8');
    const scrim = /\.hero__scrim\s*\{([^}]*)\}/.exec(src)?.[1] ?? '';

    it(`${name}: the scrim pools shade under the text block`, () => {
      expect(scrim, '.hero__scrim is gone').not.toBe('');
      // An ellipse centred on the type, distinct from the vignette centred at 62%.
      expect(scrim, 'the pool behind the hero type was removed')
        .toMatch(/radial-gradient\(\s*[\d.]+%\s+[\d.]+%\s+at\s+50%\s+50%/);
    });

    it(`${name}: and the type carries a shadow for the frames it cannot predict`, () => {
      const inner = /\.hero__inner\s*\{([^}]*)\}/.exec(src)?.[1] ?? '';
      expect(inner).toContain('text-shadow');
    });
  }
});
