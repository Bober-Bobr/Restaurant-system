import type { Event } from '../../types/domain';
import { Button } from '../ui/button';
import { useAdminStore } from '../../store/admin.store';
import { translate } from '../../utils/translate';

type EventListProps = {
  events: Event[];
  onDelete?: (eventId: number) => void;
  onEdit?: (eventId: number) => void;
  onDownloadPdf?: (eventId: number) => void;
  onReschedule?: (eventId: number) => void;
  deletingId?: number | null;
};

const statusStyle: Record<string, React.CSSProperties> = {
  DRAFT:     { background: 'rgba(148,163,184,0.15)', color: '#cbd5e1', border: '1px solid rgba(148,163,184,0.3)' },
  CONFIRMED: { background: 'rgba(34,197,94,0.15)',   color: '#4ade80', border: '1px solid rgba(34,197,94,0.3)' },
  CANCELLED: { background: 'rgba(220,38,38,0.15)',   color: '#fca5a5', border: '1px solid rgba(220,38,38,0.3)' },
  COMPLETED: { background: 'rgba(37,99,235,0.15)',   color: '#60a5fa', border: '1px solid rgba(37,99,235,0.3)' },
  MENU_NOT_SELECTED: { background: 'rgba(245,158,11,0.15)', color: '#fbbf24', border: '1px solid rgba(245,158,11,0.35)' },
};

const statusLabelKey: Record<string, Parameters<typeof translate>[0]> = {
  DRAFT: 'status_draft',
  CONFIRMED: 'status_confirmed',
  CANCELLED: 'status_cancelled',
  COMPLETED: 'status_completed',
  MENU_NOT_SELECTED: 'status_menu_not_selected',
};

const eventTypeLabelKey: Record<string, Parameters<typeof translate>[0]> = {
  RESERVATION:   'event_type_reservation',
  BANQUET:       'event_type_banquet',
  WEDDING:       'event_type_wedding',
  BIRTHDAY:      'event_type_birthday',
  PRIVATE_PARTY: 'event_type_private_party',
  CORPORATE:     'event_type_corporate',
  FOTIHA_TUI:    'event_type_fotiha_tui',
  NACHOR_OSHI:   'event_type_nachor_oshi',
};

function formatDateTime(iso: string) {
  const d = new Date(iso);
  return {
    date: d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }),
    time: d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }),
  };
}

export const EventList = ({ events, onDelete, onEdit, onDownloadPdf, onReschedule, deletingId }: EventListProps) => {
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
        {t('no_events_yet')}
      </div>
    );
  }

  const hasActions = onEdit || onDelete || onDownloadPdf || onReschedule;

  return (
    <div className="adm-card tablet-fade-up" style={{ overflow: 'auto' }}>
      <table className="adm-table">
        <thead>
          <tr>
            <th>#</th>
            <th>{t('ev_col_customer')}</th>
            <th>{t('ev_col_datetime')}</th>
            <th>{t('event_type')}</th>
            <th>{t('guests')}</th>
            <th>{t('ev_col_hall_table')}</th>
            <th>{t('menu')}</th>
            <th>{t('notes')}</th>
            <th>{t('status')}</th>
            {hasActions ? <th>{t('actions')}</th> : null}
          </tr>
        </thead>
        <tbody>
          {events.map((event) => {
            const { date, time } = formatDateTime(event.eventDate);
            const rescheduled = !!event.originalEventDate &&
              new Date(event.originalEventDate).getTime() !== new Date(event.eventDate).getTime();
            const original = rescheduled ? formatDateTime(event.originalEventDate!) : null;
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
                  {original && (
                    <p style={{ margin: '0 0 2px', fontSize: 11, color: '#f87171', textDecoration: 'line-through' }}
                      title={t('rescheduled_from')}>
                      {original.date} · {original.time}
                    </p>
                  )}
                  <p style={{ margin: 0, color: rescheduled ? '#4ade80' : '#e2e8f0', fontWeight: rescheduled ? 600 : 400 }}>
                    {rescheduled && '→ '}{date}
                  </p>
                  <p style={{ margin: '2px 0 0', fontSize: 11, color: 'rgba(226,232,240,0.5)' }}>{time}</p>
                </td>

                <td style={{ whiteSpace: 'nowrap', color: 'rgba(226,232,240,0.75)' }}>
                  {event.eventType ? (eventTypeLabelKey[event.eventType] ? t(eventTypeLabelKey[event.eventType]) : event.eventType) : '—'}
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
                        {dishTypes === 1 ? t('dish_count_one') : t('dishes_count', { count: dishTypes })}
                      </p>
                      <p style={{ margin: '2px 0 0', fontSize: 11, color: 'rgba(226,232,240,0.5)' }}>{t('pcs_total', { count: totalPcs })}</p>
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
                    {statusLabelKey[event.status] ? t(statusLabelKey[event.status]) : event.status}
                  </span>
                </td>

                {hasActions ? (
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <div style={{ display: 'flex', gap: 8 }}>
                      {onDownloadPdf && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => onDownloadPdf(event.id)}
                        >
                          {t('download_pdf')}
                        </Button>
                      )}
                      {onReschedule && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => onReschedule(event.id)}
                        >
                          {t('reschedule')}
                        </Button>
                      )}
                      {onEdit && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => onEdit(event.id)}
                        >
                          {t('edit')}
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
