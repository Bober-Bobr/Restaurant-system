import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { eventService } from '../services/event.service';
import { hallService } from '../services/hall.service';
import { useAdminStore } from '../store/admin.store';
import { translate } from '../utils/translate';
import type { Event, Hall } from '../types/domain';

const MONTH_KEYS = [
  'month_january', 'month_february', 'month_march', 'month_april',
  'month_may', 'month_june', 'month_july', 'month_august',
  'month_september', 'month_october', 'month_november', 'month_december',
] as const;

// Week starts on Monday (international standard)
const WEEKDAY_KEYS = [
  'weekday_mon', 'weekday_tue', 'weekday_wed', 'weekday_thu',
  'weekday_fri', 'weekday_sat', 'weekday_sun',
] as const;

type Slot = 'breakfast' | 'lunch' | 'dinner';
const SLOT_COLORS: Record<Slot, string> = {
  breakfast: '#fde047',
  lunch: '#fb923c',
  dinner: '#818cf8',
};
const SLOT_KEYS: Record<Slot, Parameters<typeof translate>[0]> = {
  breakfast: 'breakfast',
  lunch: 'lunch',
  dinner: 'dinner',
};

// Returns which slot an event time falls into (or null if outside the windows).
function slotForHour(hour: number): Slot | null {
  if (hour >= 6 && hour < 11) return 'breakfast';
  if (hour >= 11 && hour < 15) return 'lunch';
  if (hour >= 15 && hour < 20) return 'dinner';
  return null;
}

export const CalendarPage = () => {
  const { locale } = useAdminStore();
  const t = (key: Parameters<typeof translate>[0], params?: Record<string, string | number>) =>
    translate(key, locale, params);

  const now = new Date();
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth());

  const hallsQuery = useQuery<Hall[]>({
    queryKey: ['halls'],
    queryFn: () => hallService.list(),
  });

  const eventsQuery = useQuery<Event[]>({
    queryKey: ['events'],
    queryFn: () => eventService.list(),
  });

  const halls = (hallsQuery.data ?? []).filter((h) => h.isActive);
  const events = eventsQuery.data ?? [];

  // Map: hallId → date key (YYYY-MM-DD) → set of slots filled
  const bookingsByHallByDay = useMemo(() => {
    const map = new Map<string, Map<string, Set<Slot>>>();
    for (const ev of events) {
      if (!ev.hallId || ev.status === 'CANCELLED') continue;
      const d = new Date(ev.eventDate);
      if (Number.isNaN(d.getTime())) continue;
      const dayKey = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      const slot = slotForHour(d.getHours());
      if (!map.has(ev.hallId)) map.set(ev.hallId, new Map());
      const dayMap = map.get(ev.hallId)!;
      if (!dayMap.has(dayKey)) dayMap.set(dayKey, new Set());
      if (slot) dayMap.get(dayKey)!.add(slot);
    }
    return map;
  }, [events]);

  const goPrev = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(viewYear - 1); }
    else setViewMonth(viewMonth - 1);
  };
  const goNext = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(viewYear + 1); }
    else setViewMonth(viewMonth + 1);
  };

  return (
    <main className="tablet-fade-in" style={{ maxWidth: 1280, margin: '0 auto', padding: '28px 20px', position: 'relative', zIndex: 1 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <h1 className="adm-title" style={{ margin: 0 }}>{t('calendar')}</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button type="button" onClick={goPrev}
            style={{
              width: 38, height: 38, borderRadius: 10,
              background: 'rgba(201,164,44,0.12)',
              border: '1px solid rgba(201,164,44,0.35)',
              color: '#c9a42c', fontSize: 18, fontWeight: 700, cursor: 'pointer',
            }}>‹</button>
          <div style={{
            minWidth: 200, textAlign: 'center', padding: '8px 18px',
            background: 'rgba(15,23,42,0.6)', borderRadius: 10,
            border: '1px solid rgba(255,255,255,0.08)',
            color: '#f8fafc', fontWeight: 700, fontSize: 15,
          }}>
            {t(MONTH_KEYS[viewMonth])} {viewYear}
          </div>
          <button type="button" onClick={goNext}
            style={{
              width: 38, height: 38, borderRadius: 10,
              background: 'rgba(201,164,44,0.12)',
              border: '1px solid rgba(201,164,44,0.35)',
              color: '#c9a42c', fontSize: 18, fontWeight: 700, cursor: 'pointer',
            }}>›</button>
        </div>
      </div>

      {/* Legend */}
      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: 16,
        marginBottom: 20, padding: '12px 16px',
        background: 'rgba(15,23,42,0.4)', borderRadius: 12,
        border: '1px solid rgba(255,255,255,0.06)',
      }}>
        <LegendDot color="rgba(220,38,38,0.5)" label={t('booked')} t={t} />
        {(['breakfast', 'lunch', 'dinner'] as Slot[]).map((s) => (
          <LegendDot key={s} color={SLOT_COLORS[s]} label={t(SLOT_KEYS[s])} t={t} />
        ))}
      </div>

      {hallsQuery.isLoading ? (
        <p style={{ color: 'rgba(226,232,240,0.5)' }}>...</p>
      ) : halls.length === 0 ? (
        <p style={{ color: 'rgba(226,232,240,0.5)' }}>{t('no_halls_to_display')}</p>
      ) : (
        <div style={{ display: 'grid', gap: 20, gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))' }}>
          {halls.map((hall) => (
            <HallCalendar
              key={hall.id}
              hall={hall}
              year={viewYear}
              month={viewMonth}
              bookings={bookingsByHallByDay.get(hall.id) ?? new Map()}
              t={t}
            />
          ))}
        </div>
      )}
    </main>
  );
};

