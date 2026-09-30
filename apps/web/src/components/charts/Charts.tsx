import { useEffect, useMemo, useRef, useState } from 'react';
import {
  bandLayout, barPath, clampLabelX, divergingScale, labelStride, niceScale,
  shareSegments, sparkPoints,
} from './chartGeometry';

/**
 * The chart kit: hand-drawn SVG, no dependency.
 *
 * ── THE PALETTE IS NOT A TASTE DECISION ────────────────────────────────────
 * Four fills, and each was measured against the card they are drawn on
 * (`--adm-surface-solid`, #182138) rather than picked by eye:
 *
 *   --ch-revenue #1baf7a   money coming in
 *   --ch-spend   #c98500   money going out
 *   --ch-loss    #d64545   a negative balance
 *   --ch-count   #b08d3c   a count rather than an amount (the brand gold's family)
 *
 * Revenue-green against spend-amber measures ΔE 10.6 under deuteranopia and 19.8
 * to normal vision, clearing the ≥8 / ≥15 floors, and all four sit inside the
 * dark band (OKLCH L 0.48–0.67) at ≥3:1 on that surface. The ledger's own screen
 * uses #4ade80 and #fbbf24 for the same two ideas, and those are **text**
 * colours: at L 0.80 and 0.84 they are right for a figure on a dark ground and
 * too light for a large fill, where they glare and lose separation. So the family
 * is deliberately shared with the Restaurant Manager's page and the step is not.
 *
 * Green never appears beside gold in one chart, and neither does amber: green and
 * amber carry the P&L, gold carries counts, and no chart mixes an amount with a
 * count on one axis anyway (there is no dual axis anywhere in here — two measures
 * of different scale get two charts).
 *
 * TEXT NEVER WEARS A SERIES COLOUR. Values, labels, legends and ticks are ink
 * tokens; identity comes from the coloured swatch beside them. A light fill hue
 * is illegible as type on this ground, and colour alone would be the only channel
 * carrying identity.
 */

export const CHART_CSS = `
.ch {
  --ch-revenue: #1baf7a;
  --ch-spend: #c98500;
  --ch-loss: #d64545;
  --ch-count: #b08d3c;
  --ch-surface: #182138;
  --ch-grid: rgba(255,255,255,0.07);
  --ch-axis: rgba(255,255,255,0.16);
  --ch-ink: #f1f5f9;
  --ch-ink-2: rgba(226,232,240,0.72);
  --ch-ink-3: rgba(226,232,240,0.5);
  position: relative;
}
.ch svg { display: block; width: 100%; overflow: visible; }
/* Hairline and SOLID. A dashed grid reads as a projection or a threshold when
   it is only a grid, and at this weight it also shimmers on a phone. */
.ch-grid { stroke: var(--ch-grid); stroke-width: 1; shape-rendering: crispEdges; }
.ch-axis { stroke: var(--ch-axis); stroke-width: 1; shape-rendering: crispEdges; }
.ch-tick { fill: var(--ch-ink-3); font-size: 10px; font-variant-numeric: tabular-nums; }
.ch-cat { fill: var(--ch-ink-2); font-size: 10.5px; }
.ch-value { fill: var(--ch-ink); font-size: 11px; font-weight: 700; }
.ch-hit { fill: transparent; cursor: default; }
.ch-hit:hover + .ch-hover, .ch-slot.is-on .ch-hover { opacity: 1; }
.ch-hover { fill: rgba(255,255,255,0.05); opacity: 0; pointer-events: none; }
.ch-mark { transition: opacity 0.12s; }
.ch-slot.is-dim .ch-mark { opacity: 0.38; }

/* Legend — always present for two or more series, so identity is never left to
   colour matching alone. */
.ch-legend {
  display: flex; flex-wrap: wrap; gap: 4px 14px;
  margin: 0; padding: 0; list-style: none;
  font-size: 11.5px; color: var(--ch-ink-2);
}
.ch-legend li { display: inline-flex; align-items: center; gap: 6px; }
.ch-key { width: 9px; height: 9px; border-radius: 2px; flex-shrink: 0; }
.ch-key.is-line { height: 2px; width: 14px; border-radius: 2px; }

/* Tooltip. An HTML box rather than SVG text so it wraps and can never be
   clipped by the plot's own edge. */
.ch-tip {
  position: absolute; z-index: 5; pointer-events: none;
  transform: translate(-50%, -100%);
  background: rgba(8,12,22,0.96);
  border: 1px solid rgba(255,255,255,0.14);
  border-radius: 8px; padding: 7px 9px;
  font-size: 11.5px; line-height: 1.45; color: var(--ch-ink);
  white-space: nowrap;
  box-shadow: 0 8px 22px rgba(0,0,0,0.45);
}
.ch-tip-head { font-weight: 700; margin-bottom: 3px; }
.ch-tip-row { display: flex; align-items: center; gap: 6px; }
.ch-tip-row span:last-child { margin-left: auto; font-variant-numeric: tabular-nums; }

/* Horizontal ranked bars are HTML, not SVG: the category names are long and
   real text wraps and truncates properly, which SVG <text> does not. */
.ch-rank { display: grid; gap: 9px; }
.ch-rank-row { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 4px 10px; align-items: baseline; }
.ch-rank-name { font-size: 12.5px; color: var(--ch-ink); min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ch-rank-value { font-size: 12.5px; font-weight: 700; color: var(--ch-ink); font-variant-numeric: tabular-nums; }
.ch-rank-track { grid-column: 1 / -1; height: 8px; border-radius: 0 4px 4px 0; background: rgba(255,255,255,0.05); overflow: hidden; }
.ch-rank-fill { height: 100%; border-radius: 0 4px 4px 0; min-width: 2px; }
.ch-rank-sub { grid-column: 1 / -1; font-size: 11px; color: var(--ch-ink-3); }

/* A single part-to-whole bar. Segments are separated by a gap in the SURFACE
   colour, never by a border drawn round each one. */
.ch-share { display: flex; height: 12px; border-radius: 6px; overflow: hidden; background: rgba(255,255,255,0.05); }
.ch-share-seg { height: 100%; }

@media (max-width: 620px) {
  .ch-tick { font-size: 9.5px; }
  .ch-cat { font-size: 9.5px; }
  .ch-tip { white-space: normal; max-width: 200px; }
}
`;

