import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as web from './workArea';
import * as api from '../../../api/src/utils/workArea';

/**
 * The work-area rule exists twice — the API cannot import from the web app —
 * so this imports BOTH and runs every role, every area and every surface
 * through each. The same guard that stands over `toSubdomainSlug`, the invoice
 * arithmetic, the section rule and the ledger's money.
 *
 * A drift here is not cosmetic: the web decides which controls to draw and the
 * server decides which orders to hand over, so if they disagree a waiter gets
 * a screen whose buttons do not match the data behind them.
 */
const ROLES = [
  'CHIEF_ADMIN', 'MANAGER', 'OWNER', 'ADMIN', 'CATERING_ADMIN', 'RESTAURANT_MANAGER',
  'EMPLOYEE', 'KITCHEN', 'NFC_MAKER', 'PERFORMER', 'HOST', 'CATERING_EMPLOYEE',
  'SUPERVISOR', 'SMALL_KITCHEN',
];

describe('the two copies agree', () => {
  it('about the areas themselves, and the default', () => {
    expect(web.WORK_AREAS).toEqual(api.WORK_AREAS);
    expect(web.DEFAULT_WORK_AREA).toBe(api.DEFAULT_WORK_AREA);
    // General dining: it is what every account that exists today is working,
    // and a deploy must not move anybody to another floor.
    expect(web.DEFAULT_WORK_AREA).toBe('DINING');
  });

  it('about which roles have a floor at all', () => {
    for (const role of ROLES) {
      expect(web.hasWorkArea(role), role).toBe(api.hasWorkArea(role));
    }
    // The two food-service roles, and nobody else. A supervisor places a
    // party's order but does not serve it; a banquet ADMIN runs the other
    // section entirely.
    expect(ROLES.filter((r) => web.hasWorkArea(r))).toEqual(['CATERING_ADMIN', 'CATERING_EMPLOYEE']);
  });

  it('about who may set whose', () => {
    for (const actor of ROLES) {
      for (const target of ROLES) {
        for (const isSelf of [true, false]) {
          expect(
            web.canSetWorkArea(actor, target, isSelf),
            `${actor} → ${target}${isSelf ? ' (self)' : ''}`,
          ).toBe(api.canSetWorkArea(actor, target, isSelf));
        }
      }
    }
  });

  it('about what each area means on the floor', () => {
    for (const area of web.WORK_AREAS) {
      expect(web.workAreaSurface(area), area).toEqual(api.workAreaSurface(area));
    }
  });

  it('about the lead time, and what is due', () => {
    expect(web.DUE_LEAD_MINUTES).toBe(api.DUE_LEAD_MINUTES);
    const now = new Date('2026-10-13T12:00:00.000Z');
    const cases = [
      null, undefined,
      '2026-10-13T13:30:00.000Z', // within the lead
      '2026-10-13T14:00:00.000Z', // exactly on it
      '2026-10-13T14:01:00.000Z', // beyond it
      '2026-10-13T09:00:00.000Z', // already started
      'not a date',
    ];
    for (const at of cases) {
      expect(web.isDueNow(at, now), String(at)).toBe(api.isDueNow(at, now));
    }
  });
});

