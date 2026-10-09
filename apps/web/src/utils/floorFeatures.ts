import type { FeatureKind, MapFeature } from './floorMap';

/**
 * Editing the DRAWING under a floor map — the zones, the pool, the stage, the
 * walkways and the standing labels.
 *
 * ── WHY THIS IS A FILE OF ITS OWN ──────────────────────────────────────────
 * The drawing used to arrive with a ready-made plan and could only be changed
 * with a PATCH typed by hand, so these rules did not exist anywhere: the page
 * only ever READ `mapFeatures`. Now a supervisor draws their own venue, and
 * every one of the rules below is something the server will refuse with a 400
 * — which, because the whole array is written at once, loses the entire
 * drawing, not just the bad shape. So the editor is held to the server's
 * bounds here, `FEATURE_LIMITS` is mirrored from `floorMap.features.ts`, and
 * `floorFeatures.test.ts` imports **both** and runs the same shapes through
 * each. Same guard as `toSubdomainSlug`, the invoice arithmetic and the
 * section rule.
 *
 * ── THE TRAPS, ALL OF THEM THE SAME TRAP ───────────────────────────────────
 * Every coordinate is an INTEGER on the server and a drag produces floats; a
 * label is `min(1)` so an emptied text field must drop the key rather than
 * send `''`; a width is `min(1)` so a shape dragged shut must stop short of
 * nothing. Each of those is a 400 that takes the drawing with it.
 */

/** Mirrors `FEATURE_LIMITS` in apps/api/src/modules/floorMap/floorMap.features.ts. */
export const FEATURE_LIMITS = {
  maxFeatures: 200,
  coordMin: -5000,
  coordMax: 20000,
  extentMin: 1,
  extentMax: 20000,
  labelMax: 60,
  polygonMin: 3,
  polygonMax: 64,
} as const;

export const COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;

/**
 * The smallest a shape may be dragged to.
 *
 * Not the schema's own `extentMin` of 1: a one-unit zone is invisible, and a
 * supervisor who shrinks one by accident would be left hunting a shape they
 * cannot see or grab. 40 units is about a chair.
 */
export const MIN_FEATURE = 40;

/** What a newly drawn shape starts as, before it is dragged into place. */
export const NEW_FEATURE_SIZE = { width: 400, height: 280 };

/**
 * The kinds the editor offers, in the order they are offered.
 *
 * `zone` first because it is what nearly every drawing is made of; `label`
 * last because it is text rather than a region.
 */
export const EDITABLE_KINDS: readonly FeatureKind[] = ['zone', 'water', 'stage', 'path', 'label'];

/** Where nobody is seated — mirrors BLOCKING_KINDS, which floorMap.ts owns. */
export const BLOCKING_KINDS: readonly FeatureKind[] = ['water', 'stage'];

/**
 * A starting colour per kind, and the swatches offered beside the picker.
 *
 * Taken from Sangizar's own sheet rather than invented, so a drawing made here
 * sits beside the one that was redrawn from paper without looking like a
 * different product. A pool is water-blue, a stage is warm, a walkway is the
 * grey the sheet prints; zones cycle the sheet's four fills.
 */
export const FEATURE_PALETTE = ['#8a9a5b', '#e8b796', '#c9d8b6', '#7fb2c8', '#d9c7a0', '#b8b8b8'] as const;

export const DEFAULT_FEATURE_COLOR: Record<FeatureKind, string> = {
  zone: '#8a9a5b',
  water: '#7fb2c8',
  stage: '#d9c7a0',
  path: '#b8b8b8',
  label: '#b8b8b8',
};

const clampCoord = (v: number) =>
  Math.round(Math.min(FEATURE_LIMITS.coordMax, Math.max(FEATURE_LIMITS.coordMin, Number.isFinite(v) ? v : 0)));

const clampExtent = (v: number) =>
  Math.round(Math.min(FEATURE_LIMITS.extentMax, Math.max(MIN_FEATURE, Number.isFinite(v) ? v : MIN_FEATURE)));