/** The four fills, by the job each does. */
export const CH = {
  revenue: 'var(--ch-revenue)',
  spend: 'var(--ch-spend)',
  loss: 'var(--ch-loss)',
  count: 'var(--ch-count)',
} as const;

/**
 * The same four as raw hex.
 *
 * Needed because a custom property only resolves inside a `.ch` subtree, and two
 * callers are outside one: `ActivityCalendar`, which interpolates its accent into
 * a `color-mix()` on elements of its own, and anything handing a colour to a
 * canvas. A `var(--ch-revenue)` there resolves to nothing and the squares come
 * out blank — the kind of failure that looks like missing data.
 *
 * Keep in step with the `.ch` block above; `chartPalette.test.ts` reads both and
 * fails if they drift.
 */
export const CH_HEX = {
  revenue: '#1baf7a',
  spend: '#c98500',
  loss: '#d64545',
  count: '#b08d3c',
} as const;

/**
 * The container's width in px.
 *
 * Charts are drawn at real pixel sizes rather than with a fixed `viewBox` scaled
 * by CSS: scaling a viewBox scales the TYPE with it, so the same chart has 7px
 * ticks on a phone and 18px ticks on a desktop. Measuring instead keeps text at
 * one size and lets the plot reflow — which is also what makes the label stride
 * below possible.
 */
