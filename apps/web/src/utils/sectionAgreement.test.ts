import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as web from './section';
import * as api from '../../../api/src/utils/section';
import type { AdminRole } from '../store/auth.store';

/**
 * Small Banquets is the third section of the product, and its separation from
 * the Banquet section rests on one rule: **the section of a request comes from
 * the caller's role, not from anything the caller sends.**
 *
 * That rule exists twice — the API decides it for every authenticated request,
 * and the web copy picks which section's halls, packages and extra services the
 * kiosk asks the three unauthenticated public endpoints for. The API cannot
 * import from the web app, so the duplication is unavoidable; this is the same
 * guard the suite already puts on `toSubdomainSlug` and on the invoice
 * arithmetic. If the two drift, a supervisor's kiosk shows one section's tables
 * while writing bookings into the other's — which nobody would notice until a
 * banquet's packages turned up on a small banquet's summary.
 */
const ROLES: AdminRole[] = [
  'CHIEF_ADMIN', 'MANAGER', 'OWNER', 'ADMIN', 'CATERING_ADMIN', 'RESTAURANT_MANAGER',
  'EMPLOYEE', 'KITCHEN', 'NFC_MAKER', 'PERFORMER', 'HOST', 'CATERING_EMPLOYEE', 'SUPERVISOR',
];

describe('the two copies of the section rule agree', () => {
  for (const role of ROLES) {
    it(role, () => {
      expect(web.sectionForRole(role)).toBe(api.sectionForRole(role as never));
    });
  }

  it('and agree about nobody', () => {
    expect(web.sectionForRole(null)).toBe(api.sectionForRole(null));
    expect(web.sectionForRole(undefined)).toBe(api.sectionForRole(undefined));
  });
});

describe('which section a role works in', () => {
  it('a supervisor is pinned to Small Banquets', () => {
    expect(api.sectionForRole('SUPERVISOR' as never)).toBe('SMALL_BANQUET');
    expect(web.sectionOfRole('SUPERVISOR')).toBe('SMALL_BANQUET');
  });

  it('the banquet staff roles are pinned to Banquet', () => {
    for (const role of ['ADMIN', 'EMPLOYEE', 'KITCHEN'] as AdminRole[]) {
      expect(web.sectionForRole(role), role).toBe('BANQUET');
    }
  });

  it('the platform roles are pinned to neither, so they may choose', () => {
    // CHIEF_ADMIN, MANAGER and OWNER administer both sections and say which
    // they mean per request. Null is what lets `resolveSection` honour their
    // `?section=`, and it is the only way either book is reachable from the
    // platform screens.
    for (const role of ['CHIEF_ADMIN', 'MANAGER', 'OWNER'] as AdminRole[]) {
      expect(web.sectionForRole(role), role).toBeNull();
    }
  });
});

describe('a pinned role cannot ask for the other section', () => {
  // This is the whole of the data separation. Everything else — the repository
  // filters, the 404s on the by-id paths — is downstream of it.
  it('a supervisor asking for Banquet still gets Small Banquets', () => {
    for (const asked of ['BANQUET', 'SMALL_BANQUET', 'junk', '', null, undefined]) {
      expect(api.resolveSection('SUPERVISOR' as never, asked)).toBe('SMALL_BANQUET');
    }
  });

  it('an ADMIN asking for Small Banquets still gets Banquet', () => {
    for (const asked of ['SMALL_BANQUET', 'BANQUET', 'junk', undefined]) {
      expect(api.resolveSection('ADMIN' as never, asked)).toBe('BANQUET');
    }
  });

  it('a platform role gets what it asked for', () => {
    expect(api.resolveSection('CHIEF_ADMIN' as never, 'SMALL_BANQUET')).toBe('SMALL_BANQUET');
    expect(api.resolveSection('CHIEF_ADMIN' as never, 'BANQUET')).toBe('BANQUET');
  });

  it('and falls back to Banquet when it asks for nothing recognisable', () => {
    // Every request written before this feature sends no section at all, and
    // every one of them meant the original section. A stale bundle keeps
    // working rather than getting a 400 it cannot act on.
    for (const asked of [undefined, null, '', 'banquet', 'smallBanquet', 42]) {
      expect(api.resolveSection('CHIEF_ADMIN' as never, asked)).toBe('BANQUET');
    }
  });

  it('rejects the MenuScope spellings, which are a different axis', () => {
    // 'banquet' is a menu scope; 'BANQUET' is a section. The two axes have
    // deliberately similar names and this is where confusing them would show.
    expect(api.isSection('banquet')).toBe(false);
    expect(api.isSection('smallBanquet')).toBe(false);
    expect(api.isSection('BANQUET')).toBe(true);
    expect(api.isSection('SMALL_BANQUET')).toBe(true);
  });
});

describe('the section is resolved on the server, once, where it cannot be skipped', () => {
  const API = join(__dirname, '..', '..', '..', 'api', 'src');
  const read = (rel: string) => readFileSync(join(API, rel), 'utf8');

  it('by `requireRestaurant`, which every section-scoped route already runs behind', () => {
    // Deliberately NOT a middleware of its own: the routes that need a section
    // are exactly the routes that need a restaurant, and a second middleware is
    // one somebody eventually forgets to mount on a new route — which would
    // silently default that route to Banquet for a supervisor.
    const mw = read('middleware/auth.middleware.ts');
    expect(mw).toContain('request.section = resolveSection(admin.role,');
    const app = read('app.ts');
    for (const route of ['/events', '/table-categories', '/halls', '/extra-services']) {
      expect(app, `${route} is not behind requireRestaurant`)
        .toContain(`protectedApi.use('${route}', requireRestaurant`);
    }
  });

  it('from the ROLE, with the request body only ever consulted for platform roles', () => {
    // `resolveSection` reads the query/body value, but `sectionForRole` wins
    // whenever it returns anything — the behaviour proven above. What matters
    // here is that the middleware passes the role at all: passing only the
    // query value would make the whole thing caller-controlled.
    const mw = read('middleware/auth.middleware.ts');
    const call = mw.slice(mw.indexOf('request.section = resolveSection('));
    expect(call.slice(0, call.indexOf(';'))).toContain('admin.role');
  });
});