const point = (x: number, y: number): [number, number] => [clampCoord(x), clampCoord(y)];

/** The box a feature occupies: what the handles are drawn on and what a click tests. */
export function featureBox(f: MapFeature): { x: number; y: number; width: number; height: number } {
  if (f.shape === 'polygon') {
    const xs = f.points.map((p) => p[0]);
    const ys = f.points.map((p) => p[1]);
    const x = Math.min(...xs);
    const y = Math.min(...ys);
    return { x, y, width: Math.max(1, Math.max(...xs) - x), height: Math.max(1, Math.max(...ys) - y) };
  }
  if (f.shape === 'point') {
    // A standing label has no region, so it is given a grabbable one around
    // its anchor — otherwise the only way to select it is to hit the text
    // itself, which may be two words long or may be empty.
    const r = MIN_FEATURE;
    return { x: f.x - r, y: f.y - r, width: 2 * r, height: 2 * r };
  }
  return { x: f.x, y: f.y, width: f.width, height: f.height };
}

/** Whether a point in map units is inside a feature's box — the editor's hit test. */
export function hitsFeature(f: MapFeature, x: number, y: number): boolean {
  const b = featureBox(f);
  return x >= b.x && x <= b.x + b.width && y >= b.y && y <= b.y + b.height;
}

/**
 * The topmost feature under a point.
 *
 * Last match wins, because the array is painted in order and the LAST one
 * drawn is the one on top — picking the first would hand back the walkway
 * underneath the zone a supervisor is looking at.
 */
export function featureAt(features: MapFeature[], x: number, y: number): number | null {
  for (let i = features.length - 1; i >= 0; i -= 1) if (hitsFeature(features[i], x, y)) return i;
  return null;
}

/** A new shape of this kind, centred on the area's map. */
export function newFeature(kind: FeatureKind, area: { width: number; height: number }): MapFeature {
  const color = DEFAULT_FEATURE_COLOR[kind];
  if (kind === 'label') {
    return { kind, shape: 'point', color, x: clampCoord(area.width / 2), y: clampCoord(area.height / 2) };
  }
  const width = clampExtent(Math.min(NEW_FEATURE_SIZE.width, area.width * 0.4));
  const height = clampExtent(Math.min(NEW_FEATURE_SIZE.height, area.height * 0.4));
  return {
    kind,
    // An ellipse for the pool, a rectangle for everything else: a round pool is
    // what a venue has, and switching shape afterwards is one press either way.
    shape: kind === 'water' ? 'ellipse' : 'rect',
    color,
    x: clampCoord((area.width - width) / 2),
    y: clampCoord((area.height - height) / 2),
    width,
    height,
  };
}

/** Move a feature by a delta, whatever its shape. Every number stays a whole one. */
export function moveFeature(f: MapFeature, dx: number, dy: number): MapFeature {
  const shifted = shiftLabel(f, dx, dy);
  if (f.shape === 'polygon') {
    return { ...shifted, points: f.points.map((p) => point(p[0] + dx, p[1] + dy)) } as MapFeature;
  }
  return { ...shifted, x: clampCoord(f.x + dx), y: clampCoord(f.y + dy) } as MapFeature;
}

/**
 * A moved feature takes its label with it.
 *
 * `labelAt` is an absolute position, so without this a zone dragged across the
 * map leaves its name behind — which is not a subtle bug, it is a plan with
 * "Terrace" written over the car park.
 */
function shiftLabel(f: MapFeature, dx: number, dy: number): MapFeature {
  if (!f.labelAt) return f;
  return { ...f, labelAt: point(f.labelAt[0] + dx, f.labelAt[1] + dy) };
}

/**
 * Resize a rect or an ellipse by its bottom-right corner. A polygon is resized
 * by dragging its corners instead, and a standing label has no size at all.
 */
export function resizeFeature(f: MapFeature, width: number, height: number): MapFeature {
  if (f.shape !== 'rect' && f.shape !== 'ellipse') return f;
  return { ...f, width: clampExtent(width), height: clampExtent(height) };
}

