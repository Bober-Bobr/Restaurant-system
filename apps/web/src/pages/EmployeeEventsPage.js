import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useQuery } from '@tanstack/react-query';
import { eventService } from '../services/event.service';
import { hallService } from '../services/hall.service';
import { tableCategoryService } from '../services/tableCategory.service';
import { menuService } from '../services/menu.service';
import { useAdminStore } from '../store/admin.store';
import { translate } from '../utils/translate';
import { httpClient } from '../services/http';
const EVENT_TYPE_LABEL = {
    RESERVATION: 'Reservation',
    BANQUET: 'Banquet',
    WEDDING: 'Wedding',
    BIRTHDAY: 'Birthday',
    PRIVATE_PARTY: 'Private party',
    CORPORATE: 'Corporate',
};
const STATUS_BADGE = {
    DRAFT: { bg: '#9ca3af', label: 'Draft' },
    CONFIRMED: { bg: '#16a34a', label: 'Confirmed' },
    CANCELLED: { bg: '#dc2626', label: 'Cancelled' },
};
const formatDate = (iso, locale) => {
    const d = new Date(iso);
    return d.toLocaleString(locale === 'ru' ? 'ru-RU' : locale === 'uz' ? 'uz-UZ' : 'en-US', {
        year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    });
};
export const EmployeeEventsPage = () => {
    const { locale } = useAdminStore();
    const t = (key, params) => translate(key, locale, params);
    const eventsQuery = useQuery({ queryKey: ['events'], queryFn: () => eventService.list() });
    const hallsQuery = useQuery({ queryKey: ['halls'], queryFn: () => hallService.list() });
    const tcQuery = useQuery({ queryKey: ['tableCategories'], queryFn: () => tableCategoryService.list() });
    const menuQuery = useQuery({ queryKey: ['menu'], queryFn: () => menuService.list() });
    const events = eventsQuery.data ?? [];
    const halls = hallsQuery.data ?? [];
    const tableCategories = tcQuery.data ?? [];
    const menuItems = menuQuery.data ?? [];
    const downloadEvent = async (event, format) => {
        const hall = halls.find((h) => h.id === event.hallId);
        const tc = tableCategories.find((c) => c.id === event.tableCategoryId);
        const selectedItems = {};
        (event.selections ?? []).forEach((s) => {
            selectedItems[s.menuItem.id] = s.quantity;
        });
        // No financial information — pricing zeroed out for employees
        const body = {
            customerName: event.customerName,
            customerPhone: event.customerPhone ?? '',
            hallName: hall?.name ?? '',
            tableCategoryName: tc?.name ?? '',
            guestCount: event.guestCount,
            selectedItems,
            menuItems,
            pricing: { subtotalCents: 0, serviceFeeCents: 0, taxCents: 0, perGuestCents: 0, totalCents: 0 },
            locale,
            restaurantName: '',
            excludeFinancial: true,
        };
        const url = format === 'pdf' ? '/public/export/pdf' : '/public/export/excel';
        const filename = `event-${event.id}.${format === 'pdf' ? 'pdf' : 'xlsx'}`;
        try {
            const response = await httpClient.post(url, body, { responseType: 'blob' });
            const downloadUrl = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = downloadUrl;
            link.setAttribute('download', filename);
            document.body.appendChild(link);
            link.click();
            link.remove();
        }
        catch {
            alert(t('download_failed'));
        }
    };
    return (_jsxs("main", { style: { maxWidth: 1100, margin: '0 auto', padding: '24px 16px' }, children: [_jsx("h1", { style: { fontSize: 22, fontWeight: 700, marginBottom: 8 }, children: t('events') }), _jsxs("p", { style: { color: '#6b7280', fontSize: 13, marginBottom: 24 }, children: [events.length, " ", events.length === 1 ? 'event' : 'events'] }), eventsQuery.isLoading && _jsx("p", { style: { color: '#6b7280' }, children: t('loading_events') }), eventsQuery.isError && _jsx("p", { style: { color: '#dc2626' }, children: t('failed_load_events') }), _jsxs("div", { style: { display: 'grid', gap: 16 }, children: [events.map((event) => {
                        const hall = halls.find((h) => h.id === event.hallId);
                        const tc = tableCategories.find((c) => c.id === event.tableCategoryId);
                        const selections = event.selections ?? [];
                        const status = STATUS_BADGE[event.status];
                        return (_jsxs("div", { style: { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: 18 }, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, flexWrap: 'wrap' }, children: [_jsxs("h2", { style: { margin: 0, fontSize: 16, fontWeight: 700, color: '#111827' }, children: ["#", event.id, " \u2014 ", event.customerName] }), _jsx("span", { style: { padding: '2px 8px', background: status.bg, color: '#fff', borderRadius: 4, fontSize: 11, fontWeight: 600 }, children: status.label }), event.eventType && (_jsx("span", { style: { padding: '2px 8px', background: '#e0e7ff', color: '#3730a3', borderRadius: 4, fontSize: 11, fontWeight: 600 }, children: EVENT_TYPE_LABEL[event.eventType] }))] }), _jsxs("div", { style: { display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', marginBottom: 14 }, children: [_jsx(Detail, { label: t('event_date_time'), value: formatDate(event.eventDate, locale) }), _jsx(Detail, { label: t('guests'), value: String(event.guestCount) }), hall && _jsx(Detail, { label: t('hall'), value: hall.name }), tc && _jsx(Detail, { label: t('table_category'), value: tc.name })] }), selections.length > 0 && (_jsxs("div", { style: { borderTop: '1px solid #f3f4f6', paddingTop: 12, marginBottom: 12 }, children: [_jsxs("p", { style: { margin: '0 0 6px', fontSize: 12, fontWeight: 600, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.05em' }, children: [t('selected_dishes'), " (", selections.length, ")"] }), _jsx("ul", { style: { margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: 4 }, children: selections.map((s) => (_jsxs("li", { style: { fontSize: 13, color: '#4b5563' }, children: [s.menuItem.name, " ", _jsxs("span", { style: { color: '#9ca3af' }, children: ["\u00D7 ", s.quantity] })] }, s.id))) })] })), event.notes && (_jsxs("div", { style: { borderTop: '1px solid #f3f4f6', paddingTop: 10, marginBottom: 12, fontSize: 13, color: '#6b7280' }, children: [_jsxs("strong", { style: { color: '#374151' }, children: [t('notes'), ":"] }), " ", event.notes] })), _jsxs("div", { style: { display: 'flex', gap: 8, borderTop: '1px solid #f3f4f6', paddingTop: 12 }, children: [_jsx("button", { onClick: () => downloadEvent(event, 'pdf'), style: btnStyle('#2563eb'), children: t('download_pdf') }), _jsx("button", { onClick: () => downloadEvent(event, 'excel'), style: btnStyle('#059669'), children: t('download_excel') })] })] }, event.id));
                    }), !eventsQuery.isLoading && events.length === 0 && (_jsx("p", { style: { color: '#6b7280' }, children: t('no_items_selected') }))] })] }));
};
const Detail = ({ label, value }) => (_jsxs("div", { children: [_jsx("p", { style: { margin: 0, fontSize: 11, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }, children: label }), _jsx("p", { style: { margin: 0, fontSize: 14, color: '#111827' }, children: value })] }));
const btnStyle = (bg) => ({
    padding: '7px 14px',
    background: bg,
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
});
