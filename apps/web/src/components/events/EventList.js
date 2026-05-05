import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { Button } from '../ui/button';
import { useAdminStore } from '../../store/admin.store';
import { translate } from '../../utils/translate';
const statusStyles = {
    DRAFT: 'bg-slate-100 text-slate-600',
    CONFIRMED: 'bg-emerald-100 text-emerald-700',
    CANCELLED: 'bg-red-100 text-red-600',
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
        return (_jsx("div", { className: "rounded-2xl border border-dashed border-slate-200 py-14 text-center text-sm text-slate-400", children: "No events yet." }));
    }
    const hasActions = onEdit || onDelete;
    return (_jsx("div", { className: "overflow-x-auto rounded-2xl border border-slate-200", children: _jsxs("table", { className: "w-full border-collapse text-sm", children: [_jsx("thead", { children: _jsxs("tr", { className: "border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wider text-slate-500", children: [_jsx("th", { className: "px-4 py-3", children: "#" }), _jsx("th", { className: "px-4 py-3", children: "Customer" }), _jsx("th", { className: "px-4 py-3", children: "Date / Time" }), _jsx("th", { className: "px-4 py-3", children: "Type" }), _jsx("th", { className: "px-4 py-3", children: "Guests" }), _jsx("th", { className: "px-4 py-3", children: "Hall / Table" }), _jsx("th", { className: "px-4 py-3", children: "Menu" }), _jsx("th", { className: "px-4 py-3", children: "Notes" }), _jsx("th", { className: "px-4 py-3", children: "Status" }), hasActions ? _jsx("th", { className: "px-4 py-3", children: "Actions" }) : null] }) }), _jsx("tbody", { className: "divide-y divide-slate-100", children: events.map((event) => {
                        const { date, time } = formatDateTime(event.eventDate);
                        const dishTypes = event.selections?.length ?? 0;
                        const totalPcs = event.selections?.reduce((s, sel) => s + sel.quantity, 0) ?? 0;
                        return (_jsxs("tr", { className: "transition-colors hover:bg-slate-50", children: [_jsxs("td", { className: "whitespace-nowrap px-4 py-3 font-mono text-xs text-slate-400", children: ["#", event.id] }), _jsxs("td", { className: "px-4 py-3", children: [_jsx("p", { className: "font-medium text-slate-900", children: event.customerName }), event.customerPhone && (_jsx("p", { className: "mt-0.5 text-xs text-slate-500", children: event.customerPhone }))] }), _jsxs("td", { className: "whitespace-nowrap px-4 py-3", children: [_jsx("p", { className: "text-slate-800", children: date }), _jsx("p", { className: "mt-0.5 text-xs text-slate-500", children: time })] }), _jsx("td", { className: "whitespace-nowrap px-4 py-3 text-slate-700", children: event.eventType ? (eventTypeLabel[event.eventType] ?? event.eventType) : '—' }), _jsx("td", { className: "whitespace-nowrap px-4 py-3 text-slate-700", children: event.guestCount }), _jsxs("td", { className: "px-4 py-3", children: [event.hall ? (_jsx("p", { className: "text-slate-800", children: event.hall.name })) : (_jsx("p", { className: "text-slate-400", children: "\u2014" })), event.tableCategory && (_jsx("p", { className: "mt-0.5 text-xs text-slate-500", children: event.tableCategory.name }))] }), _jsx("td", { className: "whitespace-nowrap px-4 py-3", children: dishTypes > 0 ? (_jsxs(_Fragment, { children: [_jsxs("p", { className: "text-slate-800", children: [dishTypes, " ", dishTypes === 1 ? 'dish' : 'dishes'] }), _jsxs("p", { className: "mt-0.5 text-xs text-slate-500", children: [totalPcs, " pcs total"] })] })) : (_jsx("p", { className: "text-slate-400", children: "\u2014" })) }), _jsx("td", { className: "max-w-[180px] px-4 py-3", children: event.notes ? (_jsx("p", { className: "truncate text-xs text-slate-500", title: event.notes, children: event.notes })) : (_jsx("p", { className: "text-slate-400", children: "\u2014" })) }), _jsx("td", { className: "whitespace-nowrap px-4 py-3", children: _jsx("span", { className: `inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusStyles[event.status] ?? 'bg-slate-100 text-slate-600'}`, children: event.status }) }), hasActions ? (_jsx("td", { className: "whitespace-nowrap px-4 py-3", children: _jsxs("div", { className: "flex gap-2", children: [onEdit && (_jsx(Button, { type: "button", variant: "outline", size: "sm", onClick: () => onEdit(event.id), children: "Edit" })), onDelete && (_jsx(Button, { type: "button", variant: "destructive", size: "sm", disabled: deletingId === event.id, onClick: () => {
                                                    if (window.confirm(t('confirm_delete_event', { name: event.customerName }))) {
                                                        onDelete(event.id);
                                                    }
                                                }, children: deletingId === event.id ? t('deleting') : t('delete') }))] }) })) : null] }, event.id));
                    }) })] }) }));
};
