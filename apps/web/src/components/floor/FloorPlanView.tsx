import { useMemo } from 'react';
import {
  CHAIR_DEPTH, CHAIR_WIDTH, areaSize, chairsFor, featureLabelAt, featuresOf, tableSize,
  type MapArea, type MapFeature, type MapTable,
} from '../../utils/floorMap';

/**
 * A floor plan, drawn read-only, with each table in one of four states.
 *
 * One component rather than one per screen: the kiosk's booking map and the
 * admin's occupancy map show the SAME room, and a second drawing of it would
 * disagree with the first about where a table stands within a release. The
 * geometry itself is `utils/floorMap.ts`, shared with the editor on
 * FloorMapPage and mirrored on the API for the printed sheet.
 *
 * The editor (drag, resize, the area handle) is deliberately NOT here. Those
 * are pointer mechanics that only the admin page has, and folding them in
 * would make every caller carry them.
 */

export type TableState = 'free' | 'taken' | 'selected' | 'mine';

export type FloorPlanViewProps = {
  area: MapArea;
  tables: MapTable[];
  /** What each table looks like; anything unlisted is free. */
  stateOf?: (table: MapTable) => TableState;
  /** A second line under the number — a head count, a customer's name. */
  captionOf?: (table: MapTable) => string | null;
  onTableClick?: (table: MapTable) => void;
  /** Drawn over the whole plan when the area is reserved as one. */
  wholeAreaLabel?: string | null;
  className?: string;
  /** Percentage width for the SVG, so a caller can zoom it. */
  zoom?: number;
  ariaLabel?: string;
};

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** How each kind of feature is painted; the colour itself comes from the plan. */
const FEATURE_PAINT: Record<MapFeature['kind'], { fill: number; stroke: number }> = {
  zone: { fill: 0.3, stroke: 0.75 },
  water: { fill: 0.55, stroke: 0.9 },
  stage: { fill: 0.45, stroke: 0.9 },
  path: { fill: 0.35, stroke: 0 },
  label: { fill: 0, stroke: 0 },
};

export const FloorPlanView = ({
  area, tables, stateOf, captionOf, onTableClick, wholeAreaLabel, className, zoom = 1, ariaLabel,
}: FloorPlanViewProps) => {
  const size = useMemo(() => areaSize(area, tables), [area, tables]);
  const features = useMemo(() => featuresOf(area), [area]);
  /** Handles and type scale with the map, so a venue-sized plan stays legible. */
  const unit = Math.max(1, size.width / 1200);

  const renderFeature = (f: MapFeature, i: number) => {
    const paint = FEATURE_PAINT[f.kind] ?? FEATURE_PAINT.zone;
    const color = f.color ?? 'var(--fp-accent)';
    const style = {
      fill: color, fillOpacity: paint.fill,
      stroke: paint.stroke ? color : 'none', strokeOpacity: paint.stroke, strokeWidth: 3 * unit,
    };
    let body = null;
    if (f.shape === 'rect') body = <rect x={f.x} y={f.y} width={f.width} height={f.height} rx={6 * unit} style={style} />;
    else if (f.shape === 'ellipse') body = <ellipse cx={f.x + f.width / 2} cy={f.y + f.height / 2} rx={f.width / 2} ry={f.height / 2} style={style} />;
    else if (f.shape === 'polygon') body = <polygon points={f.points.map((p) => p.join(',')).join(' ')} style={style} />;
    const [lx, ly] = featureLabelAt(f);
    return (
      <g key={i} className={`fp-feature is-${f.kind}`}>
        {body}
        {f.label && (
          <text className="fp-feature-label" x={lx} y={ly} textAnchor="middle" dominantBaseline="middle"
            style={{ fontSize: 26 * unit }}>
            {f.label}
          </text>
        )}
      </g>
    );
  };

  const renderTable = (table: MapTable) => {
    const state = stateOf?.(table) ?? 'free';
    const { width, height } = tableSize(table.shape, table.seats, table);
    const labelSize = clamp(Math.min(width, height) * 0.36, 14, 30);
    const caption = captionOf?.(table) ?? null;
    const pickable = !!onTableClick && state !== 'taken';
    return (
      <g
        key={table.id}
        className={`fp-table is-${state}${pickable ? ' is-pickable' : ''}`}
        onClick={() => pickable && onTableClick?.(table)}
        onKeyDown={(e) => {
          if (!pickable) return;
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onTableClick?.(table); }
        }}
        role={onTableClick ? 'button' : undefined}
        tabIndex={onTableClick ? 0 : undefined}
        aria-label={`${table.label} · ${table.seats}${caption ? ` · ${caption}` : ''}`}
        aria-pressed={onTableClick ? state === 'selected' : undefined}
      >
        <g transform={`translate(${table.x} ${table.y}) rotate(${table.rotation})`}>
          {chairsFor(table.shape, table.seats, table).map((chair, i) => (
            <rect key={i} className="fp-chair"
              x={-CHAIR_WIDTH / 2} y={-CHAIR_DEPTH / 2} width={CHAIR_WIDTH} height={CHAIR_DEPTH} rx={5}
              transform={`translate(${chair.x} ${chair.y}) rotate(${chair.angle})`} />
          ))}
          {table.shape === 'ROUND'
            ? <circle className="fp-top" r={width / 2} />
            : <rect className="fp-top" x={-width / 2} y={-height / 2} width={width} height={height} rx={Math.min(8, width / 6)} />}
        </g>
        {/* Upright whatever the table's rotation — a number turned 45° is a
            number nobody reads across a room. */}
        <text className="fp-label" x={table.x} y={table.y - (caption ? labelSize * 0.32 : 0)}
          textAnchor="middle" dominantBaseline="middle" style={{ fontSize: labelSize }}>
          {table.label}
        </text>
        <text className="fp-caption" x={table.x} y={table.y + labelSize * 0.62}
          textAnchor="middle" dominantBaseline="middle" style={{ fontSize: labelSize * 0.5 }}>
          {caption ?? table.seats}
        </text>
      </g>
    );
  };

  return (
    <svg
      className={`fp-svg${className ? ` ${className}` : ''}${area.kind === 'OUTDOOR' ? ' is-outdoor' : ''}`}
      viewBox={`0 0 ${size.width} ${size.height}`}
      style={{ width: `${zoom * 100}%` }}
      role="img"
      aria-label={ariaLabel ?? area.name}
    >
      <defs>
        <pattern id="fp-grid" width="40" height="40" patternUnits="userSpaceOnUse">
          <circle cx="1" cy="1" r="1.4" className="fp-grid-dot" />
        </pattern>
        <clipPath id={`fp-clip-${area.id}`}><rect width={size.width} height={size.height} /></clipPath>
      </defs>
      <rect className="fp-ground" width={size.width} height={size.height} />
      <rect width={size.width} height={size.height} fill="url(#fp-grid)" pointerEvents="none" />
      {/* The drawing never takes a click: a press on a zone is a press on the floor. */}
      <g clipPath={`url(#fp-clip-${area.id})`} pointerEvents="none">{features.map(renderFeature)}</g>
      {tables.map(renderTable)}
      {wholeAreaLabel && (
        <g pointerEvents="none">
          <rect className="fp-whole" width={size.width} height={size.height} />
          <text className="fp-whole-label" x={size.width / 2} y={size.height / 2}
            textAnchor="middle" dominantBaseline="middle" style={{ fontSize: 42 * unit }}>
            {wholeAreaLabel}
          </text>
        </g>
      )}
    </svg>
  );
};