describe('the rules themselves', () => {
  it('only the two food-service roles may be moved between floors', () => {
    // A role with no floor is not "allowed by default" — there is nothing to
    // set, and storing one would leave a column claiming a banquet admin works
    // the dining room.
    for (const actor of ['CHIEF_ADMIN', 'OWNER', 'CATERING_ADMIN']) {
      expect(api.canSetWorkArea(actor, 'ADMIN', false)).toBe(false);
      expect(api.canSetWorkArea(actor, 'SUPERVISOR', false)).toBe(false);
      expect(api.canSetWorkArea(actor, 'CATERING_EMPLOYEE', false)).toBe(true);
    }
  });

  it('a waiter may set their OWN and nobody else\'s', () => {
    expect(api.canSetWorkArea('CATERING_EMPLOYEE', 'CATERING_EMPLOYEE', true)).toBe(true);
    expect(api.canSetWorkArea('CATERING_EMPLOYEE', 'CATERING_EMPLOYEE', false)).toBe(false);
  });

  it('a banquet ADMIN may set nobody\'s, including their own', () => {
    // They neither create nor see food employees (canManageFoodEmployees), and
    // this is the same boundary.
    expect(api.canSetWorkArea('ADMIN', 'CATERING_EMPLOYEE', false)).toBe(false);
    expect(api.canSetWorkArea('ADMIN', 'ADMIN', true)).toBe(false);
  });

  it('the two floors differ in every one of the five consequences', () => {
    // They are five readings of one question — "does the guest hold this
    // order?" — so if any of them agreed, that one would be a switch somebody
    // had forgotten to think about.
    const dining = api.workAreaSurface('DINING');
    const party = api.workAreaSurface('SMALL_BANQUET');
    for (const key of Object.keys(dining) as (keyof typeof dining)[]) {
      expect(dining[key], key).not.toBe(party[key]);
    }
    // And which way round, so the table cannot be inverted wholesale.
    expect(dining).toEqual({ claimByCode: true, takeFromList: false, waiterCalls: true, editItems: true, hideUntilDue: false });
  });

  it('an order with no time is always due, and one in progress stays', () => {
    const now = new Date('2026-10-13T20:00:00.000Z');
    // No booking behind it: a general-dining order, and an order nobody can
    // see is worse than an early one.
    expect(api.isDueNow(null, now)).toBe(true);
    // Started an hour ago. The evening is still being served, and an order
    // that vanished at 21:00 because the party said 19:00 would be a table
    // with no food and no record of why.
    expect(api.isDueNow('2026-10-13T19:00:00.000Z', now)).toBe(true);
    // Tomorrow's party is not this shift's problem.
    expect(api.isDueNow('2026-10-14T19:00:00.000Z', now)).toBe(false);
  });

  it('a stored value that is not an area reads as the default, never as a crash', () => {
    // It is a plain String column, reachable with psql.
    for (const stored of ['', 'dining', 'KITCHEN', null, undefined, 7, {}]) {
      expect(api.workAreaOf(stored as never)).toBe('DINING');
      expect(web.workAreaOf(stored as never)).toBe('DINING');
    }
  });
});

describe('the column behind it', () => {
  const root = join(__dirname, '../../..');
  const schema = readFileSync(join(root, 'api/prisma/schema.prisma'), 'utf8');
  const migration = readFileSync(
    join(root, 'api/prisma/migrations/20261013100000_work_area_orders/migration.sql'), 'utf8',
  );

  it('is a plain String with the shared default, on both the user and the order', () => {
    // A String like `Event.section`, so a third floor needs no migration.
    expect(schema).toMatch(/workArea\s+String\s+@default\("DINING"\)/);
    expect((schema.match(/workArea\s+String\s+@default\("DINING"\)/g) ?? []).length).toBe(2);
  });

  it('and the migration defaults every existing row to general dining', () => {
    // Which is what they all are: the food-service product is the only one
    // that has had orders, so the deploy re-files nothing.
    expect(migration).toMatch(/ALTER TABLE "AdminUser" ADD COLUMN "workArea" TEXT NOT NULL DEFAULT 'DINING'/);
    expect(migration).toMatch(/ALTER TABLE "Order" ADD COLUMN "workArea" TEXT NOT NULL DEFAULT 'DINING'/);
  });

  it('an order\'s booking CASCADES — a deleted booking takes its food with it', () => {
    // Otherwise a party that is not coming stays on a waiter's screen.
    expect(migration).toMatch(/FOREIGN KEY \("eventId"\) REFERENCES "Event"\("id"\) ON DELETE CASCADE/);
    expect(schema).toMatch(/event\s+Event\?\s+@relation\("EventOrders".*onDelete: Cascade\)/);
  });

  it('and the floor list has an index to read', () => {
    // "My floor's orders, by status", polled every few seconds.
    expect(migration).toContain('"Order"("restaurantId", "workArea", "status")');
  });
});
