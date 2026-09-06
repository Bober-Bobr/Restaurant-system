import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { eventService } from '../services/event.service';
import { useAdminStore } from '../store/admin.store';
import { translate } from '../utils/translate';
import { formatSum } from '../utils/currency';
import { invoiceOutstandingCents, overdueDebtEvents, pendingDebtEvents } from '../utils/invoice';
import type { Event } from '../types/domain';

const formatDate = (iso: string, locale: string) =>
  new Date(iso).toLocaleDateString(locale === 'ru' ? 'ru-RU' : locale === 'uz' ? 'uz-UZ' : 'en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
  });

// Notifications are derived live from the events list. Two groups, and both are
// money already owed on an event that has happened:
//
//   overdue — past the settlement date somebody set
//   pending — the date is still ahead, OR nobody set one
//
// The second group used to appear NOWHERE. A debt with no deadline cannot become
// overdue (`isOverdueDebt` needs a date to compare against), so it was invisible
// on this page for as long as it existed — and a debt nobody put a date on is
// the one most likely to be forgotten. Together the two cover every debt exactly
// once; see utils/invoice.ts.
export const AdminNotificationsPage = () => {
  const { locale } = useAdminStore();
  const t = (key: Parameters<typeof translate>[0], params?: Record<string, string | number>) =>
    translate(key, locale, params);

  const eventsQuery = useQuery<Event[]>({ queryKey: ['events'], queryFn: () => eventService.list() });
  const overdue = overdueDebtEvents(eventsQuery.data ?? []);
  const pending = pendingDebtEvents(eventsQuery.data ?? []);

  return (
    <main className="tablet-fade-in" style={{ maxWidth: 900, margin: '0 auto', padding: '28px 20px', position: 'relative', zIndex: 1 }}>
      <h1 className="adm-title" style={{ marginBottom: 6 }}>{t('notifications')}</h1>
      <p style={{ color: 'rgba(226,232,240,0.55)', fontSize: 13, marginBottom: 20, marginTop: 0 }}>
        {t('overdue_debts_subtitle')}
      </p>

      {eventsQuery.isLoading && <p style={{ color: 'rgba(226,232,240,0.55)' }}>{t('loading_events')}</p>}
      {eventsQuery.isError && <p style={{ color: '#fca5a5' }}>{t('failed_load_events')}</p>}

      <div style={{ display: 'grid', gap: 14 }}>
        {overdue.map((event, idx) => {
          const outstanding = invoiceOutstandingCents(event);
          return (
            <div
              key={event.id}
              className="adm-card tablet-fade-up"
              style={{
                padding: 18,
                animationDelay: `${idx * 50}ms`,
                border: '1px solid rgba(220,38,38,0.4)',
                background: 'rgba(220,38,38,0.06)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 20 }}>⚠</span>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#f8fafc' }}>
                    <span style={{ color: 'var(--adm-accent)' }}>#{event.id}</span> — {event.customerName}
                    {event.customerPhone && (
                      <span style={{ marginLeft: 8, fontSize: 12, fontWeight: 500, color: 'rgba(226,232,240,0.55)' }}>{event.customerPhone}</span>
                    )}
                  </p>
                  <p style={{ margin: '4px 0 0', fontSize: 13, color: '#fca5a5' }}>
                    {t('debt_overdue_notice', { amount: formatSum(outstanding) })}
                  </p>
                  <p style={{ margin: '3px 0 0', fontSize: 12, color: 'rgba(226,232,240,0.5)' }}>
                    {t('debt_deadline')}: {event.debtDeadline ? formatDate(event.debtDeadline, locale) : '—'}
                    {' · '}
                    {t('event_date')}: {formatDate(event.eventDate, locale)}
                  </p>
                </div>
                <Link
                  to="/admin/invoices"
                  className="adm-btn-ghost"
                  style={{ fontSize: 13, textDecoration: 'none', whiteSpace: 'nowrap' }}
                >
                  {t('invoices')} →
                </Link>
              </div>
            </div>
          );
        })}

        {/* Amber, not red: owed but not late. Same information, a rung quieter,
            so the overdue block above keeps its urgency. */}
        {pending.length > 0 && (
          <>
            <h2 className="adm-heading" style={{ margin: '10px 0 0' }}>{t('debts_pending_heading')}</h2>
            {pending.map((event, idx) => (
              <div
                key={event.id}
                className="adm-card tablet-fade-up"
                style={{
                  padding: 18,
                  animationDelay: `${idx * 50}ms`,
                  border: '1px solid rgba(245,158,11,0.35)',
                  background: 'rgba(245,158,11,0.05)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 20 }}>⏳</span>
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#f8fafc' }}>
                      <span style={{ color: 'var(--adm-accent)' }}>#{event.id}</span> — {event.customerName}
                      {event.customerPhone && (
                        <span style={{ marginLeft: 8, fontSize: 12, fontWeight: 500, color: 'rgba(226,232,240,0.55)' }}>{event.customerPhone}</span>
                      )}
                    </p>
                    <p style={{ margin: '4px 0 0', fontSize: 13, color: '#fbbf24' }}>
                      {t('debt_pending_notice', { amount: formatSum(invoiceOutstandingCents(event)) })}
                    </p>
                    <p style={{ margin: '3px 0 0', fontSize: 12, color: 'rgba(226,232,240,0.5)' }}>
                      {/* An absent date is stated, not left as a dash: it is the
                          reason this debt was invisible until now. */}
                      {event.debtDeadline
                        ? t('debt_due_on', { date: formatDate(event.debtDeadline, locale) })
                        : t('debt_no_deadline')}
                      {' · '}
                      {t('event_date')}: {formatDate(event.eventDate, locale)}
                    </p>
                  </div>
                  <Link to="/admin/invoices" className="adm-btn-ghost"
                    style={{ fontSize: 13, textDecoration: 'none', whiteSpace: 'nowrap' }}>
                    {t('invoices')} →
                  </Link>
                </div>
              </div>
            ))}
          </>
        )}

        {!eventsQuery.isLoading && overdue.length === 0 && pending.length === 0 && (
          <div className="adm-card" style={{ padding: 40, textAlign: 'center' }}>
            <p style={{ margin: 0, fontSize: 28 }}>🔔</p>
            <p style={{ margin: '10px 0 0', fontSize: 14, color: 'rgba(226,232,240,0.55)' }}>{t('no_notifications')}</p>
          </div>
        )}
      </div>
    </main>
  );
};