export function useWidth<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    // A missing ResizeObserver still gets a chart: the initial measurement stands
    // and only resizing stops working. Charts drawn at zero width would be blank.
    setWidth(node.clientWidth);
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver((entries) => {
      const measured = entries[0]?.contentRect.width ?? node.clientWidth;
      setWidth(Math.round(measured));
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return { ref, width };
}

export type Series = { key: string; label: string; color: string; values: number[] };

/**
 * Keep a centred category label inside the plot.
 *
 * The outermost label is centred on a slot whose centre is close to the edge, so
 * on a narrow screen it hangs past it — and because these charts live inside
 * `.adm-bg`, which CLIPS rather than scrolls, the label does not cause a
 * scrollbar: it silently loses its last characters. Measured at 390px with
 * thirteen months, "сент. 26" ran 2px past the right edge.
 *
 * The nudge is a clamp rather than a change of `text-anchor`, because re-anchoring
 * the first and last labels shifts them off their columns and they stop reading
 * as belonging to a bar. A couple of pixels is imperceptible; a truncated month
 * is not. The half-width is estimated from the character count — measuring would
 * mean a render pass per label for a correction of a few pixels.
 */
export function ChartLegend({ series, line }: { series: { label: string; color: string }[]; line?: string }) {
  if (series.length < 2) return null;
  return (
    <ul className="ch-legend">
      {series.map((entry) => (
        <li key={entry.label}>
          <span
            className={`ch-key${line === entry.label ? ' is-line' : ''}`}
            style={{ background: entry.color }}
            aria-hidden="true"
          />
          {entry.label}
        </li>
      ))}
    </ul>
  );
}

type TipState = { x: number; y: number; index: number } | null;

function Tip({ at, width, children }: { at: { x: number; y: number }; width: number; children: React.ReactNode }) {
  // Clamped so a tooltip on the first or last column is not half off the card.
  const x = Math.max(56, Math.min(width - 56, at.x));
  return <div className="ch-tip" style={{ left: x, top: Math.max(30, at.y) }}>{children}</div>;
}

/**
 * Grouped columns over a category axis. One or more series, one shared scale.
 *
 * There is deliberately **no second y-axis** option: two measures of different
 * scale on one plot invent a correlation that is not in the data, and the answer
 * is two charts. Every series here is in the same unit.
 */
export function ColumnChart({
  categories, series, height = 210, format, tipTitle, emptyLabel,
}: {
  categories: string[];
  series: Series[];
  height?: number;
  /** How a value is written — money or a count; the axis and tooltip share it. */
  format: (value: number) => string;
  tipTitle?: (index: number) => string;
  emptyLabel?: string;
}) {
  const { ref, width } = useWidth<HTMLDivElement>();
  const [tip, setTip] = useState<TipState>(null);

  const padLeft = 44;
  const padRight = 6;
  const padTop = 12;
  const padBottom = 22;
  const plotWidth = Math.max(0, width - padLeft - padRight);
  const plotHeight = Math.max(0, height - padTop - padBottom);

  const highest = Math.max(0, ...series.flatMap((one) => one.values));
  const scale = useMemo(() => niceScale(highest), [highest]);
  const slot = categories.length > 0 ? plotWidth / categories.length : 0;
  const { thickness, offsets } = bandLayout(slot, series.length);

  // Label every nth category so the axis never collides with itself. On a phone
  // with a year of months that is every second or third label, which is legible
  // where all thirteen are not.
  const stride = labelStride(categories, slot);

  const y = (value: number) => padTop + plotHeight - (value / scale.max) * plotHeight;

  const hasData = highest > 0;

  return (
    <div className="ch" ref={ref}>
      {width > 0 && (
        <svg height={height} role="img" aria-label={tipTitle?.(0) ?? ''}>
          {/* Gridlines first, so every mark sits over them. */}
          {scale.ticks.map((tick) => (
            <g key={tick}>
              <line className={tick === 0 ? 'ch-axis' : 'ch-grid'}
                x1={padLeft} x2={padLeft + plotWidth} y1={y(tick)} y2={y(tick)} />
              <text className="ch-tick" x={padLeft - 7} y={y(tick) + 3.5} textAnchor="end">
                {format(tick)}
              </text>
            </g>
          ))}

          {categories.map((category, index) => {
            const x0 = padLeft + index * slot;
            const on = tip?.index === index;
            return (
              <g key={category} className={`ch-slot${on ? ' is-on' : ''}`}>
                <rect className="ch-hover" x={x0} y={padTop} width={slot} height={plotHeight} />
                {hasData && series.map((one, seriesIndex) => {
                  const value = Math.max(0, one.values[index] ?? 0);
                  const top = y(value);
                  return (
                    <path
                      key={one.key}
                      className="ch-mark"
                      d={barPath(x0 + offsets[seriesIndex], top, thickness, padTop + plotHeight - top, 4, 'top')}
                      fill={one.color}
                    />
                  );
                })}
                {index % stride === 0 && (
                  <text
                    className="ch-cat"
                    x={clampLabelX(x0 + slot / 2, category, padLeft, padLeft + plotWidth)}
                    y={height - 6}
                    textAnchor="middle"
                  >
                    {category}
                  </text>
                )}
                {/* The hit target is the whole slot, not the bar: a 6px column on
                    a phone is impossible to hover and worse to tap. */}
                <rect
                  className="ch-hit"
                  x={x0} y={padTop} width={slot} height={plotHeight}
                  onMouseEnter={() => setTip({ x: x0 + slot / 2, y: padTop, index })}
                  onMouseLeave={() => setTip(null)}
                  onTouchStart={() => setTip({ x: x0 + slot / 2, y: padTop, index })}
                />
              </g>
            );
          })}
        </svg>
      )}

      {!hasData && emptyLabel && (
        <p style={{
          position: 'absolute', inset: 0, display: 'grid', placeItems: 'center',
          margin: 0, fontSize: 12.5, color: 'var(--ch-ink-3)',
        }}>
          {emptyLabel}
        </p>
      )}

      {tip && (
        <Tip at={tip} width={width}>
          <div className="ch-tip-head">{tipTitle?.(tip.index) ?? categories[tip.index]}</div>
          {series.map((one) => (
            <div className="ch-tip-row" key={one.key}>
              <span className="ch-key" style={{ background: one.color }} aria-hidden="true" />
              <span>{one.label}</span>
              <span>{format(one.values[tip.index] ?? 0)}</span>
            </div>
          ))}
        </Tip>
      )}
    </div>
  );
}

/**
 * Columns that go both ways from a zero line — profit above, loss below.
 *
 * The SIGN is carried by the direction as well as by the colour, which is what
 * makes green-above / red-below legible to a reader who cannot tell the two hues
 * apart: position is the stronger channel and it is doing the work here. The
 * tooltip states the signed figure too.
 */
export function DivergingColumns({
  categories, values, height = 150, format, tipTitle, positiveLabel, negativeLabel,
}: {
  categories: string[];
  values: number[];
  height?: number;
  format: (value: number) => string;
  tipTitle?: (index: number) => string;
  positiveLabel: string;
  negativeLabel: string;
}) {
  const { ref, width } = useWidth<HTMLDivElement>();
  const [tip, setTip] = useState<TipState>(null);

  // Wider than the column chart's gutter on purpose: these ticks carry a MINUS
  // SIGN, and "−100 mln" measured 2–4px past the left edge of the plot at 44px.
  // The chart is inside `.adm-bg`, which clips rather than scrolls, so the
  // overflow was invisible — the label simply lost its first character.
  const padLeft = 56;
  const padRight = 6;
  const padTop = 10;
  const padBottom = 20;
  const plotWidth = Math.max(0, width - padLeft - padRight);
  const plotHeight = Math.max(0, height - padTop - padBottom);

  const scale = useMemo(() => divergingScale(values), [values]);
  const slot = categories.length > 0 ? plotWidth / categories.length : 0;
  const { thickness, offsets } = bandLayout(slot, 1);
  const stride = labelStride(categories, slot);

  const span = scale.max - scale.min || 1;
  const y = (value: number) => padTop + plotHeight - ((value - scale.min) / span) * plotHeight;
  const zeroY = y(0);

  return (
    <div className="ch" ref={ref}>
      {width > 0 && (
        <svg height={height}>
          {scale.ticks.map((tick) => (
            <g key={tick}>
              <line className={tick === 0 ? 'ch-axis' : 'ch-grid'}
                x1={padLeft} x2={padLeft + plotWidth} y1={y(tick)} y2={y(tick)} />
              <text className="ch-tick" x={padLeft - 7} y={y(tick) + 3.5} textAnchor="end">
                {format(tick)}
              </text>
            </g>
          ))}

          {categories.map((category, index) => {
            const value = values[index] ?? 0;
            const x0 = padLeft + index * slot;
            const top = value >= 0 ? y(value) : zeroY;
            const barHeight = Math.abs(zeroY - y(value));
            const on = tip?.index === index;
            return (
              <g key={category} className={`ch-slot${on ? ' is-on' : ''}`}>
                <rect className="ch-hover" x={x0} y={padTop} width={slot} height={plotHeight} />
                <path
                  className="ch-mark"
                  d={barPath(x0 + offsets[0], top, thickness, barHeight, 4, value >= 0 ? 'top' : 'bottom')}
                  fill={value >= 0 ? CH.revenue : CH.loss}
                />
                {index % stride === 0 && (
                  <text
                    className="ch-cat"
                    x={clampLabelX(x0 + slot / 2, category, padLeft, padLeft + plotWidth)}
                    y={height - 5}
                    textAnchor="middle"
                  >
                    {category}
                  </text>
                )}
                <rect
                  className="ch-hit"
                  x={x0} y={padTop} width={slot} height={plotHeight}
                  onMouseEnter={() => setTip({ x: x0 + slot / 2, y: padTop, index })}
                  onMouseLeave={() => setTip(null)}
                  onTouchStart={() => setTip({ x: x0 + slot / 2, y: padTop, index })}
                />
              </g>
            );
          })}
        </svg>
      )}

      {tip && (
        <Tip at={tip} width={width}>
          <div className="ch-tip-head">{tipTitle?.(tip.index) ?? categories[tip.index]}</div>
          <div className="ch-tip-row">
            <span
              className="ch-key"
              style={{ background: (values[tip.index] ?? 0) >= 0 ? CH.revenue : CH.loss }}
              aria-hidden="true"
            />
            <span>{(values[tip.index] ?? 0) >= 0 ? positiveLabel : negativeLabel}</span>
            <span>{format(values[tip.index] ?? 0)}</span>
          </div>
        </Tip>
      )}
    </div>
  );
}

/**
 * A ranked list of bars, one series, value at the tip.
 *
 * ONE colour for every bar. Shading each bar darker-where-bigger would encode the
 * length twice and burn the only free channel on something the bar already says.
 *
 * Built from HTML rather than SVG because the labels are room names and dish
 * names: real text wraps, truncates with an ellipsis and can be selected, none of
 * which SVG `<text>` does.
 */
export function RankedBars({
  rows, color = CH.count, max, emptyLabel,
}: {
  rows: { key: string; name: string; value: number; display: string; sub?: string }[];
  color?: string;
  /** Shared across a group of charts when they must be comparable. */
  max?: number;
  emptyLabel?: string;
}) {
  const highest = max ?? Math.max(0, ...rows.map((row) => row.value));
  if (rows.length === 0) {
    return <p style={{ margin: 0, fontSize: 12.5, color: 'var(--ch-ink-3)' }}>{emptyLabel}</p>;
  }
  return (
    <div className="ch ch-rank">
      {rows.map((row) => (
        <div className="ch-rank-row" key={row.key}>
          <span className="ch-rank-name" title={row.name}>{row.name}</span>
          <span className="ch-rank-value">{row.display}</span>
          <div className="ch-rank-track">
            <div
              className="ch-rank-fill"
              style={{
                width: highest > 0 ? `${Math.max(0, (row.value / highest) * 100)}%` : 0,
                background: color,
              }}
            />
          </div>
          {row.sub && <span className="ch-rank-sub">{row.sub}</span>}
        </div>
      ))}
    </div>
  );
}

/**
 * One bar split into parts of a whole — collected against still owed.
 *
 * At most a handful of segments: past about six, adjacent parts blur and the
 * honest form is a table. Every part is also named with its figure underneath, so
 * the bar is the shape of the answer and the numbers are the answer.
 */
export function ShareBar({ parts }: { parts: { key: string; label: string; value: number; color: string; display: string }[] }) {
  const { ref, width } = useWidth<HTMLDivElement>();
  const segments = shareSegments(parts.map((part) => part.value), Math.max(0, width));
  return (
    <div className="ch" ref={ref} style={{ display: 'grid', gap: 8 }}>
      <div className="ch-share" style={{ borderRadius: 6 }}>
        {parts.map((part, index) => (
          <div
            key={part.key}
            className="ch-share-seg"
            style={{
              width: segments[index]?.width ?? 0,
              // The gap between segments is the SURFACE showing through, which is
              // why it is a margin and not a border on the segment.
              marginRight: index < parts.length - 1 && (segments[index]?.width ?? 0) > 0 ? 2 : 0,
              background: part.color,
            }}
          />
        ))}
      </div>
      <ul className="ch-legend">
        {parts.map((part) => (
          <li key={part.key}>
            <span className="ch-key" style={{ background: part.color }} aria-hidden="true" />
            {part.label}
            <strong style={{ color: 'var(--ch-ink)', fontVariantNumeric: 'tabular-nums' }}>{part.display}</strong>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** A 12-point trend for a stat tile. No axis, no labels — the tile carries those. */
export function Sparkline({ values, color = CH.revenue, width = 88, height = 22 }: {
  values: number[]; color?: string; width?: number; height?: number;
}) {
  if (values.length < 2) return null;
  return (
    <svg width={width} height={height} className="ch" aria-hidden="true" style={{ overflow: 'visible' }}>
      <polyline
        points={sparkPoints(values, width, height)}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
