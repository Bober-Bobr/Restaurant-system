import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Merging tables, from the page's side.
 *
 * The geometry is `mergeTables` in utils/floorMap.ts and is tested there; the
 * refusals are the server's (floorMap.service.test.ts). What is checked here is
 * the chain between them — that picking tables cannot also rearrange the room,
 * that what is written is the figure the panel showed, and that the tables the
 * merge consumed leave the map.
 *
 * Reads the source, the house style where there is no DOM.
 */
const WEB = join(__dirname, '..');
const strip = (code: string) => code.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, '');
const src = (rel: string) => strip(readFileSync(join(WEB, rel), 'utf8'));

const page = src('pages/FloorMapPage.tsx');
const service = src('services/floorMap.service.ts');
const fn = (name: string) => {
  const at = page.indexOf(`const ${name} = `);
  return page.slice(at, page.indexOf('\n  };', at));
};

describe('picking the tables', () => {
  it('a press TICKS a table and does nothing else — no selection, no drag', () => {
    // During a merge every press on the plan is an answer to "which tables?",
    // and a press that also dragged one would rearrange the room while being
    // asked a question about it.
    const down = fn('onTablePointerDown');
    const guard = down.indexOf('if (merging) {');
    expect(guard).toBeGreaterThan(-1);
    // It returns before the selection and before the drag below it.
    expect(down.slice(guard)).toMatch(/return;/);
    expect(guard).toBeLessThan(down.indexOf('setSelectedId(table.id);'));
    expect(guard).toBeLessThan(down.indexOf('beginDrag('));
  });

  it('the ticks are a LIST in tap order, so the first table keeps its number', () => {
    expect(page).toMatch(/const \[merging, setMerging\] = useState<string\[\] \| null>\(null\)/);
    const down = fn('onTablePointerDown');
    // Toggling: off if already ticked, appended at the end if not.
    expect(down).toMatch(/list\.includes\(table\.id\) \? list\.filter\(\(id\) => id !== table\.id\) : \[\.\.\.list, table\.id\]/);
  });

  it('leaving the editor or the area drops the ticks', () => {
    // An id ticked here means nothing in the next area, and the ticks are not
    // even drawn outside the layout editor.
    expect(fn('switchMode')).toContain('setMerging(null)');
    expect(fn('switchArea')).toContain('setMerging(null)');
  });

  it('a ticked table is painted as one, in its own class', () => {
    // `is-picked` belongs to a booking being drafted; the two are different
    // facts even though they never show at once.
    expect(page).toMatch(/merging\?\.includes\(table\.id\) \? 'is-merging' : ''/);
    expect(readFileSync(join(WEB, 'pages/FloorMapPage.tsx'), 'utf8')).toContain('.fm-table-group.is-merging .fm-top');
  });

  it('the merge panel wins over the table panel', () => {
    const dispatch = page.slice(page.indexOf('{merging ? mergeForm()'));
    expect(dispatch.indexOf('mergeForm()')).toBeLessThan(dispatch.indexOf('tablePanel'));
    expect(dispatch.indexOf('mergeForm()')).toBeLessThan(dispatch.indexOf('bookingForm()'));
  });
});

describe('what the panel promises is what gets written', () => {
  it('the preview and the commit are the SAME calculation', () => {
    // A second implementation for the preview is how a merged table comes out
    // a different size from the one somebody was shown.
    expect(page).toMatch(/const mergePreview = useMemo\(\(\) => mergeTables\(mergingTables\), \[mergingTables\]\)/);
    const merge = fn('mergeChosen');
    // The REQUEST BODY specifically. Sliced loosely, `mergePreview.seats`
    // survives in the `clampTable` call below it, so breaking the figure
    // actually sent went unnoticed — a break-check found that.
    const sent = merge.slice(merge.indexOf('floorMapService.mergeTables({'), merge.indexOf('}));'));
    for (const field of ['seats', 'width', 'height', 'rotation']) {
      expect(sent, field).toContain(`${field}: mergePreview.${field},`);
    }
    // It never recomputes the geometry; the only bare call to the pure
    // function on the whole page is the memo above (`floorMapService.
    // mergeTables` is the request, which is why this is anchored).
    expect(merge).not.toMatch(/(^|[^.])mergeTables\(/);
    expect((page.match(/(^|[^.])mergeTables\(/gm) ?? []).length).toBe(1);
  });

  it('the seat count — the whole point — is shown BEFORE the merge, cap and all', () => {
    const form = fn('mergeForm');
    expect(form).toContain("t('fm_merge_result', { seats: mergePreview.seats })");
    // Nobody should discover the cap by finding a table of 40 where they
    // expected 50.
    expect(form).toMatch(/mergePreview\.dropped > 0/);
    expect(form).toContain("t('fm_merge_capped', { max: MAX_SEATS, dropped: mergePreview.dropped })");
  });

  it('the merged table is put onto its own map, like every other table write', () => {
    // It is longer than any of the tables it replaces, so it can poke off the
    // edge of the area it was measured in.
    expect(fn('mergeChosen')).toMatch(/clampTable\(mergePreview, \{ \.\.\.mergePreview, seats: mergePreview\.seats \}, stored\)/);
  });

  it('nothing happens below two tables', () => {
    const merge = fn('mergeChosen');
    expect(merge).toMatch(/!mergePreview \|\| !merging \|\| merging\.length < 2/);
    expect(fn('mergeForm')).toMatch(/disabled=\{!mergePreview \|\| busy\}/);
  });

  it('every merged table leaves the map, and the new row takes their place', () => {
    // A refetch would redraw everything; the tables that are gone must not
    // linger on the plan until it lands.
    const merge = fn('mergeChosen');
    expect(merge).toMatch(/m\.tables\.filter\(\(x\) => !ids\.includes\(x\.id\)\), row\]/);
    // The ids are captured BEFORE the request: `merging` is cleared by the
    // success path, and filtering by a cleared list removes nothing.
    expect(merge.indexOf('const ids = merging;')).toBeLessThan(merge.indexOf('floorMapService.mergeTables'));
    expect(merge).toContain('setMerging(null)');
    // And the one table that is left is selected, so the seat count can be
    // corrected on the spot if the sum was not what was wanted.
    expect(merge).toContain('setSelectedId(row.id)');
  });

  it('it is one request, and it names no shape', () => {
    // Several creates and deletes from the browser would leave a duplicated
    // table behind if one of them failed; the shape is the server's to pin.
    expect(service).toMatch(/post<MapTable>\('\/floor-map\/tables\/merge'/);
    const send = service.slice(service.indexOf('async mergeTables('), service.indexOf('post<MapTable>'));
    expect(send).not.toContain('shape');
  });
});
