import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * An area's saved default layout, from the map page's side.
 *
 * Reverting is the one DESTRUCTIVE thing on this page that no single gesture
 * undoes: it deletes the tables standing in the area and writes the saved ones
 * again. The arithmetic is the server's (floorMap.service.test.ts); what is
 * checked here is the chain around it — that the page asks first, that it does
 * not go on pointing at rows that no longer exist, and that the snapshot
 * itself never comes down to the browser.
 */
const WEB = join(__dirname, '..');
const strip = (code: string) => code.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, '');
const src = (rel: string) => strip(readFileSync(join(WEB, rel), 'utf8'));

const page = src('pages/FloorMapPage.tsx');
const service = src('services/floorMap.service.ts');

describe('the page asks before it replaces anything', () => {
  const fn = (name: string) => page.slice(page.indexOf(`const ${name} = `), page.indexOf('};', page.indexOf(`const ${name} = `)));

  it('reverting confirms, naming the area and how many tables are standing in it now', () => {
    const revert = fn('restoreDefaultLayout');
    expect(revert).toMatch(/window\.confirm\(t\('fm_restore_default_confirm'/);
    expect(revert).toContain('name: area.name');
    expect(revert).toContain('count');
    // The confirm comes FIRST: nothing is sent to a supervisor who says no.
    expect(revert.indexOf('window.confirm')).toBeLessThan(revert.indexOf('floorMapService.restoreDefaultLayout'));
  });

  it('saving over an existing default confirms, and saving the first one does not', () => {
    const save = fn('saveDefaultLayout');
    // There is one default per area, so a second save discards the first.
    expect(save).toMatch(/area\.defaultLayoutAt && !window\.confirm\(t\('fm_default_replace_confirm'/);
  });

  it('a revert drops the selection — every table it restores is a new row', () => {
    const revert = fn('restoreDefaultLayout');
    expect(revert).toContain('setSelectedId(null)');
    expect(revert.indexOf('setSelectedId(null)')).toBeLessThan(revert.indexOf('floorMapService.restoreDefaultLayout'));
  });

  it('the restored area\'s tables REPLACE the cached ones, and no other area is touched', () => {
    const revert = fn('restoreDefaultLayout');
    // Merging by id would leave every table deleted by the restore on screen.
    expect(revert).toMatch(/m\.tables\.filter\(\(x\) => x\.hallId !== result\.area\.id\)/);
    expect(revert).toContain('...result.tables');
  });

  it('a confirmation of something that worked is not dressed as a failure', () => {
    // `fm-notice` is the red row the failed-save path uses; a success needs its own.
    expect(page).toContain('fm-flash');
    expect(fn('saveDefaultLayout')).toContain("setFlash(t('fm_default_saved_ok'))");
  });
});

describe('the snapshot stays on the server', () => {
  it('the map area carries the DATE a default was saved, and not the layout', () => {
    const types = src('utils/floorMap.ts');
    const area = types.slice(types.indexOf('export type MapArea = {'), types.indexOf('export type MapTable = {'));
    expect(area).toContain('defaultLayoutAt');
    expect(area).not.toMatch(/defaultLayout\s*[?:]/);
  });

  it('both are actions on the area, posted with no body of their own', () => {
    expect(service).toMatch(/post<MapArea>\(`\/floor-map\/areas\/\$\{id\}\/default`/);
    expect(service).toMatch(/post<\{ area: MapArea; tables: MapTable\[\] \}>\(`\/floor-map\/areas\/\$\{id\}\/restore`/);
  });

  it('neither sends a layout the browser made up — the server reads the room itself', () => {
    // The posted BODY is empty in both: a browser that named the tables to
    // save, or to restore, would be a browser that could write any layout it
    // liked over a room.
    for (const path of ['default', 'restore']) {
      const at = service.indexOf(`/${path}\``);
      expect(at, path).toBeGreaterThan(-1);
      expect(service.slice(at, service.indexOf(')', at)), path).toMatch(/`,\s*\{\}$/);
    }
  });
});
