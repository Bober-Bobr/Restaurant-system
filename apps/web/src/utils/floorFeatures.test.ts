import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  COLOR_PATTERN, EDITABLE_KINDS, FEATURE_LIMITS, MIN_FEATURE, addPolygonCorner, canAddFeature, clearLabelAt,
  featureAt, featureBox, firstBadFeature, moveFeature, moveLabelTo, newFeature, removePolygonCorner,
  reorderFeature, resizeFeature, setBoxShape, setPolygonPoint, toPolygon, toRect, withColor, withLabel,
} from './floorFeatures';
import { featureLabelAt, hitsBlockingFeature, type MapFeature } from './floorMap';
// The SERVER'S OWN validator, imported directly — the same guard the web suite
// already puts over `toSubdomainSlug`, the invoice arithmetic and the section
// rule. Here it earns its keep twice over: the whole drawing is written in one
// PATCH, so a single shape the server refuses loses every other shape with it.
import {
  FEATURE_LIMITS as API_FEATURE_LIMITS,
  FEATURE_KINDS as API_FEATURE_KINDS,
  mapFeatureSchema,
  mapFeaturesSchema,
} from '../../../api/src/modules/floorMap/floorMap.features';

const AREA = { width: 1200, height: 800 };

/**
 * `MapFeature` is an intersection of the common fields with a union of shapes,
 * and `BoxFeature` resolves to `never` on one of
 * those — the union does not distribute through the intersection. An
 * intersection does what is wanted here: the feature, with the fields that
 * shape has.
 */
type BoxFeature = MapFeature & { x: number; y: number; width: number; height: number };
type PolyFeature = MapFeature & { points: [number, number][] };

/** Asserts the server would accept this shape, and says what it objected to. */
const accepted = (f: MapFeature) => {
  const result = mapFeatureSchema.safeParse(f);
  if (!result.success) {
    throw new Error(`the server refuses this shape: ${JSON.stringify(result.error.issues)}\n${JSON.stringify(f)}`);
  }
  return true;
};

describe('the editor and the server agree about the bounds', () => {
  it('mirrors every limit', () => {
    expect(FEATURE_LIMITS).toEqual(API_FEATURE_LIMITS);
  });

  it('offers exactly the kinds the server accepts', () => {
    // A kind the editor offers and the server does not is a shape that cannot
    // be saved; one the server accepts and the editor hides is a shape in
    // Sangizar's plan that nobody can edit.
    expect([...EDITABLE_KINDS].sort()).toEqual([...API_FEATURE_KINDS].sort());
  });

  it('will not draw a shape smaller than the server\'s minimum', () => {
    expect(MIN_FEATURE).toBeGreaterThanOrEqual(FEATURE_LIMITS.extentMin);
  });

  it('builds the server\'s schema FROM those limits rather than from literals', () => {
    // The two agreeing is not enough: a literal beside an exported number
    // agrees for exactly as long as nobody edits one of them. The same guard
    // the hall photo cap carries.
    const schema = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), '../../../api/src/modules/floorMap/floorMap.features.ts'),
      'utf8',
    );
    expect(schema).toMatch(/const coord = [^;]*FEATURE_LIMITS\.coordMin[^;]*FEATURE_LIMITS\.coordMax/);
    expect(schema).toMatch(/const extent = [^;]*FEATURE_LIMITS\.extentMin[^;]*FEATURE_LIMITS\.extentMax/);
    expect(schema).toMatch(/max\(FEATURE_LIMITS\.labelMax\)/);
    expect(schema).toMatch(/min\(FEATURE_LIMITS\.polygonMin\)\.max\(FEATURE_LIMITS\.polygonMax\)/);
    expect(schema).toMatch(/\.max\(FEATURE_LIMITS\.maxFeatures\)/);
  });

  it('uses the same colour rule', () => {
    expect(COLOR_PATTERN.test('#8a9a5b')).toBe(true);
    expect(mapFeatureSchema.safeParse({ kind: 'zone', shape: 'point', x: 0, y: 0, color: 'red' }).success).toBe(false);
  });
});

