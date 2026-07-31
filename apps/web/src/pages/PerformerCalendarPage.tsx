import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { performerService, type PerformerEvent } from '../services/performer.service';
import { useAdminStore } from '../store/admin.store';
import { useAuthStore } from '../store/auth.store';
import { translate } from '../utils/translate';

const MONTH_KEYS = [
  'month_january', 'month_february', 'month_march', 'month_april',
  'month_may', 'month_june', 'month_july', 'month_august',
  'month_september', 'month_october', 'month_november', 'month_december',
] as const;

// Week starts on Monday, matching the admin calendar.
const WEEKDAY_KEYS = [
  'weekday_mon', 'weekday_tue', 'weekday_wed', 'weekday_thu',
  'weekday_fri', 'weekday_sat', 'weekday_sun',
] as const;

type Draft = { id?: string; eventDate: string; eventTime: string; title: string; note: string; program: string };
type SourceFilter = 'all' | 'manual' | 'booking';

// Entries are stored as UTC midnight, so read the day parts off the ISO string
// rather than through the local-time Date getters — otherwise an entry lands in
// the previous day's cell for anyone west of UTC.
function dayKeyOf(iso: string): string {
  return iso.slice(0, 10);
}
function ymd(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

// The performer's or host's schedule. Entries are added by hand here, and
// appear automatically when a booking request is accepted — those carry a
// bookingId and are shown in a different colour, but are otherwise ordinary
// entries.
//
// Hosts additionally record the event programme against an entry. It arrives
// pre-filled on entries created from a booking, since the client had to supply
// one to book at all, and is editable from there.
export const PerformerCalendarPage = () => {
  const { locale } = useAdminStore();
  const isHost = useAuthStore((state) => state.role) === 'HOST';
  const t = (k: Parameters<typeof translate>[0]) => translate(k, locale);
  const queryClient = useQueryClient();

  const eventsQuery = useQuery({ queryKey: ['pf-events'], queryFn: () => performerService.listEvents() });

  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [source, setSource] = useState<SourceFilter>('all');
  const [search, setSearch] = useState('');
  const [openDay, setOpenDay] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);

  const events = eventsQuery.data ?? [];

  // Filters apply to the grid and the list alike, so what you see marked is
  // exactly what you see listed.
  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return events.filter((ev) => {
      if (source === 'manual' && ev.bookingId) return false;
      if (source === 'booking' && !ev.bookingId) return false;
      if (!needle) return true;
      return ev.title.toLowerCase().includes(needle)
        || (ev.note ?? '').toLowerCase().includes(needle);
    });
  }, [events, source, search]);

  const byDay = useMemo(() => {
    const map = new Map<string, PerformerEvent[]>();
    for (const ev of filtered) {
      const key = dayKeyOf(ev.eventDate);
      const list = map.get(key);
      if (list) list.push(ev); else map.set(key, [ev]);
    }
    for (const list of map.values()) list.sort((a, b) => a.eventTime.localeCompare(b.eventTime));
    return map;
  }, [filtered]);

  const monthEvents = useMemo(() => {
    const prefix = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}`;
    return filtered
      .filter((ev) => dayKeyOf(ev.eventDate).startsWith(prefix))
      .sort((a, b) => (dayKeyOf(a.eventDate) + a.eventTime).localeCompare(dayKeyOf(b.eventDate) + b.eventTime));
  }, [filtered, viewYear, viewMonth]);

  const goPrev = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(viewYear - 1); }
    else setViewMonth(viewMonth - 1);
    setOpenDay(null);
  };
  const goNext = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(viewYear + 1); }
    else setViewMonth(viewMonth + 1);
    setOpenDay(null);
  };
  const goToday = () => {
    setViewYear(today.getFullYear());
    setViewMonth(today.getMonth());
    setOpenDay(null);
  };

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
        // Only hosts are shown the field, so only hosts can write it. Sending
        // it unconditionally would blank a value the moment the role changed.
        ...(isHost ? { program: draft!.program.trim() || null } : {}),
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

  const canSave = !!draft?.eventDate && !!draft?.eventTime && !!draft?.title.trim();

  // ── Month grid cells (Monday-first, padded to whole weeks) ──
  const firstWeekday = (new Date(viewYear, viewMonth, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const cells: Array<{ day: number | null; key: string }> = [];
  for (let i = 0; i < firstWeekday; i++) cells.push({ day: null, key: `lead-${i}` });
  for (let d = 1; d <= daysInMonth; d++) cells.push({ day: d, key: ymd(viewYear, viewMonth, d) });
  while (cells.length % 7 !== 0) cells.push({ day: null, key: `tail-${cells.length}` });

  const isCurrentMonth = today.getFullYear() === viewYear && today.getMonth() === viewMonth;

  const inputStyle: React.CSSProperties = {
    background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10,
    color: '#e2e8f0', padding: '0.6rem 0.9rem', width: '100%', fontSize: 14,
    fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
  };
  const labelText: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: 'rgba(226,232,240,0.75)' };
  const navBtn: React.CSSProperties = {
    width: 38, height: 38, borderRadius: 10,
    background: 'rgba(201,164,44,0.12)', border: '1px solid rgba(201,164,44,0.35)',
    color: '#c9a42c', fontSize: 18, fontWeight: 700, cursor: 'pointer',
  };
  const chip = (active: boolean): React.CSSProperties => ({
    padding: '6px 14px', borderRadius: 999, fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
    background: active ? 'rgba(201,164,44,0.15)' : 'rgba(15,23,42,0.5)',
    color: active ? '#c9a42c' : 'rgba(226,232,240,0.65)',
    border: `1px solid ${active ? 'rgba(201,164,44,0.5)' : 'rgba(255,255,255,0.1)'}`,
    transition: 'all 0.18s',
  });

  return (
    <main className="tablet-fade-in" style={{ maxWidth: 1080, margin: '0 auto', padding: '28px 20px', position: 'relative', zIndex: 1 }}>

      {/* Header: month navigation */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 18, flexWrap: 'wrap' }}>
        <h1 className="adm-title" style={{ margin: 0 }}>{t('pf_calendar')}</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button type="button" onClick={goPrev} style={navBtn} aria-label="previous month">‹</button>
          <div style={{
            minWidth: 200, textAlign: 'center', padding: '8px 18px',
            background: 'rgba(15,23,42,0.6)', borderRadius: 10,
            border: '1px solid rgba(255,255,255,0.08)',
            color: '#f8fafc', fontWeight: 700, fontSize: 15,
          }}>
            {t(MONTH_KEYS[viewMonth])} {viewYear}
          </div>
          <button type="button" onClick={goNext} style={navBtn} aria-label="next month">›</button>
          <button type="button" onClick={goToday} style={{ ...chip(false), height: 38 }}>{t('pf_today')}</button>
        </div>
      </div>

      {/* Filters */}
      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center',
        marginBottom: 18, padding: '12px 16px',
        background: 'rgba(15,23,42,0.4)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.06)',
      }}>
        {(['all', 'manual', 'booking'] as SourceFilter[]).map((s) => (
          <button key={s} type="button" onClick={() => { setSource(s); setOpenDay(null); }} style={chip(source === s)}>
            {s === 'all' ? t('pf_filter_all') : s === 'manual' ? t('pf_filter_manual') : t('pf_filter_bookings')}
          </button>
        ))}
        <input
          value={search}
          onChange={(e) => { setSearch(e.target.value); setOpenDay(null); }}
          placeholder={t('pf_search')}
          style={{ ...inputStyle, width: 'auto', flex: '1 1 200px', minWidth: 160, padding: '6px 12px' }}
        />
        <span style={{ fontSize: 12, color: 'rgba(226,232,240,0.5)' }}>
          {monthEvents.length} / {events.length}
        </span>
        <button
          type="button"
          className="adm-btn-primary"
          style={{ marginLeft: 'auto' }}
          onClick={() => setDraft({ eventDate: ymd(viewYear, viewMonth, Math.min(today.getDate(), daysInMonth)), eventTime: '', title: '', note: '', program: '' })}
        >
          {t('pf_add_event')}
        </button>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginBottom: 14, fontSize: 12, color: 'rgba(226,232,240,0.6)' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
          <span style={{ width: 12, height: 12, borderRadius: 3, background: 'rgba(201,164,44,0.55)' }} /> {t('pf_filter_manual')}
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
          <span style={{ width: 12, height: 12, borderRadius: 3, background: 'rgba(219,39,119,0.6)' }} /> {t('pf_from_booking')}
        </span>
      </div>

      {/* Editor */}
      {draft && (
        <section className="adm-card adm-section tablet-fade-up" style={{ display: 'grid', gap: 14, marginBottom: 20 }}>
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
          {isHost && (
            <label style={{ display: 'grid', gap: 4 }}>
              <span style={labelText}>{t('pf_program')}</span>
              <textarea
                style={{ ...inputStyle, minHeight: 140, resize: 'vertical' }}
                placeholder={t('pf_program_hint')}
                value={draft.program}
                onChange={(e) => setDraft({ ...draft, program: e.target.value })}
              />
            </label>
          )}
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

      {/* Month grid */}
      <section className="adm-card tablet-fade-up" style={{ padding: 16, display: 'grid', gap: 10, marginBottom: 20 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 5 }}>
          {WEEKDAY_KEYS.map((wk) => (
            <div key={wk} style={{
              textAlign: 'center', fontSize: 10, fontWeight: 700,
              color: 'rgba(226,232,240,0.45)', letterSpacing: '0.08em',
              textTransform: 'uppercase', padding: '4px 0',
            }}>
              {t(wk)}
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 5 }}>
          {cells.map((cell) => {
            if (cell.day === null) return <div key={cell.key} />;
            const dayEvents = byDay.get(cell.key) ?? [];
            const isToday = isCurrentMonth && cell.day === today.getDate();
            const isOpen = openDay === cell.key;
            const hasBooking = dayEvents.some((e) => e.bookingId);
            const hasManual = dayEvents.some((e) => !e.bookingId);
            const bg = dayEvents.length === 0
              ? 'rgba(15,23,42,0.4)'
              : hasBooking && !hasManual ? 'rgba(219,39,119,0.35)'
              : hasBooking ? 'rgba(160,60,110,0.38)'
              : 'rgba(201,164,44,0.28)';

            return (
              <button
                key={cell.key}
                type="button"
                // Clicking any day opens it — an empty day is where you add one.
                onClick={() => setOpenDay(isOpen ? null : cell.key)}
                style={{
                  aspectRatio: '1 / 1', borderRadius: 8, border: '1px solid',
                  borderColor: isOpen ? '#c9a42c' : isToday ? 'rgba(201,164,44,0.6)' : 'rgba(255,255,255,0.06)',
                  background: bg,
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start',
                  padding: '4px 2px', overflow: 'hidden', cursor: 'pointer', font: 'inherit',
                }}
              >
                <span style={{
                  fontSize: 13, fontWeight: isToday ? 800 : 600, lineHeight: 1,
                  color: isToday ? '#c9a42c' : dayEvents.length ? '#fff' : 'rgba(226,232,240,0.7)',
                }}>
                  {cell.day}
                </span>
                {dayEvents.length > 0 && (
                  <span style={{ marginTop: 3, fontSize: 10, color: 'rgba(255,255,255,0.85)', lineHeight: 1.2 }}>
                    {dayEvents.length > 1 ? `${dayEvents.length} ×` : dayEvents[0].eventTime}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </section>

      {/* Selected day */}
      {openDay && (
        <section className="adm-card adm-section tablet-fade-up" style={{ display: 'grid', gap: 12, marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <h2 className="adm-heading" style={{ margin: 0 }}>{new Date(`${openDay}T00:00:00Z`).toLocaleDateString()}</h2>
            <button
              type="button"
              className="adm-btn-primary"
              style={{ marginLeft: 'auto' }}
              onClick={() => setDraft({ eventDate: openDay, eventTime: '', title: '', note: '', program: '' })}
            >
              {t('pf_add_event')}
            </button>
          </div>
          {(byDay.get(openDay) ?? []).length === 0
            ? <p style={{ margin: 0, color: 'rgba(226,232,240,0.5)', fontSize: 13 }}>{t('pf_no_events')}</p>
            : (byDay.get(openDay) ?? []).map((ev) => (
              <EventRow key={ev.id} ev={ev} t={t} onEdit={setDraft} onDelete={(id) => removeEvent.mutate(id)} deleting={removeEvent.isPending} />
            ))}
        </section>
      )}

      {/* Everything in the visible month, matching the filters */}
      <h2 className="adm-heading" style={{ margin: '0 0 12px' }}>
        {t(MONTH_KEYS[viewMonth])} {viewYear}
      </h2>
      {eventsQuery.isLoading && <p style={{ color: 'rgba(226,232,240,0.55)' }}>…</p>}
      {!eventsQuery.isLoading && monthEvents.length === 0 && <p className="adm-empty">{t('pf_no_events')}</p>}
      <div style={{ display: 'grid', gap: 10 }}>
        {monthEvents.map((ev) => (
          <EventRow key={ev.id} ev={ev} t={t} showDate onEdit={setDraft} onDelete={(id) => removeEvent.mutate(id)} deleting={removeEvent.isPending} />
        ))}
      </div>
    </main>
  );
};

function EventRow({ ev, t, showDate, onEdit, onDelete, deleting }: {
  ev: PerformerEvent;
  t: (k: Parameters<typeof translate>[0]) => string;
  showDate?: boolean;
  onEdit: (d: Draft) => void;
  onDelete: (id: string) => void;
  deleting: boolean;
}) {
  return (
    <div className="adm-card adm-card-hover" style={{ padding: 14, display: 'grid', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <strong style={{ fontSize: 15 }}>{ev.title}</strong>
        {ev.bookingId && (
          <span className="adm-badge" style={{ background: 'rgba(219,39,119,0.18)', color: '#f9a8d4', border: '1px solid rgba(219,39,119,0.35)' }}>
            {t('pf_from_booking')}
          </span>
        )}
        <span style={{ marginLeft: 'auto', fontSize: 13, color: 'rgba(226,232,240,0.65)' }}>
          {showDate && `${new Date(ev.eventDate).toLocaleDateString()} · `}{ev.eventTime}
        </span>
      </div>
      {ev.note && <p style={{ margin: 0, fontSize: 13, color: 'rgba(226,232,240,0.6)', whiteSpace: 'pre-wrap' }}>{ev.note}</p>}
      {ev.program && (
        <div style={{
          display: 'grid', gap: 4, padding: '10px 12px', borderRadius: 8,
          background: 'rgba(201,164,44,0.08)', border: '1px solid rgba(201,164,44,0.25)',
        }}>
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: '#c9a42c' }}>
            {t('pf_program')}
          </span>
          <p style={{ margin: 0, fontSize: 13, color: 'rgba(226,232,240,0.8)', whiteSpace: 'pre-wrap' }}>{ev.program}</p>
        </div>
      )}
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={() => onEdit({
            id: ev.id,
            // Stored as UTC midnight — slice the ISO string rather than going
            // through local time, which would shift the day.
            eventDate: ev.eventDate.slice(0, 10),
            eventTime: ev.eventTime,
            title: ev.title,
            note: ev.note ?? '',
            program: ev.program ?? '',
          })}
          style={{ padding: '5px 12px', background: 'rgba(255,255,255,0.07)', color: 'rgba(226,232,240,0.8)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, fontSize: 12, cursor: 'pointer' }}
        >
          {t('edit')}
        </button>
        <button
          onClick={() => { if (confirm(t('pf_delete_event_confirm'))) onDelete(ev.id); }}
          disabled={deleting}
          style={{ padding: '5px 12px', background: '#7f1d1d', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, cursor: 'pointer' }}
        >
          {t('delete')}
        </button>
      </div>
    </div>
  );
}
