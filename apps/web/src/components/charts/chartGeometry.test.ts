import { describe, expect, it } from 'vitest';
import {
  bandLayout, barPath, clampLabelX, compactCount, compactSum, divergingScale,
  labelStride, monthLabel, niceScale, shareSegments, sparkPoints, spansYears,
} from './chartGeometry';

// The charts are drawn by hand, so the things a charting library would get right
// for us are the things that need holding down here: that a bar starts at zero,
// that both arms of a diverging scale use the same step, that a bar never draws
// wider than its slot, and that nothing divides by zero on an empty report — a
// restaurant with no trade yet is the FIRST state this page is ever seen in.

describe('the vertical scale', () => {
  it('always starts at zero', () => {
    // A truncated baseline makes a 2% difference look like a tripling. It is the
    // most common way a bar chart lies, and it is not reachable from here.
    expect(niceScale(1000).min).toBe(0);
    expect(niceScale(1_000_000).min).toBe(0);
  });

  it('rounds the top to a clean number', () => {
    expect(niceScale(970).max).toBe(1000);
    // 1040 snaps up to 1500 on a step of 500, not to 1040 on a step of 260 —
    // reaching a clean step matters more than hugging the tallest bar.
    expect(niceScale(1040).max).toBe(1500);
    // 23 bookings top out at 30, on a step of 10 — not at 24 on a step of 6.
    expect(niceScale(23).max).toBe(30);
    expect(niceScale(23).ticks).toEqual([0, 10, 20, 30]);
  });

  it('produces ticks a person would read', () => {
    expect(niceScale(1000).ticks).toEqual([0, 250, 500, 750, 1000]);
    expect(niceScale(40).ticks).toEqual([0, 10, 20, 30, 40]);
  });

  it('keeps the top tick when the step is fractional', () => {
    // A 2.5 × 10^n step accumulates drift, and `value <= max` dropped the last
    // tick — leaving a chart whose highest bar reached past its own axis.
    const scale = niceScale(9500);
    expect(scale.ticks[scale.ticks.length - 1]).toBe(scale.max);
  });

  it('survives an empty report without dividing by zero', () => {
    for (const highest of [0, -5, Number.NaN, Number.POSITIVE_INFINITY]) {
      const scale = niceScale(highest);
      expect(scale.max).toBeGreaterThan(0);
      expect(scale.ticks.length).toBeGreaterThan(1);
    }
  });
});

describe('the diverging scale', () => {
  // A step on one side of zero has to mean the same as a step on the other, or
  // the chart draws a small loss as a catastrophe beside a large profit.
  const stepOf = (ticks: number[]) => ticks[1] - ticks[0];

  it('uses one step for both arms, so a unit is a unit on either side of zero', () => {
    const scale = divergingScale([1_000_000, -200_000]);
    const step = stepOf(scale.ticks);
    for (let i = 1; i < scale.ticks.length; i += 1) {
      expect(scale.ticks[i] - scale.ticks[i - 1]).toBeCloseTo(step, 5);
    }
  });

  it('does NOT waste an arm the data never reaches', () => {
    // A year of profit with one bad month used to spend half the plot on an
    // empty negative arm and squash every real bar into the top half.
    const scale = divergingScale([1_000_000, 900_000, -50_000]);
    expect(scale.max).toBeGreaterThan(-scale.min);
    expect(scale.min).toBeLessThan(0);
  });

  it('still reaches past the largest value on each side', () => {
    const scale = divergingScale([900, -400]);
    expect(scale.max).toBeGreaterThanOrEqual(900);
    expect(scale.min).toBeLessThanOrEqual(-400);
  });

  it('has no negative arm at all when nothing went negative', () => {
    expect(divergingScale([500, 900]).min).toBe(0);
  });

  it('always draws the zero line — it is the baseline every bar is measured from', () => {
    expect(divergingScale([0, 0, 0]).ticks).toContain(0);
    expect(divergingScale([500, 900]).ticks).toContain(0);
    expect(divergingScale([-500, -900]).ticks).toContain(0);
    expect(Number.isFinite(divergingScale([0, 0, 0]).zeroAt)).toBe(true);
  });

  it('has no duplicate ticks around zero', () => {
    for (const values of [[500, -500], [500, 900], [-100, -900], [0, 0]]) {
      const ticks = divergingScale(values).ticks;
      expect(new Set(ticks).size).toBe(ticks.length);
    }
  });
});