/**
 * The plan's styles. Exported as a string so both callers mount exactly these
 * rules — a copy in each page is how two maps come to disagree about what
 * "taken" looks like. Colours come from `--fp-*`, which each caller maps onto
 * its own palette (`--adm-*` in the admin app, `--rg-*` on the kiosk).
 */
export const FLOOR_PLAN_CSS = `
  .fp-svg { display: block; min-width: 100%; height: auto; user-select: none; -webkit-user-select: none; }
  .fp-ground { fill: var(--fp-ground); }
  .fp-svg.is-outdoor .fp-ground { fill: var(--fp-ground-outdoor); }
  .fp-grid-dot { fill: var(--fp-grid); }
  .fp-feature-label {
    font-weight: 800; letter-spacing: 0.02em; fill: var(--fp-text);
    paint-order: stroke; stroke: var(--fp-text-halo); stroke-width: 5px;
  }
  .fp-feature.is-label .fp-feature-label { fill: var(--fp-text-muted); font-weight: 700; }

  .fp-top { fill: var(--fp-surface); stroke: var(--fp-table-line); stroke-width: 2; }
  .fp-chair { fill: var(--fp-chair); stroke: var(--fp-chair-line); stroke-width: 1.5; }
  .fp-label { font-weight: 800; fill: var(--fp-text); pointer-events: none; }
  .fp-caption { font-weight: 600; fill: var(--fp-text-muted); pointer-events: none; }

  .fp-table { outline: none; }
  .fp-table.is-pickable { cursor: pointer; }
  .fp-table.is-pickable:hover .fp-top { stroke: var(--fp-accent); stroke-width: 3; }
  .fp-table:focus-visible .fp-top { stroke: var(--fp-accent); stroke-width: 4; }

  /* Taken: filled and dimmed, and NOT pickable. The fill carries the state on
     its own, so this still reads on a black-and-white screenshot. */
  .fp-table.is-taken { cursor: not-allowed; }
  .fp-table.is-taken .fp-top { fill: var(--fp-taken); stroke: var(--fp-taken-line); }
  .fp-table.is-taken .fp-chair { opacity: 0.35; }
  .fp-table.is-taken .fp-label, .fp-table.is-taken .fp-caption { fill: var(--fp-taken-text); }

  /* Chosen in this booking. */
  .fp-table.is-selected .fp-top { fill: var(--fp-accent); stroke: var(--fp-accent); }
  .fp-table.is-selected .fp-chair { stroke: var(--fp-accent); }
  .fp-table.is-selected .fp-label, .fp-table.is-selected .fp-caption { fill: var(--fp-accent-ink); }

  /* Held by the booking currently open on the admin's map. */
  .fp-table.is-mine .fp-top { stroke: var(--fp-accent); stroke-width: 4; }

  .fp-whole { fill: var(--fp-taken); opacity: 0.18; }
  .fp-whole-label {
    font-weight: 800; fill: var(--fp-text); opacity: 0.55; letter-spacing: 0.04em;
    paint-order: stroke; stroke: var(--fp-text-halo); stroke-width: 6px;
  }
`;
