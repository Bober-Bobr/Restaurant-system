import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The waiter's two floors, from the screens' side.
 *
 * The rule is `utils/workArea.ts` and the refusals are the server's
 * (order.service.test.ts). What is checked here is that the PAGE reads the one
 * surface table rather than deciding for itself, that nothing is drawn which
 * the server would refuse, and that the mode is visible — a waiter who cannot
 * tell which stream they are looking at will acknowledge a call that cannot
 * exist.
 *
 * Reads the source, the house style where there is no DOM.
 */
const WEB = join(__dirname, '..');
const strip = (code: string) => code.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, '');
const src = (rel: string) => strip(readFileSync(join(WEB, rel), 'utf8'));

const page = src('pages/FoodEmployeeOrdersPage.tsx');
const layout = src('app/FoodEmployeeLayout.tsx');
const hook = src('utils/useWorkArea.ts');
const users = src('pages/AdminUsersPage.tsx');

describe('the page reads the surface, and never decides for itself', () => {
  it('every control it drops is dropped by the shared table', () => {
    // Five readings of one question — "does the guest hold this order?" — so
    // the page asks that question once, by name, in five places.
    for (const key of ['surface.claimByCode', 'surface.takeFromList', 'surface.editItems']) {
      expect(page, key).toContain(key);
    }
    // And it never compares the area itself, which is how a sixth consequence
    // ends up written in two voices.
    expect(page).not.toMatch(/area === 'SMALL_BANQUET'/);
    expect(page).not.toMatch(/area === 'DINING'/);
  });

  it('taking an order by CODE is the dining floor\'s only', () => {
    expect(page).toMatch(/\{surface\.claimByCode && \(/);
  });

  it('the "waiting to be taken" list is the party floor\'s only', () => {
    // In general dining an unclaimed order belongs to the guest holding its
    // code; listing them for anyone to take would undo that handoff.
    expect(page).toMatch(/\{surface\.takeFromList && \(/);
    expect(page).toMatch(/enabled: surface\.takeFromList/);
  });

  it('the dish-amending editor is not even loaded where nothing can be amended', () => {
    // Including the menu it needs: a party's dishes were agreed with the host.
    expect(page).toMatch(/enabled: !!restaurantId && surface\.editItems/);
    expect(page).toMatch(/orders\.map\(\(order\) => \(surface\.editItems \?/);
  });

  it('a party\'s card carries no code, no call and no edit', () => {
    const card = page.slice(page.indexOf('function PartyCard'), page.indexOf('function errorMessage'));
    expect(card).not.toContain('order.code');
    expect(card).not.toContain('callPendingAt');
    expect(card).not.toContain('fe_edit_items');
    // What it carries instead: whose evening, when, which tables, how many
    // portions.
    expect(card).toContain('event?.customerName');
    expect(card).toContain("t('fe_portions')");
    expect(card).toContain('floorTables.map');
  });

  it('the party\'s time is the PARTY\'s, in the reader\'s own clock', () => {
    // An order placed last Tuesday for tonight is a tonight order, and printed
    // as UTC a 19:00 party reads as 14:00.
    const card = page.slice(page.indexOf('function PartyCard'), page.indexOf('function errorMessage'));
    expect(card).toContain('new Date(event.eventDate)');
    expect(card).toContain('toLocaleTimeString');
    expect(card).not.toContain('toISOString');
  });

  it('the list says how many orders it is HOLDING BACK', () => {
    // A clean screen that says nothing about what it hides is a screen nobody
    // can trust.
    expect(page).toMatch(/const later = \(pendingQuery\.data\?\.later \?\? 0\) \+ \(ordersQuery\.data\?\.later \?\? 0\)/);
    expect(page).toContain("t('fe_later_hidden', { count: later, hours: Math.round(DUE_LEAD_MINUTES / 60) })");
  });
});

describe('the mode is visible, and switchable', () => {
  it('the look is a token SCOPE, not a forked page', () => {
    // The same mechanism `.svr-theme` and `.cadm-theme` use: ~every primitive
    // follows, and a copy of the page would drift within a release.
    expect(layout).toMatch(/adm-bg \$\{area === 'SMALL_BANQUET' \? SB_FLOOR_CLASS : 'cadm-theme'\}/);
    expect(readFileSync(join(WEB, 'index.css'), 'utf8')).toContain('.sb-floor {');
  });

  it('the header reads its own colours as TOKENS with the dining values as fallback', () => {
    // One set of markup for both floors; a second copy would be a second thing
    // to keep in step.
    expect(layout).toContain("'var(--sbf-header, rgba(10,10,10,0.92))'");
    expect(layout).toContain("'var(--sbf-tab-on, #fff)'");
  });

  it('the switch shows the CURRENT floor as well as the other one', () => {
    // A glance has to answer "where am I?" as well as "where can I go?".
    expect(layout).toMatch(/aria-pressed=\{area === option\}/);
    expect(layout).toMatch(/WORK_AREAS\.map\(\(option\) => \(/);
  });

  it('and is hidden for a role that works no floor', () => {
    expect(layout).toMatch(/\{canSwitch && \(/);
    expect(hook).toMatch(/enabled: !!role && hasWorkArea\(role\)/);
  });

  it('the alert count is not polled where there are no calls', () => {
    // It would be a number that is always zero, asked for every five seconds.
    expect(layout).toMatch(/enabled: !!accessToken && surface\.waiterCalls/);
  });
});

describe('where the floor is read from', () => {
  it('the SERVER, with the session\'s copy only as the first paint', () => {
    // A value cached in the browser would leave a waiter looking at one
    // floor's chrome while the server handed them the other floor's orders.
    expect(hook).toContain('queryFn: () => authService.me()');
    expect(hook).toMatch(/initialData: \{[^}]*workArea: stored/);
    expect(hook).toMatch(/refetchInterval: 60_000/);
  });

  it('switching floors drops every list that was the other floor\'s', () => {
    for (const key of ['wt-orders', 'wt-pending', 'wt-alerts']) {
      expect(hook, key).toContain(`queryKey: ['${key}']`);
    }
  });

  it('one hook serves the layout and the page, so they cannot disagree', () => {
    expect(layout).toContain("from '../utils/useWorkArea'");
    expect(page).toContain("from '../utils/useWorkArea'");
  });
});

describe('a manager can move somebody between floors', () => {
  it('from the user list, and only where the shared rule allows it', () => {
    expect(users).toContain('canSetWorkArea(currentRole, user.role, isSelf)');
    expect(users).toContain('authService.setWorkArea(id, workArea)');
  });

  it('and the server applies that same rule rather than trusting the screen', () => {
    const service = strip(readFileSync(join(WEB, '../../api/src/modules/auth/auth.service.ts'), 'utf8'));
    const fn = service.slice(service.indexOf('async setWorkArea('));
    expect(fn).toContain('canSetWorkArea(caller.role, target.role, caller.id === targetId)');
    // Three refusals, three different facts.
    expect(fn).toMatch(/createHttpError\(400, 'Unknown work area'\)/);
    expect(fn).toMatch(/createHttpError\(404, 'User not found'\)/);
    expect(fn).toMatch(/createHttpError\(400, 'This role does not work a service floor\.'\)/);
    expect(fn).toMatch(/createHttpError\(403/);
  });
});
