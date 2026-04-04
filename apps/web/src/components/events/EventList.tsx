import type { Event } from '../../types/domain';

type EventListProps = {
  events: Event[];
  onDelete?: (eventId: number) => void;
  onEdit?: (eventId: number) => void;
  deletingId?: number | null;
};

export const EventList = ({ events, onDelete, onEdit, deletingId }: EventListProps) => {
  if (events.length === 0) {
    return <p>No events yet.</p>;
  }

  return (
    <table width="100%" cellPadding={8}>
      <thead>
        <tr>
          <th align="left">ID</th>
          <th align="left">Customer</th>
          <th align="left">Date</th>
          <th align="left">Guests</th>
          <th align="left">Status</th>
          {(onEdit || onDelete) ? <th align="left">Actions</th> : null}
        </tr>
      </thead>
      <tbody>
        {events.map((event) => (
          <tr key={event.id}>
            <td style={{ fontSize: '0.8rem', color: '#555' }}>{event.id}</td>
            <td>{event.customerName}</td>
            <td>{new Date(event.eventDate).toLocaleDateString()}</td>
            <td>{event.guestCount}</td>
            <td>{event.status}</td>
            {(onEdit || onDelete) ? (
              <td style={{ display: 'flex', gap: 8 }}>
                {onEdit ? (
                  <button type="button" onClick={() => onEdit(event.id)}>
                    Edit
                  </button>
                ) : null}
                {onDelete ? (
                  <button
                    type="button"
                    disabled={deletingId === event.id}
                    onClick={() => {
                      if (window.confirm(`Delete reservation for ${event.customerName}?`)) {
                        onDelete(event.id);
                      }
                    }}
                  >
                    {deletingId === event.id ? 'Deleting…' : 'Delete'}
                  </button>
                ) : null}
              </td>
            ) : null}
          </tr>
        ))}
      </tbody>
    </table>
  );
};
