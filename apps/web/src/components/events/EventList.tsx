import type { Event } from '../../types/domain';
import { Button } from '../ui/button';
import { useAdminStore } from '../../store/admin.store';
import { translate } from '../../utils/translate';

type EventListProps = {
  events: Event[];
  onDelete?: (eventId: number) => void;
  onEdit?: (eventId: number) => void;
  deletingId?: number | null;
};

const statusStyle: Record<string, React.CSSProperties> = {
  DRAFT:     { background: 'rgba(148,163,184,0.15)', color: '#cbd5e1', border: '1px solid rgba(148,163,184,0.3)' },
  CONFIRMED: { background: 'rgba(34,197,94,0.15)',   color: '#4ade80', border: '1px solid rgba(34,197,94,0.3)' },
  CANCELLED: { background: 'rgba(220,38,38,0.15)',   color: '#fca5a5', border: '1px solid rgba(220,38,38,0.3)' },
};

const eventTypeLabel: Record<string, string> = {
  RESERVATION:   'Reservation',
  BANQUET:       'Banquet',
  WEDDING:       'Wedding',
  PRIVATE_PARTY: 'Private Party',
  CORPORATE:     'Corporate',
};

function formatDateTime(iso: string) {
  const d = new Date(iso);
  return {
    date: d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }),
    time: d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }),
  };
}

export const EventList = ({ events, onDelete, onEdit, deletingId }: EventListProps) => {
  const { locale } = useAdminStore();
  const t = (key: Parameters<typeof translate>[0], params?: Record<string, string | number>) =>
    translate(key, locale, params);

  if (events.length === 0) {
    return (
      <div style={{
        border: '2px dashed rgba(255,255,255,0.08)',
        borderRadius: 16,
        padding: '56px 16px',
        textAlign: 'center',
        fontSize: 14,
        color: 'rgba(226,232,240,0.45)',
      }}>
        No events yet.
      </div>
    );
  }

  const hasActions = onEdit || onDelete;

  return (
    <div className="adm-card tablet-fade-up" style={{ overflow: 'auto' }}>
      <table className="adm-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Customer</th>
            <th>Date / Time</th>
            <th>Type</th>
            <th>Guests</th>
            <th>Hall / Table</th>
            <th>Menu</th>
            <th>Notes</th>
            <th>Status</th>
            {hasActions ? <th>Actions</th> : null}
          </tr>
        </thead>
        <tbody>
          {events.map((event) => {
            const { date, time } = formatDateTime(event.eventDate);
            const dishTypes  = event.selections?.length ?? 0;
            const totalPcs   = event.selections?.reduce((s, sel) => s + sel.quantity, 0) ?? 0;

            return (
              <tr key={event.id}>
                <td style={{ whiteSpace: 'nowrap', fontFamily: 'monospace', fontSize: 12, color: '#c9a42c' }}>
                  #{event.id}
                </td>

                <td>
                  <p style={{ margin: 0, fontWeight: 600, color: '#f8fafc' }}>{event.customerName}</p>
                  {event.customerPhone && (
                    <p style={{ margin: '2px 0 0', fontSize: 11, color: 'rgba(226,232,240,0.5)' }}>{event.customerPhone}</p>
                  )}
                </td>

                <td style={{ whiteSpace: 'nowrap' }}>
                  <p style={{ margin: 0, color: '#e2e8f0' }}>{date}</p>
                  <p style={{ margin: '2px 0 0', fontSize: 11, color: 'rgba(226,232,240,0.5)' }}>{time}</p>
                </td>

                <td style={{ whiteSpace: 'nowrap', color: 'rgba(226,232,240,0.75)' }}>
                  {event.eventType ? (eventTypeLabel[event.eventType] ?? event.eventType) : '—'}
                </td>

                <td style={{ whiteSpace: 'nowrap', color: 'rgba(226,232,240,0.75)' }}>
                  {event.guestCount}
                </td>

                <td>
                  {event.hall ? (
                    <p style={{ margin: 0, color: '#e2e8f0' }}>{event.hall.name}</p>
                  ) : (
                    <p style={{ margin: 0, color: 'rgba(226,232,240,0.35)' }}>—</p>
                  )}
                  {event.tableCategory && (
                    <p style={{ margin: '2px 0 0', fontSize: 11, color: 'rgba(226,232,240,0.5)' }}>{event.tableCategory.name}</p>
                  )}
                </td>

                <td style={{ whiteSpace: 'nowrap' }}>
                  {dishTypes > 0 ? (
                    <>
                      <p style={{ margin: 0, color: '#e2e8f0' }}>
                        {dishTypes} {dishTypes === 1 ? 'dish' : 'dishes'}
                      </p>
                      <p style={{ margin: '2px 0 0', fontSize: 11, color: 'rgba(226,232,240,0.5)' }}>{totalPcs} pcs total</p>
                    </>
                  ) : (
                    <p style={{ margin: 0, color: 'rgba(226,232,240,0.35)' }}>—</p>
                  )}
                </td>

                <td style={{ maxWidth: 180 }}>
                  {event.notes ? (
                    <p style={{ margin: 0, fontSize: 12, color: 'rgba(226,232,240,0.65)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={event.notes}>
                      {event.notes}
                    </p>
                  ) : (
                    <p style={{ margin: 0, color: 'rgba(226,232,240,0.35)' }}>—</p>
                  )}
                </td>

                <td style={{ whiteSpace: 'nowrap' }}>
                  <span
                    className="adm-badge"
                    style={statusStyle[event.status] ?? statusStyle.DRAFT}
                  >
                    {event.status}
                  </span>
                </td>

                {hasActions ? (
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <div style={{ display: 'flex', gap: 8 }}>
                      {onEdit && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => onEdit(event.id)}
                        >
                          Edit
                        </Button>
                      )}
                      {onDelete && (
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          disabled={deletingId === event.id}
                          onClick={() => {
                            if (window.confirm(t('confirm_delete_event', { name: event.customerName }))) {
                              onDelete(event.id);
                            }
                          }}
                        >
                          {deletingId === event.id ? t('deleting') : t('delete')}
                        </Button>
                      )}
                    </div>
                  </td>
                ) : null}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
