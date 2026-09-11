import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The opening film is cut, and the cut is expressed in ONE place.
 *
 * Three designs open on an 8-second film. For a guest that is 8 seconds of
 * waiting before the invitation can be read, every time the link is opened.
 *
 * It is cut by raising `playbackRate`, not by trimming the mp4, because the
 * same file supplies the poster frame and the still that stands in under
 * reduced motion and on a slow connection — and because the hero comes to rest
 * on the film's final frame, so stopping it early would leave it resting on a
 * half-open gate.
 *
 * The thing this file actually guards is that the rate stays the single source
 * of the opening's length. There are two other numbers derived from it: the
 * moment the title lands (a FRACTION of the film, so it tracks the shot rather
 * than the clock) and the safety net that reveals the page if the video never
 * plays at all. Leave that net at its original wall-clock value and it fires
 * seconds AFTER a film that now finishes early — harmless today, and quietly
 * wrong the moment somebody raises the rate again.
 */
const DIR = join(__dirname, 'templates');
const TEMPLATES = readdirSync(DIR, { withFileTypes: true })
  .filter((e) => e.isDirectory() && existsSync(join(DIR, e.name, 'template.html')))
  .map((e) => e.name);

const read = (name: string) => readFileSync(join(DIR, name, 'template.html'), 'utf8');
const WITH_FILM = TEMPLATES.filter((n) => read(n).includes('function initFilm'));

it('the designs that open on a film still do', () => {
  expect(WITH_FILM.sort()).toEqual(['wedding-chateau', 'wedding-paris', 'wedding-samarkand']);
});

describe.each(WITH_FILM)('%s', (name) => {
  const src = read(name);
  const rate = Number(/var\s+INTRO_RATE\s*=\s*([\d.]+)\s*;/.exec(src)?.[1]);

  it('declares one rate, and it actually shortens the opening', () => {
    expect(Number.isFinite(rate), 'INTRO_RATE is gone').toBe(true);
    expect(rate, 'a rate of 1 or less is not a cut').toBeGreaterThan(1);
    // Above roughly 2x an architectural shot stops reading as a camera move and
    // starts reading as a glitch. This is a judgement, not a measurement, and
    // it is here so the number is reconsidered rather than nudged.
    expect(rate, 'that is fast enough to look broken rather than brisk').toBeLessThanOrEqual(2);
  });

  it('applies it to the element', () => {
    const fn = src.slice(src.indexOf('function initFilm'));
    expect(fn.slice(0, 2200), 'the rate is declared but never set on the video')
      .toMatch(/film\.playbackRate\s*=\s*INTRO_RATE/);
    // Set twice on purpose: some engines reset playbackRate across load().
    const hits = [...fn.slice(0, 2200).matchAll(/playbackRate\s*=\s*INTRO_RATE/g)].length;
    expect(hits, 'only set once — a load() that resets it leaves the film at 1x').toBe(2);
  });

  it('derives the safety net from the rate rather than restating it', () => {
    const net = /setTimeout\(arrive,\s*([^)]+)\)/.exec(src)?.[1] ?? '';
    expect(net, 'the safety net is gone').not.toBe('');
    expect(net, `the fallback reveal is still a fixed ${net.trim()}ms — raise the rate `
      + 'and it fires long after the film has finished').toContain('INTRO_RATE');
  });

  it('still lands the title on a fraction of the film, not a wall-clock delay', () => {
    // `currentTime > duration * f` is what keeps the title tied to the moment
    // the gates finish opening whatever the rate is. A setTimeout here would
    // have to be re-tuned every time the rate changes.
    const fn = src.slice(src.indexOf('function initFilm'));
    expect(fn.slice(0, 2600), 'the title no longer tracks the shot')
      .toMatch(/film\.currentTime\s*>\s*film\.duration\s*\*\s*[\d.]+/);
  });
});