/** Move one corner of a polygon. */
export function setPolygonPoint(f: MapFeature, index: number, x: number, y: number): MapFeature {
  if (f.shape !== 'polygon') return f;
  if (index < 0 || index >= f.points.length) return f;
  return { ...f, points: f.points.map((p, i) => (i === index ? point(x, y) : p)) };
}

/**
 * Add a corner, at the midpoint of the LONGEST edge.
 *
 * The longest edge because that is where there is room to work: splitting the
 * first edge every time stacks new corners on top of one another, and a corner
 * that lands under the one before it cannot be grabbed.
 */
export function addPolygonCorner(f: MapFeature): MapFeature {
  if (f.shape !== 'polygon' || f.points.length >= FEATURE_LIMITS.polygonMax) return f;
  let at = 0;
  let longest = -1;
  for (let i = 0; i < f.points.length; i += 1) {
    const a = f.points[i];
    const b = f.points[(i + 1) % f.points.length];
    const d = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (d > longest) { longest = d; at = i; }
  }
  const a = f.points[at];
  const b = f.points[(at + 1) % f.points.length];
  const next = [...f.points];
  next.splice(at + 1, 0, point((a[0] + b[0]) / 2, (a[1] + b[1]) / 2));
  return { ...f, points: next };
}

/** Remove a corner, never below three — two points are not a shape. */
export function removePolygonCorner(f: MapFeature, index: number): MapFeature {
  if (f.shape !== 'polygon' || f.points.length <= FEATURE_LIMITS.polygonMin) return f;
  if (index < 0 || index >= f.points.length) return f;
  return { ...f, points: f.points.filter((_, i) => i !== index) };
}

/**
 * Turn a rectangle into a four-cornered polygon.
 *
 * This is what makes an ARBITRARY shape reachable without a freehand drawing
 * tool: a supervisor draws the rectangle their zone roughly is, converts it,
 * then drags the corners onto the real walls. Sangizar's bungalow — a
 * five-sided room — is exactly that shape.
 */
export function toPolygon(f: MapFeature): MapFeature {
  if (f.shape === 'polygon') return f;
  const b = featureBox(f);
  return {
    kind: f.kind,
    ...(f.label !== undefined ? { label: f.label } : {}),
    ...(f.labelAt !== undefined ? { labelAt: f.labelAt } : {}),
    ...(f.color !== undefined ? { color: f.color } : {}),
    shape: 'polygon',
    points: [
      point(b.x, b.y),
      point(b.x + b.width, b.y),
      point(b.x + b.width, b.y + b.height),
      point(b.x, b.y + b.height),
    ],
  };
}

/** Turn a polygon back into the rectangle of its bounding box. */
export function toRect(f: MapFeature): MapFeature {
  if (f.shape === 'rect') return f;
  const b = featureBox(f);
  return {
    kind: f.kind,
    ...(f.label !== undefined ? { label: f.label } : {}),
    ...(f.labelAt !== undefined ? { labelAt: f.labelAt } : {}),
    ...(f.color !== undefined ? { color: f.color } : {}),
    shape: 'rect',
    x: b.x,
    y: b.y,
    width: clampExtent(b.width),
    height: clampExtent(b.height),
  };
}

/** Switch a rect to an ellipse or back — both are a box, so nothing is lost. */
export function setBoxShape(f: MapFeature, shape: 'rect' | 'ellipse'): MapFeature {
  // A standing label has no shape to switch.
  if (f.shape === 'point') return f;
  // A polygon goes through its bounding box, which is the only box it has.
  const box = toRect(f);
  if (box.shape !== 'rect') return f;
  return shape === 'rect' ? box : { ...box, shape: 'ellipse' };
}

/**
 * Set a feature's name, or take it away.
 *
 * A blank name **deletes the key** rather than storing `''`. The server's rule
 * is `min(1)` after trimming, so an emptied text field sent as an empty string
 * is a 400 — and because the whole array goes in one request, that 400 would
 * refuse every other shape on the plan along with it. `labelAt` goes too: a
 * position for a name that does not exist is a position nothing reads.
 */
