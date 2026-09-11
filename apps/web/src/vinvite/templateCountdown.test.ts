import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { RICH_TEMPLATES } from './templates';

/**
 * The countdown block in the four newest designs.
 *
 * It is wired through six separate places, and five of them fail QUIETLY:
 *
 *   · the markup (a section, four numerals, four labels)
 *   · `renderCountdown()` in renderAll, so a date edited in Design+ updates
 *     without a reload
 *   · `initCountdown()` in the boot, which is the only thing that starts the
 *     interval — without it the numbers are painted once and then sit frozen,
 *     which looks exactly like a working countdown for the first minute
 *   · a `hidden.countdown` toggle, or a couple cannot drop the block
 *   · 'countdown' in `sectionIds`, or Design+ silently skips it
 *   · the four labels in all three UI dictionaries — a missing `data-t` key
 *     renders as an empty element, so the numbers lose their meaning in that
 *     language and nothing says so
 *
 * Verified on the real render as well as here: all four show a live count.
 */
const DIR = join(__dirname, 'templates');
const read = (id: string) => readFileSync(join(DIR, id, 'template.html'), 'utf8');

/**
 * The four the block was added to.
 *
 * Keyed on `initCountdown`, NOT on `id="countdown"` and not on
 * `renderCountdown` either — six older designs carry a countdown of their own,
 * written before this one and differently, and `birthday-prestige`'s happens
 * to share the name `renderCountdown`. Those are not wrong and the checks
 * below do not describe them. The date tripwire at the foot of the file covers
 * every design that shows a count, because that failure is about the content
 * shipped, not about how the block is built.
 */
const WITH_COUNTDOWN = RICH_TEMPLATES.filter((t) => read(t.id).includes('function initCountdown'));
const ANY_COUNTDOWN = RICH_TEMPLATES.filter((t) => read(t.id).includes('id="countdown"'));

it('the designs given a countdown still have one', () => {
  // Named, so removing the section from all four turns every check below into a
  // vacuous pass and this one fails instead.
  expect(WITH_COUNTDOWN.map((t) => t.id).sort()).toEqual([
    'wedding-chateau', 'wedding-paris', 'wedding-samarkand', 'wedding-stillvatn',
  ]);
});

describe.each(WITH_COUNTDOWN.map((t) => [t.id, t] as const))('%s', (id, tpl) => {
  const src = read(id);

  it('has all four numerals', () => {
    for (const unit of ['cdDays', 'cdHours', 'cdMins', 'cdSecs']) {
      expect(src, `#${unit} is missing — that unit renders as nothing`).toContain(`id="${unit}"`);
    }
  });

  it('starts ticking from the boot, not only from a render', () => {
    // renderAll() paints the numbers once. Without the boot call they never
    // change again — and a frozen countdown reads as a working one until the
    // guest has watched it for a minute.
    expect(src, 'initCountdown is gone').toContain('function initCountdown');
    const boot = src.slice(src.lastIndexOf('/* ── Boot'));
    expect(boot, 'initCountdown() is defined but the boot never calls it')
      .toMatch(/\binitCountdown\(\s*\)/);
  });

  it('re-renders on a config push, so an edited date updates live', () => {
    const renderAll = src.slice(src.indexOf('function renderAll'));
    expect(renderAll.slice(0, 700), 'renderAll does not renderCountdown')
      .toMatch(/\brenderCountdown\(\s*\)/);
  });

  it('writes a numeral only when it changes', () => {
    // Assigning the same textContent four times a second makes the browser
    // re-lay-out the row for nothing, and the seconds column drags the three
    // units beside it as it does.
    const fn = src.slice(src.indexOf('function cdSet'), src.indexOf('function renderCountdown'));
    expect(fn, 'cdSet writes unconditionally').toMatch(/if\s*\(\s*el\.textContent\s*!==/);
  });

  it('holds at zero instead of counting backwards', () => {
    // An invitation is opened on the morning of the day and the week after. A
    // negative count, or a section that removes itself, reads as a broken page
    // on precisely the day it matters most.
    const fn = src.slice(src.indexOf('function renderCountdown'));
    expect(fn.slice(0, 700), 'nothing clamps the elapsed case').toMatch(/left\s*<\s*0.*left\s*=\s*0/s);
    expect(fn.slice(0, 700), 'the elapsed state is not marked').toContain('is-over');
    expect(src, 'nothing is shown once the day arrives').toContain('data-t="theDayIsHere"');
  });

  it('is reachable and switchable', () => {
    expect(tpl.sectionIds, "'countdown' is missing from sectionIds").toContain('countdown');
    expect(tpl.fields.some((f) => f.path === 'hidden.countdown'), 'no visibility switch').toBe(true);
    expect(src).toContain('data-opt="countdown"');
  });

  it('its labels exist in every language', () => {
    for (const key of ['countingDown', 'untilTheDay', 'uDays', 'uHours', 'uMins', 'uSecs', 'theDayIsHere']) {
      const found = [...src.matchAll(new RegExp(`\\b${key}:`, 'g'))].length;
      expect(found, `${key} is not in all three dictionaries`).toBe(3);
    }
  });
});

describe('the date these designs ship with has not already passed', () => {
  /**
   * A tripwire, and a deliberate one.
   *
   * `defaultConfig.event.dateISO` is what the template renders with on the
   * marketing site's catalog and full-screen preview, where nobody has typed a
   * date. Two of these four already shipped a date in the PAST, which nothing
   * noticed while the date was only printed — but a countdown renders it as
   * 00:00:00:00 under "The day is here", and a prospective customer reads that
   * as a design that does not work.
   *
   * So when this fails, it is not wrong: move the defaults forward a year.
   */
  for (const tpl of ANY_COUNTDOWN) {
    it(tpl.id, () => {
      const iso = ((tpl.defaultConfig.event ?? {}) as Record<string, unknown>).dateISO;
      expect(typeof iso, 'no default date at all').toBe('string');
      const when = new Date(iso as string);
      expect(Number.isNaN(when.getTime()), `unparseable default date: ${iso}`).toBe(false);
      expect(
        when.getTime() > Date.now(),
        `${tpl.id} previews a wedding that has already happened (${iso}) — the `
        + 'catalog and the pricing preview both render the default config, so the '
        + 'countdown there reads 00:00:00:00. Move the default forward a year.',
      ).toBe(true);
    });
  }
});
