/**
 * The tablet kiosk used to be reachable by anyone: the login page carried a
 * "View tablet menu" button that opened `/tablet?restaurantId=…&viewOnly=1`,
 * and the root domain's route table served `/tablet` with no session at all.
 *
 * Both halves are gone. Deleting only the button would have left the mode alive
 * to anyone who typed the URL, so the route is what actually closes it — and a
 * route is easy to re-open by accident while tidying the file. Hence this.
 *
 * Source-reading, in the style of `translate.test.ts` and
 * `stickyAncestors.test.ts`: the suite has no DOM and no router, and what is
 * being asserted is the shape of the route table, not a rendered result.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const SRC = join(__dirname, '..');
const read = (rel: string) => readFileSync(join(SRC, rel), 'utf8');

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) sourceFiles(full, out);
    else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(full);
  }
  return out;
}

describe('the anonymous tablet view is gone', () => {
  const app = read('app/App.tsx');

  it('the root domain serves the kiosk only to a signed-in device', () => {
    // The block that runs on v-menu.uz itself. Everything else there is a
    // redirect to a role's own subdomain, so this route table is the whole of
    // what an anonymous visitor can reach.
    const block = app.slice(app.indexOf('// On root domain'));
    const routes = block.slice(0, block.indexOf('</Routes>'));
    expect(routes, 'the root block no longer routes the tablet at all').toContain('<TabletMenuPage />');
    expect(
      routes,
      'the root domain serves /tablet without checking for a session — that is the public view mode',
    ).toMatch(/\{accessToken && \(\s*<Route element=\{<TabletLayout \/>\}>/);
  });

  it('an anonymous visitor falls through to the login page', () => {
    const block = app.slice(app.indexOf('// On root domain'));
    const routes = block.slice(0, block.indexOf('</Routes>'));
    expect(routes).toContain('<Route path="*" element={<Navigate to="/login" replace />} />');
  });

  it('the login page does not link into the kiosk', () => {
    // The button, the restaurant picker it opened, and the navigate() behind it.
    const login = read('pages/LoginPage.tsx');
    expect(login).not.toContain('/tablet');
    expect(login).not.toContain('view_tablet_menu');
  });

  it('nothing anywhere still speaks of a view-only mode', () => {
    // The prop threaded through TabletMenuPage, IncludedDishesSection,
    // ChildrenTableSection and MenuItemCard. Any survivor is a branch that can
    // only be reached by re-adding the entry point.
    const offenders = sourceFiles(SRC)
      .filter((f) => /viewOnly|view_only_mode|choose_restaurant_to_view/.test(readFileSync(f, 'utf8')))
      .map((f) => f.slice(SRC.length + 1));
    expect(offenders).toEqual([]);
  });
});

describe('the kiosk itself still works', () => {
  // The point was to remove the anonymous entrance, not the kiosk. These guard
  // against the removal having taken the controls with it.
  const tablet = read('pages/TabletMenuPage.tsx');

  it('keeps the settings section, the steppers and the summary button', () => {
    expect(tablet).toContain("t('room_table_settings')");
    expect(tablet).toContain("navigate('/tablet/summary')");
    expect(tablet).toContain('<MenuItemCard');
  });

  it('keeps the free-substitute picker on included dishes', () => {
    // This was behind `!viewOnly` and is the tablet's whole reason for existing.
    expect(tablet).toContain('freeAlts.length > 0 &&');
  });

  it('the staff layouts still link to it', () => {
    for (const layout of ['app/AdminLayout.tsx', 'app/EmployeeLayout.tsx']) {
      expect(read(layout), layout).toContain('/tablet?restaurantId=');
    }
  });
});