export function withLabel(f: MapFeature, text: string): MapFeature {
  const label = text.trim().slice(0, FEATURE_LIMITS.labelMax);
  if (!label) {
    const { label: _drop, labelAt: _dropAt, ...rest } = f;
    return rest as MapFeature;
  }
  return { ...f, label };
}

/** Set a feature's colour, or clear it back to the map's accent. */
export function withColor(f: MapFeature, color: string | null): MapFeature {
  if (!color || !COLOR_PATTERN.test(color)) {
    const { color: _drop, ...rest } = f;
    return rest as MapFeature;
  }
  return { ...f, color: color.toLowerCase() };
}

/** Put a feature's name somewhere other than the middle of its shape. */
export function moveLabelTo(f: MapFeature, x: number, y: number): MapFeature {
  return { ...f, labelAt: point(x, y) };
}

/** Put the name back in the middle of the shape. */
export function clearLabelAt(f: MapFeature): MapFeature {
  const { labelAt: _drop, ...rest } = f;
  return rest as MapFeature;
}

/**
 * Move a feature up or down the painting order.
 *
 * The array IS the z-order — Sangizar's plan puts its walkways first "so the
 * zones and tables draw over them" — so without this, a zone drawn after a
 * path simply hides it and there is no way back but deleting one of them.
 * Returns the same array when the move would fall off either end.
 */
export function reorderFeature(features: MapFeature[], from: number, to: number): MapFeature[] {
  if (from < 0 || from >= features.length) return features;
  if (to < 0 || to >= features.length) return features;
  const next = [...features];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

/** Whether another shape may be added at all. */
export function canAddFeature(features: MapFeature[]): boolean {
  return features.length < FEATURE_LIMITS.maxFeatures;
}

/**
 * What the server would refuse about this feature, in plain terms.
 *
 * The editor is built so none of these can happen; this is the belt to that
 * braces, run over the whole array before it is sent. A drawing already on the
 * map may also be older than a bound, and failing to save a legal change
 * because of a shape somebody else drew would be its own bug — so the page
 * reports which shape is the problem rather than only showing the 400.
 */
export function featureProblems(f: MapFeature): string[] {
  const out: string[] = [];
  const inCoord = (v: number) =>
    Number.isInteger(v) && v >= FEATURE_LIMITS.coordMin && v <= FEATURE_LIMITS.coordMax;
  const inExtent = (v: number) =>
    Number.isInteger(v) && v >= FEATURE_LIMITS.extentMin && v <= FEATURE_LIMITS.extentMax;

  if (f.label !== undefined && (f.label.trim().length === 0 || f.label.length > FEATURE_LIMITS.labelMax)) {
    out.push('label');
  }
  if (f.labelAt !== undefined && !(inCoord(f.labelAt[0]) && inCoord(f.labelAt[1]))) out.push('labelAt');
  if (f.color !== undefined && !COLOR_PATTERN.test(f.color)) out.push('color');

  if (f.shape === 'polygon') {
    if (f.points.length < FEATURE_LIMITS.polygonMin || f.points.length > FEATURE_LIMITS.polygonMax) out.push('points');
    if (f.points.some((p) => !inCoord(p[0]) || !inCoord(p[1]))) out.push('points');
  } else if (f.shape === 'point') {
    if (!inCoord(f.x) || !inCoord(f.y)) out.push('position');
  } else {
    if (!inCoord(f.x) || !inCoord(f.y)) out.push('position');
    if (!inExtent(f.width) || !inExtent(f.height)) out.push('size');
  }
  return out;
}

/** The index of the first unsaveable feature, or null when the drawing is fine. */
export function firstBadFeature(features: MapFeature[]): number | null {
  if (features.length > FEATURE_LIMITS.maxFeatures) return FEATURE_LIMITS.maxFeatures;
  const at = features.findIndex((f) => featureProblems(f).length > 0);
  return at < 0 ? null : at;
}