describe('a new shape', () => {
  for (const kind of EDITABLE_KINDS) {
    it(`of kind ${kind} is one the server accepts`, () => {
      expect(accepted(newFeature(kind, AREA))).toBe(true);
    });
  }

  it('lands on the map rather than off it', () => {
    const box = featureBox(newFeature('zone', AREA));
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(AREA.width);
    expect(box.y + box.height).toBeLessThanOrEqual(AREA.height);
  });

  it('is a FRACTION of the map, so a small room gets a small shape', () => {
    // A fixed 400-unit default in a 400-wide room fills it edge to edge: the
    // zone cannot be told apart from the floor, and the corner handle sits on
    // the boundary. `<=` against the map's own width is not enough to catch
    // that — the test has to measure it against the proportion.
    const smallest = { width: 400, height: 300 };
    const box = featureBox(newFeature('zone', smallest));
    expect(box.width).toBeLessThanOrEqual(smallest.width * 0.4);
    expect(box.height).toBeLessThanOrEqual(smallest.height * 0.4);
    // And still big enough to grab.
    expect(box.width).toBeGreaterThanOrEqual(MIN_FEATURE);
  });

  it('is water as an oval and everything else as a rectangle', () => {
    expect(newFeature('water', AREA).shape).toBe('ellipse');
    expect(newFeature('zone', AREA).shape).toBe('rect');
    expect(newFeature('label', AREA).shape).toBe('point');
  });
});

describe('dragging', () => {
  const zone: MapFeature = { kind: 'zone', shape: 'rect', x: 100, y: 100, width: 300, height: 200, color: '#8a9a5b' };

  it('rounds a fractional drag to whole units', () => {
    // Every coordinate is an INTEGER on the server and a pointer gives floats.
    // Unrounded, the first drag of a zone 400s and takes the drawing with it.
    const moved = moveFeature(zone, 12.4, -7.8) as BoxFeature;
    expect(Number.isInteger(moved.x)).toBe(true);
    expect(Number.isInteger(moved.y)).toBe(true);
    expect(accepted(moved)).toBe(true);
  });

  it('takes a moved NAME along with the shape', () => {
    // `labelAt` is absolute, so without this a zone dragged across the room
    // leaves "Terrace" written over the car park.
    const named: MapFeature = { ...zone, label: 'Terrace', labelAt: [200, 150] };
    const moved = moveFeature(named, 500, 0);
    expect(moved.labelAt).toEqual([700, 150]);
    expect(featureLabelAt(moved)[0]).toBe(700);
  });

  it('leaves a shape with no moved name alone', () => {
    expect(moveFeature({ ...zone, label: 'Terrace' }, 10, 10).labelAt).toBeUndefined();
  });

  it('moves every corner of a polygon together', () => {
    const poly: MapFeature = { kind: 'zone', shape: 'polygon', points: [[0, 0], [100, 0], [100, 100]] };
    const moved = moveFeature(poly, 10.6, 20) as PolyFeature;
    expect(moved.points).toEqual([[11, 20], [111, 20], [111, 120]]);
    expect(accepted(moved)).toBe(true);
  });

  it('clamps to the server\'s own range rather than sailing past it', () => {
    const moved = moveFeature(zone, 1e9, -1e9) as BoxFeature;
    expect(moved.x).toBe(FEATURE_LIMITS.coordMax);
    expect(moved.y).toBe(FEATURE_LIMITS.coordMin);
    expect(accepted(moved)).toBe(true);
  });

  it('may be dragged off the top of the map, because the stage is', () => {
    // Sangizar's stage sits at y = −180, half off the plan, and the drawing is
    // clipped when it is drawn rather than confined.
    const moved = moveFeature(zone, 0, -500) as BoxFeature;
    expect(moved.y).toBe(-400);
    expect(accepted(moved)).toBe(true);
  });
});

