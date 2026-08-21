import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { eventService } from '../services/event.service';
import { useAdminStore } from '../store/admin.store';
import { translate } from '../utils/translate';
import { formatSum } from '../utils/currency';
import { invoiceOutstandingCents, overdueDebtEvents } from '../utils/invoice';
import type { Event } from '../types/domain';

const formatDate = (iso: string, locale: string) =>
  new Date(iso).toLocaleDateString(locale === 'ru' ? 'ru-RU' : locale === 'uz' ? 'uz-UZ' : 'en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
  });

// Notifications are derived live from the events list: every event whose debt
// (outstanding balance after the event started) is past its settlement deadline.
export const AdminNotificationsPage = () => {
  const { locale } = useAdminStore();
  const t = (key: Parameters<typeof translate>[0], params?: Record<string, string | number>) =>
    translate(key, locale, params);

  const eventsQuery = useQuery<Event[]>({ queryKey: ['events'], queryFn: () => eventService.list() });
  const overdue = overdueDebtEvents(eventsQuery.data ?? []);

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

        {!eventsQuery.isLoading && overdue.length === 0 && (
          <div className="adm-card" style={{ padding: 40, textAlign: 'center' }}>
            <p style={{ margin: 0, fontSize: 28 }}>🔔</p>
            <p style={{ margin: '10px 0 0', fontSize: 14, color: 'rgba(226,232,240,0.55)' }}>{t('no_notifications')}</p>
          </div>
        )}
      </div>
    </main>
  );
};
