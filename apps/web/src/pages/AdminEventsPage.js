import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { EventList } from '../components/events/EventList';
import { eventService } from '../services/event.service';
import { hallService } from '../services/hall.service';
import { tableCategoryService } from '../services/tableCategory.service';
import { useAdminStore } from '../store/admin.store';
import { translate } from '../utils/translate';
import { Input } from '../components/ui/input';
import { Select } from '../components/ui/select';
import { Button } from '../components/ui/button';
const parsePositiveInt = (value) => {
    const trimmed = value.trim();
    if (!trimmed)
        return null;
    const parsed = Number(trimmed);
    if (!Number.isInteger(parsed) || parsed <= 0)
        return null;
    return parsed;
};
// Binary search function for finding event by ID
const binarySearchEventById = (events, targetId) => {
    // Sort events by ID for binary search
    const sortedEvents = [...events].sort((a, b) => a.id - b.id);
    let left = 0;
    let right = sortedEvents.length - 1;
    while (left <= right) {
        const mid = Math.floor((left + right) / 2);
        const midEvent = sortedEvents[mid];
        if (midEvent.id === targetId) {
            return midEvent;
        }
        else if (midEvent.id < targetId) {
            left = mid + 1;
        }
        else {
            right = mid - 1;
        }
    }
    return null; // Event not found
};
const eventTypes = ['RESERVATION', 'BANQUET', 'WEDDING', 'BIRTHDAY', 'PRIVATE_PARTY', 'CORPORATE'];
export const AdminEventsPage = () => {
    const queryClient = useQueryClient();
    const { locale } = useAdminStore();
    const t = (key, params) => translate(key, locale, params);
    const { data: events, isLoading, isError } = useQuery({
        queryKey: ['events'],
        queryFn: () => eventService.list()
    });
    const { data: halls } = useQuery({
        queryKey: ['halls'],
        queryFn: () => hallService.list()
    });
    const { data: tableCategories } = useQuery({
        queryKey: ['tableCategories'],
        queryFn: () => tableCategoryService.list()
    });
    const [customerName, setCustomerName] = useState('');
    const [customerPhone, setCustomerPhone] = useState('');
    const [eventDate, setEventDate] = useState('');
    const [eventTime, setEventTime] = useState('');
    const [guestCountText, setGuestCountText] = useState('50');
    const [eventType, setEventType] = useState('RESERVATION');
    const [status, setStatus] = useState('DRAFT');
    const [hallId, setHallId] = useState('');
    const [tableCategoryId, setTableCategoryId] = useState('');
    const [notes, setNotes] = useState('');
    const [birthdayPersonName, setBirthdayPersonName] = useState('');
    const [brideName, setBrideName] = useState('');
    const [groomName, setGroomName] = useState('');
    const [honoreePersonName, setHonoreeName] = useState('');
    const [editingId, setEditingId] = useState(null);
    // Search functionality
    const [searchId, setSearchId] = useState('');
    const [searchResult, setSearchResult] = useState(null);
    const [searchError, setSearchError] = useState(null);
    const validation = useMemo(() => {
        const errors = [];
        if (customerName.trim().length < 2)
            errors.push('Customer name must be at least 2 characters.');
        if (!eventDate) {
            errors.push('Event date is required.');
        }
        else if (!eventTime) {
            errors.push('Event time is required.');
        }
        else if (Number.isNaN(new Date(`${eventDate}T${eventTime}`).getTime())) {
            errors.push('Event date/time is invalid.');
        }
        const guestCount = parsePositiveInt(guestCountText);
        if (guestCount === null)
            errors.push('Guest count must be a positive integer.');
        if (guestCount !== null && guestCount > 5000)
            errors.push('Guest count must be 5000 or less.');
        if (tableCategoryId && tableCategories && !tableCategories.find((category) => category.id === tableCategoryId)) {
            errors.push('Selected table category is invalid.');
        }
        return { errors, guestCount };
    }, [customerName, eventDate, eventTime, guestCountText, tableCategoryId, tableCategories]);
    const createMutation = useMutation({
        mutationFn: () => {
            if (validation.errors.length > 0 || validation.guestCount === null) {
                throw new Error(validation.errors[0] ?? 'Invalid form');
            }
            const date = new Date(`${eventDate}T${eventTime}`);
            if (Number.isNaN(date.getTime())) {
                throw new Error('Invalid event date/time');
            }
            return eventService.create({
                customerName: customerName.trim(),
                customerPhone: customerPhone.trim() ? customerPhone.trim() : undefined,
                eventDate: date.toISOString(),
                guestCount: validation.guestCount,
                status,
                eventType,
                hallId: hallId ? hallId : undefined,
                tableCategoryId: tableCategoryId ? tableCategoryId : undefined,
                notes: notes.trim() ? notes.trim() : undefined,
                birthdayPersonName: eventType === 'BIRTHDAY' && birthdayPersonName.trim() ? birthdayPersonName.trim() : undefined,
                brideName: eventType === 'WEDDING' && brideName.trim() ? brideName.trim() : undefined,
                groomName: eventType === 'WEDDING' && groomName.trim() ? groomName.trim() : undefined,
                honoreePersonName: !['BIRTHDAY', 'WEDDING'].includes(eventType) && honoreePersonName.trim() ? honoreePersonName.trim() : undefined
            });
        },
        onSuccess: async () => {
            setCustomerName('');
            setCustomerPhone('');
            setEventDate('');
            setEventTime('');
            setGuestCountText('50');
            setStatus('DRAFT');
            setEventType('RESERVATION');
            setHallId('');
            setTableCategoryId('');
            setNotes('');
            setBirthdayPersonName('');
            setBrideName('');
            setGroomName('');
            setHonoreeName('');
            await queryClient.invalidateQueries({ queryKey: ['events'] });
        }
    });
    const updateMutation = useMutation({
        mutationFn: ({ eventId, data }) => eventService.update(eventId, data),
        onSuccess: async () => {
            setEditingId(null);
            setCustomerName('');
            setCustomerPhone('');
            setEventDate('');
            setEventTime('');
            setGuestCountText('50');
            setStatus('DRAFT');
            setEventType('RESERVATION');
            setHallId('');
            setTableCategoryId('');
            setNotes('');
            setBirthdayPersonName('');
            setBrideName('');
            setGroomName('');
            setHonoreeName('');
            await queryClient.invalidateQueries({ queryKey: ['events'] });
        }
    });
    const deleteMutation = useMutation({
        mutationFn: (eventId) => eventService.remove(eventId),
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ['events'] });
        }
    });
    // Search handler
    const handleSearch = () => {
        if (!events) {
            setSearchError(t('no_events_loaded'));
            setSearchResult(null);
            return;
        }
        const targetId = parsePositiveInt(searchId);
        if (targetId === null) {
            setSearchError(t('enter_event_id'));
            setSearchResult(null);
            return;
        }
        const result = binarySearchEventById(events, targetId);
        if (result) {
            setSearchResult(result);
            setSearchError(null);
        }
        else {
            setSearchResult(null);
            setSearchError(t('event_not_found', { id: targetId }));
        }
    };
    const canSubmit = validation.errors.length === 0 && !createMutation.isPending;
    const canSave = validation.errors.length === 0 && !updateMutation.isPending;
    return (_jsxs("main", { style: { padding: 20 }, children: [_jsx("h1", { children: t('banquet_events') }), _jsxs("section", { style: { border: '1px solid #ddd', borderRadius: 8, padding: 12, marginBottom: 16 }, children: [_jsx("h3", { children: editingId ? t('edit_existing_event') : t('create_new_event') }), _jsxs("form", { onSubmit: (event) => {
                            event.preventDefault();
                            const date = new Date(`${eventDate}T${eventTime}`);
                            if (!eventDate || !eventTime || Number.isNaN(date.getTime()))
                                return;
                            if (editingId) {
                                if (!canSave || updateMutation.isPending)
                                    return;
                                updateMutation.mutate({
                                    eventId: editingId,
                                    data: {
                                        customerName: customerName.trim(),
                                        customerPhone: customerPhone.trim() ? customerPhone.trim() : undefined,
                                        eventDate: date.toISOString(),
                                        guestCount: validation.guestCount ?? 0,
                                        status,
                                        eventType,
                                        hallId: hallId ? hallId : undefined,
                                        tableCategoryId: tableCategoryId ? tableCategoryId : undefined,
                                        notes: notes.trim() ? notes.trim() : undefined,
                                        birthdayPersonName: eventType === 'BIRTHDAY' && birthdayPersonName.trim() ? birthdayPersonName.trim() : undefined,
                                        brideName: eventType === 'WEDDING' && brideName.trim() ? brideName.trim() : undefined,
                                        groomName: eventType === 'WEDDING' && groomName.trim() ? groomName.trim() : undefined,
                                        honoreePersonName: !['BIRTHDAY', 'WEDDING'].includes(eventType) && honoreePersonName.trim() ? honoreePersonName.trim() : undefined
                                    }
                                });
                            }
                            else {
                                if (!canSubmit || createMutation.isPending)
                                    return;
                                createMutation.mutate();
                            }
                        }, style: { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, alignItems: 'end' }, children: [_jsxs("label", { style: { display: 'grid', gap: 6 }, children: [t('customer_name'), _jsx(Input, { value: customerName, onChange: (e) => setCustomerName(e.target.value) })] }), _jsxs("label", { style: { display: 'grid', gap: 6 }, children: [t('phone_number'), _jsx(Input, { type: "tel", placeholder: "e.g., +7 999 123 45 67", value: customerPhone, onChange: (e) => setCustomerPhone(e.target.value) })] }), _jsxs("label", { style: { display: 'grid', gap: 6 }, children: [t('event_date'), _jsx(Input, { type: "date", value: eventDate, onChange: (e) => setEventDate(e.target.value) })] }), _jsxs("label", { style: { display: 'grid', gap: 6 }, children: [t('event_time'), _jsx(Input, { type: "time", value: eventTime, onChange: (e) => setEventTime(e.target.value) })] }), _jsxs("label", { style: { display: 'grid', gap: 6 }, children: [t('guests'), _jsx(Input, { type: "number", min: 1, max: 5000, inputMode: "numeric", value: guestCountText, onChange: (e) => setGuestCountText(e.target.value) })] }), _jsxs("label", { style: { display: 'grid', gap: 6 }, children: [t('event_type'), _jsx(Select, { value: eventType, onChange: (e) => setEventType(e.target.value), children: eventTypes.map((type) => (_jsx("option", { value: type, children: t(`event_type_${type.toLowerCase()}`) }, type))) })] }), eventType === 'BIRTHDAY' && (_jsxs("label", { style: { display: 'grid', gap: 6 }, children: [t('birthday_person_name'), _jsx(Input, { placeholder: t('birthday_person_name_placeholder'), value: birthdayPersonName, onChange: (e) => setBirthdayPersonName(e.target.value) })] })), eventType === 'WEDDING' && (_jsxs(_Fragment, { children: [_jsxs("label", { style: { display: 'grid', gap: 6 }, children: [t('bride_name'), _jsx(Input, { placeholder: t('bride_groom_name_placeholder'), value: brideName, onChange: (e) => setBrideName(e.target.value) })] }), _jsxs("label", { style: { display: 'grid', gap: 6 }, children: [t('groom_name'), _jsx(Input, { placeholder: t('bride_groom_name_placeholder'), value: groomName, onChange: (e) => setGroomName(e.target.value) })] })] })), !['BIRTHDAY', 'WEDDING'].includes(eventType) && (_jsxs("label", { style: { display: 'grid', gap: 6 }, children: [t('honoree_person_name'), _jsx(Input, { placeholder: t('honoree_person_name_placeholder'), value: honoreePersonName, onChange: (e) => setHonoreeName(e.target.value) })] })), _jsxs("label", { style: { display: 'grid', gap: 6 }, children: [t('status'), _jsxs(Select, { value: status, onChange: (e) => setStatus(e.target.value), children: [_jsx("option", { value: "DRAFT", children: "DRAFT" }), _jsx("option", { value: "CONFIRMED", children: "CONFIRMED" }), _jsx("option", { value: "CANCELLED", children: "CANCELLED" })] })] }), _jsxs("label", { style: { display: 'grid', gap: 6 }, children: [t('hall_optional'), _jsxs(Select, { value: hallId, onChange: (e) => setHallId(e.target.value), children: [_jsx("option", { value: "", children: t('select_hall') }), halls?.map((hall) => (_jsxs("option", { value: hall.id, children: [hall.name, " (Cap: ", hall.capacity, ")"] }, hall.id)))] })] }), _jsxs("label", { style: { display: 'grid', gap: 6 }, children: [t('table_category_optional'), _jsxs(Select, { value: tableCategoryId, onChange: (e) => setTableCategoryId(e.target.value), children: [_jsx("option", { value: "", children: t('choose_table_category') }), tableCategories?.map((category) => (_jsxs("option", { value: category.id, children: [category.name, " ($", Number(category.ratePerPerson / 100).toFixed(2), " per person)"] }, category.id)))] })] }), _jsxs("label", { style: { display: 'grid', gap: 6, gridColumn: '1 / -1' }, children: [t('notes'), _jsx(Input, { value: notes, onChange: (e) => setNotes(e.target.value) })] }), _jsxs("div", { style: { gridColumn: '1 / -1', display: 'flex', gap: 12, alignItems: 'center' }, children: [_jsx(Button, { type: "submit", disabled: editingId ? !canSave : !canSubmit, children: editingId
                                            ? updateMutation.isPending
                                                ? t('updating')
                                                : t('update_event')
                                            : createMutation.isPending
                                                ? t('creating')
                                                : t('create_event') }), editingId ? (_jsx(Button, { variant: "secondary", type: "button", onClick: () => {
                                            setEditingId(null);
                                            setCustomerName('');
                                            setCustomerPhone('');
                                            setEventDate('');
                                            setEventTime('');
                                            setGuestCountText('50');
                                            setStatus('DRAFT');
                                            setEventType('RESERVATION');
                                            setHallId('');
                                            setTableCategoryId('');
                                            setNotes('');
                                            setBirthdayPersonName('');
                                            setBrideName('');
                                            setGroomName('');
                                            setHonoreeName('');
                                        }, children: t('cancel') })) : null, validation.errors.length > 0 ? (_jsx("span", { style: { color: '#b00020' }, children: validation.errors[0] })) : null, editingId ? (updateMutation.isError ? (_jsx("span", { style: { color: '#b00020' }, children: updateMutation.error instanceof Error ? updateMutation.error.message : 'Failed to update event.' })) : null) : createMutation.isError ? (_jsx("span", { style: { color: '#b00020' }, children: createMutation.error instanceof Error ? createMutation.error.message : 'Failed to create event.' })) : null] })] })] }), _jsxs("section", { style: { border: '1px solid #ddd', borderRadius: 8, padding: 12, marginBottom: 16 }, children: [_jsx("h3", { children: t('search_event_by_id') }), _jsxs("div", { style: { display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12 }, children: [_jsxs("label", { style: { display: 'flex', flexDirection: 'column', gap: 6 }, children: [t('enter_event_id'), ":", _jsx(Input, { type: "number", min: "1", value: searchId, onChange: (e) => setSearchId(e.target.value), placeholder: t('enter_event_id') })] }), _jsx(Button, { type: "button", onClick: handleSearch, disabled: !events || isLoading, style: { alignSelf: 'end' }, children: t('search_olog_n') })] }), searchError && _jsx("p", { style: { color: '#b00020' }, children: searchError }), searchResult && (() => {
                        const d = new Date(searchResult.eventDate);
                        const dateStr = d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
                        const timeStr = d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
                        const eventTypeLabels = {
                            RESERVATION: t('event_type_reservation'), BANQUET: t('event_type_banquet'),
                            WEDDING: t('event_type_wedding'), BIRTHDAY: t('event_type_birthday'),
                            PRIVATE_PARTY: t('event_type_private_party'), CORPORATE: t('event_type_corporate')
                        };
                        const statusColors = {
                            DRAFT: '#64748b', CONFIRMED: '#059669', CANCELLED: '#dc2626'
                        };
                        const dishTypes = searchResult.selections?.length ?? 0;
                        const totalPcs = searchResult.selections?.reduce((s, sel) => s + sel.quantity, 0) ?? 0;
                        return (_jsxs("div", { style: { border: '1px solid #cbd5e1', borderRadius: 8, padding: 16, backgroundColor: '#f8fafc' }, children: [_jsx("h4", { style: { margin: '0 0 12px', fontSize: '0.9rem', color: '#475569' }, children: t('search_result') }), _jsxs("div", { style: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px 24px' }, children: [_jsxs("div", { children: [_jsx("p", { style: { margin: 0, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#94a3b8' }, children: "ID" }), _jsxs("p", { style: { margin: '2px 0 0', fontFamily: 'monospace', color: '#475569' }, children: ["#", searchResult.id] })] }), _jsxs("div", { children: [_jsx("p", { style: { margin: 0, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#94a3b8' }, children: t('customer_name') }), _jsx("p", { style: { margin: '2px 0 0', fontWeight: 600, color: '#0f172a' }, children: searchResult.customerName }), searchResult.customerPhone && (_jsx("p", { style: { margin: '1px 0 0', fontSize: '0.78rem', color: '#64748b' }, children: searchResult.customerPhone }))] }), _jsxs("div", { children: [_jsx("p", { style: { margin: 0, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#94a3b8' }, children: t('status') }), _jsx("p", { style: { margin: '2px 0 0', fontWeight: 600, color: statusColors[searchResult.status] ?? '#475569' }, children: searchResult.status })] }), _jsxs("div", { children: [_jsx("p", { style: { margin: 0, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#94a3b8' }, children: t('event_date_time') }), _jsx("p", { style: { margin: '2px 0 0', color: '#0f172a' }, children: dateStr }), _jsx("p", { style: { margin: '1px 0 0', fontSize: '0.78rem', color: '#64748b' }, children: timeStr })] }), _jsxs("div", { children: [_jsx("p", { style: { margin: 0, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#94a3b8' }, children: t('event_type') }), _jsx("p", { style: { margin: '2px 0 0', color: '#0f172a' }, children: searchResult.eventType ? (eventTypeLabels[searchResult.eventType] ?? searchResult.eventType) : '—' })] }), _jsxs("div", { children: [_jsx("p", { style: { margin: 0, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#94a3b8' }, children: t('guests') }), _jsx("p", { style: { margin: '2px 0 0', color: '#0f172a' }, children: searchResult.guestCount })] }), _jsxs("div", { children: [_jsx("p", { style: { margin: 0, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#94a3b8' }, children: t('hall_optional') }), _jsx("p", { style: { margin: '2px 0 0', color: '#0f172a' }, children: searchResult.hall?.name ?? '—' })] }), _jsxs("div", { children: [_jsx("p", { style: { margin: 0, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#94a3b8' }, children: t('table_category_optional') }), _jsx("p", { style: { margin: '2px 0 0', color: '#0f172a' }, children: searchResult.tableCategory?.name ?? '—' }), searchResult.tableCategory && (_jsxs("p", { style: { margin: '1px 0 0', fontSize: '0.78rem', color: '#64748b' }, children: ["$", (searchResult.tableCategory.ratePerPerson / 100).toFixed(2), " per person"] }))] }), _jsxs("div", { children: [_jsx("p", { style: { margin: 0, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#94a3b8' }, children: "Menu" }), _jsx("p", { style: { margin: '2px 0 0', color: '#0f172a' }, children: dishTypes > 0 ? `${dishTypes} dish${dishTypes !== 1 ? 'es' : ''}, ${totalPcs} pcs` : '—' })] }), searchResult.eventType === 'BIRTHDAY' && searchResult.birthdayPersonName && (_jsxs("div", { children: [_jsx("p", { style: { margin: 0, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#94a3b8' }, children: t('birthday_person_name') }), _jsx("p", { style: { margin: '2px 0 0', color: '#0f172a' }, children: searchResult.birthdayPersonName })] })), searchResult.eventType === 'WEDDING' && searchResult.brideName && (_jsxs("div", { children: [_jsx("p", { style: { margin: 0, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#94a3b8' }, children: t('bride_name') }), _jsx("p", { style: { margin: '2px 0 0', color: '#0f172a' }, children: searchResult.brideName })] })), searchResult.eventType === 'WEDDING' && searchResult.groomName && (_jsxs("div", { children: [_jsx("p", { style: { margin: 0, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#94a3b8' }, children: t('groom_name') }), _jsx("p", { style: { margin: '2px 0 0', color: '#0f172a' }, children: searchResult.groomName })] })), searchResult.eventType && !['BIRTHDAY', 'WEDDING'].includes(searchResult.eventType) && searchResult.honoreePersonName && (_jsxs("div", { children: [_jsx("p", { style: { margin: 0, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#94a3b8' }, children: t('honoree_person_name') }), _jsx("p", { style: { margin: '2px 0 0', color: '#0f172a' }, children: searchResult.honoreePersonName })] })), searchResult.notes && (_jsxs("div", { style: { gridColumn: '1 / -1' }, children: [_jsx("p", { style: { margin: 0, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#94a3b8' }, children: t('notes') }), _jsx("p", { style: { margin: '2px 0 0', fontSize: '0.85rem', color: '#475569' }, children: searchResult.notes })] }))] }), _jsxs("div", { style: { display: 'flex', gap: 8, marginTop: 14, justifyContent: 'flex-end' }, children: [_jsx(Button, { variant: "outline", size: "sm", onClick: () => {
                                                setEditingId(searchResult.id);
                                                setCustomerName(searchResult.customerName);
                                                setCustomerPhone(searchResult.customerPhone ?? '');
                                                const srDate = new Date(searchResult.eventDate);
                                                const srLocal = new Date(srDate.getTime() - srDate.getTimezoneOffset() * 60000).toISOString();
                                                setEventDate(srLocal.slice(0, 10));
                                                setEventTime(srLocal.slice(11, 16));
                                                setGuestCountText(searchResult.guestCount.toString());
                                                setEventType(searchResult.eventType ?? 'RESERVATION');
                                                setStatus(searchResult.status);
                                                setHallId(searchResult.hallId ?? '');
                                                setTableCategoryId(searchResult.tableCategoryId ?? '');
                                                setNotes(searchResult.notes ?? '');
                                                setBirthdayPersonName(searchResult.birthdayPersonName ?? '');
                                                setBrideName(searchResult.brideName ?? '');
                                                setGroomName(searchResult.groomName ?? '');
                                                setHonoreeName(searchResult.honoreePersonName ?? '');
                                                document.querySelector('form')?.scrollIntoView({ behavior: 'smooth' });
                                            }, children: t('edit') }), _jsx(Button, { variant: "destructive", size: "sm", onClick: () => {
                                                if (window.confirm(`Delete reservation for ${searchResult.customerName}?`)) {
                                                    deleteMutation.mutate(searchResult.id);
                                                    setSearchResult(null);
                                                    setSearchId('');
                                                }
                                            }, disabled: deleteMutation.isPending, children: deleteMutation.isPending ? t('deleting') : t('delete') })] })] }));
                    })()] }), isLoading ? _jsx("p", { children: t('loading_events') }) : null, isError ? _jsx("p", { children: t('failed_load_events') }) : null, events ? (_jsx(EventList, { events: events, onEdit: (eventId) => {
                    const event = events.find((item) => item.id === eventId);
                    if (!event)
                        return;
                    setEditingId(event.id);
                    setCustomerName(event.customerName);
                    setCustomerPhone(event.customerPhone ?? '');
                    const evDate = new Date(event.eventDate);
                    const evLocal = new Date(evDate.getTime() - evDate.getTimezoneOffset() * 60000).toISOString();
                    setEventDate(evLocal.slice(0, 10));
                    setEventTime(evLocal.slice(11, 16));
                    setGuestCountText(event.guestCount.toString());
                    setEventType(event.eventType ?? 'RESERVATION');
                    setStatus(event.status);
                    setHallId(event.hallId ?? '');
                    setTableCategoryId(event.tableCategoryId ?? '');
                    setNotes(event.notes ?? '');
                    setBirthdayPersonName(event.birthdayPersonName ?? '');
                    setBrideName(event.brideName ?? '');
                    setGroomName(event.groomName ?? '');
                    setHonoreeName(event.honoreePersonName ?? '');
                }, onDelete: (eventId) => deleteMutation.mutate(eventId), deletingId: deleteMutation.isPending ? deleteMutation.variables ?? null : null })) : null] }));
};
