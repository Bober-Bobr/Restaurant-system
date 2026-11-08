import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Per-day table layouts, from the map page's side.
 *
 * There is no saved "default layout" any more. The STANDING tables are the
 * default: the two editors change them, and every day shows them — except a
 * day whose tables were rearranged while taking a booking for it, which has a
 * layout of its own. The copying, and the moving of that day's bookings onto
 * the copies, are the server's (floorMap.service.test.ts); what is checked here
 * is that the page draws the right layout, sends each change to the right one,
 * and does not go on pointing at rows the copy replaced.
 *
 * Reads the source, the house style where there is no DOM.
 */
const WEB = join(__dirname, '..');
const strip = (code: string) => code.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, '');
const src = (rel: string) => strip(readFileSync(join(WEB, rel), 'utf8'));

const page = src('pages/FloorMapPage.tsx');
const service = src('services/floorMap.service.ts');
const kiosk = src('pages/KioskFloorSection.tsx');
const fn = (name: string) => {
  const at = page.indexOf(`const ${name} = `);
  return page.slice(at, page.indexOf('\n  };', at));
};

describe('which layout is on screen', () => {
  it('the editors show the STANDING layout; everywhere else, the day\'s', () => {
    expect(page).toContain('const mapDay = editing ? null : day;');
    expect(page).toMatch(/queryKey: mapKey\(mapDay\),\s*queryFn: \(\) => floorMapService\.get\(mapDay\)/);
    // One cache entry per layout, so a day's copy never overwrites the default.
    expect(page).toContain("const mapKey = (day: string | null) => [...MAP_KEY, day ?? 'standing'] as const;");
    expect(fn('patchCache')).toContain('mapKey(mapDay)');
  });

  it('closing an editor refreshes every cached day — they show what it changed', () => {
    expect(fn('switchMode')).toContain('if (editing) void queryClient.invalidateQueries({ queryKey: MAP_KEY });');
  });

  it('the kiosk draws the BOOKING\'s day too', () => {
    expect(kiosk).toContain("queryKey: ['kiosk-floor-map', day], queryFn: () => floorMapService.get(day)");
  });

  it('a day with its own layout says so', () => {
    expect(page).toContain("t('fm_layout_day_note')");
  });
});

describe('a change lands in the layout on screen', () => {
  const own = fn('ownLayout');

  it('in an editor there is nothing to copy — the standing layout is the default', () => {
    expect(own).toMatch(/if \(editing \|\| dayLayouts\.includes\(hallId\)\) return follow;/);
  });

  it('on a day, the first change copies the area for that day, once', () => {
    expect(own).toContain('floorMapService.forkDay(hallId, day)');
    // Two quick changes share one copy rather than racing two.
    expect(own).toContain('forking.current.get(key)');
    expect(own).toContain('forking.current.set(key, pending)');
  });

  it('what the page held by id follows the tables onto their copies', () => {
    for (const held of ['setPicked(', 'setSelectedId(', 'setOpenTableId(', 'setMerging(']) {
      expect(own, held).toContain(held);
    }
    // And a write from an older closure is translated too.
    expect(own).toContain('copies.current[`${day}|${id}`] ?? id');
    // That day's bookings moved with them, so occupancy is re-read.
    expect(own).toContain('invalidateQueries({ queryKey: DAY_KEY(day) })');
  });

  it('a failed copy drops the change rather than writing into the default', () => {
    expect(own).toMatch(/catch \(error\) \{[\s\S]*return false;/);
    expect(own).toContain('return (await pending) ? follow : null;');
  });

  it('every furniture write goes through it', () => {
    for (const name of ['updateTable', 'addTable', 'deleteTable', 'mergeChosen']) {
      expect(fn(name), name).toMatch(/await ownLayout\(/);
    }
    // A table added outside an editor joins the day's layout.
    expect(fn('addTable')).toContain('...(editing ? {} : { day })');
  });

  it('a table cannot be carried into another area outside the editors', () => {
    expect(page).toMatch(/\{editing && <label>\s*<span>\{t\('fm_area'\)\}<\/span>/);
  });

  it('the service asks for a day\'s layout, and the default-layout calls are gone', () => {
    expect(service).toContain('`/floor-map/areas/${id}/day-layout`, { day }');
    expect(service).not.toContain('/default');
    expect(service).not.toContain('/restore');
  });
});
