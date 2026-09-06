import type { Event } from '../types/domain';

// ── Shared invoice math ─────────────────────────────────────────────────────
// Used by the Invoices page and the debt notifications so both always agree.

/** Total billable price of an event: table package (rate × guests) + dishes. */
export function invoiceTotalCents(event: Event): number {
  const tableRate = (event.tableCategory?.ratePerPerson ?? 0) * event.guestCount;
  const dishes = (event.selections ?? []).reduce((sum, s) => sum + s.quantity * s.unitPriceCents, 0);
  return tableRate + dishes;
}

/** Everything already paid: the deposit plus all partial payments. */
export function invoicePaidCents(event: Event): number {
  const deposit = event.depositCents ?? 0;
  const payments = (event.payments ?? []).reduce((sum, p) => sum + p.amountCents, 0);
  return deposit + payments;
}

/** Remaining balance (never negative). */
export function invoiceOutstandingCents(event: Event): number {
  return Math.max(0, invoiceTotalCents(event) - invoicePaidCents(event));
}

/**
 * The event has happened and its invoice is still short.
 *
 * A **closed** invoice is not a debt, whatever its arithmetic says. Closing now
 * requires the money to be in (`isFullyPaid`), but invoices closed before that
 * rule existed can still carry a stale balance, and those were turning up under
 * both debt filters and on the Notifications page. The Invoices page had always
 * excluded them from its own row badge; the rule belongs here, once, so every
 * caller agrees.
 *
 * Cancelled is excluded for the plainer reason that nobody owes for an event
 * that did not happen.
 */
export function isDebt(event: Event, now: Date = new Date()): boolean {
  if (event.status === 'CANCELLED' || event.status === 'COMPLETED') return false;
  return new Date(event.eventDate).getTime() <= now.getTime() && invoiceOutstandingCents(event) > 0;
}

/** Debt whose admin-set settlement deadline has passed → surfaces as a notification. */
export function isOverdueDebt(event: Event, now: Date = new Date()): boolean {
  if (!isDebt(event, now)) return false;
  if (!event.debtDeadline) return false;
  return new Date(event.debtDeadline).getTime() < now.getTime();
}

/**
 * A debt that is not late yet: the deadline is still ahead, or nobody set one.
 *
 * **No deadline counts as not-yet-due, not as overdue.** A debt nobody has put a
 * date on is money still owed, and it used to appear nowhere at all — it was
 * invisible to the Notifications page, which asks only for overdue ones, and it
 * cannot become overdue on its own because `isOverdueDebt` needs a date to
 * compare. Those are the debts most likely to be forgotten, which is exactly why
 * they belong on the same screen.
 *
 * Together with `isOverdueDebt` this partitions the debts: every debt is one or
 * the other, and never both.
 */
export function isPendingDebt(event: Event, now: Date = new Date()): boolean {
  if (!isDebt(event, now)) return false;
  return !isOverdueDebt(event, now);
}

/** All events with a past-due, unpaid debt (for the Notifications page/bell). */
export function overdueDebtEvents(events: Event[], now: Date = new Date()): Event[] {
  return events.filter((e) => isOverdueDebt(e, now));
}

/** Debts still within their deadline, or with none set (Notifications page). */
export function pendingDebtEvents(events: Event[], now: Date = new Date()): Event[] {
  return events.filter((e) => isPendingDebt(e, now));
}

/**
 * Is the invoice settled in full?
 *
 * An invoice is closed when the money is in, not when someone says so. The
 * deposit and every partial payment count towards it — see `invoicePaidCents`.
 */
export function isFullyPaid(event: Event): boolean {
  return invoiceOutstandingCents(event) === 0;
}
