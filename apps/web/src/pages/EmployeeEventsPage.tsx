import { useQuery } from '@tanstack/react-query';
import { eventService } from '../services/event.service';
import { hallService } from '../services/hall.service';
import { tableCategoryService } from '../services/tableCategory.service';
import { menuService } from '../services/menu.service';
import { useAdminStore } from '../store/admin.store';
import { translate } from '../utils/translate';
import type { Event } from '../types/domain';
import { httpClient } from '../services/http';

const EVENT_TYPE_LABEL: Record<NonNullable<Event['eventType']>, string> = {
  RESERVATION: 'Reservation',
  BANQUET: 'Banquet',
  WEDDING: 'Wedding',
  BIRTHDAY: 'Birthday',
  PRIVATE_PARTY: 'Private party',
  CORPORATE: 'Corporate',
};

const STATUS_BADGE: Record<Event['status'], { bg: string; label: string }> = {
  DRAFT: { bg: '#9ca3af', label: 'Draft' },
  CONFIRMED: { bg: '#16a34a', label: 'Confirmed' },
  CANCELLED: { bg: '#dc2626', label: 'Cancelled' },
};

const formatDate = (iso: string, locale: string) => {
  const d = new Date(iso);
  return d.toLocaleString(locale === 'ru' ? 'ru-RU' : locale === 'uz' ? 'uz-UZ' : 'en-US', {
    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
};

export const EmployeeEventsPage = () => {
  const { locale } = useAdminStore();
  const t = (key: Parameters<typeof translate>[0], params?: Record<string, string | number>) =>
    translate(key, locale, params);

  const eventsQuery = useQuery<Event[]>({ queryKey: ['events'], queryFn: () => eventService.list() });
  const hallsQuery = useQuery({ queryKey: ['halls'], queryFn: () => hallService.list() });
  const tcQuery = useQuery({ queryKey: ['tableCategories'], queryFn: () => tableCategoryService.list() });
  const menuQuery = useQuery({ queryKey: ['menu'], queryFn: () => menuService.list() });

  const events = eventsQuery.data ?? [];
  const halls = hallsQuery.data ?? [];
  const tableCategories = tcQuery.data ?? [];
  const menuItems = menuQuery.data ?? [];

  const downloadEvent = async (event: Event, format: 'pdf' | 'excel') => {
    const hall = halls.find((h) => h.id === event.hallId);
    const tc = tableCategories.find((c) => c.id === event.tableCategoryId);
    const selectedItems: Record<string, number> = {};
    (event.selections ?? []).forEach((s) => {
      selectedItems[s.menuItem.id] = s.quantity;
    });

    // No financial information — pricing zeroed out for employees
    const body = {
      customerName: event.customerName,
      customerPhone: event.customerPhone ?? '',
      hallName: hall?.name ?? '',
      tableCategoryName: tc?.name ?? '',
      guestCount: event.guestCount,
      selectedItems,
      menuItems,
      pricing: { subtotalCents: 0, serviceFeeCents: 0, taxCents: 0, perGuestCents: 0, totalCents: 0 },
      locale,
      restaurantName: '',
      excludeFinancial: true,
    };

    const url = format === 'pdf' ? '/public/export/pdf' : '/public/export/excel';
    const filename = `event-${event.id}.${format === 'pdf' ? 'pdf' : 'xlsx'}`;

    try {
      const response = await httpClient.post(url, body, { responseType: 'blob' });
      const downloadUrl = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch {
      alert(t('download_failed'));
    }
  };

  return (
    <main className="tablet-fade-in" style={{ maxWidth: 1180, margin: '0 auto', padding: '28px 20px', position: 'relative', zIndex: 1 }}>
      <h1 className="adm-title" style={{ marginBottom: 6 }}>{t('events')}</h1>
      <p style={{ color: 'rgba(226,232,240,0.55)', fontSize: 13, marginBottom: 24, marginTop: 0 }}>
        {events.length} {events.length === 1 ? 'event' : 'events'}
      </p>

      {eventsQuery.isLoading && <p style={{ color: 'rgba(226,232,240,0.55)' }}>{t('loading_events')}</p>}
      {eventsQuery.isError && <p style={{ color: '#fca5a5' }}>{t('failed_load_events')}</p>}

      <div style={{ display: 'grid', gap: 14 }}>
        {events.map((event, idx) => {
          const hall = halls.find((h) => h.id === event.hallId);
          const tc = tableCategories.find((c) => c.id === event.tableCategoryId);
          const selections = event.selections ?? [];
          const status = STATUS_BADGE[event.status];

          return (
            <div key={event.id} className="adm-card adm-card-hover tablet-fade-up" style={{ padding: 20, animationDelay: `${idx * 60}ms` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
                <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: '#f8fafc' }}>
                  <span style={{ color: '#c9a42c' }}>#{event.id}</span> — {event.customerName}
                </h2>
                <span className="adm-badge" style={{ background: status.bg, color: '#fff' }}>
                  {status.label}
                </span>
                {event.eventType && (
                  <span className="adm-badge" style={{ background: 'rgba(99,102,241,0.18)', color: '#a5b4fc', border: '1px solid rgba(99,102,241,0.3)' }}>
                    {EVENT_TYPE_LABEL[event.eventType]}
                  </span>
                )}
              </div>

              <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', marginBottom: 14 }}>
                <Detail label={t('event_date_time')} value={formatDate(event.eventDate, locale)} />
                <Detail label={t('guests')} value={String(event.guestCount)} />
                {hall && <Detail label={t('hall')} value={hall.name} />}
                {tc && <Detail label={t('table_category')} value={tc.name} />}
              </div>

              {selections.length > 0 && (
                <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 12, marginBottom: 12 }}>
                  <p className="adm-label" style={{ marginBottom: 6 }}>
                    {t('selected_dishes')} ({selections.length})
                  </p>
                  <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: 4 }}>
                    {selections.map((s) => (
                      <li key={s.id} style={{ fontSize: 13, color: '#cbd5e1' }}>
                        {s.menuItem.name} <span style={{ color: 'rgba(226,232,240,0.45)' }}>× {s.quantity}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {event.notes && (
                <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 10, marginBottom: 12, fontSize: 13, color: 'rgba(226,232,240,0.65)' }}>
                  <strong style={{ color: '#c9a42c' }}>{t('notes')}:</strong> {event.notes}
                </div>
              )}

              <div style={{ display: 'flex', gap: 8, borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 14 }}>
                <button onClick={() => downloadEvent(event, 'pdf')} className="adm-btn-primary" style={{ fontSize: 13 }}>
                  {t('download_pdf')}
                </button>
                <button onClick={() => downloadEvent(event, 'excel')} className="adm-btn-ghost" style={{ fontSize: 13, color: '#4ade80', borderColor: 'rgba(74,222,128,0.3)' }}>
                  {t('download_excel')}
                </button>
              </div>
            </div>
          );
        })}

        {!eventsQuery.isLoading && events.length === 0 && (
          <p className="adm-empty">{t('no_items_selected')}</p>
        )}
      </div>
    </main>
  );
};

const Detail = ({ label, value }: { label: string; value: string }) => (
  <div>
    <p className="adm-label" style={{ margin: 0 }}>{label}</p>
    <p style={{ margin: '4px 0 0', fontSize: 14, color: '#e2e8f0', fontWeight: 600 }}>{value}</p>
  </div>
);

const btnStyle = (bg: string): React.CSSProperties => ({
  padding: '7px 14px',
  background: bg,
  color: '#fff',
  border: 'none',
  borderRadius: 6,
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
});
