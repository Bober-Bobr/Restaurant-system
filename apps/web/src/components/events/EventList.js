import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export const EventList = ({ events, onDelete, onEdit, deletingId }) => {
    if (events.length === 0) {
        return _jsx("p", { children: "No events yet." });
    }
    return (_jsxs("table", { width: "100%", cellPadding: 8, children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { align: "left", children: "ID" }), _jsx("th", { align: "left", children: "Customer" }), _jsx("th", { align: "left", children: "Date" }), _jsx("th", { align: "left", children: "Guests" }), _jsx("th", { align: "left", children: "Status" }), (onEdit || onDelete) ? _jsx("th", { align: "left", children: "Actions" }) : null] }) }), _jsx("tbody", { children: events.map((event) => (_jsxs("tr", { children: [_jsxs("td", { style: { fontWeight: 600, color: '#2196F3' }, children: ["#", event.id] }), _jsx("td", { children: event.customerName }), _jsx("td", { children: new Date(event.eventDate).toLocaleDateString() }), _jsx("td", { children: event.guestCount }), _jsx("td", { children: event.status }), (onEdit || onDelete) ? (_jsxs("td", { style: { display: 'flex', gap: 8 }, children: [onEdit ? (_jsx("button", { type: "button", onClick: () => onEdit(event.id), children: "Edit" })) : null, onDelete ? (_jsx("button", { type: "button", disabled: deletingId === event.id, onClick: () => {
                                        if (window.confirm(`Delete reservation for ${event.customerName}?`)) {
                                            onDelete(event.id);
                                        }
                                    }, children: deletingId === event.id ? 'Deleting…' : 'Delete' })) : null] })) : null] }, event.id))) })] }));
};
