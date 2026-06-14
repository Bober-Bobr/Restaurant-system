import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { eventService } from '../services/event.service';
import { useAdminStore } from '../store/admin.store';
import { translate } from '../utils/translate';
import { formatSum } from '../utils/currency';
import type { Event } from '../types/domain';

// 1,000,000 so'm expressed in tiyin (amounts are stored as tiyin = 1/100 so'm).
const MILLION_TIYIN = 100_000_000;
const roundDownToMillion = (tiyin: number) => Math.floor(tiyin / MILLION_TIYIN) * MILLION_TIYIN;

// Total billable price of an event: the table package (rate per guest × guests)
// plus every additional dish (quantity × unit price snapshot).
const eventTotalCents = (event: Event) => {
  const tableRate = (event.tableCategory?.ratePerPerson ?? 0) * event.guestCount;
  const dishes = (event.selections ?? []).reduce((sum, s) => sum + s.quantity * s.unitPriceCents, 0);
  return tableRate + dishes;
};

const STATUS_BADGE: Record<Event['status'], { bg: string; fg: string; border: string; key: Parameters<typeof translate>[0] }> = {
  DRAFT:     { bg: 'rgba(148,163,184,0.15)', fg: '#cbd5e1', border: 'rgba(148,163,184,0.3)', key: 'status_draft' },
  CONFIRMED: { bg: 'rgba(34,197,94,0.15)',   fg: '#4ade80', border: 'rgba(34,197,94,0.3)',  key: 'status_confirmed' },
  CANCELLED: { bg: 'rgba(220,38,38,0.15)',   fg: '#fca5a5', border: 'rgba(220,38,38,0.3)',  key: 'status_cancelled' },
  COMPLETED: { bg: 'rgba(37,99,235,0.15)',   fg: '#60a5fa', border: 'rgba(37,99,235,0.3)',  key: 'status_completed' },
};

const formatDate = (iso: string, locale: string) =>
  new Date(iso).toLocaleString(locale === 'ru' ? 'ru-RU' : locale === 'uz' ? 'uz-UZ' : 'en-US', {
    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });

type InvoiceFilter = 'ALL' | 'OPEN' | 'PAID';

export const AdminInvoicesPage = () => {
  const queryClient = useQueryClient();
  const { locale } = useAdminStore();
  const t = (key: Parameters<typeof translate>[0], params?: Record<string, string | number>) =>
    translate(key, locale, params);

  const [filter, setFilter] = useState<InvoiceFilter>('ALL');
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

  const visibleEvents = useMemo(() => {
    if (filter === 'OPEN') return events.filter((e) => e.status !== 'COMPLETED' && e.status !== 'CANCELLED');
    if (filter === 'PAID') return events.filter((e) => e.status === 'COMPLETED');
    return events;
  }, [events, filter]);

  const filters: { id: InvoiceFilter; label: string }[] = [
    { id: 'ALL', label: t('filter_all') },
    { id: 'OPEN', label: t('invoices_open') },
    { id: 'PAID', label: t('invoices_paid') },
  ];

  return (
    <main className="tablet-fade-in" style={{ maxWidth: 1100, margin: '0 auto', padding: '28px 20px', position: 'relative', zIndex: 1 }}>
      <h1 className="adm-title" style={{ marginBottom: 6 }}>{t('invoices')}</h1>
      <p style={{ color: 'rgba(226,232,240,0.55)', fontSize: 13, marginBottom: 20, marginTop: 0 }}>
        {visibleEvents.length} {visibleEvents.length === 1 ? t('invoice_one') : t('invoice_many')}
      </p>

      {/* Controls: status filter */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap', marginBottom: 20 }}>
        {filters.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            className="adm-badge"
            style={{
              cursor: 'pointer', padding: '6px 14px', fontSize: 13, fontWeight: 600,
              background: filter === f.id ? 'rgba(201,164,44,0.15)' : 'rgba(255,255,255,0.04)',
              color: filter === f.id ? '#c9a42c' : 'rgba(226,232,240,0.7)',
              border: `1px solid ${filter === f.id ? 'rgba(201,164,44,0.4)' : 'rgba(255,255,255,0.1)'}`,
            }}
          >
            {f.label}
          </button>
        ))}
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
          const isPaid = event.status === 'COMPLETED';
          const isCancelled = event.status === 'CANCELLED';

          return (
            <div key={event.id} className="adm-card adm-card-hover tablet-fade-up" style={{ padding: 20, animationDelay: `${idx * 50}ms` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
                <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#f8fafc' }}>
                  <span style={{ color: '#c9a42c' }}>#{event.id}</span> — {event.customerName}
                </h2>
                <span className="adm-badge" style={{ background: status.bg, color: status.fg, border: `1px solid ${status.border}` }}>
                  {t(status.key)}
                </span>
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
                    <span style={{ fontSize: 17, fontWeight: 800, color: '#c9a42c' }}>{formatSum(shownTotal)}</span>
                    {isRounded && (
                      <span style={{ display: 'block', fontSize: 11, color: 'rgba(226,232,240,0.45)', marginTop: 2 }}>
                        {t('rounded_to_million')}
                      </span>
                    )}
                  </span>
                </div>
              </div>

              {/* Action */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'space-between', flexWrap: 'wrap', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 14, marginTop: 12 }}>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'rgba(226,232,240,0.85)', cursor: 'pointer', userSelect: 'none' }}>
                  <input type="checkbox" checked={rounded} onChange={() => toggleRounded(event.id)} style={{ accentColor: '#c9a42c', width: 16, height: 16 }} />
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
                    onClick={() => closeMutation.mutate(event.id)}
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
