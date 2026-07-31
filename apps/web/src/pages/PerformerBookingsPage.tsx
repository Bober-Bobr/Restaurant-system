import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { performerService, type PerformerBooking } from '../services/performer.service';
import { useAdminStore } from '../store/admin.store';
import { translate } from '../utils/translate';

// Booking requests raised from the Additional Services page. Accepting one adds
// it to the calendar, which is also what makes a performer or host show as busy
// for that date — so accepting is the single action that closes the loop. A
// host's requests carry the event programme, which travels onto the calendar
// entry when the request is accepted.
export const PerformerBookingsPage = () => {
  const { locale } = useAdminStore();
  const t = (k: Parameters<typeof translate>[0]) => translate(k, locale);
  const queryClient = useQueryClient();

  const bookingsQuery = useQuery({ queryKey: ['pf-bookings'], queryFn: () => performerService.listBookings() });

  const decide = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'ACCEPTED' | 'DECLINED' }) =>
      performerService.decideBooking(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pf-bookings'] });
      queryClient.invalidateQueries({ queryKey: ['pf-bookings-pending'] });
      // An accepted request becomes a calendar entry.
      queryClient.invalidateQueries({ queryKey: ['pf-events'] });
    },
  });

  const bookings = bookingsQuery.data ?? [];

  const statusBadge = (status: PerformerBooking['status']) => {
    if (status === 'ACCEPTED') return { label: t('pf_accepted'), background: 'rgba(34,197,94,0.16)', color: '#86efac', border: '1px solid rgba(34,197,94,0.4)' };
    if (status === 'DECLINED') return { label: t('pf_declined'), background: 'rgba(148,163,184,0.14)', color: 'rgba(226,232,240,0.6)', border: '1px solid rgba(255,255,255,0.15)' };
    return { label: t('pf_pending'), background: 'rgba(201,164,44,0.18)', color: '#f4d47c', border: '1px solid rgba(201,164,44,0.4)' };
  };

  return (
    <main className="tablet-fade-in" style={{ maxWidth: 780, margin: '0 auto', padding: '28px 20px', position: 'relative', zIndex: 1 }}>
      <h1 className="adm-title" style={{ marginBottom: 24 }}>{t('pf_bookings')}</h1>

      {bookingsQuery.isLoading && <p style={{ color: 'rgba(226,232,240,0.55)' }}>…</p>}
      {!bookingsQuery.isLoading && bookings.length === 0 && <p className="adm-empty">{t('pf_no_bookings')}</p>}

      <div style={{ display: 'grid', gap: 12 }}>
        {bookings.map((b) => {
          const badge = statusBadge(b.status);
          return (
            <div key={b.id} className="adm-card adm-card-hover" style={{ padding: 16, display: 'grid', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <strong style={{ fontSize: 15 }}>{b.restaurantName}</strong>
                <span className="adm-badge" style={{ background: badge.background, color: badge.color, border: badge.border }}>
                  {badge.label}
                </span>
                <span style={{ marginLeft: 'auto', fontSize: 12, color: 'rgba(226,232,240,0.5)' }}>
                  {new Date(b.createdAt).toLocaleString()}
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 10, fontSize: 13 }}>
                <div>
                  <p style={{ margin: 0, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'rgba(226,232,240,0.45)' }}>{t('addon_inv_date')}</p>
                  <p style={{ margin: 0 }}>{new Date(b.eventDate).toLocaleDateString()} · {b.eventTime}</p>
                </div>
                <div>
                  <p style={{ margin: 0, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'rgba(226,232,240,0.45)' }}>{t('pf_contact')}</p>
                  <p style={{ margin: 0 }}>
                    {b.contactName} · <a href={`tel:${b.phone}`} style={{ color: '#c9a42c' }}>{b.phone}</a>
                  </p>
                </div>
                {b.eventNumber != null && (
                  <div>
                    <p style={{ margin: 0, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'rgba(226,232,240,0.45)' }}>{t('addon_services_for_event')}</p>
                    <p style={{ margin: 0 }}>#{b.eventNumber}</p>
                  </div>
                )}
              </div>

              {b.note && <p style={{ margin: 0, fontSize: 13, color: 'rgba(226,232,240,0.6)', whiteSpace: 'pre-wrap' }}>{b.note}</p>}

              {/* Hosts only: the running order the client sent. It is what the
                  request is judged on, so it is given its own panel rather than
                  being run together with the note. */}
              {b.program && (
                <div style={{
                  display: 'grid', gap: 4, padding: '10px 12px', borderRadius: 8,
                  background: 'rgba(201,164,44,0.08)', border: '1px solid rgba(201,164,44,0.25)',
                }}>
                  <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: '#c9a42c' }}>
                    {t('pf_program')}
                  </span>
                  <p style={{ margin: 0, fontSize: 13, color: 'rgba(226,232,240,0.8)', whiteSpace: 'pre-wrap' }}>{b.program}</p>
                </div>
              )}

              {b.status === 'PENDING' && (
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    className="adm-btn-primary"
                    disabled={decide.isPending}
                    onClick={() => decide.mutate({ id: b.id, status: 'ACCEPTED' })}
                  >
                    {t('pf_accept')}
                  </button>
                  <button
                    disabled={decide.isPending}
                    onClick={() => decide.mutate({ id: b.id, status: 'DECLINED' })}
                    style={{ padding: '6px 16px', background: 'rgba(255,255,255,0.07)', color: 'rgba(226,232,240,0.8)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, fontSize: 13, cursor: 'pointer' }}
                  >
                    {t('pf_decline')}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </main>
  );
};
