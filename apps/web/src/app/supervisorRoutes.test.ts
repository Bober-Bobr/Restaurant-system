import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The Small Banquets section is required to offer *identical* pages and
 * capabilities to the banquet admin app, over separate data.
 *
 * "Identical" is the part that rots: the obvious way to give a section its own
 * look is to fork its pages, and forked pages drift within a release — one gets
 * a bug fix, the other does not. So the section mounts the SAME components, and
 * this reads the router to prove it still does. If somebody adds a page to the
 * banquet app and not to this one, that shows up here rather than as a
 * supervisor asking why they cannot see extra services.
 */
const APP = readFileSync(join(__dirname, 'App.tsx'), 'utf8');

/** The body of a `const <name> = () => (…)` route table. */
function routeTable(name: string): string {
  const at = APP.indexOf(`const ${name} =`);
  expect(at, `${name} is gone`).toBeGreaterThan(-1);
  const end = APP.indexOf('\n};', at) >= 0 && APP.indexOf('\n};', at) < APP.indexOf('\n);', at)
    ? APP.indexOf('\n};', at)
    : APP.indexOf('\n);', at);
  return APP.slice(at, end);
}

const supervisor = routeTable('SupervisorRoutes');
const banquet = routeTable('RoleRoutes');
/** The banquet admin app is the tail of RoleRoutes, after the role branches. */
const banquetAdmin = banquet.slice(banquet.lastIndexOf('<Route element={<AdminLayout />}>'));

const paths = (table: string) =>
  new Set([...table.matchAll(/<Route path="([^"]+)" element=/g)].map((m) => m[1]));

describe('the Small Banquets app mounts the banquet admin app\'s pages', () => {
  const supPaths = paths(supervisor);
  const banqPaths = paths(banquetAdmin);

  // Two deliberate omissions, stated here so they are a decision rather than an
  // oversight — and so that adding either back is a one-line change here too.
  //
  //   /admin/users       — the section has exactly ONE role at this stage, so
  //                        there is nobody for a supervisor to create; and the
  //                        roles a banquet ADMIN can create are the OTHER
  //                        section's staff, which this one must not be handed.
  //   /admin/restaurants — a tenancy screen, not part of running a section.
  const OMITTED = ['/admin/users', '/admin/restaurants'];

  for (const path of ['/', '/calendar', '/devices', '/admin/invoices', '/admin/notifications',
    '/admin/menu', '/admin/subcategories', '/admin/additional', '/admin/table-categories',
    '/admin/halls', '/admin/extra-services', '/admin/photos', '/admin/settings', '/admin/arrangement']) {
    it(path, () => {
      expect(supPaths.has(path), `${path} is missing from the supervisor app`).toBe(true);
    });
  }

  it('and nothing else has quietly gone missing', () => {
    const missing = [...banqPaths].filter((p) => !supPaths.has(p) && !OMITTED.includes(p));
    expect(missing, `add these to SupervisorRoutes, or to OMITTED with a reason: ${missing.join(', ')}`).toEqual([]);
  });

  it('the two omissions are still omissions', () => {
    // If one is added back, this fails and the comment above has to be revised
    // rather than left describing a state that no longer holds.
    for (const path of OMITTED) expect(supPaths.has(path), path).toBe(false);
  });
});

describe('it can take a booking, which is the point of the section', () => {
  it('mounts the kiosk and the summary', () => {
    for (const path of ['/tablet', '/tablet/summary']) {
      expect(paths(supervisor).has(path), path).toBe(true);
    }
    expect(supervisor).toContain('<TabletLayout />');
  });

  it('and creating an event is open to the role server-side', () => {
    // The kiosk being mounted is worth nothing if POST /events refuses the
    // role. `requireRole` on the mutating event routes has to name SUPERVISOR.
    const routes = readFileSync(
      join(__dirname, '..', '..', '..', 'api', 'src', 'modules', 'events', 'event.routes.ts'), 'utf8',
    );
    const mutations = [...routes.matchAll(/router\.(post|patch|delete)\([^\n]*\n?/g)].map((m) => m[0]);
    expect(mutations.length).toBeGreaterThan(0);
    for (const line of mutations) {
      expect(line, `a mutating event route excludes SUPERVISOR: ${line.trim()}`).toContain('AdminRole.SUPERVISOR');
    }
  });
});

describe('the section has its own look without forking a page', () => {
  it('through a theme scope on the layout, not per-page styles', () => {
    // `.svr-theme` redeclares every `--adm-*` token (see palette.test.ts), which
    // is what reaches ~40 unmodified pages at once. Same mechanism as
    // `.cadm-theme` for food service.
    const layout = readFileSync(join(__dirname, 'SupervisorLayout.tsx'), 'utf8');
    expect(layout).toContain('className="adm-bg svr-theme"');
  });

  it('and the host resolves to it', () => {
    expect(APP).toContain('if (isSupervisorHost())');
    expect(APP).toContain('<SupervisorRoutes />');
    // A signed-in supervisor landing on the root domain must be sent to their
    // own host BEFORE the catch-all that sends restaurant staff to the banquet
    // app — a host their role cannot get past.
    expect(APP.indexOf("role === 'SUPERVISOR' && restaurantName"))
      .toBeLessThan(APP.indexOf('window.location.href = buildBanquetUrl('));
  });
});
