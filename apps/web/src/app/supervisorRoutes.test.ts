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
    const redirect = APP.indexOf("(role === 'SUPERVISOR' || role === 'SMALL_KITCHEN') && restaurantName");
    // -1 would pass the comparison below for free, so prove the line is there
    // before asking where it is. The redirect was reworded once already, when
    // the section's kitchen joined it.
    expect(redirect, 'the supervisor redirect is gone or reworded').toBeGreaterThan(-1);
    expect(redirect).toBeLessThan(APP.indexOf('window.location.href = buildBanquetUrl('));
  });
});

/**
 * The Small Banquets section's kitchen.
 *
 * SMALL_KITCHEN is required to work exactly as KITCHEN does — same pages, same
 * permissions — over the section's own bookings. "Exactly as" is the part that
 * rots, so the three roles share ONE route table (`StaffRoutes`) and this reads
 * the router to prove they still do. A second table for the new role would pass
 * every other test in the suite and drift from the first within a release.
 */
describe('the section\'s kitchen is the banquet kitchen, on the other book', () => {
  const staff = routeTable('StaffRoutes');

  it('mounts one table for EMPLOYEE, KITCHEN and SMALL_KITCHEN alike', () => {
    expect(APP).toMatch(/role === 'EMPLOYEE' \|\| role === 'KITCHEN' \|\| role === 'SMALL_KITCHEN'/);
    for (const path of ['/', '/calendar', '/devices']) {
      expect(paths(staff).has(path), `${path} is missing from the staff routes`).toBe(true);
    }
    expect(staff).toContain('<EmployeeLayout />');
  });

  it('and the kiosk stays EMPLOYEE\'s alone, as a POSITIVE test', () => {
    // `role !== 'KITCHEN'` was the old form, and it hands the tablet to every
    // role added to this layout afterwards — this one included. A cook does not
    // take bookings in either section.
    expect(staff).toContain("role === 'EMPLOYEE' && (");
    expect(staff).not.toContain("role !== 'KITCHEN'");
    // The layout carries the tablet LINK, and it had the same negative form.
    // Checked at the link rather than across the file, because the layout's
    // own role guard names the three roles it admits and legitimately says
    // `role !== 'KITCHEN'` while doing so.
    const layout = readFileSync(join(__dirname, 'EmployeeLayout.tsx'), 'utf8');
    const link = layout.slice(Math.max(0, layout.indexOf('to={`/tablet?restaurantId=') - 600), layout.indexOf('to={`/tablet?restaurantId='));
    expect(link, 'the tablet link is gone').not.toBe('');
    expect(link, 'the tablet link is offered by a negative role test again').not.toContain("role !== 'KITCHEN'");
    expect(link).toContain("role === 'EMPLOYEE' && (");
  });

  it('reaches the section\'s own host rather than the banquet app', () => {
    // A signed-in small-banquet cook landing on the root domain must be sent to
    // supervisor.v-menu.uz — the banquet host is one their role cannot get past
    // — and that redirect must come BEFORE the catch-all that sends restaurant
    // staff to the banquet app.
    expect(APP).toContain("(role === 'SUPERVISOR' || role === 'SMALL_KITCHEN')");
    expect(APP.indexOf("role === 'SUPERVISOR' || role === 'SMALL_KITCHEN'"))
      .toBeLessThan(APP.indexOf('window.location.href = buildBanquetUrl('));
    // …and on that host it gets the kitchen's pages, not the section admin's.
    expect(APP).toContain("if (supRole === 'SMALL_KITCHEN') return <StaffRoutes role={supRole} />;");
  });

  it('is dressed in the section\'s colours without forking the layout', () => {
    // Same mechanism as SupervisorLayout: `.svr-theme` redeclares every --adm-*
    // token, so one class reaches the whole shell and the three pages under it.
    // Forking EmployeeLayout is what this is avoiding — the two kitchens would
    // then drift, which is the one thing the role was specified not to do.
    const layout = readFileSync(join(__dirname, 'EmployeeLayout.tsx'), 'utf8');
    expect(layout).toContain("'adm-bg svr-theme'");
    expect(layout).toMatch(/role === 'SMALL_KITCHEN'/);
  });
});