describe('bars inside their slot', () => {
  it('never draws a bar thicker than the cap, however wide the slot', () => {
    // The slot's leftover is air. A 90px-wide bar reads as a block, not a mark.
    expect(bandLayout(400, 1).thickness).toBeLessThanOrEqual(24);
    expect(bandLayout(4000, 2).thickness).toBeLessThanOrEqual(24);
  });

  it('keeps every bar of a group inside the slot', () => {
    for (const slot of [12, 30, 64, 120, 300]) {
      for (const series of [1, 2, 3]) {
        const { thickness, offsets } = bandLayout(slot, series);
        expect(offsets[0]).toBeGreaterThanOrEqual(0);
        expect(offsets[offsets.length - 1] + thickness).toBeLessThanOrEqual(slot + 0.001);
      }
    }
  });

  it('leaves a 2px gap between touching bars rather than a stroke around them', () => {
    const { thickness, offsets } = bandLayout(120, 2);
    expect(offsets[1] - (offsets[0] + thickness)).toBeCloseTo(2, 5);
  });

  it('still gives a visible bar in a very narrow slot', () => {
    // A phone with twelve months and two series: the bars get thin, never zero.
    expect(bandLayout(8, 2).thickness).toBeGreaterThan(0);
  });

  it('centres the group in its slot', () => {
    const { thickness, offsets } = bandLayout(100, 2);
    const used = offsets[1] + thickness - offsets[0];
    expect(offsets[0]).toBeCloseTo((100 - used) / 2, 5);
  });
});

describe('the bar path', () => {
  it('rounds the data end and leaves the baseline end square', () => {
    // Rounding both ends detaches the bar from its axis; a short bar becomes a
    // floating pill.
    const path = barPath(0, 10, 20, 50, 4, 'top');
    expect(path).toContain('a4 4');
    // Two arcs, not four: only the top corners are rounded.
    expect(path.match(/a4 4/g)).toHaveLength(2);
  });

  it('caps the radius so a bar shorter than the radius cannot bulge past its value', () => {
    const path = barPath(0, 0, 20, 2, 4, 'top');
    expect(path).not.toContain('a4 4');
    expect(path).toContain('a1 1');
  });

  it('draws nothing for a zero-length bar', () => {
    // An empty string, not a degenerate path: a dot at the axis reads as a real
    // but tiny value where the truth is none at all.
    expect(barPath(0, 0, 20, 0)).toBe('');
    expect(barPath(0, 0, 0, 20)).toBe('');
  });

  it('serves all four directions', () => {
    for (const side of ['top', 'right', 'bottom', 'left'] as const) {
      expect(barPath(0, 0, 40, 40, 4, side)).toMatch(/^M/);
    }
  });
});

describe('a part-to-whole bar', () => {
  it('splits the width in proportion, less the gaps', () => {
    const segments = shareSegments([75, 25], 202, 2);
    expect(segments[0].width).toBeCloseTo(150, 5);
    expect(segments[1].width).toBeCloseTo(50, 5);
  });

  it('charges no gap for a part that is not there', () => {
    // Two parts, one empty: the drawn one takes the whole width, with no gap
    // reserved beside nothing.
    const segments = shareSegments([100, 0], 200, 2);
    expect(segments[0].width).toBeCloseTo(200, 5);
    expect(segments[1].width).toBe(0);
  });

  it('drops a sliver rather than drawing a 1px stripe of colour', () => {
    // A hairline at the end of a bar reads as a rendering artefact. The figure
    // beside the bar still states it.
    const segments = shareSegments([100_000, 1], 300, 2);
    expect(segments[1].width).toBe(0);
  });

  it('draws nothing when nothing has happened yet', () => {
    expect(shareSegments([0, 0], 300).every((segment) => segment.width === 0)).toBe(true);
    expect(shareSegments([5, 5], 0).every((segment) => segment.width === 0)).toBe(true);
  });
});

describe('the sparkline', () => {
  it('draws a flat series down the middle instead of dividing by zero', () => {
    const points = sparkPoints([7, 7, 7], 90, 20);
    expect(points).not.toContain('NaN');
    expect(points).toContain('10.00');
  });

  it('draws nothing from nothing, and a flat line from one point', () => {
    expect(sparkPoints([], 90, 20)).toBe('');
    expect(sparkPoints([4], 90, 20)).toBe('0,10 90,10');
  });

  it('puts the highest value at the top', () => {
    const points = sparkPoints([0, 10], 90, 20).split(' ');
    expect(Number(points[0].split(',')[1])).toBeGreaterThan(Number(points[1].split(',')[1]));
  });
});

