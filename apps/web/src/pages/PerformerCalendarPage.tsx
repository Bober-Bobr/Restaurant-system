import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { performerService, type PerformerEvent } from '../services/performer.service';
import { useAdminStore } from '../store/admin.store';
import { translate } from '../utils/translate';

type Draft = { id?: string; eventDate: string; eventTime: string; title: string; note: string };

const EMPTY: Draft = { eventDate: '', eventTime: '', title: '', note: '' };

// The performer's schedule. Entries are added by hand here, and appear
// automatically when a booking request is accepted — those are marked and
// otherwise behave the same.
export const PerformerCalendarPage = () => {
  const { locale } = useAdminStore();
  const t = (k: Parameters<typeof translate>[0]) => translate(k, locale);
  const queryClient = useQueryClient();

  const eventsQuery = useQuery({ queryKey: ['pf-events'], queryFn: () => performerService.listEvents() });
  const [draft, setDraft] = useState<Draft | null>(null);

  const done = () => {
    setDraft(null);
    queryClient.invalidateQueries({ queryKey: ['pf-events'] });
  };

  const saveEvent = useMutation({
    mutationFn: () => {
      const payload = {
        eventDate: draft!.eventDate,
        eventTime: draft!.eventTime,
        title: draft!.title.trim(),
        note: draft!.note.trim() || null,
      };
      return draft!.id
        ? performerService.updateEvent(draft!.id, payload)
        : performerService.createEvent(payload);
    },
    onSuccess: done,
  });

  const removeEvent = useMutation({
    mutationFn: (id: string) => performerService.removeEvent(id),
    onSuccess: done,
  });

  const events = eventsQuery.data ?? [];
  const canSave = !!draft?.eventDate && !!draft?.eventTime && !!draft?.title.trim();

  const inputStyle: React.CSSProperties = {
    background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10,
    color: '#e2e8f0', padding: '0.6rem 0.9rem', width: '100%', fontSize: 14,
    fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
  };
  const labelText: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: 'rgba(226,232,240,0.75)' };

  return (
    <main className="tablet-fade-in" style={{ maxWidth: 780, margin: '0 auto', padding: '28px 20px', position: 'relative', zIndex: 1 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 24 }}>
        <h1 className="adm-title" style={{ margin: 0 }}>{t('pf_calendar')}</h1>
        {!draft && (
          <button className="adm-btn-primary" style={{ marginLeft: 'auto' }} onClick={() => setDraft({ ...EMPTY })}>
            {t('pf_add_event')}
          </button>
        )}
      </div>

      {draft && (
        <section className="adm-card adm-section tablet-fade-up" style={{ display: 'grid', gap: 14, marginBottom: 22 }}>
          <h2 className="adm-heading" style={{ margin: 0 }}>{draft.id ? t('pf_edit_event') : t('pf_add_event')}</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 12 }}>
            <label style={{ display: 'grid', gap: 4 }}>
              <span style={labelText}>{t('addon_inv_date')}</span>
              <input style={inputStyle} type="date" value={draft.eventDate} onChange={(e) => setDraft({ ...draft, eventDate: e.target.value })} />
            </label>
            <label style={{ display: 'grid', gap: 4 }}>
              <span style={labelText}>{t('addon_inv_time')}</span>
              <input style={inputStyle} type="time" value={draft.eventTime} onChange={(e) => setDraft({ ...draft, eventTime: e.target.value })} />
            </label>
          </div>
          <label style={{ display: 'grid', gap: 4 }}>
            <span style={labelText}>{t('pf_event_title')}</span>
            <input style={inputStyle} value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
          </label>
          <label style={{ display: 'grid', gap: 4 }}>
            <span style={labelText}>{t('pf_event_note')}</span>
            <textarea style={{ ...inputStyle, minHeight: 80, resize: 'vertical' }} value={draft.note} onChange={(e) => setDraft({ ...draft, note: e.target.value })} />
          </label>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="adm-btn-primary" disabled={!canSave || saveEvent.isPending} onClick={() => saveEvent.mutate()}>
              {saveEvent.isPending ? t('saving') : t('save')}
            </button>
            <button
              onClick={() => setDraft(null)}
              style={{ padding: '6px 16px', background: 'rgba(255,255,255,0.07)', color: 'rgba(226,232,240,0.8)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, fontSize: 13, cursor: 'pointer' }}
            >
              {t('cancel')}
            </button>
          </div>
        </section>
      )}

      {eventsQuery.isLoading && <p style={{ color: 'rgba(226,232,240,0.55)' }}>…</p>}
      {!eventsQuery.isLoading && events.length === 0 && <p className="adm-empty">{t('pf_no_events')}</p>}

      <div style={{ display: 'grid', gap: 12 }}>
        {events.map((ev: PerformerEvent) => (
          <div key={ev.id} className="adm-card adm-card-hover" style={{ padding: 16, display: 'grid', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <strong style={{ fontSize: 15 }}>{ev.title}</strong>
              {ev.bookingId && (
                <span className="adm-badge" style={{ background: 'rgba(219,39,119,0.18)', color: '#f9a8d4', border: '1px solid rgba(219,39,119,0.35)' }}>
                  {t('pf_from_booking')}
                </span>
              )}
              <span style={{ marginLeft: 'auto', fontSize: 13, color: 'rgba(226,232,240,0.65)' }}>
                {new Date(ev.eventDate).toLocaleDateString()} · {ev.eventTime}
              </span>
            </div>
            {ev.note && <p style={{ margin: 0, fontSize: 13, color: 'rgba(226,232,240,0.6)', whiteSpace: 'pre-wrap' }}>{ev.note}</p>}
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => setDraft({
                  id: ev.id,
                  // The stored value is a UTC timestamp; slice back to yyyy-mm-dd
                  // for the date input rather than going through local time.
                  eventDate: ev.eventDate.slice(0, 10),
                  eventTime: ev.eventTime,
                  title: ev.title,
                  note: ev.note ?? '',
                })}
                style={{ padding: '5px 12px', background: 'rgba(255,255,255,0.07)', color: 'rgba(226,232,240,0.8)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, fontSize: 12, cursor: 'pointer' }}
              >
                {t('edit')}
              </button>
              <button
                onClick={() => { if (confirm(t('pf_delete_event_confirm'))) removeEvent.mutate(ev.id); }}
                disabled={removeEvent.isPending}
                style={{ padding: '5px 12px', background: '#7f1d1d', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, cursor: 'pointer' }}
              >
                {t('delete')}
              </button>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
};
