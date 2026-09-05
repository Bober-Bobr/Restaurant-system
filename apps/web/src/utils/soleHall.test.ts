import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { soleHallId } from './soleHall';

const SRC = join(__dirname, '..');
const read = (rel: string) => readFileSync(join(SRC, rel), 'utf8');

describe('the only hall a restaurant has', () => {
  it('is returned when there is exactly one', () => {
    expect(soleHallId([{ id: 'h1', isActive: true }])).toBe('h1');
  });

  it('is null when there is a real choice', () => {
    expect(soleHallId([{ id: 'h1', isActive: true }, { id: 'h2', isActive: true }])).toBeNull();
  });

  it('is null when there are none at all', () => {
    expect(soleHallId([])).toBeNull();
    expect(soleHallId(null)).toBeNull();
    expect(soleHallId(undefined)).toBeNull();
  });

  it('ignores halls that are switched off', () => {
    // The admin form lists retired halls so an event already assigned to one can
    // still be opened. They are not bookable, so they are not a choice.
    expect(soleHallId([
      { id: 'open', isActive: true },
      { id: 'retired', isActive: false },
      { id: 'also-retired', isActive: false },
    ])).toBe('open');
  });

  it('is null when every hall is switched off', () => {
    expect(soleHallId([{ id: 'a', isActive: false }, { id: 'b', isActive: false }])).toBeNull();
    expect(soleHallId([{ id: 'a', isActive: false }])).toBeNull();
  });

  it('treats a missing flag as active', () => {
    // The kiosk's public payload has already filtered by it. Reading an absent
    // flag as "off" would make the sole hall invisible and silently do nothing.
    expect(soleHallId([{ id: 'h1' }])).toBe('h1');
  });
});

describe('every hall picker applies the default', () => {
  // Two screens pick a hall: the admin event form and the kiosk. Both have to
  // apply it, and a third added later should fail here rather than ship blank.
  const PICKERS = ['pages/AdminEventsPage.tsx', 'pages/TabletMenuPage.tsx'];

  for (const file of PICKERS) {
    it(`${file} fills the field in from the sole hall`, () => {
      expect(read(file), `${file} does not use soleHallId`).toContain('soleHallId');
    });

    it(`${file} applies it only to an empty field`, () => {
      // The default is applied once, never re-asserted: an effect that also
      // watched the current selection would put the hall straight back every
      // time someone cleared it, and nothing could undo that.
      const src = read(file);
      const guarded =
        /setHallId\(\(current\) => current \|\| defaultHallId\)/.test(src) ||
        /if \(only && !useTabletStore\.getState\(\)\.selectedHallId\) setHall\(only\)/.test(src);
      expect(guarded, `${file} applies the default without checking the field is empty`).toBe(true);
    });
  }

  it('the admin form resets back to the default, not to blank', () => {
    // Creating an event clears the form. Clearing it to '' would mean the
    // default applied on the first event only.
    const src = read('pages/AdminEventsPage.tsx');
    expect(src).not.toMatch(/^\s*setHallId\(''\);\s*$/m);
    expect(src).toMatch(/setHallId\(defaultHallId\);/);
  });
});
