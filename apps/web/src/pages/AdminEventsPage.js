import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
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
const eventTypes = ['RESERVATION', 'BANQUET', 'WEDDING', 'PRIVATE_PARTY', 'CORPORATE'];
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
    const [eventDateLocal, setEventDateLocal] = useState('');
    const [guestCountText, setGuestCountText] = useState('50');
    const [eventType, setEventType] = useState('RESERVATION');
    const [status, setStatus] = useState('DRAFT');
    const [hallId, setHallId] = useState('');
    const [tableCategoryId, setTableCategoryId] = useState('');
    const [notes, setNotes] = useState('');
    const [editingId, setEditingId] = useState(null);
    // Search functionality
    const [searchId, setSearchId] = useState('');
    const [searchResult, setSearchResult] = useState(null);
    const [searchError, setSearchError] = useState(null);
    const validation = useMemo(() => {
        const errors = [];
        if (customerName.trim().length < 2)
            errors.push('Customer name must be at least 2 characters.');
        if (!eventDateLocal) {
            errors.push('Event date/time is required.');
        }
        else if (Number.isNaN(new Date(eventDateLocal).getTime())) {
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
    }, [customerName, eventDateLocal, guestCountText, tableCategoryId, tableCategories]);
    const createMutation = useMutation({
        mutationFn: () => {
            if (validation.errors.length > 0 || validation.guestCount === null) {
                throw new Error(validation.errors[0] ?? 'Invalid form');
            }
            const date = new Date(eventDateLocal);
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
                notes: notes.trim() ? notes.trim() : undefined
            });
        },
        onSuccess: async () => {
            setCustomerName('');
            setCustomerPhone('');
            setEventDateLocal('');
            setGuestCountText('50');
            setStatus('DRAFT');
            setEventType('RESERVATION');
            setHallId('');
            setTableCategoryId('');
            setNotes('');
            await queryClient.invalidateQueries({ queryKey: ['events'] });
        }
    });
    const updateMutation = useMutation({
        mutationFn: ({ eventId, data }) => eventService.update(eventId, data),
        onSuccess: async () => {
            setEditingId(null);
            setCustomerName('');
            setCustomerPhone('');
            setEventDateLocal('');
            setGuestCountText('50');
            setStatus('DRAFT');
            setEventType('RESERVATION');
            setHallId('');
            setTableCategoryId('');
            setNotes('');
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
                            const date = new Date(eventDateLocal);
                            if (!eventDateLocal || Number.isNaN(date.getTime()))
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
                                        notes: notes.trim() ? notes.trim() : undefined
                                    }
                                });
                            }
                            else {
                                if (!canSubmit || createMutation.isPending)
                                    return;
                                createMutation.mutate();
                            }
                        }, style: { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, alignItems: 'end' }, children: [_jsxs("label", { style: { display: 'grid', gap: 6 }, children: [t('customer_name'), _jsx(Input, { value: customerName, onChange: (e) => setCustomerName(e.target.value) })] }), _jsxs("label", { style: { display: 'grid', gap: 6 }, children: [t('phone_number'), _jsx(Input, { type: "tel", placeholder: "e.g., +7 999 123 45 67", value: customerPhone, onChange: (e) => setCustomerPhone(e.target.value) })] }), _jsxs("label", { style: { display: 'grid', gap: 6 }, children: [t('event_date_time'), _jsx(Input, { type: "datetime-local", value: eventDateLocal, onChange: (e) => setEventDateLocal(e.target.value) })] }), _jsxs("label", { style: { display: 'grid', gap: 6 }, children: [t('guests'), _jsx(Input, { type: "number", min: 1, max: 5000, inputMode: "numeric", value: guestCountText, onChange: (e) => setGuestCountText(e.target.value) })] }), _jsxs("label", { style: { display: 'grid', gap: 6 }, children: [t('event_type'), _jsx(Select, { value: eventType, onChange: (e) => setEventType(e.target.value), children: eventTypes.map((type) => (_jsx("option", { value: type, children: type }, type))) })] }), _jsxs("label", { style: { display: 'grid', gap: 6 }, children: [t('status'), _jsxs(Select, { value: status, onChange: (e) => setStatus(e.target.value), children: [_jsx("option", { value: "DRAFT", children: "DRAFT" }), _jsx("option", { value: "CONFIRMED", children: "CONFIRMED" }), _jsx("option", { value: "CANCELLED", children: "CANCELLED" })] })] }), _jsxs("label", { style: { display: 'grid', gap: 6 }, children: [t('hall_optional'), _jsxs(Select, { value: hallId, onChange: (e) => setHallId(e.target.value), children: [_jsx("option", { value: "", children: t('select_hall') }), halls?.map((hall) => (_jsxs("option", { value: hall.id, children: [hall.name, " (Cap: ", hall.capacity, ")"] }, hall.id)))] })] }), _jsxs("label", { style: { display: 'grid', gap: 6 }, children: [t('table_category_optional'), _jsxs(Select, { value: tableCategoryId, onChange: (e) => setTableCategoryId(e.target.value), children: [_jsx("option", { value: "", children: t('choose_table_category') }), tableCategories?.map((category) => (_jsxs("option", { value: category.id, children: [category.name, " - ", category.mealPackage, " (", category.seatingCapacity, " seats, ", Number(category.ratePerPerson / 100).toFixed(2), " per person)"] }, category.id)))] })] }), _jsxs("label", { style: { display: 'grid', gap: 6, gridColumn: '1 / -1' }, children: [t('notes'), _jsx(Input, { value: notes, onChange: (e) => setNotes(e.target.value) })] }), _jsxs("div", { style: { gridColumn: '1 / -1', display: 'flex', gap: 12, alignItems: 'center' }, children: [_jsx(Button, { type: "submit", disabled: editingId ? !canSave : !canSubmit, children: editingId
                                            ? updateMutation.isPending
                                                ? t('updating')
                                                : t('update_event')
                                            : createMutation.isPending
                                                ? t('creating')
                                                : t('create_event') }), editingId ? (_jsx(Button, { variant: "secondary", type: "button", onClick: () => {
                                            setEditingId(null);
                                            setCustomerName('');
                                            setCustomerPhone('');
                                            setEventDateLocal('');
                                            setGuestCountText('50');
                                            setStatus('DRAFT');
                                            setEventType('RESERVATION');
                                            setHallId('');
                                            setTableCategoryId('');
                                            setNotes('');
                                        }, children: t('cancel') })) : null, validation.errors.length > 0 ? (_jsx("span", { style: { color: '#b00020' }, children: validation.errors[0] })) : null, editingId ? (updateMutation.isError ? (_jsx("span", { style: { color: '#b00020' }, children: updateMutation.error instanceof Error ? updateMutation.error.message : 'Failed to update event.' })) : null) : createMutation.isError ? (_jsx("span", { style: { color: '#b00020' }, children: createMutation.error instanceof Error ? createMutation.error.message : 'Failed to create event.' })) : null] })] })] }), _jsxs("section", { style: { border: '1px solid #ddd', borderRadius: 8, padding: 12, marginBottom: 16 }, children: [_jsx("h3", { children: t('search_event_by_id') }), _jsxs("div", { style: { display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12 }, children: [_jsxs("label", { style: { display: 'flex', flexDirection: 'column', gap: 6 }, children: [t('enter_event_id'), ":", _jsx(Input, { type: "number", min: "1", value: searchId, onChange: (e) => setSearchId(e.target.value), placeholder: t('enter_event_id') })] }), _jsx(Button, { type: "button", onClick: handleSearch, disabled: !events || isLoading, style: { alignSelf: 'end' }, children: t('search_olog_n') })] }), searchError && _jsx("p", { style: { color: '#b00020' }, children: searchError }), searchResult && (_jsxs("div", { style: { border: '1px solid #ccc', borderRadius: 4, padding: 8, backgroundColor: '#f9f9f9' }, children: [_jsxs("h4", { children: [t('search_result'), ":"] }), _jsxs("p", { children: [_jsx("strong", { children: "ID:" }), " ", searchResult.id] }), _jsxs("p", { children: [_jsxs("strong", { children: [t('customer_name'), ":"] }), " ", searchResult.customerName] }), _jsxs("p", { children: [_jsxs("strong", { children: [t('event_date_time'), ":"] }), " ", new Date(searchResult.eventDate).toLocaleDateString()] }), _jsxs("p", { children: [_jsxs("strong", { children: [t('guests'), ":"] }), " ", searchResult.guestCount] }), _jsxs("p", { children: [_jsxs("strong", { children: [t('status'), ":"] }), " ", searchResult.status] }), _jsxs("div", { style: { display: 'flex', gap: 8, marginTop: 8, justifyContent: 'flex-end' }, children: [_jsx(Button, { variant: "outline", size: "sm", onClick: () => {
                                            setEditingId(searchResult.id);
                                            setCustomerName(searchResult.customerName);
                                            setCustomerPhone(searchResult.customerPhone ?? '');
                                            const eventDate = new Date(searchResult.eventDate);
                                            const localISO = new Date(eventDate.getTime() - eventDate.getTimezoneOffset() * 60000)
                                                .toISOString()
                                                .slice(0, 16);
                                            setEventDateLocal(localISO);
                                            setGuestCountText(searchResult.guestCount.toString());
                                            setEventType(searchResult.eventType ?? 'RESERVATION');
                                            setStatus(searchResult.status);
                                            setHallId(searchResult.hallId ?? '');
                                            setTableCategoryId(searchResult.tableCategoryId ?? '');
                                            setNotes(searchResult.notes ?? '');
                                            // Scroll to form
                                            document.querySelector('form')?.scrollIntoView({ behavior: 'smooth' });
                                        }, children: t('edit') }), _jsx(Button, { variant: "destructive", size: "sm", onClick: () => {
                                            if (window.confirm(`Delete reservation for ${searchResult.customerName}?`)) {
                                                deleteMutation.mutate(searchResult.id);
                                                setSearchResult(null);
                                                setSearchId('');
                                            }
                                        }, disabled: deleteMutation.isPending, children: deleteMutation.isPending ? t('deleting') : t('delete') })] })] }))] }), isLoading ? _jsx("p", { children: t('loading_events') }) : null, isError ? _jsx("p", { children: t('failed_load_events') }) : null, events ? (_jsx(EventList, { events: events, onEdit: (eventId) => {
                    const event = events.find((item) => item.id === eventId);
                    if (!event)
                        return;
                    setEditingId(event.id);
                    setCustomerName(event.customerName);
                    setCustomerPhone(event.customerPhone ?? '');
                    const eventDate = new Date(event.eventDate);
                    const localISO = new Date(eventDate.getTime() - eventDate.getTimezoneOffset() * 60000)
                        .toISOString()
                        .slice(0, 16);
                    setEventDateLocal(localISO);
                    setGuestCountText(event.guestCount.toString());
                    setEventType(event.eventType ?? 'RESERVATION');
                    setStatus(event.status);
                    setHallId(event.hallId ?? '');
                    setTableCategoryId(event.tableCategoryId ?? '');
                    setNotes(event.notes ?? '');
                }, onDelete: (eventId) => deleteMutation.mutate(eventId), deletingId: deleteMutation.isPending ? deleteMutation.variables ?? null : null })) : null] }));
};
