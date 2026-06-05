import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { eventService } from '../services/event.service';
import { hallService } from '../services/hall.service';
import { useAdminStore } from '../store/admin.store';
import { translate } from '../utils/translate';
const MONTH_KEYS = [
    'month_january', 'month_february', 'month_march', 'month_april',
    'month_may', 'month_june', 'month_july', 'month_august',
    'month_september', 'month_october', 'month_november', 'month_december',
];
// Week starts on Monday (international standard)
const WEEKDAY_KEYS = [
    'weekday_mon', 'weekday_tue', 'weekday_wed', 'weekday_thu',
    'weekday_fri', 'weekday_sat', 'weekday_sun',
];
const SLOT_COLORS = {
    breakfast: '#fde047',
    lunch: '#fb923c',
    dinner: '#818cf8',
};
const SLOT_KEYS = {
    breakfast: 'breakfast',
    lunch: 'lunch',
    dinner: 'dinner',
};
const EVENT_TYPE_KEY = {
    RESERVATION: 'event_type_reservation',
    BANQUET: 'event_type_banquet',
    WEDDING: 'event_type_wedding',
    BIRTHDAY: 'event_type_birthday',
    PRIVATE_PARTY: 'event_type_private_party',
    CORPORATE: 'event_type_corporate',
};
// Returns which slot an event time falls into (or null if outside the windows).
function slotForHour(hour) {
    if (hour >= 6 && hour < 11)
        return 'breakfast';
    if (hour >= 11 && hour < 15)
        return 'lunch';
    if (hour >= 15 && hour < 20)
        return 'dinner';
    return null;
}
export const CalendarPage = () => {
    const { locale } = useAdminStore();
    const t = (key, params) => translate(key, locale, params);
    const now = new Date();
    const [viewYear, setViewYear] = useState(now.getFullYear());
    const [viewMonth, setViewMonth] = useState(now.getMonth());
    const hallsQuery = useQuery({
        queryKey: ['halls'],
        queryFn: () => hallService.list(),
    });
    const eventsQuery = useQuery({
        queryKey: ['events'],
        queryFn: () => eventService.list(),
    });
    const halls = (hallsQuery.data ?? []).filter((h) => h.isActive);
    const events = eventsQuery.data ?? [];
    // Map: hallId → date key (YYYY-MM-DD) → { slots, events }
    const bookingsByHallByDay = useMemo(() => {
        const map = new Map();
        for (const ev of events) {
            if (!ev.hallId || ev.status === 'CANCELLED')
                continue;
            const d = new Date(ev.eventDate);
            if (Number.isNaN(d.getTime()))
                continue;
            const dayKey = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
            const slot = slotForHour(d.getHours());
            if (!map.has(ev.hallId))
                map.set(ev.hallId, new Map());
            const dayMap = map.get(ev.hallId);
            if (!dayMap.has(dayKey))
                dayMap.set(dayKey, { slots: new Set(), events: [] });
            const booking = dayMap.get(dayKey);
            if (slot)
                booking.slots.add(slot);
            booking.events.push({
                name: ev.customerName,
                time: d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }),
                type: ev.eventType ?? null,
                sortAt: d.getTime(),
            });
        }
        for (const dayMap of map.values()) {
            for (const booking of dayMap.values()) {
                booking.events.sort((a, b) => a.sortAt - b.sortAt);
            }
        }
        return map;
    }, [events]);
    const goPrev = () => {
        if (viewMonth === 0) {
            setViewMonth(11);
            setViewYear(viewYear - 1);
        }
        else
            setViewMonth(viewMonth - 1);
    };
    const goNext = () => {
        if (viewMonth === 11) {
            setViewMonth(0);
            setViewYear(viewYear + 1);
        }
        else
            setViewMonth(viewMonth + 1);
    };
    return (_jsxs("main", { className: "tablet-fade-in", style: { maxWidth: 1280, margin: '0 auto', padding: '28px 20px', position: 'relative', zIndex: 1 }, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 20, flexWrap: 'wrap' }, children: [_jsx("h1", { className: "adm-title", style: { margin: 0 }, children: t('calendar') }), _jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 8 }, children: [_jsx("button", { type: "button", onClick: goPrev, style: {
                                    width: 38, height: 38, borderRadius: 10,
                                    background: 'rgba(201,164,44,0.12)',
                                    border: '1px solid rgba(201,164,44,0.35)',
                                    color: '#c9a42c', fontSize: 18, fontWeight: 700, cursor: 'pointer',
                                }, children: "\u2039" }), _jsxs("div", { style: {
                                    minWidth: 200, textAlign: 'center', padding: '8px 18px',
                                    background: 'rgba(15,23,42,0.6)', borderRadius: 10,
                                    border: '1px solid rgba(255,255,255,0.08)',
                                    color: '#f8fafc', fontWeight: 700, fontSize: 15,
                                }, children: [t(MONTH_KEYS[viewMonth]), " ", viewYear] }), _jsx("button", { type: "button", onClick: goNext, style: {
                                    width: 38, height: 38, borderRadius: 10,
                                    background: 'rgba(201,164,44,0.12)',
                                    border: '1px solid rgba(201,164,44,0.35)',
                                    color: '#c9a42c', fontSize: 18, fontWeight: 700, cursor: 'pointer',
                                }, children: "\u203A" })] })] }), _jsxs("div", { style: {
                    display: 'flex', flexWrap: 'wrap', gap: 16,
                    marginBottom: 20, padding: '12px 16px',
                    background: 'rgba(15,23,42,0.4)', borderRadius: 12,
                    border: '1px solid rgba(255,255,255,0.06)',
                }, children: [_jsx(LegendDot, { color: "rgba(220,38,38,0.5)", label: t('booked'), t: t }), ['breakfast', 'lunch', 'dinner'].map((s) => (_jsx(LegendDot, { color: SLOT_COLORS[s], label: t(SLOT_KEYS[s]), t: t }, s)))] }), hallsQuery.isLoading ? (_jsx("p", { style: { color: 'rgba(226,232,240,0.5)' }, children: "..." })) : halls.length === 0 ? (_jsx("p", { style: { color: 'rgba(226,232,240,0.5)' }, children: t('no_halls_to_display') })) : (_jsx("div", { style: { display: 'grid', gap: 20, gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))' }, children: halls.map((hall) => (_jsx(HallCalendar, { hall: hall, year: viewYear, month: viewMonth, bookings: bookingsByHallByDay.get(hall.id) ?? new Map(), t: t }, hall.id))) }))] }));
};
function LegendDot({ color, label }) {
    return (_jsxs("div", { style: { display: 'inline-flex', alignItems: 'center', gap: 8 }, children: [_jsx("span", { style: { width: 12, height: 12, borderRadius: '50%', background: color, display: 'inline-block' } }), _jsx("span", { style: { fontSize: 12, color: 'rgba(226,232,240,0.7)' }, children: label })] }));
}
function HallCalendar({ hall, year, month, bookings, t, }) {
    const today = new Date();
    const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month;
    const [openKey, setOpenKey] = useState(null);
    // Build grid: 6 rows × 7 days = 42 cells max
    const firstOfMonth = new Date(year, month, 1);
    const firstWeekday = (firstOfMonth.getDay() + 6) % 7; // shift so Monday = 0
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells = [];
    for (let i = 0; i < firstWeekday; i++)
        cells.push({ day: null, key: `lead-${i}`, booking: null });
    for (let d = 1; d <= daysInMonth; d++) {
        const dayKey = `${year}-${month}-${d}`;
        const booking = bookings.get(dayKey) ?? null;
        cells.push({ day: d, key: dayKey, booking });
    }
    while (cells.length % 7 !== 0)
        cells.push({ day: null, key: `tail-${cells.length}`, booking: null });
    return (_jsxs("section", { className: "adm-card tablet-fade-up", style: { padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }, children: [_jsxs("header", { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }, children: [_jsxs("div", { children: [_jsx("p", { className: "adm-heading", style: { margin: 0 }, children: t('hall') }), _jsx("h3", { style: { margin: '4px 0 0', color: '#f8fafc', fontWeight: 700, fontSize: 17 }, children: hall.name })] }), _jsxs("span", { style: {
                            fontSize: 11, fontWeight: 600,
                            color: 'rgba(226,232,240,0.6)',
                            padding: '4px 10px', borderRadius: 999,
                            background: 'rgba(255,255,255,0.06)',
                            border: '1px solid rgba(255,255,255,0.08)',
                        }, children: [hall.capacity, " ", t('guests')] })] }), _jsx("div", { style: { display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }, children: WEEKDAY_KEYS.map((wk) => (_jsx("div", { style: {
                        textAlign: 'center', fontSize: 10, fontWeight: 700,
                        color: 'rgba(226,232,240,0.45)', letterSpacing: '0.08em',
                        textTransform: 'uppercase', padding: '4px 0',
                    }, children: t(wk) }, wk))) }), _jsx("div", { style: { display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }, children: cells.map((cell) => {
                    if (cell.day === null) {
                        return _jsx("div", {}, cell.key);
                    }
                    const isToday = isCurrentMonth && cell.day === today.getDate();
                    const booking = cell.booking;
                    const hasBookings = booking !== null;
                    const isOpen = openKey === cell.key;
                    return (_jsxs("div", { style: { position: 'relative' }, children: [_jsxs("button", { type: "button", onClick: () => hasBookings && setOpenKey(isOpen ? null : cell.key), style: {
                                    width: '100%',
                                    aspectRatio: '1 / 1',
                                    borderRadius: 8,
                                    border: '1px solid',
                                    borderColor: isOpen ? '#c9a42c' : isToday ? 'rgba(201,164,44,0.6)' : 'rgba(255,255,255,0.06)',
                                    background: hasBookings ? 'rgba(220,38,38,0.32)' : 'rgba(15,23,42,0.4)',
                                    display: 'flex', flexDirection: 'column',
                                    alignItems: 'center', justifyContent: 'flex-start',
                                    padding: '4px 2px 2px',
                                    overflow: 'hidden',
                                    cursor: hasBookings ? 'pointer' : 'default',
                                    font: 'inherit',
                                }, children: [_jsx("span", { style: {
                                            fontSize: 13, fontWeight: isToday ? 800 : 600,
                                            color: isToday ? '#c9a42c' : (hasBookings ? '#fff' : 'rgba(226,232,240,0.7)'),
                                            lineHeight: 1,
                                        }, children: cell.day }), hasBookings && (_jsx("div", { style: { display: 'flex', gap: 3, marginTop: 'auto', marginBottom: 2 }, children: ['breakfast', 'lunch', 'dinner'].map((slot) => {
                                            const filled = booking.slots.has(slot);
                                            return (_jsx("span", { title: t(SLOT_KEYS[slot]), style: {
                                                    width: 6, height: 6, borderRadius: '50%',
                                                    background: filled ? SLOT_COLORS[slot] : 'transparent',
                                                    border: filled ? 'none' : `1px solid ${SLOT_COLORS[slot]}80`,
                                                    opacity: filled ? 1 : 0.4,
                                                } }, slot));
                                        }) }))] }), isOpen && booking && (_jsx(EventDayBox, { booking: booking, onClose: () => setOpenKey(null), t: t }))] }, cell.key));
                }) })] }));
}
function EventDayBox({ booking, onClose, t, }) {
    return (_jsxs(_Fragment, { children: [_jsx("div", { onClick: onClose, style: { position: 'fixed', inset: 0, zIndex: 40 } }), _jsx("div", { className: "scale-in", style: {
                    position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)',
                    marginTop: 6, zIndex: 41,
                    width: 'max(220px, 100%)',
                    background: 'rgba(15,23,42,0.98)',
                    border: '1px solid rgba(201,164,44,0.4)',
                    borderRadius: 12,
                    boxShadow: '0 12px 32px rgba(0,0,0,0.5)',
                    padding: 10,
                    display: 'flex', flexDirection: 'column', gap: 8,
                }, children: booking.events.map((ev, i) => (_jsxs("div", { style: {
                        display: 'flex', flexDirection: 'column', gap: 2,
                        padding: '8px 10px',
                        borderRadius: 8,
                        background: 'rgba(201,164,44,0.08)',
                        border: '1px solid rgba(201,164,44,0.2)',
                    }, children: [_jsx("p", { style: { margin: 0, fontSize: 13, fontWeight: 700, color: '#f8fafc' }, children: ev.name }), _jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }, children: [_jsx("span", { style: { fontSize: 12, color: '#c9a42c', fontWeight: 600 }, children: ev.time }), ev.type && (_jsx("span", { style: {
                                        fontSize: 10, fontWeight: 600, letterSpacing: '0.04em',
                                        padding: '2px 8px', borderRadius: 999,
                                        background: 'rgba(139,92,246,0.15)', color: '#c4b5fd',
                                        border: '1px solid rgba(139,92,246,0.3)',
                                    }, children: EVENT_TYPE_KEY[ev.type] ? t(EVENT_TYPE_KEY[ev.type]) : ev.type }))] })] }, i))) })] }));
}