describe('compact money', () => {
  // `toLocaleString('ru-RU')` groups with a NON-BREAKING space, which is correct
  // on screen and invisible in a failure message — two identical-looking strings
  // that are not equal. Normalised here so a real difference is the only thing
  // that can fail.
  const plain = (value: number) => compactSum(value).replace(/ /g, ' ');

  it('takes TIYIN and prints so’m', () => {
    // Every money value in this product is tiyin; the ÷100 lives in one place.
    expect(plain(100)).toBe('1');
    expect(plain(1_000_000)).toBe('10 ming');
  });

  it('shortens the big figures an owner actually reads', () => {
    expect(plain(120_000_000)).toBe('1,2 mln');
    // 50 000 000 000 tiyin = 500 000 000 so'm.
    expect(plain(50_000_000_000)).toBe('500 mln');
  });

  it('keeps the sign on a loss', () => {
    expect(plain(-120_000_000).startsWith('-')).toBe(true);
  });

  it('leaves small figures alone rather than rounding them to 0K', () => {
    expect(plain(450_000)).toBe('4 500');
  });

  it('compacts counts the same way so two axes match', () => {
    expect(compactCount(12)).toBe('12');
    expect(compactCount(24_000)).toBe('24K');
  });
});

describe('month labels', () => {
  it('omits the year when the range stays inside one', () => {
    // Twelve columns all reading "2026" is twelve repetitions of nothing.
    expect(spansYears(['2026-01', '2026-08'])).toBe(false);
    expect(monthLabel('2026-08', 'en', false)).not.toContain('26');
  });

  it('adds the year when the range crosses one', () => {
    // Otherwise December and January are two columns both labelled "Jan"/"Dec"
    // with nothing saying they are different years.
    expect(spansYears(['2026-12', '2027-01'])).toBe(true);
    expect(monthLabel('2027-01', 'en', true)).toContain('27');
  });

  it('hands back an unparseable key rather than printing "Invalid Date"', () => {
    expect(monthLabel('nonsense', 'en', false)).toBe('nonsense');
  });
});


// ── The two rules a browser found, not a test ──────────────────────────────
// Both were measured in headless Chrome at 390px, and both were INVISIBLE as
// bugs: these charts live inside `.adm-bg`, which clips horizontally rather than
// scrolling, so an overflowing label does not produce a scrollbar — it just
// loses its last characters.

describe('category labels stay inside the plot', () => {
  it('nudges the outermost label in rather than letting it hang off the edge', () => {
    // Thirteen months at 390px: "сент. 26" ran 2px past the right edge.
    const clamped = clampLabelX(305, 'сент. 26', 44, 308);
    expect(clamped).toBeLessThan(305);
    expect(clamped + ('сент. 26'.length * 5.4) / 2).toBeLessThanOrEqual(308.001);
  });

  it('leaves a label that already fits exactly where it was', () => {
    // A clamp that moved every label would detach them all from their columns.
    expect(clampLabelX(180, 'авг.', 44, 308)).toBe(180);
  });

  it('centres a label too wide for the plot instead of pushing it off the other side', () => {
    const clamped = clampLabelX(10, 'a very long category label indeed', 44, 120);
    expect(clamped).toBe(82);
  });
});

describe('how many labels the axis can carry', () => {
  it('skips more when the labels are longer', () => {
    // The stride used to be a constant ~34px, which assumed a three-letter
    // month. The moment a range crossed a year the labels gained a year suffix
    // and every other one overlapped its neighbour.
    const slot = 20;
    expect(labelStride(['авг.', 'сент.'], slot)).toBeLessThan(labelStride(['сент. 26', 'окт. 26'], slot));
  });

  it('labels every column when there is room', () => {
    expect(labelStride(['авг.', 'сент.'], 80)).toBe(1);
  });

  it('leaves no pair of shown labels overlapping', () => {
    for (const labels of [['сент. 26'], ['авг.'], ['Фотиха'], ['Свадьба']]) {
      for (const slot of [8, 14, 20, 33, 60, 140]) {
        const stride = labelStride(labels, slot);
        expect(stride * slot).toBeGreaterThanOrEqual(labels[0].length * 5.4 + 8 - 0.001);
      }
    }
  });

  it('never returns zero, which would label nothing at all', () => {
    expect(labelStride(['x'], 0)).toBe(1);
    expect(labelStride([], 20)).toBe(1);
  });
});
