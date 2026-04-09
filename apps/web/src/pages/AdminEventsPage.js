import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { EventList } from '../components/events/EventList';
import { eventService } from '../services/event.service';
import { hallService } from '../services/hall.service';
import { tableCategoryService } from '../services/tableCategory.service';
import { useAdminStore } from '../store/admin.store';
import { translate } from '../utils/translate';
const parsePositiveInt = (value) => {
    const trimmed = value.trim();
    if (!trimmed)
        return null;
    const parsed = Number(trimmed);
    if (!Number.isInteger(parsed) || parsed <= 0)
        return null;
    return parsed;
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
                        }, style: { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, alignItems: 'end' }, children: [_jsxs("label", { style: { display: 'grid', gap: 6 }, children: [t('customer_name'), _jsx("input", { value: customerName, onChange: (e) => setCustomerName(e.target.value) })] }), _jsxs("label", { style: { display: 'grid', gap: 6 }, children: [t('phone_number'), _jsx("input", { type: "tel", placeholder: "e.g., +7 999 123 45 67", value: customerPhone, onChange: (e) => setCustomerPhone(e.target.value) })] }), _jsxs("label", { style: { display: 'grid', gap: 6 }, children: [t('event_date_time'), _jsx("input", { type: "datetime-local", value: eventDateLocal, onChange: (e) => setEventDateLocal(e.target.value) })] }), _jsxs("label", { style: { display: 'grid', gap: 6 }, children: [t('guests'), _jsx("input", { type: "number", min: 1, max: 5000, inputMode: "numeric", value: guestCountText, onChange: (e) => setGuestCountText(e.target.value) })] }), _jsxs("label", { style: { display: 'grid', gap: 6 }, children: [t('event_type'), _jsx("select", { value: eventType, onChange: (e) => setEventType(e.target.value), children: eventTypes.map((type) => (_jsx("option", { value: type, children: type }, type))) })] }), _jsxs("label", { style: { display: 'grid', gap: 6 }, children: [t('status'), _jsxs("select", { value: status, onChange: (e) => setStatus(e.target.value), children: [_jsx("option", { value: "DRAFT", children: "DRAFT" }), _jsx("option", { value: "CONFIRMED", children: "CONFIRMED" }), _jsx("option", { value: "CANCELLED", children: "CANCELLED" })] })] }), _jsxs("label", { style: { display: 'grid', gap: 6 }, children: [t('hall_optional'), _jsxs("select", { value: hallId, onChange: (e) => setHallId(e.target.value), children: [_jsx("option", { value: "", children: t('select_hall') }), halls?.map((hall) => (_jsxs("option", { value: hall.id, children: [hall.name, " (Cap: ", hall.capacity, ")"] }, hall.id)))] })] }), _jsxs("label", { style: { display: 'grid', gap: 6 }, children: [t('table_category_optional'), _jsxs("select", { value: tableCategoryId, onChange: (e) => setTableCategoryId(e.target.value), children: [_jsx("option", { value: "", children: t('choose_table_category') }), tableCategories?.map((category) => (_jsxs("option", { value: category.id, children: [category.name, " - ", category.mealPackage, " (", category.seatingCapacity, " seats, ", Number(category.ratePerPerson / 100).toFixed(2), " per person)"] }, category.id)))] })] }), _jsxs("label", { style: { display: 'grid', gap: 6, gridColumn: '1 / -1' }, children: [t('notes'), _jsx("input", { value: notes, onChange: (e) => setNotes(e.target.value) })] }), _jsxs("div", { style: { gridColumn: '1 / -1', display: 'flex', gap: 12, alignItems: 'center' }, children: [_jsx("button", { type: "submit", disabled: editingId ? !canSave : !canSubmit, children: editingId
                                            ? updateMutation.isPending
                                                ? t('updating')
                                                : t('update_event')
                                            : createMutation.isPending
                                                ? t('creating')
                                                : t('create_event') }), editingId ? (_jsx("button", { type: "button", onClick: () => {
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
                                        }, children: t('cancel') })) : null, validation.errors.length > 0 ? (_jsx("span", { style: { color: '#b00020' }, children: validation.errors[0] })) : null, editingId ? (updateMutation.isError ? (_jsx("span", { style: { color: '#b00020' }, children: updateMutation.error instanceof Error ? updateMutation.error.message : 'Failed to update event.' })) : null) : createMutation.isError ? (_jsx("span", { style: { color: '#b00020' }, children: createMutation.error instanceof Error ? createMutation.error.message : 'Failed to create event.' })) : null] })] })] }), isLoading ? _jsx("p", { children: t('loading_events') }) : null, isError ? _jsx("p", { children: t('failed_load_events') }) : null, events ? (_jsx(EventList, { events: events, onEdit: (eventId) => {
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
