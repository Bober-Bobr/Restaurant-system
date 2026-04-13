import type { Event } from '../../types/domain';
import { Button } from '../ui/button';

type EventListProps = {
  events: Event[];
  onDelete?: (eventId: number) => void;
  onEdit?: (eventId: number) => void;
  deletingId?: number | null;
};

const statusStyles: Record<string, string> = {
  DRAFT:      'bg-slate-100 text-slate-600',
  CONFIRMED:  'bg-emerald-100 text-emerald-700',
  CANCELLED:  'bg-red-100 text-red-600',
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
  if (events.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 py-14 text-center text-sm text-slate-400">
        No events yet.
      </div>
    );
  }

  const hasActions = onEdit || onDelete;

  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
            <th className="px-4 py-3">#</th>
            <th className="px-4 py-3">Customer</th>
            <th className="px-4 py-3">Date / Time</th>
            <th className="px-4 py-3">Type</th>
            <th className="px-4 py-3">Guests</th>
            <th className="px-4 py-3">Hall / Table</th>
            <th className="px-4 py-3">Menu</th>
            <th className="px-4 py-3">Notes</th>
            <th className="px-4 py-3">Status</th>
            {hasActions ? <th className="px-4 py-3">Actions</th> : null}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {events.map((event) => {
            const { date, time } = formatDateTime(event.eventDate);
            const dishTypes  = event.selections?.length ?? 0;
            const totalPcs   = event.selections?.reduce((s, sel) => s + sel.quantity, 0) ?? 0;

            return (
              <tr key={event.id} className="transition-colors hover:bg-slate-50">

                {/* ID */}
                <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-slate-400">
                  #{event.id}
                </td>

                {/* Customer */}
                <td className="px-4 py-3">
                  <p className="font-medium text-slate-900">{event.customerName}</p>
                  {event.customerPhone && (
                    <p className="mt-0.5 text-xs text-slate-500">{event.customerPhone}</p>
                  )}
                </td>

                {/* Date / Time */}
                <td className="whitespace-nowrap px-4 py-3">
                  <p className="text-slate-800">{date}</p>
                  <p className="mt-0.5 text-xs text-slate-500">{time}</p>
                </td>

                {/* Type */}
                <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                  {event.eventType ? (eventTypeLabel[event.eventType] ?? event.eventType) : '—'}
                </td>

                {/* Guests */}
                <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                  {event.guestCount}
                </td>

                {/* Hall / Table */}
                <td className="px-4 py-3">
                  {event.hall ? (
                    <p className="text-slate-800">{event.hall.name}</p>
                  ) : (
                    <p className="text-slate-400">—</p>
                  )}
                  {event.tableCategory && (
                    <p className="mt-0.5 text-xs text-slate-500">{event.tableCategory.name}</p>
                  )}
                </td>

                {/* Menu selections */}
                <td className="whitespace-nowrap px-4 py-3">
                  {dishTypes > 0 ? (
                    <>
                      <p className="text-slate-800">
                        {dishTypes} {dishTypes === 1 ? 'dish' : 'dishes'}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500">{totalPcs} pcs total</p>
                    </>
                  ) : (
                    <p className="text-slate-400">—</p>
                  )}
                </td>

                {/* Notes */}
                <td className="max-w-[180px] px-4 py-3">
                  {event.notes ? (
                    <p className="truncate text-xs text-slate-500" title={event.notes}>
                      {event.notes}
                    </p>
                  ) : (
                    <p className="text-slate-400">—</p>
                  )}
                </td>

                {/* Status badge */}
                <td className="whitespace-nowrap px-4 py-3">
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusStyles[event.status] ?? 'bg-slate-100 text-slate-600'}`}
                  >
                    {event.status}
                  </span>
                </td>

                {/* Actions */}
                {hasActions ? (
                  <td className="whitespace-nowrap px-4 py-3">
                    <div className="flex gap-2">
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
                            if (window.confirm(`Delete reservation for ${event.customerName}?`)) {
                              onDelete(event.id);
                            }
                          }}
                        >
                          {deletingId === event.id ? 'Deleting…' : 'Delete'}
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
