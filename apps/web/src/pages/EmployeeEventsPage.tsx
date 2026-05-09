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
    <main style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 16px' }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>{t('events')}</h1>
      <p style={{ color: '#6b7280', fontSize: 13, marginBottom: 24 }}>
        {events.length} {events.length === 1 ? 'event' : 'events'}
      </p>

      {eventsQuery.isLoading && <p style={{ color: '#6b7280' }}>{t('loading_events')}</p>}
      {eventsQuery.isError && <p style={{ color: '#dc2626' }}>{t('failed_load_events')}</p>}

      <div style={{ display: 'grid', gap: 16 }}>
        {events.map((event) => {
          const hall = halls.find((h) => h.id === event.hallId);
          const tc = tableCategories.find((c) => c.id === event.tableCategoryId);
          const selections = event.selections ?? [];
          const status = STATUS_BADGE[event.status];

          return (
            <div key={event.id} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: 18 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
                <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#111827' }}>
                  #{event.id} — {event.customerName}
                </h2>
                <span style={{ padding: '2px 8px', background: status.bg, color: '#fff', borderRadius: 4, fontSize: 11, fontWeight: 600 }}>
                  {status.label}
                </span>
                {event.eventType && (
                  <span style={{ padding: '2px 8px', background: '#e0e7ff', color: '#3730a3', borderRadius: 4, fontSize: 11, fontWeight: 600 }}>
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
                <div style={{ borderTop: '1px solid #f3f4f6', paddingTop: 12, marginBottom: 12 }}>
                  <p style={{ margin: '0 0 6px', fontSize: 12, fontWeight: 600, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    {t('selected_dishes')} ({selections.length})
                  </p>
                  <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: 4 }}>
                    {selections.map((s) => (
                      <li key={s.id} style={{ fontSize: 13, color: '#4b5563' }}>
                        {s.menuItem.name} <span style={{ color: '#9ca3af' }}>× {s.quantity}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {event.notes && (
                <div style={{ borderTop: '1px solid #f3f4f6', paddingTop: 10, marginBottom: 12, fontSize: 13, color: '#6b7280' }}>
                  <strong style={{ color: '#374151' }}>{t('notes')}:</strong> {event.notes}
                </div>
              )}

              <div style={{ display: 'flex', gap: 8, borderTop: '1px solid #f3f4f6', paddingTop: 12 }}>
                <button onClick={() => downloadEvent(event, 'pdf')} style={btnStyle('#2563eb')}>
                  {t('download_pdf')}
                </button>
                <button onClick={() => downloadEvent(event, 'excel')} style={btnStyle('#059669')}>
                  {t('download_excel')}
                </button>
              </div>
            </div>
          );
        })}

        {!eventsQuery.isLoading && events.length === 0 && (
          <p style={{ color: '#6b7280' }}>{t('no_items_selected')}</p>
        )}
      </div>
    </main>
  );
};

const Detail = ({ label, value }: { label: string; value: string }) => (
  <div>
    <p style={{ margin: 0, fontSize: 11, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>{label}</p>
    <p style={{ margin: 0, fontSize: 14, color: '#111827' }}>{value}</p>
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
