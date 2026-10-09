import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The floor map's THREE modes, from the page's side.
 *
 * The map is a home page and two different editors, and the gestures collide:
 * a drag means "move this table" in one and "move the room it stands in" in
 * the other. What is checked here is the chain that keeps them apart — which
 * mode each control belongs to, that a press can only ever mean one thing, and
 * that nothing about the drawing leaks into the day view, where a zone must
 * not swallow the press meant for the table standing on it.
 *
 * The geometry itself is `floorFeatures.test.ts`, which runs every edit
 * through the SERVER'S own schema. This file reads the source, the house style
 * where there is no DOM.
 */
const WEB = join(__dirname, '..');
const strip = (code: string) => code.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, '');
const src = (rel: string) => strip(readFileSync(join(WEB, rel), 'utf8'));

const page = src('pages/FloorMapPage.tsx');
const raw = readFileSync(join(WEB, 'pages/FloorMapPage.tsx'), 'utf8');
const service = src('services/floorMap.service.ts');

/** The body of a top-level `const name = ` in the page. */
const fn = (name: string) => {
  const at = page.indexOf(`const ${name} = `);
  expect(at).toBeGreaterThan(-1);
  return page.slice(at, page.indexOf('\n  };', at));
};

describe('there are two editors and they are one at a time', () => {
  it('the mode is one value, not a pair of booleans', () => {
    // Two flags can be true at once, which is a map where one drag does two
    // things. One value cannot be in two modes.
    expect(page).toMatch(/type EditMode = 'view' \| 'tables' \| 'zones'/);
    expect(page).toMatch(/useState<EditMode>\('view'\)/);
    expect(page).not.toContain('setEditing');
  });

  it('both buttons are in the toolbar, each naming what it opens', () => {
    expect(page).toContain("t('fm_edit_tables')");
    expect(page).toContain("t('fm_edit')");
  });

  it('each button switches through the one function that clears up', () => {
    // A mode change has to drop a drag in flight, both selections and any
    // booking being drafted. Written at each call site, one of them forgets.
    expect(page).toMatch(/switchMode\(editingTables \? 'view' : 'tables'\)/);
    expect(page).toMatch(/switchMode\(editingZones \? 'view' : 'zones'\)/);
    const switcher = fn('switchMode');
    for (const call of ['setDrag(null)', 'setSelectedId(null)', 'setSelectedFeature(null)',
      'setBooking(null)', 'setAssigning(null)', 'setPicked({})']) {
      expect(switcher).toContain(call);
    }
  });

  it('the day view is still the only place a booking is drafted', () => {
    // The day bar carries the date, the schedule and "New booking"; in either
    // editor the map is not a picture of a day at all.
    expect(page).toMatch(/\{!editing && \(\s*<div className="fm-daybar">/);
  });
});

describe('a press means exactly one thing', () => {
  it('the drawing takes pointer events ONLY while it is being edited', () => {
    // Left clickable, a zone would swallow the press meant for the table
    // standing on it — on the day view, that is a booking nobody can open.
    expect(page).toMatch(/pointerEvents=\{editingZones \? 'auto' : 'none'\}/);
    expect(page).toMatch(/onPointerDown=\{editingZones \? onFeatureLayerPointerDown : undefined\}/);
  });

  it('the tables go inert while the drawing is edited', () => {
    // The other half of "tables sit on top of zones": the paint keeps them on
    // top, and this is what lets a press reach the zone underneath.
    expect(page).toContain("editingZones ? 'is-inert' : ''");
    expect(raw).toMatch(/\.fm-table-group\.is-inert \{[^}]*pointer-events: none/);
  });

  it('a table is draggable in the LAYOUT editor only', () => {
    expect(page).toContain("editingTables ? 'is-editable' : ''");
    expect(page).toMatch(/\{editingTables && selected && \(/);
  });

  it('the topmost shape under the finger is the one picked', () => {
    // Shapes overlap by design — a zone over a walkway — and an SVG child only
    // receives what is not covered by a sibling above it, so the layer takes
    // the press and `featureAt` decides. First match would hand back the
    // walkway underneath.
    expect(fn('onFeatureLayerPointerDown')).toContain('featureAt(features, p.x, p.y)');
    expect(src('utils/floorFeatures.ts')).toMatch(/for \(let i = features\.length - 1; i >= 0; i -= 1\)/);
  });

  it('bare floor clears both selections', () => {
    expect(page).toMatch(/className="fm-ground"[\s\S]{0,220}setSelectedId\(null\); setSelectedFeature\(null\)/);
  });

  it('Escape clears both too', () => {
    expect(page).toMatch(/Escape'\) \{ setSelectedId\(null\); setSelectedFeature\(null\); \}/);
  });
});

describe('the day\'s bookings are not drawn in either editor', () => {
  // In an editor the map is furniture and rooms being arranged; colouring it
  // by an evening's bookings would say a table cannot be moved when it can.
  for (const cls of ['is-taken', 'is-partly', 'is-picked']) {
    it(`${cls} is painted only when nothing is being edited`, () => {
      const at = page.indexOf(`'${cls}' : ''`);
      expect(at).toBeGreaterThan(-1);
      // `editing` is `mode !== 'view'`, so one test covers both editors.
      expect(page.slice(at - 120, at)).toContain('!editing');
    });
  }

  it('`editing` means "in either editor", and is derived rather than stored', () => {
    expect(page).toMatch(/const editing = mode !== 'view'/);
    expect(page).toMatch(/const editingTables = mode === 'tables'/);
    expect(page).toMatch(/const editingZones = mode === 'zones'/);
  });

  it('the whole-area overlay and the pending strip stay on the day view', () => {
    expect(page).toContain('{!editing && wholeAreaBooking && (');
    expect(page).toContain('{!editing && pendingHere.length > 0 && (');
  });
});

describe('each control belongs to one editor', () => {
  it('"Add table" is in the layout editor', () => {
    // Not `<button[^>]*>`: an arrow function in an attribute contains a `>`.
    expect(page).toMatch(/\{editingTables && \(\s*<button[\s\S]{0,160}?\{t\('fm_add_table'\)\}/);
  });

  it('adding an AREA is in the map editor — creating a venue is a map-level act', () => {
    expect(page).toMatch(/\{editingZones && \(\s*<button type="button" className="fm-tab fm-tab-add"/);
  });

  it('the default layout sits with the TABLE layout, which is what an evening moves', () => {
    const panel = page.slice(page.indexOf('const areaPanel'), page.indexOf('const drawingPalette'));
    const zones = panel.indexOf('if (editingZones)');
    expect(zones).toBeGreaterThan(-1);
    // After the zones branch returns, so it is the layout editor's.
    expect(panel.indexOf("t('fm_save_default')")).toBeGreaterThan(zones);
    // And the drawing's own branch does not offer it.
    const zonesBranch = panel.slice(zones, panel.indexOf("t('fm_delete_area')", zones));
    expect(zonesBranch).not.toContain('fm_save_default');
  });

  it('the shape palette is up throughout the drawing editor, not only when nothing is selected', () => {
    // It was a part of the area's panel at first, so selecting a shape
    // replaced the one row that adds another — drawing a second zone needed a
    // deselect that nothing on the screen mentioned.
    expect(page).toMatch(/\{editingZones && drawingPalette\(\)\}/);
    const aside = page.slice(page.indexOf('<aside className="adm-card fm-panel">'));
    // Palette, then whatever is selected, then the (tall) list of shapes.
    expect(aside.indexOf('drawingPalette()')).toBeLessThan(aside.indexOf('featurePanel'));
    expect(aside.indexOf('drawingList()')).toBeGreaterThan(aside.indexOf('featurePanel'));
  });

  it('the map-size handle is in BOTH editors — either can run out of room', () => {
    expect(page).toMatch(/\{editing && \(\s*<rect\s*className="fm-resize"/);
  });

  it('the shape panel wins over the table panel while drawing', () => {
    // There a press is never about a table, so a table left selected from the
    // other editor must not take the panel.
    const dispatch = page.slice(page.indexOf('{booking ? bookingForm()'));
    expect(dispatch.indexOf('featurePanel')).toBeLessThan(dispatch.indexOf('tablePanel'));
  });

  it('a table\'s form is the layout editor\'s; elsewhere it reads as facts', () => {
    expect(fn('tablePanel')).toContain('if (!editingTables) {');
  });
});

describe('writing the drawing', () => {
  it('is sent as the whole array, because that is the column', () => {
    expect(service).toMatch(/mapFeatures: MapFeature\[\]/);
    expect(fn('writeFeatures')).toMatch(/floorMapService\.updateArea\(area\.id, \{ mapFeatures: next \}\)/);
  });

  it('is CHECKED first — one bad shape would refuse the whole drawing', () => {
    const write = fn('writeFeatures');
    expect(write).toContain('firstBadFeature(next)');
    // And it says which shape, by its place in the list the panel shows: a
    // bare "save failed" on a drawing of forty zones is useless.
    expect(write).toMatch(/setNotice\(t\('fm_feature_invalid', \{ n: bad \+ 1 \}\)\)/);
    expect(write.indexOf('firstBadFeature')).toBeLessThan(write.indexOf('floorMapService.updateArea'));
  });

  it('patches the cache optimistically, like a table move', () => {
    expect(fn('writeFeatures')).toMatch(/a\.id === area\.id \? \{ \.\.\.a, mapFeatures: next \}/);
  });

  it('sends nothing when a shape did not actually change', () => {
    // A colour re-picked to the same hex and a name committed unedited on blur
    // both arrive here, and each would otherwise be a request that rewrites
    // the whole drawing.
    expect(fn('editFeature')).toMatch(/JSON\.stringify\(replaced\) === JSON\.stringify\(target\)/);
  });

  it('refuses to add past the server\'s cap, and says so', () => {
    const add = fn('addFeature');
    expect(add).toContain('canAddFeature(features)');
    expect(add).toMatch(/fm_feature_limit', \{ max: FEATURE_LIMITS\.maxFeatures \}/);
  });

  it('deleting a shape asks first, naming it', () => {
    const del = fn('deleteFeature');
    expect(del).toMatch(/window\.confirm\(t\('fm_delete_feature_confirm'/);
    expect(del.indexOf('window.confirm')).toBeLessThan(del.indexOf('writeFeatures'));
    // And stops pointing at an index that no longer exists.
    expect(del).toContain('setSelectedFeature(null)');
  });

  it('the colour input is CONTROLLED AND has an onChange, or React makes it read-only', () => {
    // This is the bug a browser found and no test here would have: a `value`
    // with no `onChange` renders a read-only input, so the swatch opened, a
    // colour was chosen, and nothing whatever happened.
    const field = page.slice(page.indexOf('const ColorField'), page.indexOf('const LabelField'));
    expect(field).toContain('type="color"');
    expect(field).toMatch(/value=\{draft\}/);
    expect(field).toMatch(/onChange=\{\(e\) => setDraft\(e\.target\.value\)\}/);
  });

  it('a shape\'s name can be CLEARED, and a table\'s number cannot', () => {
    // Clearing a zone's name has to reach `withLabel`, which deletes the key —
    // the server refuses an empty one. A table number is the opposite: every
    // table has one, so an emptied field there is a half-typed edit and is put
    // back. One field serves both, and `allowEmpty` is the whole difference.
    expect(page).toMatch(/if \(!next && !allowEmpty\) \{ setDraft\(value\); return; \}/);
    const featureName = page.slice(page.indexOf("t('fm_feature_name')"));
    expect(featureName.slice(0, 400)).toContain('allowEmpty');
    // The table's own number field must not carry it.
    const tableName = page.slice(page.indexOf('const tablePanel'), page.indexOf('const savedAtText'));
    expect(tableName).toContain('<LabelField');
    expect(tableName).not.toContain('allowEmpty');
  });

  it('a colour is WRITTEN on blur, not on every change', () => {
    // A colour input fires continuously while the picker is dragged, and each
    // one of those would be a request that rewrites the whole drawing — so the
    // draft follows the picker and only the blur commits.
    const field = page.slice(page.indexOf('const ColorField'), page.indexOf('const LabelField'));
    expect(field).toMatch(/onBlur=\{\(\) => \{ if \(draft !== value\) onCommit\(draft\); \}\}/);
    expect(field).not.toMatch(/onChange=\{[^}]*onCommit/);
    // And the panel hands the write through editFeature, like every other edit.
    const panel = page.slice(page.indexOf('const featurePanel'));
    expect(panel).toMatch(/<ColorField[\s\S]{0,300}onCommit=\{\(color\) => editFeature/);
  });
});

describe('the selection is an index, and is kept honest', () => {
  it('is read through the array every render rather than held', () => {
    // An edit rewrites the array; a held copy leaves the panel showing the
    // colour from before the last press.
    expect(page).toMatch(/const selectedShape = editingZones && selectedFeature !== null \? features\[selectedFeature\] \?\? null : null/);
  });

  it('follows a shape through a reorder instead of staying on the slot', () => {
    expect(fn('moveFeatureOrder')).toContain('setSelectedFeature(to)');
  });

  it('is dropped when the area changes — the same index is another area\'s shape', () => {
    expect(fn('switchArea')).toContain('setSelectedFeature(null)');
  });
});

describe('what the drag preview draws is what the release writes', () => {
  it('the preview applies the SAME pure functions the commit does', () => {
    // A separate preview transform is a second implementation of the geometry,
    // and the two drift into a shape that jumps when the finger comes up.
    const preview = fn('previewFeature');
    const up = fn('onPointerUp');
    for (const op of ['moveFeature', 'resizeFeature', 'setPolygonPoint', 'moveLabelTo']) {
      expect(preview).toContain(op);
      expect(up).toContain(op);
    }
  });

  it('a move is measured from where the drag started, not from the pointer', () => {
    expect(fn('onPointerUp')).toMatch(/moveFeature\(f, done\.x - done\.baseX, done\.y - done\.baseY\)/);
  });

  it('a press that did not move writes nothing', () => {
    // Selecting a shape is a press, and a press that committed a move would
    // rewrite the drawing on every selection.
    expect(fn('onPointerUp')).toContain('if (!done || !done.moved || !current) return;');
    expect(fn('onFeatureLayerPointerDown')).toContain('moved: false');
  });
});

describe('the drawing editor leaves the rest of the map alone', () => {
  it('every new rule is scoped to the editing layer or to a panel class', () => {
    // Nothing about a zone may change on the day view or on the printed sheet:
    // outside the editor a zone is paint, with no cursor, frame or handles.
    for (const rule of ['.fm-features.is-editing', '.fm-feature-frame', '.fm-feature-handle', '.fm-feature-vertex']) {
      expect(raw).toContain(rule);
    }
    expect(raw).toMatch(/\.fm-features\.is-editing \{[^}]*cursor: pointer/);
  });

  it('the page\'s style block still contains no backtick', () => {
    // It lives inside a template literal: one backtick, even in a prose
    // comment, ends it and the file stops compiling. That shipped once.
    const block = raw.slice(raw.indexOf('<style>{`'), raw.indexOf('`}</style>'));
    expect(block.slice(9)).not.toContain('`');
  });

  it('no inline style declaration uses !important, which React drops', () => {
    expect(raw).not.toMatch(/style=\{\{[^}]*!important/);
  });
});