describe('resizing', () => {
  const zone: MapFeature = { kind: 'zone', shape: 'rect', x: 100, y: 100, width: 300, height: 200 };

  it('never shrinks a shape to nothing', () => {
    // A shape dragged shut would be both unsaveable (width is min 1) and
    // impossible to grab again.
    const small = resizeFeature(zone, -40, 0) as BoxFeature;
    expect(small.width).toBe(MIN_FEATURE);
    expect(small.height).toBe(MIN_FEATURE);
    expect(accepted(small)).toBe(true);
  });

  it('rounds and clamps at the top end', () => {
    const big = resizeFeature(zone, 1e9, 500.5) as BoxFeature;
    expect(big.width).toBe(FEATURE_LIMITS.extentMax);
    expect(big.height).toBe(501);
    expect(accepted(big)).toBe(true);
  });

  it('does nothing to a polygon or a standing label', () => {
    const poly: MapFeature = { kind: 'zone', shape: 'polygon', points: [[0, 0], [10, 0], [10, 10]] };
    const text: MapFeature = { kind: 'label', shape: 'point', x: 5, y: 5 };
    expect(resizeFeature(poly, 500, 500)).toBe(poly);
    expect(resizeFeature(text, 500, 500)).toBe(text);
  });
});

describe('outlines', () => {
  const zone: MapFeature = {
    kind: 'zone', shape: 'rect', x: 100, y: 100, width: 300, height: 200,
    label: 'Bungalow', labelAt: [250, 200], color: '#e8b796',
  };

  it('a rectangle becomes a four-cornered outline keeping its name and colour', () => {
    const poly = toPolygon(zone) as PolyFeature;
    expect(poly.points).toEqual([[100, 100], [400, 100], [400, 300], [100, 300]]);
    expect(poly.label).toBe('Bungalow');
    expect(poly.labelAt).toEqual([250, 200]);
    expect(poly.color).toBe('#e8b796');
    expect(accepted(poly)).toBe(true);
  });

  it('does not invent a name or a colour for a shape that has none', () => {
    // Writing `label: undefined` is not the same as omitting it: the server
    // refuses a label that is not at least one character.
    const bare: MapFeature = { kind: 'path', shape: 'rect', x: 0, y: 0, width: 50, height: 50 };
    const poly = toPolygon(bare);
    expect('label' in poly).toBe(false);
    expect('color' in poly).toBe(false);
    expect(accepted(poly)).toBe(true);
  });

  it('comes back as the rectangle of its bounding box', () => {
    const back = toRect(toPolygon(zone)) as BoxFeature;
    expect([back.x, back.y, back.width, back.height]).toEqual([100, 100, 300, 200]);
  });

  it('adds a corner at the midpoint of the LONGEST edge', () => {
    // The longest edge because that is where there is room: splitting the
    // first edge every time stacks corners on top of one another, and a corner
    // under another corner cannot be grabbed.
    const poly: MapFeature = { kind: 'zone', shape: 'polygon', points: [[0, 0], [600, 0], [600, 100], [0, 100]] };
    const grown = addPolygonCorner(poly) as PolyFeature;
    expect(grown.points).toEqual([[0, 0], [300, 0], [600, 0], [600, 100], [0, 100]]);
    expect(accepted(grown)).toBe(true);
  });

  it('counts the CLOSING edge, which is often the longest one', () => {
    // A polygon is closed, so the edge from the last corner back to the first
    // is a real edge. Skipping it puts the new corner on a short side of a
    // triangle whose long side is exactly the one nobody can subdivide.
    const tri: MapFeature = { kind: 'zone', shape: 'polygon', points: [[0, 0], [20, 0], [20, 400]] };
    const grown = addPolygonCorner(tri) as PolyFeature;
    expect(grown.points).toEqual([[0, 0], [20, 0], [20, 400], [10, 200]]);
  });

  it('never goes below three corners', () => {
    const tri: MapFeature = { kind: 'zone', shape: 'polygon', points: [[0, 0], [10, 0], [10, 10]] };
    expect(removePolygonCorner(tri, 0)).toBe(tri);
  });

  it('stops adding corners at the server\'s cap', () => {
    const many: MapFeature = {
      kind: 'zone', shape: 'polygon',
      points: Array.from({ length: FEATURE_LIMITS.polygonMax }, (_, i) => [i * 10, 0] as [number, number]),
    };
    expect(addPolygonCorner(many)).toBe(many);
    expect(accepted(many)).toBe(true);
  });

  it('moves one corner and leaves the others', () => {
    const poly: MapFeature = { kind: 'zone', shape: 'polygon', points: [[0, 0], [10, 0], [10, 10]] };
    const moved = setPolygonPoint(poly, 1, 55.7, -3.2) as PolyFeature;
    expect(moved.points).toEqual([[0, 0], [56, -3], [10, 10]]);
    expect(accepted(moved)).toBe(true);
  });

  it('ignores a corner that is not there', () => {
    const poly: MapFeature = { kind: 'zone', shape: 'polygon', points: [[0, 0], [10, 0], [10, 10]] };
    expect(setPolygonPoint(poly, 9, 1, 1)).toBe(poly);
  });

  it('switches a rectangle to an oval and back without losing its box', () => {
    const oval = setBoxShape(zone, 'ellipse') as BoxFeature;
    expect(oval.shape).toBe('ellipse');
    expect([oval.x, oval.y, oval.width, oval.height]).toEqual([100, 100, 300, 200]);
    expect(accepted(oval)).toBe(true);
    expect(setBoxShape(oval, 'rect').shape).toBe('rect');
  });

  it('leaves a standing label shapeless', () => {
    const text: MapFeature = { kind: 'label', shape: 'point', x: 5, y: 5 };
    expect(setBoxShape(text, 'rect')).toBe(text);
  });
});

