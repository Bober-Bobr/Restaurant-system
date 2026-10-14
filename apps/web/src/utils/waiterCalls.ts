/**
 * "Table 7 is calling the waiter!"
 *
 * A guest pressing "call waiter" sets `callPendingAt` on their order, and until
 * now the only thing that said so was a small count on the Orders tab. A waiter
 * crossing a dining room is not reading a badge: the call has to reach them
 * wherever they are in the app, name the table, and make a noise.
 *
 * This is the pure half — which orders are calling, which of those are NEW
 * since the last look, and how long somebody has been waiting. The impure half
 * (the banner, the sound, the vibration) is `components/WaiterCallBanner.tsx`.
 */

export type CallingOrder = {
  id: string;
  tableNumber: string | null;
  callPendingAt: string | null;
};

/**
 * The orders waiting on a waiter, **oldest call first**.
 *
 * Oldest first because that is the one to go to: a queue that puts the newest
 * call at the top sends somebody to the table that has been waiting the least.
 * An order whose `callPendingAt` cannot be read keeps its place at the END
 * rather than being dropped — a call nobody can see is the failure this exists
 * to prevent, and an unreadable timestamp is still a guest with their hand up.
 */
export function callingOrders<T extends CallingOrder>(orders: readonly T[]): T[] {
  const calling = orders.filter((order) => !!order.callPendingAt);
  return [...calling].sort((a, b) => {
    const at = Date.parse(a.callPendingAt ?? '');
    const bt = Date.parse(b.callPendingAt ?? '');
    if (Number.isNaN(at) && Number.isNaN(bt)) return 0;
    if (Number.isNaN(at)) return 1;
    if (Number.isNaN(bt)) return -1;
    return at - bt;
  });
}

/**
 * Which calls have not been announced yet.
 *
 * Keyed on the ORDER id and not on the timestamp: a guest who presses the
 * button twice does not get two announcements (the server is idempotent and
 * does not reset the clock either), and a poll that re-delivers the same call
 * every six seconds must not sound the alert every six seconds.
 *
 * The identity is the id ALONE, so a call that is acknowledged and then raised
 * again by the same table does sound again — `callPendingAt` is cleared on
 * acknowledgement, which takes the order out of `calling` and therefore out of
 * the announced set (see `prune`).
 */
export function newCalls<T extends CallingOrder>(calling: readonly T[], announced: ReadonlySet<string>): T[] {
  return calling.filter((order) => !announced.has(order.id));
}

/**
 * The announced set, with anything no longer calling forgotten.
 *
 * Without this the set grows for the whole shift and, worse, a table that
 * called, was served, and called again would never be announced a second time.
 */
export function prune(announced: ReadonlySet<string>, calling: readonly CallingOrder[]): Set<string> {
  const live = new Set(calling.map((order) => order.id));
  return new Set([...announced].filter((id) => live.has(id)));
}

/** How long this table has been waiting, in whole minutes, never negative. */
export function waitedMinutes(order: CallingOrder, now: number = Date.now()): number {
  const at = Date.parse(order.callPendingAt ?? '');
  if (Number.isNaN(at)) return 0;
  return Math.max(0, Math.round((now - at) / 60_000));
}

/**
 * What the table is called on the banner.
 *
 * An order claimed without a table number is possible only from a stale client
 * (the claim refuses a blank one), and "Table — is calling" would read as a
 * bug. The fallback is the order's own code, which the waiter typed.
 */
export function tableLabel(order: CallingOrder & { code?: string }): string {
  const table = order.tableNumber?.trim();
  if (table) return table;
  return order.code?.trim() || '—';
}