function LegendDot({ color, label }: { color: string; label: string; t: (k: Parameters<typeof translate>[0]) => string }) {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      <span style={{ width: 12, height: 12, borderRadius: '50%', background: color, display: 'inline-block' }} />
      <span style={{ fontSize: 12, color: 'rgba(226,232,240,0.7)' }}>{label}</span>
    </div>
  );
}

function HallCalendar({
  hall, year, month, bookings, t,
}: {
  hall: Hall;
  year: number;
  month: number;
  bookings: Map<string, Set<Slot>>;
  t: (k: Parameters<typeof translate>[0], p?: Record<string, string | number>) => string;
}) {
  const today = new Date();
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month;

  // Build grid: 6 rows × 7 days = 42 cells max
  const firstOfMonth = new Date(year, month, 1);
  const firstWeekday = (firstOfMonth.getDay() + 6) % 7; // shift so Monday = 0
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells: Array<{ day: number | null; key: string; slots: Set<Slot> | null }> = [];
  for (let i = 0; i < firstWeekday; i++) cells.push({ day: null, key: `lead-${i}`, slots: null });
  for (let d = 1; d <= daysInMonth; d++) {
    const dayKey = `${year}-${month}-${d}`;
    const slots = bookings.get(dayKey) ?? null;
    cells.push({ day: d, key: dayKey, slots });
  }
  while (cells.length % 7 !== 0) cells.push({ day: null, key: `tail-${cells.length}`, slots: null });

  return (
    <section className="adm-card tablet-fade-up" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <div>
          <p className="adm-heading" style={{ margin: 0 }}>{t('hall')}</p>
          <h3 style={{ margin: '4px 0 0', color: '#f8fafc', fontWeight: 700, fontSize: 17 }}>{hall.name}</h3>
        </div>
        <span style={{
          fontSize: 11, fontWeight: 600,
          color: 'rgba(226,232,240,0.6)',
          padding: '4px 10px', borderRadius: 999,
          background: 'rgba(255,255,255,0.06)',
          border: '1px solid rgba(255,255,255,0.08)',
        }}>
          {hall.capacity} {t('guests')}
        </span>
      </header>

      {/* Weekday headers */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
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

      {/* Day cells */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
        {cells.map((cell) => {
          if (cell.day === null) {
            return <div key={cell.key} />;
          }
          const isToday = isCurrentMonth && cell.day === today.getDate();
          const hasBookings = cell.slots !== null;
          return (
            <div
              key={cell.key}
              style={{
                aspectRatio: '1 / 1',
                position: 'relative',
                borderRadius: 8,
                border: '1px solid',
                borderColor: isToday ? 'rgba(201,164,44,0.6)' : 'rgba(255,255,255,0.06)',
                background: hasBookings
                  ? 'rgba(220,38,38,0.32)'
                  : 'rgba(15,23,42,0.4)',
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'flex-start',
                padding: '4px 2px 2px',
                overflow: 'hidden',
              }}
            >
              <span style={{
                fontSize: 13, fontWeight: isToday ? 800 : 600,
                color: isToday ? '#c9a42c' : (hasBookings ? '#fff' : 'rgba(226,232,240,0.7)'),
                lineHeight: 1,
              }}>
                {cell.day}
              </span>
              {hasBookings && (
                <div style={{ display: 'flex', gap: 3, marginTop: 'auto', marginBottom: 2 }}>
                  {(['breakfast', 'lunch', 'dinner'] as Slot[]).map((slot) => {
                    const filled = cell.slots!.has(slot);
                    return (
                      <span
                        key={slot}
                        title={t(SLOT_KEYS[slot])}
                        style={{
                          width: 6, height: 6, borderRadius: '50%',
                          background: filled ? SLOT_COLORS[slot] : 'transparent',
                          border: filled ? 'none' : `1px solid ${SLOT_COLORS[slot]}80`,
                          opacity: filled ? 1 : 0.4,
                        }}
                      />
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