describe('a shape\'s name', () => {
  const zone: MapFeature = { kind: 'zone', shape: 'rect', x: 0, y: 0, width: 100, height: 100 };

  it('is stored trimmed', () => {
    expect(withLabel(zone, '  Terrace  ').label).toBe('Terrace');
  });

  it('is DELETED by an emptied field, not stored as an empty string', () => {
    // The server's rule is at least one character after trimming, and the
    // whole drawing goes in one request — so `label: ''` refuses every other
    // shape on the plan along with this one.
    const named = withLabel(zone, 'Terrace');
    const cleared = withLabel(named, '   ');
    expect('label' in cleared).toBe(false);
    expect(accepted(cleared)).toBe(true);
    expect(mapFeatureSchema.safeParse({ ...zone, label: '' }).success).toBe(false);
  });

  it('takes its moved position with it when it is deleted', () => {
    // A position for a name that no longer exists is a position nothing reads.
    const named = moveLabelTo(withLabel(zone, 'Terrace'), 50, 50);
    expect('labelAt' in withLabel(named, '')).toBe(false);
  });

  it('is cut to the length the server accepts', () => {
    const long = withLabel(zone, 'x'.repeat(FEATURE_LIMITS.labelMax + 40));
    expect(long.label).toHaveLength(FEATURE_LIMITS.labelMax);
    expect(accepted(long)).toBe(true);
  });

  it('is centred on the shape again when its position is cleared', () => {
    const named = moveLabelTo(withLabel(zone, 'Terrace'), 10, 10);
    expect(featureLabelAt(named)).toEqual([10, 10]);
    expect(featureLabelAt(clearLabelAt(named))).toEqual([50, 50]);
  });

  it('rounds a dragged position', () => {
    expect(moveLabelTo(zone, 10.5, 20.4).labelAt).toEqual([11, 20]);
  });
});

describe('a shape\'s colour', () => {
  const zone: MapFeature = { kind: 'zone', shape: 'rect', x: 0, y: 0, width: 100, height: 100 };

  it('is stored lower-cased, as six hex digits', () => {
    expect(withColor(zone, '#8A9A5B').color).toBe('#8a9a5b');
    expect(accepted(withColor(zone, '#8A9A5B'))).toBe(true);
  });

  it('is DELETED rather than stored as something the server refuses', () => {
    const colored = withColor(zone, '#8a9a5b');
    for (const bad of ['', 'red', '#fff', 'rgb(1,2,3)', '#12345g']) {
      const cleared = withColor(colored, bad);
      expect('color' in cleared).toBe(false);
      expect(accepted(cleared)).toBe(true);
    }
  });
});

