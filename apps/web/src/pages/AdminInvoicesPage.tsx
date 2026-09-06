import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { eventService } from '../services/event.service';
import { useAdminStore } from '../store/admin.store';
import { translate } from '../utils/translate';
import { formatSum, groupDigits, parseSumToTiyin } from '../utils/currency';
import { MoneyInput } from '../components/ui/MoneyInput';
import { invoiceOutstandingCents, invoiceTotalCents, isDebt, isFullyPaid, isOverdueDebt, isPendingDebt } from '../utils/invoice';
import type { Event } from '../types/domain';

// 1,000,000 so'm expressed in tiyin (amounts are stored as tiyin = 1/100 so'm).
const MILLION_TIYIN = 100_000_000;
const roundDownToMillion = (tiyin: number) => Math.floor(tiyin / MILLION_TIYIN) * MILLION_TIYIN;

const eventTotalCents = invoiceTotalCents;

const STATUS_BADGE: Record<Event['status'], { bg: string; fg: string; border: string; key: Parameters<typeof translate>[0] }> = {
  DRAFT:     { bg: 'rgba(148,163,184,0.15)', fg: '#cbd5e1', border: 'rgba(148,163,184,0.3)', key: 'status_draft' },
  CONFIRMED: { bg: 'rgba(34,197,94,0.15)',   fg: '#4ade80', border: 'rgba(34,197,94,0.3)',  key: 'status_confirmed' },
  CANCELLED: { bg: 'rgba(220,38,38,0.15)',   fg: '#fca5a5', border: 'rgba(220,38,38,0.3)',  key: 'status_cancelled' },
  COMPLETED: { bg: 'rgba(37,99,235,0.15)',   fg: '#60a5fa', border: 'rgba(37,99,235,0.3)',  key: 'status_completed' },
  MENU_NOT_SELECTED: { bg: 'rgba(245,158,11,0.15)', fg: '#fbbf24', border: 'rgba(245,158,11,0.35)', key: 'status_menu_not_selected' },
};

const formatDate = (iso: string, locale: string) =>
  new Date(iso).toLocaleString(locale === 'ru' ? 'ru-RU' : locale === 'uz' ? 'uz-UZ' : 'en-US', {
    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });

/**
 * `OUTSTANDING` split in two. It showed every non-cancelled invoice with a
 * balance, which lumped a wedding six months out together with a bill that
 * should have been settled a fortnight ago — the same list, no way to tell them
 * apart, and the second is the only one anybody needs to act on.
 *
 * The two are a partition of the DEBTS (an event that has already happened and
 * still owes money — see `isDebt`): `DEBT_OVERDUE` is past its settlement
 * deadline, `DEBT_PENDING` is not, which includes every debt nobody has put a
 * date on. Between them they cover each debt exactly once.
 *
 * Note this deliberately no longer lists a FUTURE event with an unpaid balance:
 * that is a deposit not yet taken, not a debt, and calling it one on a screen
 * labelled "Debt" is how a manager chases a customer who owes nothing yet.
 */
type InvoiceFilter = 'ALL' | 'OPEN' | 'DEBT_OVERDUE' | 'DEBT_PENDING' | 'PAID';

// Month-of-year keys for labelling the month filter (index 0 = January).
const MONTH_KEYS: Parameters<typeof translate>[0][] = [
  'month_january', 'month_february', 'month_march', 'month_april', 'month_may', 'month_june',
  'month_july', 'month_august', 'month_september', 'month_october', 'month_november', 'month_december',
];

