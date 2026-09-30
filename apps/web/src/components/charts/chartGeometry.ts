/**
 * The arithmetic behind the charts, with no SVG in it.
 *
 * Kept apart from the components for the reason every other `*Draft.ts` in this
 * codebase is: a scale that puts a bar half a pixel outside its frame, or a tick
 * row that reads 0 / 3333 / 6667, is a bug you can only see by looking — unless
 * the arithmetic is a function, in which case it is a test.
 *
 * This codebase has **no charting dependency** and deliberately keeps it that
 * way (see the note in ActivityCalendar.tsx). The owner's cabinet is in the entry
 * chunk that every public page downloads, so a chart library here would be paid
 * for by someone tapping an NFC tag. Hand-drawn SVG also inherits the admin
 * palette's custom properties, which a library would have to be configured into.
 */

/** A bar chart's vertical scale: the top of the axis, and the tick values on it. */
export type Scale = {
  /** Always 0 for a bar chart — a bar's length is only meaningful from zero. */
  min: number;
  max: number;
  ticks: number[];
};

/**
 * A "nice" upper bound and tick row for values from 0 to `highest`.
 *
 * Bars are measured from zero, never from the smallest value: a truncated
 * baseline makes a 2% difference look like a tripling, which is the most common
 * way a chart lies. So `min` is 0 and only the top is chosen.
 *
 * The step is snapped to 1, 2, 2.5 or 5 × a power of ten so the labels read
 * 0 / 500K / 1M rather than 0 / 333 333 / 666 667.
 */
export function niceScale(highest: number, targetTicks = 4): Scale {
  if (!Number.isFinite(highest) || highest <= 0) {
    return { min: 0, max: 1, ticks: [0, 1] };
  }
  const rough = highest / Math.max(1, targetTicks);
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const normalised = rough / magnitude;
  const step = (normalised <= 1 ? 1 : normalised <= 2 ? 2 : normalised <= 2.5 ? 2.5 : normalised <= 5 ? 5 : 10) * magnitude;
  const max = Math.ceil(highest / step) * step;
  const ticks: number[] = [];
  // `<= max + step / 1000` rather than `<= max`: the running sum of a fractional
  // step (2.5 × 10^n) drifts, and the top tick would sometimes be dropped.
  for (let value = 0; value <= max + step / 1000; value += step) ticks.push(Math.round(value));
  return { min: 0, max, ticks };
}

/**
 * A scale that spans zero, for a chart whose bars go both ways.
 *
 * **Both arms get the same STEP, and therefore the same pixels per so'm** — a
 * loss of 500 000 is drawn exactly as long as a profit of 500 000. Scaling each
 * arm to its own extreme would make a small loss look like a catastrophe beside
 * a large profit, which is the whole trap of a two-sided chart.
 *
 * The arms are NOT forced to be equally long, though. A year of solid profit
 * with one bad month spent half the plot on an empty negative arm and squashed
 * every real bar into the top half. Each arm is rounded out to the next whole
 * step of the shared unit, so the chart uses the room it has while a unit stays
 * a unit on both sides of zero.
 */
export function divergingScale(values: number[], targetTicks = 2): Scale & { zeroAt: number } {
  const highest = Math.max(0, ...values);
  const lowest = Math.min(0, ...values);
  const reach = Math.max(highest, -lowest);
  const rough = niceScale(reach, targetTicks);
  // The step the shared unit is built on; both arms are multiples of it.
  const step = rough.ticks.length > 1 ? rough.ticks[1] - rough.ticks[0] : rough.max;
  if (step <= 0) return { min: -1, max: 1, ticks: [-1, 0, 1], zeroAt: 0.5 };

  const max = Math.max(step, Math.ceil(highest / step) * step);
  const min = lowest < 0 ? -Math.ceil(-lowest / step) * step : 0;

  // Zero is always among these, which is what makes it the baseline every bar is
  // measured from: `min` is a whole number of steps below zero by construction,
  // so the walk lands on it exactly. (A guard that pushed a 0 if it were missing
  // was unreachable, and a break-check proved it: no mutation could make it
  // matter. `divergingScale` is tested on the property instead.)
  const ticks: number[] = [];
  for (let value = min; value <= max + step / 1000; value += step) ticks.push(Math.round(value));

  return {
    min,
    max,
    ticks,
    // Where zero sits as a fraction of the plot's height, from the top.
    zeroAt: max === min ? 0.5 : max / (max - min),
  };
}