describe('the painting order', () => {
  const list: MapFeature[] = ['path', 'zone', 'stage'].map((kind) => ({
    kind: kind as MapFeature['kind'], shape: 'rect', x: 0, y: 0, width: 10, height: 10,
  }));

  it('moves a shape one place', () => {
    // The array IS the z-order — Sangizar's plan puts its walkways first "so
    // the zones and tables draw over them" — so a zone drawn after a path
    // simply hides it, and without this there is no way back.
    expect(reorderFeature(list, 2, 0).map((f) => f.kind)).toEqual(['stage', 'path', 'zone']);
  });

  it('does nothing off either end', () => {
    expect(reorderFeature(list, 0, -1)).toBe(list);
    expect(reorderFeature(list, 2, 3)).toBe(list);
    expect(reorderFeature(list, 7, 0)).toBe(list);
  });
});

describe('hit testing', () => {
  const path: MapFeature = { kind: 'path', shape: 'rect', x: 0, y: 0, width: 400, height: 400 };
  const zone: MapFeature = { kind: 'zone', shape: 'rect', x: 100, y: 100, width: 100, height: 100 };

  it('picks the TOPMOST shape, which is the last one painted', () => {
    // Picking the first match hands back the walkway underneath the zone the
    // supervisor is looking at.
    expect(featureAt([path, zone], 150, 150)).toBe(1);
    expect(featureAt([zone, path], 150, 150)).toBe(1);
  });

  it('answers null on bare floor', () => {
    expect(featureAt([zone], 5, 5)).toBe(null);
  });

  it('gives a standing label a box big enough to grab', () => {
    // It has no region of its own, so the only other way to select one is to
    // hit the text — which may be two words long, or may not exist yet.
    const text: MapFeature = { kind: 'label', shape: 'point', x: 500, y: 500 };
    expect(featureAt([text], 500, 500)).toBe(0);
    expect(featureBox(text).width).toBeGreaterThanOrEqual(2 * MIN_FEATURE);
  });

  it('boxes a polygon round its corners', () => {
    const poly: MapFeature = { kind: 'zone', shape: 'polygon', points: [[10, 20], [110, 20], [60, 220]] };
    expect(featureBox(poly)).toEqual({ x: 10, y: 20, width: 100, height: 200 });
  });
});

describe('tables and zones', () => {
  it('a ZONE never stops a table standing on it', () => {
    // The requirement in as many words: a table may be placed on top of a
    // zone. Only water and the stage are places nobody is seated.
    const box = { x: 200, y: 200, hx: 60, hy: 40 };
    const zone: MapFeature = { kind: 'zone', shape: 'rect', x: 0, y: 0, width: 400, height: 400 };
    const path: MapFeature = { kind: 'path', shape: 'rect', x: 0, y: 0, width: 400, height: 400 };
    const text: MapFeature = { kind: 'label', shape: 'point', x: 200, y: 200 };
    expect(hitsBlockingFeature(box, [zone, path, text])).toBe(false);
  });

  it('water and the stage still are', () => {
    const box = { x: 200, y: 200, hx: 60, hy: 40 };
    const pool: MapFeature = { kind: 'water', shape: 'ellipse', x: 100, y: 100, width: 200, height: 200 };
    expect(hitsBlockingFeature(box, [pool])).toBe(true);
    expect(hitsBlockingFeature(box, [{ ...pool, kind: 'stage' }])).toBe(true);
  });

  it('a zone turned INTO water starts blocking, and back again', () => {
    // The kind is a one-press change in the panel, and it is the only thing
    // that decides this — so the panel says which it is.
    const box = { x: 200, y: 200, hx: 60, hy: 40 };
    const zone: MapFeature = { kind: 'zone', shape: 'rect', x: 0, y: 0, width: 400, height: 400 };
    expect(hitsBlockingFeature(box, [{ ...zone, kind: 'water' }])).toBe(true);
    expect(hitsBlockingFeature(box, [zone])).toBe(false);
  });
});

