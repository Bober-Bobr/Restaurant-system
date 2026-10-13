/**
 * Which FLOOR a member of staff is working, and which orders belong to it.
 *
 * The food-service product and the Small Banquets section both put orders in
 * front of the same two roles — a waiter (`CATERING_EMPLOYEE`) and the Food
 * Admin (`CATERING_ADMIN`) — and the two jobs are not the same job. General
 * dining is a guest at a table ordering for themselves; a small banquet is a
 * party whose host chose the food in advance, with no guest device in it at
 * all. So a member of staff is in ONE work area at a time, and sees only that
 * area's orders.
 *
 * **It is a stored choice, not a per-browser one** (`AdminUser.workArea`): it
 * is the floor somebody is standing on, their manager may set it for them when
 * the rota changes, and a preference that lived in a browser would send the
 * waiter who picked up a different phone back to the wrong floor.
 *
 * **It is NOT `Section` and not `MenuScope`.** A section says whose halls and
 * bookings a row belongs to (BANQUET | SMALL_BANQUET); a scope says which
 * product is reading the shared dish table. This says which stream of orders a
 * person is serving, and its two values straddle both: 'DINING' is the catering
 * scope with no section, 'SMALL_BANQUET' is the section's own dining service.
 * Merging any two of the three would make one column answer questions it
 * cannot.
 *
 * The rule exists twice — here and in `apps/web/src/utils/workArea.ts`, because
 * the API cannot import from the web app — and `workAreaAgreement.test.ts`
 * imports BOTH and runs every role and every surface through each.
 */

export const WORK_AREAS = ['DINING', 'SMALL_BANQUET'] as const;
export type WorkArea = (typeof WORK_AREAS)[number];

/**
 * What a member of staff gets if nobody has chosen.
 *
 * General dining, because that is the product these roles were created for and
 * every account that exists today is working it. A deploy must not move
 * somebody to another floor.
 */
export const DEFAULT_WORK_AREA: WorkArea = 'DINING';

export const isWorkArea = (value: unknown): value is WorkArea =>
  typeof value === 'string' && (WORK_AREAS as readonly string[]).includes(value);

/** A stored value, read defensively: the column is a plain String. */
export const workAreaOf = (value: unknown): WorkArea => (isWorkArea(value) ? value : DEFAULT_WORK_AREA);

/**
 * The roles that stand on a floor, and so have a work area at all.
 *
 * A POSITIVE list, like `kioskSessionsFor` and the kiosk's own role gate: a
 * role added to the orders router later must not silently acquire a floor
 * setting nobody designed for it.
 */
export const FLOOR_ROLES = ['CATERING_EMPLOYEE', 'CATERING_ADMIN'] as const;

export const hasWorkArea = (role: string): boolean => (FLOOR_ROLES as readonly string[]).includes(role);

/**
 * Who may set SOMEBODY ELSE'S work area.
 *
 * The same people who may create the account in the first place — the platform
 * Chief Admin, the restaurant's Owner and the restaurant's Food Admin (see
 * `canManageFoodEmployees`) — because moving a waiter between floors is part of
 * running the rota, not a privilege of its own. A banquet ADMIN manages neither
 * role and is not here.
 *
 * Everyone with a work area may always set their OWN; that is the switch in the
 * header, and it is what makes the mode usable at all.
 */
const WORK_AREA_MANAGERS: readonly string[] = ['CHIEF_ADMIN', 'OWNER', 'CATERING_ADMIN'];

export function canSetWorkArea(actorRole: string, targetRole: string, isSelf: boolean): boolean {
  if (!hasWorkArea(targetRole)) return false;
  if (isSelf) return hasWorkArea(actorRole);
  return WORK_AREA_MANAGERS.includes(actorRole);
}

/**
 * What the work area MEANS on the floor screens — one decision, five
 * consequences, stated once.
 *
 * Written as a table for the reason `kioskSurface` is: these are not five
 * independent switches that happen to agree, they are five readings of "does
 * the guest hold this order?". In general dining they do — they built the cart,
 * they are holding a code, and they press "call waiter". In a small banquet the
 * host ordered in advance through the supervisor and there is no guest device
 * to call from or to check a dish against, so each of these would be a control
 * that cannot work.
 */
export type WorkAreaSurface = {
  /** Take an order by the 3-character code a guest is holding up. */
  claimByCode: boolean;
  /** Take an order straight off the list — it is already on the screen. */
  takeFromList: boolean;
  /** "Call waiter" alerts, and acknowledging them. */
  waiterCalls: boolean;
  /** Amending the dishes on an open order. */
  editItems: boolean;
  /** Hide orders whose party is still hours away. */
  hideUntilDue: boolean;
};

const SURFACES: Record<WorkArea, WorkAreaSurface> = {
  DINING: { claimByCode: true, takeFromList: false, waiterCalls: true, editItems: true, hideUntilDue: false },
  SMALL_BANQUET: { claimByCode: false, takeFromList: true, waiterCalls: false, editItems: false, hideUntilDue: true },
};

export const workAreaSurface = (area: WorkArea): WorkAreaSurface => SURFACES[workAreaOf(area)];

/**
 * How far ahead of the party a small banquet's order appears on the floor.
 *
 * A venue takes bookings weeks out, and all of them at once at the top of a
 * waiter's list is a screen nobody can work from — the order they need now
 * would be the twentieth row. Two hours is the span in which a party is
 * actually being prepared for.
 *
 * It is a LEAD TIME, not a filter on "today": an order for 19:00 is of no use
 * at 09:00, and one for 00:30 is of every use at 23:00 — which a day boundary
 * would hide.
 */
export const DUE_LEAD_MINUTES = 120;

/**
 * Whether an order for a party at `serveAt` belongs on the floor list now.
 *
 * An order with no time at all is ALWAYS due: it is a general-dining order, or
 * a small-banquet one whose booking has lost its date, and an order nobody can
 * see is worse than an early one.
 *
 * Nothing is hidden once the party has started, however long ago — the evening
 * is still being served, and an order that vanished at 21:00 because the
 * booking said 19:00 would be a party with no food and no record of why.
 */
export function isDueNow(serveAt: Date | string | null | undefined, now: Date, leadMinutes = DUE_LEAD_MINUTES): boolean {
  if (serveAt == null) return true;
  const at = serveAt instanceof Date ? serveAt : new Date(serveAt);
  if (Number.isNaN(at.getTime())) return true;
  return at.getTime() - now.getTime() <= leadMinutes * 60_000;
}