/**
 * Where the bars of one category sit inside its slot.
 *
 * Two rules the mark spec fixes: a bar is **never wider than 24px** — the slot's
 * leftover is air, not bar — and touching bars are separated by a **2px gap in
 * the surface colour**, never by a stroke around them. A stroke adds ink that is
 * not data; the gap is the surface showing through.
 */
export function bandLayout(
  slot: number, series: number, options: { maxThickness?: number; gap?: number } = {},
): { thickness: number; offsets: number[] } {
  const maxThickness = options.maxThickness ?? 24;
  const gap = options.gap ?? 2;
  const count = Math.max(1, series);
  // Keep a quarter of the slot as air between one category and the next, so the
  // groups read as groups.
  const usable = Math.max(1, slot * 0.76);
  const thickness = Math.max(2, Math.min(maxThickness, (usable - gap * (count - 1)) / count));
  const width = thickness * count + gap * (count - 1);
  const start = (slot - width) / 2;
  return {
    thickness,
    offsets: Array.from({ length: count }, (_, index) => start + index * (thickness + gap)),
  };
}

/**
 * An SVG path for a bar with its DATA END rounded and its baseline end square.
 *
 * Rounding both ends would detach the bar from its axis and make a short bar look
 * like a floating pill; rounding neither is the blunt look this avoids. `side`
 * is which end the data is at, so one function serves columns and horizontal
 * bars.
 *
 * The radius is capped at half the bar's length as well as half its thickness —
 * without that cap, a bar shorter than the radius draws a shape that bulges past
 * its own value.
 */
export function barPath(
  x: number, y: number, width: number, height: number,
  radius = 4, side: 'top' | 'right' | 'bottom' | 'left' = 'top',
): string {
  const w = Math.max(0, width);
  const h = Math.max(0, height);
  if (w === 0 || h === 0) return '';
  const vertical = side === 'top' || side === 'bottom';
  const r = Math.max(0, Math.min(radius, (vertical ? w : h) / 2, (vertical ? h : w) / 2));
  if (r === 0) return `M${x} ${y}h${w}v${h}h${-w}Z`;

  switch (side) {
    case 'top':
      return `M${x} ${y + h}V${y + r}a${r} ${r} 0 0 1 ${r} ${-r}h${w - 2 * r}a${r} ${r} 0 0 1 ${r} ${r}V${y + h}Z`;
    case 'bottom':
      return `M${x} ${y}V${y + h - r}a${r} ${r} 0 0 0 ${r} ${r}h${w - 2 * r}a${r} ${r} 0 0 0 ${r} ${-r}V${y}Z`;
    case 'right':
      return `M${x} ${y}h${w - r}a${r} ${r} 0 0 1 ${r} ${r}v${h - 2 * r}a${r} ${r} 0 0 1 ${-r} ${r}H${x}Z`;
    default:
      return `M${x + w} ${y}H${x + r}a${r} ${r} 0 0 0 ${-r} ${r}v${h - 2 * r}a${r} ${r} 0 0 0 ${r} ${r}H${x + w}Z`;
  }
}

/**
 * Segments of a part-to-whole bar, with a 2px surface gap between them.
 *
 * A segment whose share rounds to less than a pixel is given **zero width**
 * rather than one pixel, and is therefore not drawn: a hairline of colour at the
 * end of a bar reads as a rounding error in the data rather than as a real but
 * tiny part, and the figure beside the bar says it anyway.
 */
export function shareSegments(
  values: number[], width: number, gap = 2,
): { offset: number; width: number }[] {
  const total = values.reduce((sum, value) => sum + Math.max(0, value), 0);
  if (total <= 0 || width <= 0) return values.map(() => ({ offset: 0, width: 0 }));
  const drawn = values.filter((value) => value > 0).length;
  const usable = Math.max(0, width - gap * Math.max(0, drawn - 1));
  let offset = 0;
  return values.map((value) => {
    if (value <= 0) return { offset, width: 0 };
    const segment = (Math.max(0, value) / total) * usable;
    const at = offset;
    offset += segment + gap;
    return { offset: at, width: segment < 1 ? 0 : segment };
  });
}

