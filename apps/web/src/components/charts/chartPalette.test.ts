import { describe, expect, it } from 'vitest';
import { CH, CH_HEX, CHART_CSS } from './Charts';

// ── The palette, and the two copies of it ───────────────────────────────────
// The fills are custom properties so a chart inherits them from its card, but
// two callers draw OUTSIDE a `.ch` subtree — the activity calendar, which
// interpolates its accent into a `color-mix()`, and anything handing a colour to
// a canvas. There `var(--ch-revenue)` resolves to nothing and the marks come out
// blank, which looks exactly like missing data. `CH_HEX` exists for those, and a
// second copy of a colour is a copy that can drift.

const declared = (name: string): string | null => {
  const match = new RegExp(`--ch-${name}:\\s*(#[0-9a-fA-F]{3,8})\\s*;`).exec(CHART_CSS);
  return match?.[1].toLowerCase() ?? null;
};

describe('the raw hexes match the custom properties', () => {
  for (const slot of ['revenue', 'spend', 'loss', 'count'] as const) {
    it(`--ch-${slot}`, () => {
      expect(declared(slot)).toBe(CH_HEX[slot].toLowerCase());
      expect(CH[slot]).toBe(`var(--ch-${slot})`);
    });
  }

  it('covers every slot, so a new fill cannot be added to only one copy', () => {
    expect(Object.keys(CH_HEX).sort()).toEqual(Object.keys(CH).sort());
  });
});

describe('the chart chrome stays recessive', () => {
  it('draws gridlines and axes as SOLID hairlines', () => {
    // A dashed grid reads as a projection or a threshold when it is only a grid,
    // and at this weight it shimmers on a phone.
    const chrome = /\.ch-grid \{([^}]*)\}/.exec(CHART_CSS)?.[1] ?? '';
    expect(chrome).not.toMatch(/dash/);
    expect(chrome).toMatch(/stroke-width:\s*1\b/);
  });

  it('never sets a series colour on chart TEXT', () => {
    // Identity comes from the coloured swatch beside a label. These fills are
    // chosen for a large mark on a dark ground and are illegible as type.
    const textRules = [...CHART_CSS.matchAll(/\.ch-(tick|cat|value|legend)[^{]*\{([^}]*)\}/g)];
    expect(textRules.length).toBeGreaterThan(0);
    for (const [, name, body] of textRules) {
      for (const slot of Object.keys(CH_HEX)) {
        expect(`${name}: ${body}`).not.toContain(`--ch-${slot}`);
      }
    }
  });
});

describe('the inline style React would silently drop', () => {
  it('uses no `!important` anywhere in the chart CSS', () => {
    // React drops any inline style declaration containing `!important`, and this
    // block is injected as a <style> tag whose rules must beat nothing.
    expect(CHART_CSS).not.toContain('!important');
  });
});
