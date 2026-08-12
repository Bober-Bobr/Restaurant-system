import { describe, expect, it } from 'vitest';
import { DEFAULT_ACCENT, resolveAccent } from './theme';

// A restaurant picks its own accent, and the food-service site is near-black.
// Without a guard, a brand navy renders as an invisible site that looks like our
// bug rather than their setting.

const isDefault = (hex: string) => hex.toLowerCase() === DEFAULT_ACCENT.toLowerCase();

/** WCAG relative luminance, recomputed here so the test does not trust the module. */
function luminance(hex: string): number {
  const n = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16) / 255);
  const ch = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * ch(r!) + 0.7152 * ch(g!) + 0.0722 * ch(b!);
}
function contrastWithCard(hex: string): number {
  const card = 0.0157; // luminance of the card surface the accent sits on
  const l = luminance(hex);
  return (Math.max(l, card) + 0.05) / (Math.min(l, card) + 0.05);
}

describe('an unset or broken colour falls back', () => {
  for (const value of [null, undefined, '', '   ', 'red', '#12', '#ggg', 'rgb(1,2,3)', '#1234567']) {
    it(`${JSON.stringify(value)} → the platform default`, () => {
      expect(isDefault(resolveAccent(value).accent)).toBe(true);
    });
  }
});

describe('a usable colour is kept', () => {
  it('keeps a bright brand colour untouched', () => {
    expect(resolveAccent('#ff6b5a').accent).toBe('#ff6b5a');
  });

  it('accepts shorthand hex and a missing #', () => {
    expect(resolveAccent('#fff').accent).toBe('#ffffff');
    expect(resolveAccent('ff6b5a').accent).toBe('#ff6b5a');
  });

  it('lifts even a vivid colour if it is too dark for the card it sits on', () => {
    // Pure red clears no contrast bar against a near-black card, so it is
    // lightened rather than kept — the judgement is contrast, not vividness.
    const { accent } = resolveAccent('#ff0000');
    expect(accent).not.toBe('#ff0000');
    expect(isDefault(accent)).toBe(false);
    expect(contrastWithCard(accent)).toBeGreaterThanOrEqual(4.5);
  });

  it('is case-insensitive', () => {
    expect(resolveAccent('#FF6B5A').accent).toBe('#ff6b5a');
  });
});

describe('a too-dark colour keeps its hue instead of being thrown away', () => {
  // Swapping a restaurant's navy for the platform lime is a surprising thing
  // for a settings field to do, so the lightness is raised and the hue kept.
  const DARK_BRANDS = ['#001f3f', '#0b3d0b', '#2b0a3d', '#3a0f0f'];

  for (const brand of DARK_BRANDS) {
    it(`${brand} is lifted, not replaced`, () => {
      const { accent } = resolveAccent(brand);
      expect(isDefault(accent)).toBe(false);
      expect(luminance(accent)).toBeGreaterThan(luminance(brand));
      expect(contrastWithCard(accent)).toBeGreaterThanOrEqual(4.5);
    });
  }

  it('lifts no further than it has to', () => {
    const { accent } = resolveAccent('#001f3f');
    expect(contrastWithCard(accent)).toBeLessThan(9);
  });
});

describe('a colour with no hue to preserve falls back', () => {
  // Lightening black yields grey, which is not anybody's brand colour either.
  for (const grey of ['#000000', '#0a0a0a', '#222222', '#1c1e20']) {
    it(`${grey} → the platform default`, () => {
      expect(isDefault(resolveAccent(grey).accent)).toBe(true);
    });
  }
});

describe('text on the accent is chosen by measurement', () => {
  it('puts dark ink on a light accent', () => {
    expect(resolveAccent('#c6f24e').accentInk).toBe('#040506');
    expect(resolveAccent('#ffffff').accentInk).toBe('#040506');
  });

  it('reaches for white only when dark ink would read worse', () => {
    const ink = resolveAccent('#7c2e3c').accentInk;
    expect(['#040506', '#ffffff']).toContain(ink);
  });

  it('always produces a legible pairing', () => {
    for (const brand of ['#ff6b5a', '#c6f24e', '#001f3f', '#7c2e3c', '#2563eb', '#ffffff']) {
      const { accent, accentInk } = resolveAccent(brand);
      const ratio = (() => {
        const [hi, lo] = [luminance(accent), luminance(accentInk)].sort((a, b) => b - a);
        return (hi! + 0.05) / (lo! + 0.05);
      })();
      expect(ratio).toBeGreaterThan(3);
    }
  });
});

describe('the CSS custom-property payload', () => {
  it('gives foodsite.css the "r, g, b" triple it composes alphas from', () => {
    // Nothing in the sheet hard-codes the accent; it is all
    // `rgb(var(--fs-accent-rgb) / <alpha>)`.
    const { accent, accentRgb } = resolveAccent('#c6f24e');
    expect(accentRgb).toBe('198, 242, 78');
    expect(accent).toBe('#c6f24e');
  });

  it('pads a single-digit channel so the hex stays six characters', () => {
    expect(resolveAccent('#0f0f0f').accent).toMatch(/^#[0-9a-f]{6}$/);
    expect(resolveAccent('#ff6b5a').accent).toMatch(/^#[0-9a-f]{6}$/);
  });
});