/** A polyline through a series, for a sparkline. Flat series sit on the midline. */
export function sparkPoints(values: number[], width: number, height: number): string {
  if (values.length === 0) return '';
  if (values.length === 1) return `0,${height / 2} ${width},${height / 2}`;
  const highest = Math.max(...values);
  const lowest = Math.min(...values);
  const span = highest - lowest;
  const step = width / (values.length - 1);
  return values
    .map((value, index) => {
      // A series with no variation would divide by zero; draw it down the middle,
      // which is what "no change" looks like.
      const y = span === 0 ? height / 2 : height - ((value - lowest) / span) * height;
      return `${(index * step).toFixed(2)},${y.toFixed(2)}`;
    })
    .join(' ');
}

/**
 * A big money figure, short enough for an axis tick or a stat tile.
 *
 * Takes TIYIN, like every money value in this product, and prints so'm — so the
 * ÷100 lives here and not at each of the dozen call sites. Thresholds are
 * so'm-side: "1,2 mln" is what an owner reads, not "120000000".
 */
export function compactSum(tiyin: number, locale = 'ru-RU'): string {
  const sum = Math.round(tiyin / 100);
  const sign = sum < 0 ? '-' : '';
  const value = Math.abs(sum);
  if (value >= 1_000_000_000) return `${sign}${round(value / 1_000_000_000, locale)} mlrd`;
  if (value >= 1_000_000) return `${sign}${round(value / 1_000_000, locale)} mln`;
  if (value >= 10_000) return `${sign}${Math.round(value / 1000).toLocaleString(locale)} ming`;
  return `${sign}${value.toLocaleString(locale)}`;
}

/** One decimal, and none when it would be `,0`. */
function round(value: number, locale: string): string {
  const fixed = Math.round(value * 10) / 10;
  return fixed.toLocaleString(locale, { maximumFractionDigits: 1 });
}

/** A plain count, compacted the same way so an axis of counts matches one of money. */
export function compactCount(value: number, locale = 'ru-RU'): string {
  if (Math.abs(value) >= 1_000_000) return `${round(value / 1_000_000, locale)}M`;
  if (Math.abs(value) >= 10_000) return `${Math.round(value / 1000)}K`;
  return value.toLocaleString(locale);
}

/**
 * `2026-08` → a short month label in the reader's language.
 *
 * The year is appended **only when the range crosses one**, so twelve columns are
 * not twelve repetitions of the same year, and a range spanning December to
 * January is never two columns both labelled "Jan".
 */
export function monthLabel(month: string, locale: string, withYear: boolean): string {
  const [year, index] = month.split('-').map(Number);
  if (!year || !index) return month;
  const label = new Intl.DateTimeFormat(locale, { month: 'short' }).format(new Date(year, index - 1, 1));
  return withYear ? `${label} ${String(year).slice(2)}` : label;
}

/** Whether a set of `YYYY-MM` keys spans more than one calendar year. */
export function spansYears(months: string[]): boolean {
  const years = new Set(months.map((month) => month.slice(0, 4)));
  return years.size > 1;
}


/**
 * How many categories to skip between labels so they cannot collide.
 *
 * Derived from the WIDEST label rather than from a constant: a fixed ~34px
 * assumed a three-letter month, and the moment a range crossed a year the labels
 * gained a year suffix ("сент. 26", ~51px) and every other one overlapped its
 * neighbour at 390px. Whatever the labels actually are, the stride is the number
 * of slots their width needs.
 */
export function labelStride(categories: string[], slot: number, perChar = 5.4, gap = 8): number {
  if (slot <= 0) return 1;
  const widest = categories.reduce((most, text) => Math.max(most, text.length), 0) * perChar + gap;
  return Math.max(1, Math.ceil(widest / slot));
}

export function clampLabelX(centre: number, text: string, left: number, right: number, perChar = 5.4): number {
  const half = (text.length * perChar) / 2;
  if (half * 2 >= right - left) return (left + right) / 2;
  return Math.max(left + half, Math.min(right - half, centre));
}