describe('what the page refuses to send', () => {
  it('passes a drawing that is fine', () => {
    expect(firstBadFeature(EDITABLE_KINDS.map((k) => newFeature(k, AREA)))).toBe(null);
  });

  it('names the shape the server would refuse, by its place in the list', () => {
    const good = newFeature('zone', AREA);
    const bad = { ...good, label: '' } as MapFeature;
    expect(firstBadFeature([good, bad, good])).toBe(1);
  });

  it('catches a drawing longer than the server accepts', () => {
    const many = Array.from({ length: FEATURE_LIMITS.maxFeatures + 1 }, () => newFeature('zone', AREA));
    expect(firstBadFeature(many)).toBe(FEATURE_LIMITS.maxFeatures);
    expect(mapFeaturesSchema.safeParse(many).success).toBe(false);
  });

  it('stops offering new shapes at the cap', () => {
    const full = Array.from({ length: FEATURE_LIMITS.maxFeatures }, () => newFeature('zone', AREA));
    expect(canAddFeature(full)).toBe(false);
    expect(canAddFeature(full.slice(1))).toBe(true);
    expect(mapFeaturesSchema.safeParse(full).success).toBe(true);
  });

  it('agrees with the server about a fractional coordinate', () => {
    // The one failure mode this whole file exists for: an unrounded drag.
    const fractional = { kind: 'zone', shape: 'rect', x: 10.5, y: 0, width: 50, height: 50 } as MapFeature;
    expect(firstBadFeature([fractional])).toBe(0);
    expect(mapFeatureSchema.safeParse(fractional).success).toBe(false);
  });
});

// ── Every operation, chained, checked against the server at each step ───────
// The editor applies these in whatever order a supervisor presses things, and
// the state that is sent is the state the last operation left behind. A single
// operation being safe on a fresh shape says nothing about the hundredth one
// on a shape that has been dragged, converted, recoloured and renamed — which
// is exactly the shape that would lose somebody's whole drawing to a 400.
describe('a long session of editing never produces a shape the server refuses', () => {
  const OPS: ((f: MapFeature, step: number) => MapFeature)[] = [
    (f, n) => moveFeature(f, n * 13.7 - 60, 41.3 - n * 7.1),
    (f, n) => resizeFeature(f, 50 + n * 37.5, 900 - n * 61.2),
    (f) => toPolygon(f),
    (f) => addPolygonCorner(f),
    (f, n) => setPolygonPoint(f, n % 5, n * 311.4 - 900, 20000 - n * 97.6),
    (f, n) => removePolygonCorner(f, n % 4),
    (f) => toRect(f),
    (f) => setBoxShape(f, 'ellipse'),
    (f) => setBoxShape(f, 'rect'),
    (f, n) => withLabel(f, n % 3 === 0 ? '' : ` ${'Зона'.repeat(n % 24)} `),
    (f, n) => withColor(f, n % 4 === 0 ? 'not a colour' : `#${(n * 7919 % 0xffffff).toString(16).padStart(6, '0')}`),
    (f, n) => moveLabelTo(f, n * 523.6 - 4000, n * 211.1),
    (f) => clearLabelAt(f),
    (f, n) => ({ ...f, kind: EDITABLE_KINDS[n % EDITABLE_KINDS.length] }),
  ];

  for (const kind of EDITABLE_KINDS) {
    it(`starting from a new ${kind}`, () => {
      let f = newFeature(kind, AREA);
      // Deterministic rather than random: a fuzz that fails only sometimes is
      // a fuzz nobody can fix.
      for (let step = 1; step <= 400; step += 1) {
        f = OPS[(step * 7 + step * step * 3) % OPS.length](f, step);
        accepted(f);
        expect(firstBadFeature([f])).toBe(null);
      }
    });
  }
});
