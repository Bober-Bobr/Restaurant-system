import { describe, expect, it } from 'vitest';
import { plaqueSig, themePayload } from './plaqueDraft';
import type { DesignTheme } from '../services/designTemplate.service';
import type { Block } from '../blocks/types';

// The NFC plaque editor auto-saves. These are the two rules that turns into,
// both learned from the same symptom: a change the maker made, saw in the
// preview, and lost.

const blocks: Block[] = [{ id: 'a', type: 'heading', props: { text: 'Hi' } }];

describe('themePayload', () => {
  it('sends every theme field even when the theme is empty', () => {
    // THE bug this file exists for. `JSON.stringify` drops undefined keys, so a
    // colour the maker cleared was simply absent from the request and the server
    // kept the old one.
    //
    // The expected keys are listed rather than derived from the result, because
    // deriving them is exactly how this test passes against the broken version:
    // the old code spread the theme, `themePayload({})` returned `{}`, and a
    // loop over its own keys had nothing to check.
    const EXPECTED = [
      'accentColor', 'backgroundColor', 'backgroundImageUrl', 'textColor', 'textScale',
      'particles', 'particlesColor', 'particlesImageUrl', 'musicUrl',
      'trailTemplate', 'trailColor', 'trailImageUrl',
    ];
    const sent = JSON.parse(JSON.stringify(themePayload({}))) as Record<string, unknown>;
    for (const key of EXPECTED) {
      expect(sent, `${key} was dropped in transit`).toHaveProperty(key);
    }
  });

  it('a cleared colour is distinguishable from an unchanged one', () => {
    const before = themePayload({ accentColor: '#c8a97a' });
    const after = themePayload({ accentColor: undefined });
    expect(before.accentColor).toBe('#c8a97a');
    expect(after.accentColor).toBeNull();
  });

  it('textScale falls back to 1 rather than null', () => {
    // The column is a number the renderer multiplies by; null would render
    // every text block at zero.
    expect(themePayload({}).textScale).toBe(1);
    expect(themePayload({ textScale: 1.4 }).textScale).toBe(1.4);
  });
});

describe('plaqueSig', () => {
  const theme: DesignTheme = { accentColor: '#c8a97a', textScale: 1 };

  it('is stable across theme key order', () => {
    // The theme loaded from the server is assembled in a different key order
    // than the one the editor builds. Comparing raw JSON would call that a
    // change, and auto-save would write on every visit to the editor.
    const a: DesignTheme = { accentColor: '#c8a97a', textColor: '#111111' };
    const b: DesignTheme = { textColor: '#111111', accentColor: '#c8a97a' };
    expect(plaqueSig('B', 'b', false, blocks, a)).toBe(plaqueSig('B', 'b', false, blocks, b));
  });

  it('treats "never set" and "explicitly cleared" as the same state', () => {
    // Both persist as null, so they must not read as a pending change — that
    // would be an auto-save that can never settle.
    const unset: DesignTheme = { accentColor: '#c8a97a' };
    const cleared: DesignTheme = { accentColor: '#c8a97a', musicUrl: undefined };
    expect(plaqueSig('B', 'b', false, blocks, unset)).toBe(plaqueSig('B', 'b', false, blocks, cleared));
  });

  it('notices a change to a single block prop', () => {
    // Per-block colour lives in the blocks JSON. If the signature missed it,
    // auto-save would never fire for it and the colour would not stick.
    const recoloured: Block[] = [{ ...blocks[0], props: { ...blocks[0].props, textColor: '#ff0000' } }];
    expect(plaqueSig('B', 'b', false, recoloured, theme)).not.toBe(plaqueSig('B', 'b', false, blocks, theme));
  });

  it('notices publish, name and address changes', () => {
    const base = plaqueSig('B', 'b', false, blocks, theme);
    expect(plaqueSig('B', 'b', true, blocks, theme)).not.toBe(base);
    expect(plaqueSig('C', 'b', false, blocks, theme)).not.toBe(base);
    expect(plaqueSig('B', 'c', false, blocks, theme)).not.toBe(base);
  });
});
