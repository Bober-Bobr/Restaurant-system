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

/** The event has started (or passed) and still has an outstanding balance. */
export function isDebt(event: Event, now: Date = new Date()): boolean {
  if (event.status === 'CANCELLED') return false;
  return new Date(event.eventDate).getTime() <= now.getTime() && invoiceOutstandingCents(event) > 0;
}

/** Debt whose admin-set settlement deadline has passed → surfaces as a notification. */
export function isOverdueDebt(event: Event, now: Date = new Date()): boolean {
  if (!isDebt(event, now)) return false;
  if (!event.debtDeadline) return false;
  return new Date(event.debtDeadline).getTime() < now.getTime();
}

/** All events with a past-due, unpaid debt (for the Notifications page/bell). */
export function overdueDebtEvents(events: Event[], now: Date = new Date()): Event[] {
  return events.filter((e) => isOverdueDebt(e, now));
}
