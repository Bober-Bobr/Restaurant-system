import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { Button } from '../ui/button';
import { useAdminStore } from '../../store/admin.store';
import { translate } from '../../utils/translate';
const statusStyle = {
    DRAFT: { background: 'rgba(148,163,184,0.15)', color: '#cbd5e1', border: '1px solid rgba(148,163,184,0.3)' },
    CONFIRMED: { background: 'rgba(34,197,94,0.15)', color: '#4ade80', border: '1px solid rgba(34,197,94,0.3)' },
    CANCELLED: { background: 'rgba(220,38,38,0.15)', color: '#fca5a5', border: '1px solid rgba(220,38,38,0.3)' },
};
const eventTypeLabel = {
    RESERVATION: 'Reservation',
    BANQUET: 'Banquet',
    WEDDING: 'Wedding',
    PRIVATE_PARTY: 'Private Party',
    CORPORATE: 'Corporate',
};
function formatDateTime(iso) {
    const d = new Date(iso);
    return {
        date: d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }),
        time: d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }),
    };
}
export const EventList = ({ events, onDelete, onEdit, deletingId }) => {
    const { locale } = useAdminStore();
    const t = (key, params) => translate(key, locale, params);
    if (events.length === 0) {
        return (_jsx("div", { style: {
                border: '2px dashed rgba(255,255,255,0.08)',
                borderRadius: 16,
                padding: '56px 16px',
                textAlign: 'center',
                fontSize: 14,
                color: 'rgba(226,232,240,0.45)',
            }, children: "No events yet." }));
    }
    const hasActions = onEdit || onDelete;
    return (_jsx("div", { className: "adm-card tablet-fade-up", style: { overflow: 'auto' }, children: _jsxs("table", { className: "adm-table", children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { children: "#" }), _jsx("th", { children: "Customer" }), _jsx("th", { children: "Date / Time" }), _jsx("th", { children: "Type" }), _jsx("th", { children: "Guests" }), _jsx("th", { children: "Hall / Table" }), _jsx("th", { children: "Menu" }), _jsx("th", { children: "Notes" }), _jsx("th", { children: "Status" }), hasActions ? _jsx("th", { children: "Actions" }) : null] }) }), _jsx("tbody", { children: events.map((event) => {
                        const { date, time } = formatDateTime(event.eventDate);
                        const dishTypes = event.selections?.length ?? 0;
                        const totalPcs = event.selections?.reduce((s, sel) => s + sel.quantity, 0) ?? 0;
                        return (_jsxs("tr", { children: [_jsxs("td", { style: { whiteSpace: 'nowrap', fontFamily: 'monospace', fontSize: 12, color: '#c9a42c' }, children: ["#", event.id] }), _jsxs("td", { children: [_jsx("p", { style: { margin: 0, fontWeight: 600, color: '#f8fafc' }, children: event.customerName }), event.customerPhone && (_jsx("p", { style: { margin: '2px 0 0', fontSize: 11, color: 'rgba(226,232,240,0.5)' }, children: event.customerPhone }))] }), _jsxs("td", { style: { whiteSpace: 'nowrap' }, children: [_jsx("p", { style: { margin: 0, color: '#e2e8f0' }, children: date }), _jsx("p", { style: { margin: '2px 0 0', fontSize: 11, color: 'rgba(226,232,240,0.5)' }, children: time })] }), _jsx("td", { style: { whiteSpace: 'nowrap', color: 'rgba(226,232,240,0.75)' }, children: event.eventType ? (eventTypeLabel[event.eventType] ?? event.eventType) : '—' }), _jsx("td", { style: { whiteSpace: 'nowrap', color: 'rgba(226,232,240,0.75)' }, children: event.guestCount }), _jsxs("td", { children: [event.hall ? (_jsx("p", { style: { margin: 0, color: '#e2e8f0' }, children: event.hall.name })) : (_jsx("p", { style: { margin: 0, color: 'rgba(226,232,240,0.35)' }, children: "\u2014" })), event.tableCategory && (_jsx("p", { style: { margin: '2px 0 0', fontSize: 11, color: 'rgba(226,232,240,0.5)' }, children: event.tableCategory.name }))] }), _jsx("td", { style: { whiteSpace: 'nowrap' }, children: dishTypes > 0 ? (_jsxs(_Fragment, { children: [_jsxs("p", { style: { margin: 0, color: '#e2e8f0' }, children: [dishTypes, " ", dishTypes === 1 ? 'dish' : 'dishes'] }), _jsxs("p", { style: { margin: '2px 0 0', fontSize: 11, color: 'rgba(226,232,240,0.5)' }, children: [totalPcs, " pcs total"] })] })) : (_jsx("p", { style: { margin: 0, color: 'rgba(226,232,240,0.35)' }, children: "\u2014" })) }), _jsx("td", { style: { maxWidth: 180 }, children: event.notes ? (_jsx("p", { style: { margin: 0, fontSize: 12, color: 'rgba(226,232,240,0.65)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }, title: event.notes, children: event.notes })) : (_jsx("p", { style: { margin: 0, color: 'rgba(226,232,240,0.35)' }, children: "\u2014" })) }), _jsx("td", { style: { whiteSpace: 'nowrap' }, children: _jsx("span", { className: "adm-badge", style: statusStyle[event.status] ?? statusStyle.DRAFT, children: event.status }) }), hasActions ? (_jsx("td", { style: { whiteSpace: 'nowrap' }, children: _jsxs("div", { style: { display: 'flex', gap: 8 }, children: [onEdit && (_jsx(Button, { type: "button", variant: "outline", size: "sm", onClick: () => onEdit(event.id), children: "Edit" })), onDelete && (_jsx(Button, { type: "button", variant: "destructive", size: "sm", disabled: deletingId === event.id, onClick: () => {
                                                    if (window.confirm(t('confirm_delete_event', { name: event.customerName }))) {
                                                        onDelete(event.id);
                                                    }
                                                }, children: deletingId === event.id ? t('deleting') : t('delete') }))] }) })) : null] }, event.id));
                    }) })] }) }));
};