// 'YYYY-MM' bucket for an event's date (local time), or null when it has no date.
const eventMonthKey = (iso: string | null | undefined): string | null => {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

export const AdminInvoicesPage = () => {
  const queryClient = useQueryClient();
  const { locale } = useAdminStore();
  const t = (key: Parameters<typeof translate>[0], params?: Record<string, string | number>) =>
    translate(key, locale, params);

  const [filter, setFilter] = useState<InvoiceFilter>('ALL');
  // '' = all months; otherwise a 'YYYY-MM' bucket.
  const [monthFilter, setMonthFilter] = useState<string>('');
  // Round-up is decided per invoice: this holds the event ids that are rounded.
  const [roundedIds, setRoundedIds] = useState<Set<number>>(new Set());
  const toggleRounded = (eventId: number) =>
    setRoundedIds((prev) => {
      const next = new Set(prev);
      if (next.has(eventId)) next.delete(eventId);
      else next.add(eventId);
      return next;
    });

  const eventsQuery = useQuery<Event[]>({ queryKey: ['events'], queryFn: () => eventService.list() });
  const events = eventsQuery.data ?? [];

  const closeMutation = useMutation({
    mutationFn: (eventId: number) => eventService.update(eventId, { status: 'COMPLETED' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['events'] }),
  });

  // Which invoice was someone told they cannot close yet, and why.
  const [closeBlocked, setCloseBlocked] = useState<number | null>(null);

  /**
   * Closing an invoice means the money is in. It used to be a button that set
   * the status and nothing else, so an invoice could be marked settled with the
   * balance still outstanding — and the debt then vanished from every debt
   * filter and from Notifications, because both skip COMPLETED events. The money
   * was still owed; nothing in the system said so any more.
   *
   * The button stays PRESSABLE on an unpaid invoice, deliberately: a disabled
   * control with no explanation is the same dead end, and the person pressing it
   * needs to be told what to do instead.
   */
  const tryClose = (event: Event) => {
    if (!isFullyPaid(event)) { setCloseBlocked(event.id); return; }
    setCloseBlocked(null);
    closeMutation.mutate(event.id);
  };

  // ── Partial payments + debt deadline ──
  // Per-invoice input drafts (amount in so'm / deadline date string).
  const [paymentDrafts, setPaymentDrafts] = useState<Record<number, string>>({});
  const [deadlineDrafts, setDeadlineDrafts] = useState<Record<number, string>>({});

  // Which invoice's payment was refused by the server, and what it said.
  const [payError, setPayError] = useState<{ id: number; message: string } | null>(null);

  const addPaymentMutation = useMutation({
    mutationFn: ({ eventId, amountCents }: { eventId: number; amountCents: number }) =>
      eventService.addPayment(eventId, amountCents),
    onSuccess: (_data, { eventId }) => {
      setPayError(null);
      setPaymentDrafts((prev) => ({ ...prev, [eventId]: '' }));
      queryClient.invalidateQueries({ queryKey: ['events'] });
    },
    // There was NO error handler here, which is why a refused payment looked
    // like a button that did nothing at all — the request 500'd on a column
    // overflow and the page said not a word. A write that fails has to say so.
    onError: (error: unknown, { eventId }) => {
      const response = (error as { response?: { data?: { message?: string } } })?.response;
      setPayError({ id: eventId, message: response?.data?.message || t('payment_failed') });
    },
  });

  const removePaymentMutation = useMutation({
    mutationFn: ({ eventId, paymentId }: { eventId: number; paymentId: string }) =>
      eventService.removePayment(eventId, paymentId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['events'] }),
  });

  const deadlineMutation = useMutation({
    mutationFn: ({ eventId, iso }: { eventId: number; iso: string | null }) =>
      eventService.setDebtDeadline(eventId, iso),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['events'] }),
  });

  // A payment larger than what is left would push the invoice past its total and
  // leave it at a negative balance — money the restaurant appears to owe the
  // customer, arrived at by a typo. Refused here AND in the API, because this
  // page is not the only thing that can call that endpoint.
  const [payTooMuch, setPayTooMuch] = useState<number | null>(null);

  const submitPayment = (event: Event) => {
    const amountCents = parseSumToTiyin(paymentDrafts[event.id] ?? '');
    if (!amountCents || amountCents <= 0 || addPaymentMutation.isPending) return;
    if (amountCents > invoiceOutstandingCents(event)) { setPayTooMuch(event.id); return; }
    setPayTooMuch(null);
    setPayError(null);
    addPaymentMutation.mutate({ eventId: event.id, amountCents });
  };

  const saveDeadline = (event: Event) => {
    const draft = deadlineDrafts[event.id];
    if (draft === undefined || deadlineMutation.isPending) return;
    // End of the chosen day, local time — the debt is overdue after this moment.
    const iso = draft ? new Date(`${draft}T23:59:59`).toISOString() : null;
    deadlineMutation.mutate({ eventId: event.id, iso });
  };

  // Distinct months present in the data, newest first, for the month dropdown.
  const availableMonths = useMemo(() => {
    const set = new Set<string>();
    for (const e of events) {
      const key = eventMonthKey(e.eventDate);
      if (key) set.add(key);
    }
    return [...set].sort().reverse();
  }, [events]);

  const monthLabel = (ym: string) => {
    const [y, m] = ym.split('-').map(Number);
    return `${t(MONTH_KEYS[m - 1])} ${y}`;
  };

  const visibleEvents = useMemo(() => {
    let list = events;
    if (monthFilter) list = list.filter((e) => eventMonthKey(e.eventDate) === monthFilter);
    if (filter === 'OPEN') return list.filter((e) => e.status !== 'COMPLETED' && e.status !== 'CANCELLED');
    if (filter === 'PAID') return list.filter((e) => e.status === 'COMPLETED');
    if (filter === 'DEBT_OVERDUE') return list.filter((e) => isOverdueDebt(e));
    if (filter === 'DEBT_PENDING') return list.filter((e) => isPendingDebt(e));
    return list;
  }, [events, filter, monthFilter]);

  const filters: { id: InvoiceFilter; label: string }[] = [
    { id: 'ALL', label: t('filter_all') },
    { id: 'OPEN', label: t('invoices_open') },
    { id: 'DEBT_OVERDUE', label: t('invoices_debt') },
    { id: 'DEBT_PENDING', label: t('invoices_debt_pending') },
    { id: 'PAID', label: t('invoices_paid') },
  ];

  return (
    <main className="tablet-fade-in" style={{ maxWidth: 1100, margin: '0 auto', padding: '28px 20px', position: 'relative', zIndex: 1 }}>
      <h1 className="adm-title" style={{ marginBottom: 6 }}>{t('invoices')}</h1>
      <p style={{ color: 'rgba(226,232,240,0.55)', fontSize: 13, marginBottom: 20, marginTop: 0 }}>
        {visibleEvents.length} {visibleEvents.length === 1 ? t('invoice_one') : t('invoice_many')}
      </p>

      {/* Controls: status filter + month filter */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap', marginBottom: 20 }}>
        {filters.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            className="adm-badge"
            style={{
              cursor: 'pointer', padding: '6px 14px', fontSize: 13, fontWeight: 600,
              background: filter === f.id ? 'rgba(var(--adm-accent-rgb),0.15)' : 'rgba(255,255,255,0.04)',
              color: filter === f.id ? 'var(--adm-accent)' : 'rgba(226,232,240,0.7)',
              border: `1px solid ${filter === f.id ? 'rgba(var(--adm-accent-rgb),0.4)' : 'rgba(255,255,255,0.1)'}`,
            }}
          >
            {f.label}
          </button>
        ))}
        <select
          value={monthFilter}
          onChange={(e) => setMonthFilter(e.target.value)}
          className="adm-input"
          style={{
            marginLeft: 'auto', padding: '6px 12px', fontSize: 13, fontWeight: 600,
            borderRadius: 999, cursor: 'pointer',
            background: monthFilter ? 'rgba(var(--adm-accent-rgb),0.15)' : 'rgba(255,255,255,0.04)',
            color: monthFilter ? 'var(--adm-accent)' : 'rgba(226,232,240,0.7)',
            border: `1px solid ${monthFilter ? 'rgba(var(--adm-accent-rgb),0.4)' : 'rgba(255,255,255,0.1)'}`,
            colorScheme: 'dark',
          }}
        >
          <option value="">{t('all_months')}</option>
          {availableMonths.map((ym) => (
            <option key={ym} value={ym}>{monthLabel(ym)}</option>
          ))}
        </select>
      </div>

      {eventsQuery.isLoading && <p style={{ color: 'rgba(226,232,240,0.55)' }}>{t('loading_events')}</p>}
      {eventsQuery.isError && <p style={{ color: '#fca5a5' }}>{t('failed_load_events')}</p>}

      <div style={{ display: 'grid', gap: 14 }}>
        {visibleEvents.map((event, idx) => {
          const status = STATUS_BADGE[event.status];
          const tableRate = (event.tableCategory?.ratePerPerson ?? 0) * event.guestCount;
          const dishes = (event.selections ?? []).reduce((sum, s) => sum + s.quantity * s.unitPriceCents, 0);
          const exactTotal = eventTotalCents(event);
          const rounded = roundedIds.has(event.id);
          const shownTotal = rounded ? roundDownToMillion(exactTotal) : exactTotal;
          const isRounded = rounded && shownTotal !== exactTotal;
          // Everything paid so far: the deposit plus recorded partial payments.
          const deposit = event.depositCents ?? 0;
          const payments = event.payments ?? [];
          const paymentsSum = payments.reduce((s, p) => s + p.amountCents, 0);
          const amountDue = Math.max(0, shownTotal - deposit - paymentsSum);
          // Debt: the event has started but the invoice still isn't settled.
          // `isDebt` now carries the COMPLETED exclusion this line used to add
          // on its own — which is exactly why the two disagreed.
          const debt = isDebt(event);
          const deadlineDraft = deadlineDrafts[event.id] ?? (event.debtDeadline ? event.debtDeadline.slice(0, 10) : '');
          const overdue = debt && !!event.debtDeadline && new Date(event.debtDeadline).getTime() < Date.now();
          const isPaid = event.status === 'COMPLETED';
          const isCancelled = event.status === 'CANCELLED';

          return (
            <div key={event.id} className="adm-card adm-card-hover tablet-fade-up" style={{ padding: 20, animationDelay: `${idx * 50}ms` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
                <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#f8fafc' }}>
                  <span style={{ color: 'var(--adm-accent)' }}>#{event.id}</span> — {event.customerName}
                </h2>
                <span className="adm-badge" style={{ background: status.bg, color: status.fg, border: `1px solid ${status.border}` }}>
                  {t(status.key)}
                </span>
                {debt && (
                  <span className="adm-badge" style={{
                    background: overdue ? 'rgba(220,38,38,0.25)' : 'rgba(220,38,38,0.12)',
                    color: '#fca5a5',
                    border: `1px solid ${overdue ? 'rgba(220,38,38,0.6)' : 'rgba(220,38,38,0.35)'}`,
                    fontWeight: 700,
                  }}>
                    {overdue ? `⚠ ${t('debt_overdue')}` : t('debt')}
                  </span>
                )}
                <span style={{ marginLeft: 'auto', fontSize: 12, color: 'rgba(226,232,240,0.5)' }}>
                  {formatDate(event.eventDate, locale)}
                </span>
              </div>

              {/* Breakdown + total */}
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 12, display: 'grid', gap: 6 }}>
                <Row label={`${t('table_package')}${event.tableCategory ? ` — ${event.tableCategory.name}` : ''} (${event.guestCount} × ${formatSum(event.tableCategory?.ratePerPerson ?? 0)})`} value={formatSum(tableRate)} muted />
                <Row label={`${t('additional_dishes')} (${(event.selections ?? []).length})`} value={formatSum(dishes)} muted />

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 8, marginTop: 2 }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: '#e2e8f0' }}>{t('billable_total')}</span>
                  <span style={{ textAlign: 'right' }}>
                    {isRounded && (
                      <span style={{ fontSize: 12, color: 'rgba(226,232,240,0.45)', textDecoration: 'line-through', marginRight: 8 }}>
                        {formatSum(exactTotal)}
                      </span>
                    )}
                    <span style={{ fontSize: 17, fontWeight: 800, color: 'var(--adm-accent)' }}>{formatSum(shownTotal)}</span>
                    {isRounded && (
                      <span style={{ display: 'block', fontSize: 11, color: 'rgba(226,232,240,0.45)', marginTop: 2 }}>
                        {t('rounded_to_million')}
                      </span>
                    )}
                  </span>
                </div>

                {/* Deposit + recorded partial payments */}
                {deposit > 0 && <Row label={t('deposit')} value={`−${formatSum(deposit)}`} muted />}
                {payments.map((p) => (
                  <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, fontSize: 13 }}>
                    <span style={{ color: 'rgba(226,232,240,0.6)' }}>
                      {t('payment')} · {formatDate(p.createdAt, locale)}
                    </span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap' }}>
                      <span style={{ color: 'rgba(226,232,240,0.75)', fontWeight: 600 }}>−{formatSum(p.amountCents)}</span>
                      {!isCancelled && (
                        <button
                          type="button"
                          onClick={() => removePaymentMutation.mutate({ eventId: event.id, paymentId: p.id })}
                          disabled={removePaymentMutation.isPending}
                          title={t('delete')}
                          style={{
                            width: 20, height: 20, borderRadius: 6, cursor: 'pointer', lineHeight: 1,
                            background: 'rgba(220,38,38,0.12)', color: '#fca5a5',
                            border: '1px solid rgba(220,38,38,0.3)', fontSize: 12, padding: 0,
                          }}
                        >×</button>
                      )}
                    </span>
                  </div>
                ))}

                {/* Amount still due after deposit + installments */}
                {(deposit > 0 || payments.length > 0) && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 8, marginTop: 2 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: '#e2e8f0' }}>{t('amount_due')}</span>
                    <span style={{ fontSize: 17, fontWeight: 800, color: amountDue === 0 ? '#4ade80' : debt ? '#fca5a5' : '#e2e8f0' }}>
                      {formatSum(amountDue)}
                    </span>
                  </div>
                )}

                {/* Record a new partial payment */}
                {!isCancelled && !isPaid && amountDue > 0 && (
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginTop: 4 }}>
                    <MoneyInput
                      className=""
                      placeholder={t('payment_amount')}
                      value={paymentDrafts[event.id] ?? ''}
                      onChange={(next) => setPaymentDrafts((prev) => ({ ...prev, [event.id]: next }))}
                      onKeyDown={(e) => { if (e.key === 'Enter') submitPayment(event); }}
                      style={{
                        width: 170, padding: '7px 10px', borderRadius: 8, fontSize: 13,
                        background: 'rgba(255,255,255,0.05)', color: '#e2e8f0',
                        border: '1px solid rgba(255,255,255,0.12)', outline: 'none',
                      }}
                    />
                    <span style={{ fontSize: 12, color: 'rgba(226,232,240,0.5)' }}>so'm</span>
                    <button
                      type="button"
                      className="adm-btn-ghost"
                      onClick={() => submitPayment(event)}
                      disabled={addPaymentMutation.isPending || !(parseSumToTiyin(paymentDrafts[event.id] ?? '') ?? 0)}
                      style={{ fontSize: 13 }}
                    >
                      + {t('add_payment')}
                    </button>
                    {/* Settling the invoice is the commonest payment there is, and
                        it is the exact figure printed two lines above — so it is
                        one press rather than a number to copy by hand. */}
                    <button
                      type="button"
                      className="adm-btn-ghost"
                      onClick={() => {
                        setPayTooMuch(null);
                        setPaymentDrafts((prev) => ({ ...prev, [event.id]: groupDigits(String(Math.round(amountDue / 100))) }));
                      }}
                      style={{ fontSize: 13 }}
                    >
                      {t('pay_the_rest', { amount: formatSum(amountDue) })}
                    </button>
                  </div>
                )}

                {payError?.id === event.id && (
                  <p style={{
                    margin: '8px 0 0', padding: '9px 12px', borderRadius: 10,
                    fontSize: 13, fontWeight: 600, color: '#fca5a5',
                    background: 'rgba(220,38,38,0.1)', border: '1px solid rgba(220,38,38,0.35)',
                  }}>
                    {payError.message}
                  </p>
                )}

                {payTooMuch === event.id && (
                  <p style={{
                    margin: '8px 0 0', padding: '9px 12px', borderRadius: 10,
                    fontSize: 13, fontWeight: 600, color: '#fca5a5',
                    background: 'rgba(220,38,38,0.1)', border: '1px solid rgba(220,38,38,0.35)',
                  }}>
                    {t('payment_exceeds_balance', { amount: formatSum(amountDue) })}
                  </p>
                )}

                {/* Debt: settlement deadline set by the administrator */}
                {debt && (
                  <div style={{
                    marginTop: 6, padding: '10px 12px', borderRadius: 10,
                    background: overdue ? 'rgba(220,38,38,0.10)' : 'rgba(245,158,11,0.08)',
                    border: `1px solid ${overdue ? 'rgba(220,38,38,0.4)' : 'rgba(245,158,11,0.3)'}`,
                    display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap',
                  }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: overdue ? '#fca5a5' : '#fbbf24' }}>
                      {overdue
                        ? t('debt_overdue_notice', { amount: formatSum(amountDue) })
                        : t('debt_deadline')}
                    </span>
                    <input
                      type="date"
                      value={deadlineDraft}
                      onChange={(e) => setDeadlineDrafts((prev) => ({ ...prev, [event.id]: e.target.value }))}
                      style={{
                        padding: '6px 10px', borderRadius: 8, fontSize: 13,
                        background: 'rgba(255,255,255,0.05)', color: '#e2e8f0',
                        border: '1px solid rgba(255,255,255,0.12)', outline: 'none', colorScheme: 'dark',
                      }}
                    />
                    <button
                      type="button"
                      className="adm-btn-ghost"
                      onClick={() => saveDeadline(event)}
                      disabled={deadlineMutation.isPending || deadlineDrafts[event.id] === undefined}
                      style={{ fontSize: 13 }}
                    >
                      {deadlineMutation.isPending ? t('updating') : t('save')}
                    </button>
                  </div>
                )}
              </div>

              {/* Action */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'space-between', flexWrap: 'wrap', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 14, marginTop: 12 }}>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'rgba(226,232,240,0.85)', cursor: 'pointer', userSelect: 'none' }}>
                  <input type="checkbox" checked={rounded} onChange={() => toggleRounded(event.id)} style={{ accentColor: 'var(--adm-accent)', width: 16, height: 16 }} />
                  {t('round_up_to_million')}
                </label>
                {isCancelled ? (
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'rgba(226,232,240,0.4)' }}>—</span>
                ) : isPaid ? (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, color: '#60a5fa' }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                    {t('invoice_closed')}
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => tryClose(event)}
                    disabled={closeMutation.isPending && closeMutation.variables === event.id}
                    className="adm-btn-primary"
                    style={{ fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 6 }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                    {closeMutation.isPending && closeMutation.variables === event.id ? t('closing') : t('close_invoice')}
                  </button>
                )}
              </div>

              {/* Says what is missing and how much, rather than only refusing. */}
              {closeBlocked === event.id && !isPaid && !isCancelled && (
                <p style={{
                  margin: '10px 0 0', padding: '9px 12px', borderRadius: 10,
                  fontSize: 13, fontWeight: 600, color: '#fca5a5',
                  background: 'rgba(220,38,38,0.1)', border: '1px solid rgba(220,38,38,0.35)',
                }}>
                  {t('close_needs_full_payment', { amount: formatSum(amountDue) })}
                </p>
              )}
            </div>
          );
        })}

        {!eventsQuery.isLoading && visibleEvents.length === 0 && (
          <p className="adm-empty">{t('no_invoices')}</p>
        )}
      </div>
    </main>
  );
};

const Row = ({ label, value, muted }: { label: string; value: string; muted?: boolean }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 13 }}>
    <span style={{ color: muted ? 'rgba(226,232,240,0.6)' : '#e2e8f0' }}>{label}</span>
    <span style={{ color: muted ? 'rgba(226,232,240,0.75)' : '#e2e8f0', fontWeight: 600, whiteSpace: 'nowrap' }}>{value}</span>
  </div>
);
