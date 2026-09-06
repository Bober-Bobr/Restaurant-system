import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Event } from '../types/domain';
import {
  invoiceOutstandingCents, isDebt, isFullyPaid, isOverdueDebt, isPendingDebt,
  overdueDebtEvents, pendingDebtEvents,
} from './invoice';

/**
 * Which invoices are debts, which of those are late, and when one may be closed.
 *
 * The three used to be one loose idea. "With outstanding balance" listed a
 * wedding six months out beside a bill overdue by a fortnight; a debt nobody had
 * put a date on appeared on no screen at all; and "close invoice" was a button
 * that set a status, so an invoice could be marked settled with the money still
 * owed — after which it vanished from every debt view, because they all skip
 * COMPLETED events.
 */
const SRC = join(__dirname, '..');
const read = (rel: string) => readFileSync(join(SRC, rel), 'utf8');

const NOW = new Date('2026-06-15T12:00:00.000Z');
const day = (iso: string) => new Date(iso).toISOString();

const event = (over: Partial<Event> = {}): Event => ({
  id: 1,
  customerName: 'Aziz',
  eventDate: day('2026-06-01T18:00:00.000Z'),   // already happened
  guestCount: 100,
  status: 'CONFIRMED',
  depositCents: 0,
  payments: [],
  selections: [],
  tableCategory: { id: 'tc', name: 'Standart', ratePerPerson: 1000_00, isActive: true } as never,
  ...over,
} as Event);

describe('what counts as a debt', () => {
  it('an event that has happened and still owes money', () => {
    expect(isDebt(event(), NOW)).toBe(true);
  });

  it('not an event still in the future', () => {
    // That is a deposit not yet taken. Chasing it as a debt would have a manager
    // ringing a customer who owes nothing yet.
    expect(isDebt(event({ eventDate: day('2026-08-01T18:00:00.000Z') }), NOW)).toBe(false);
  });

  it('not a cancelled one, and not a settled one', () => {
    expect(isDebt(event({ status: 'CANCELLED' }), NOW)).toBe(false);
    expect(isDebt(event({ depositCents: 100_000_00 }), NOW)).toBe(false);
  });
});

describe('overdue and not-yet-overdue split the debts exactly once', () => {
  const overdue = event({ debtDeadline: day('2026-06-10T00:00:00.000Z') });
  const future = event({ debtDeadline: day('2026-07-10T00:00:00.000Z') });
  const undated = event({ debtDeadline: null });

  it('a deadline in the past is overdue', () => {
    expect(isOverdueDebt(overdue, NOW)).toBe(true);
    expect(isPendingDebt(overdue, NOW)).toBe(false);
  });

  it('a deadline still ahead is not', () => {
    expect(isPendingDebt(future, NOW)).toBe(true);
    expect(isOverdueDebt(future, NOW)).toBe(false);
  });

  it('NO deadline counts as not-yet-overdue, not as overdue', () => {
    // It is money owed, and it can never become overdue on its own — there is no
    // date to compare — so without this it appeared on no screen at all. Those
    // are the debts most likely to be forgotten.
    expect(isPendingDebt(undated, NOW)).toBe(true);
    expect(isOverdueDebt(undated, NOW)).toBe(false);
  });

  it('every debt lands in exactly one of the two', () => {
    for (const e of [overdue, future, undated]) {
      expect(Number(isOverdueDebt(e, NOW)) + Number(isPendingDebt(e, NOW)), String(e.debtDeadline)).toBe(1);
    }
    // …and something that is not a debt lands in neither.
    const notADebt = event({ eventDate: day('2026-08-01T18:00:00.000Z') });
    expect(isOverdueDebt(notADebt, NOW) || isPendingDebt(notADebt, NOW)).toBe(false);
  });

  it('the list helpers agree with the predicates', () => {
    const all = [overdue, future, undated];
    expect(overdueDebtEvents(all, NOW)).toEqual([overdue]);
    expect(pendingDebtEvents(all, NOW)).toEqual([future, undated]);
  });
});

describe('an invoice is closed when the money is in', () => {
  it('not while anything is outstanding', () => {
    expect(isFullyPaid(event())).toBe(false);
  });

  it('the deposit and the instalments both count towards it', () => {
    const total = invoiceOutstandingCents(event());
    expect(isFullyPaid(event({ depositCents: total }))).toBe(true);
    expect(isFullyPaid(event({
      depositCents: Math.floor(total / 2),
      payments: [{ id: 'p', amountCents: Math.ceil(total / 2), createdAt: '' }] as never,
    }))).toBe(true);
  });

  it('overpaying still counts as paid, not as a negative balance', () => {
    expect(isFullyPaid(event({ depositCents: 999_999_00 }))).toBe(true);
  });
});

describe('the pages use those rules', () => {
  const invoices = read('pages/AdminInvoicesPage.tsx');

  it('the outstanding filter is gone, replaced by the two', () => {
    expect(invoices).not.toContain("'OUTSTANDING'");
    expect(invoices).toContain("if (filter === 'DEBT_OVERDUE') return list.filter((e) => isOverdueDebt(e));");
    expect(invoices).toContain("if (filter === 'DEBT_PENDING') return list.filter((e) => isPendingDebt(e));");
  });

  it('both are offered as buttons, with their own labels', () => {
    expect(invoices).toContain("{ id: 'DEBT_OVERDUE', label: t('invoices_debt') }");
    expect(invoices).toContain("{ id: 'DEBT_PENDING', label: t('invoices_debt_pending') }");
  });

  it('closing is refused, with a message, until the invoice is paid', () => {
    // The button stays pressable: a disabled control with no explanation is the
    // same dead end, and the person pressing it needs to know what to do.
    expect(invoices).toContain('if (!isFullyPaid(event)) { setCloseBlocked(event.id); return; }');
    expect(invoices).toContain("t('close_needs_full_payment', { amount: formatSum(amountDue) })");
    expect(invoices).toContain('onClick={() => tryClose(event)}');
    expect(invoices, 'the raw mutation is still wired to the button')
      .not.toContain('onClick={() => closeMutation.mutate(event.id)}');
  });

  it('the notifications page shows both groups', () => {
    const page = read('pages/AdminNotificationsPage.tsx');
    expect(page).toContain('pendingDebtEvents(');
    expect(page).toContain("t('debts_pending_heading')");
    // An absent deadline is stated rather than shown as a dash — it is the
    // reason the debt was invisible until now.
    expect(page).toContain("t('debt_no_deadline')");
    // The empty state only appears when BOTH groups are empty.
    expect(page).toContain('overdue.length === 0 && pending.length === 0');
  });

  it('every new label is translated in all three locales', () => {
    const translations = read('utils/translate.ts');
    for (const key of ['invoices_debt', 'invoices_debt_pending', 'close_needs_full_payment',
                       'debts_pending_heading', 'debt_pending_notice', 'debt_no_deadline', 'debt_due_on']) {
      expect((translations.match(new RegExp(`\\b${key}:`, 'g')) ?? []).length, key).toBe(3);
    }
  });
});
