import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Select } from '../components/ui/select';
import { Card } from '../components/ui/card';
import { usePriceCalculator } from '../hooks/usePriceCalculator';
import { usePublicDataStore } from '../store/publicData.store';
import { useTabletStore } from '../store/tablet.store';
import { eventService } from '../services/event.service';
import { httpClient } from '../services/http';
import logo from '../assets/logo.png';
import { locales, translate } from '../utils/translate';
const eventTypes = ['RESERVATION', 'BANQUET', 'WEDDING', 'BIRTHDAY', 'PRIVATE_PARTY', 'CORPORATE'];
export const TabletSummaryPage = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const restaurantId = searchParams.get('restaurantId') ?? '';
    const { selectedItems, selectedHallId, selectedTableCategoryId, guestCount, locale, setLocale, reset } = useTabletStore();
    const menuItems = usePublicDataStore((state) => state.menuItems);
    const halls = usePublicDataStore((state) => state.halls);
    const tableCategories = usePublicDataStore((state) => state.tableCategories);
    const isLoading = usePublicDataStore((state) => state.isLoading);
    const loadPublicData = usePublicDataStore((state) => state.loadPublicData);
    const [customerName, setCustomerName] = useState('');
    const [customerPhone, setCustomerPhone] = useState('');
    const [eventDate, setEventDate] = useState('');
    const [eventTime, setEventTime] = useState('');
    const [eventNotes, setEventNotes] = useState('');
    const [eventType, setEventType] = useState('RESERVATION');
    const [birthdayPersonName, setBirthdayPersonName] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [confirmedEventId, setConfirmedEventId] = useState(null);
    const [submitError, setSubmitError] = useState(null);
    const t = (key, params) => translate(key, locale, params);
    useEffect(() => {
        if (restaurantId)
            loadPublicData(restaurantId);
    }, [loadPublicData, restaurantId]);
    const selectedTableCategory = tableCategories.find((tc) => tc.id === selectedTableCategoryId);
    const selectedHall = halls.find((h) => h.id === selectedHallId);
    const selectedMenuItems = useMemo(() => (menuItems || []).filter((item) => selectedItems[item.id] > 0), [menuItems, selectedItems]);
    const pricing = usePriceCalculator(menuItems ?? [], selectedItems, selectedTableCategory, guestCount);
    const confirmDisabled = !customerName.trim() || !customerPhone.trim() || !eventDate || !eventTime;
    const handleConfirm = async () => {
        if (confirmDisabled || isSubmitting)
            return;
        setIsSubmitting(true);
        setSubmitError(null);
        try {
            const event = await eventService.create({
                customerName: customerName.trim(),
                customerPhone: customerPhone.trim() || undefined,
                eventDate: new Date(`${eventDate}T${eventTime}`).toISOString(),
                guestCount,
                status: 'CONFIRMED',
                eventType,
                hallId: selectedHallId || undefined,
                tableCategoryId: selectedTableCategoryId || undefined,
                notes: eventNotes.trim() || undefined,
                birthdayPersonName: eventType === 'BIRTHDAY' && birthdayPersonName.trim() ? birthdayPersonName.trim() : undefined,
            });
            setConfirmedEventId(event.id);
            reset();
        }
        catch {
            setSubmitError(t('event_create_error'));
        }
        finally {
            setIsSubmitting(false);
        }
    };
    const downloadBlob = async (url, filename) => {
        try {
            const response = await httpClient.post(url, {
                customerName,
                customerPhone,
                hallName: selectedHall?.name || '',
                tableCategoryName: selectedTableCategory?.name || '',
                guestCount,
                selectedItems,
                menuItems: menuItems || [],
                pricing,
                locale,
                restaurantName: 'Madinabek'
            }, { responseType: 'blob' });
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
    // ── Success screen ────────────────────────────────────────────────────────
    if (confirmedEventId !== null) {
        return (_jsx("main", { className: "min-h-screen bg-slate-50 px-4 py-6 sm:px-6 lg:px-8", children: _jsxs("div", { className: "mx-auto max-w-lg", children: [_jsxs("header", { className: "mb-8 flex items-center gap-4", children: [_jsx("img", { src: logo, alt: "Madinabek logo", className: "h-14 w-14 rounded-3xl object-cover" }), _jsxs("div", { children: [_jsx("p", { className: "text-sm uppercase tracking-[0.3em] text-slate-500", children: "Madinabek" }), _jsx("h1", { className: "page-heading", children: t('selection_summary') })] })] }), _jsxs(Card, { className: "p-8 text-center space-y-6", children: [_jsx("div", { className: "mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100", children: _jsx("svg", { className: "h-10 w-10 text-emerald-600", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M5 13l4 4L19 7" }) }) }), _jsxs("div", { className: "space-y-2", children: [_jsx("p", { className: "text-xl font-semibold text-slate-900", children: t('event_confirmed') }), _jsx("p", { className: "text-sm text-slate-500", children: t('thank_you') }), _jsxs("p", { className: "mt-3 font-mono text-sm text-slate-400", children: ["Event #", confirmedEventId] })] }), _jsx(Button, { className: "w-full", onClick: () => {
                                    setConfirmedEventId(null);
                                    setCustomerName('');
                                    setCustomerPhone('');
                                    setEventDate('');
                                    setEventTime('');
                                    setEventNotes('');
                                    setEventType('RESERVATION');
                                    setBirthdayPersonName('');
                                    navigate('/tablet');
                                }, children: t('start_new_booking') })] })] }) }));
    }
    // ── Main summary screen ───────────────────────────────────────────────────
    return (_jsx("main", { className: "min-h-screen bg-slate-50 px-4 py-6 sm:px-6 lg:px-8", children: _jsxs("div", { className: "mx-auto max-w-5xl space-y-6", children: [_jsxs("header", { className: "card flex flex-col gap-6 rounded-[32px] border-slate-200 bg-white p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between", children: [_jsxs("div", { className: "flex items-center gap-4", children: [_jsx("img", { src: logo, alt: "Madinabek logo", className: "h-16 w-16 rounded-3xl object-cover" }), _jsxs("div", { children: [_jsx("p", { className: "text-sm uppercase tracking-[0.24em] text-slate-500", children: "Madinabek" }), _jsx("h1", { className: "page-heading", children: t('selection_summary') })] })] }), _jsxs("div", { className: "flex flex-col items-start gap-3 sm:items-end", children: [_jsx("span", { className: "text-sm text-slate-500", children: t('language') }), _jsx(Select, { value: locale, onChange: (event) => setLocale(event.target.value), disabled: isLoading, className: "w-full sm:w-auto", children: locales.map((localeOption) => (_jsx("option", { value: localeOption, children: t(localeOption === 'en' ? 'english' : localeOption === 'ru' ? 'russian' : 'uzbek') }, localeOption))) })] })] }), _jsxs("div", { className: "grid gap-6 lg:grid-cols-[1.3fr_0.7fr]", children: [_jsxs("div", { className: "space-y-6", children: [_jsxs(Card, { className: "p-6", children: [_jsxs("div", { className: "mb-4", children: [_jsx("p", { className: "section-heading", children: t('customer_details') }), _jsx("p", { className: "mt-1 text-sm text-slate-500", children: t('enter_customer_information') })] }), _jsxs("div", { className: "grid gap-4", children: [_jsxs("div", { className: "grid gap-2", children: [_jsx("label", { className: "text-sm font-medium text-slate-700", children: t('customer_name') }), _jsx(Input, { placeholder: t('customer_name'), value: customerName, onChange: (e) => setCustomerName(e.target.value) })] }), _jsxs("div", { className: "grid gap-2", children: [_jsx("label", { className: "text-sm font-medium text-slate-700", children: t('customer_phone') }), _jsx(Input, { placeholder: t('customer_phone'), type: "tel", value: customerPhone, onChange: (e) => setCustomerPhone(e.target.value) })] }), _jsxs("div", { className: "grid grid-cols-2 gap-3", children: [_jsxs("div", { className: "grid gap-2", children: [_jsx("label", { className: "text-sm font-medium text-slate-700", children: t('event_date') }), _jsx(Input, { type: "date", value: eventDate, onChange: (e) => setEventDate(e.target.value) })] }), _jsxs("div", { className: "grid gap-2", children: [_jsx("label", { className: "text-sm font-medium text-slate-700", children: t('event_time') }), _jsx(Input, { type: "time", value: eventTime, onChange: (e) => setEventTime(e.target.value) })] })] }), _jsxs("div", { className: "grid gap-2", children: [_jsx("label", { className: "text-sm font-medium text-slate-700", children: t('event_type') }), _jsx(Select, { value: eventType, onChange: (e) => setEventType(e.target.value), children: eventTypes.map((type) => (_jsx("option", { value: type, children: t(`event_type_${type.toLowerCase()}`) }, type))) })] }), eventType === 'BIRTHDAY' && (_jsxs("div", { className: "grid gap-2", children: [_jsx("label", { className: "text-sm font-medium text-slate-700", children: t('birthday_person_name') }), _jsx(Input, { placeholder: t('birthday_person_name_placeholder'), value: birthdayPersonName, onChange: (e) => setBirthdayPersonName(e.target.value) })] })), _jsxs("div", { className: "grid gap-2", children: [_jsxs("label", { className: "text-sm font-medium text-slate-700", children: [t('notes'), _jsxs("span", { className: "ml-1 font-normal text-slate-400", children: ["(", t('description_optional').toLowerCase(), ")"] })] }), _jsx("textarea", { rows: 3, placeholder: t('notes_placeholder'), value: eventNotes, onChange: (e) => setEventNotes(e.target.value), className: "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200 resize-none" })] })] })] }), _jsxs(Card, { className: "p-6", children: [_jsxs("div", { className: "mb-4", children: [_jsx("p", { className: "section-heading", children: t('event_details') }), _jsx("p", { className: "mt-1 text-sm text-slate-500", children: t('overview_of_selection') })] }), _jsxs("div", { className: "space-y-3 text-sm text-slate-600", children: [_jsxs("div", { className: "rounded-3xl bg-slate-50 p-4", children: [t('event_type'), ": ", _jsx("span", { className: "font-medium text-slate-800", children: t(`event_type_${eventType.toLowerCase()}`) })] }), eventType === 'BIRTHDAY' && birthdayPersonName && (_jsxs("div", { className: "rounded-3xl bg-slate-50 p-4", children: [t('birthday_person_name'), ": ", _jsx("span", { className: "font-medium text-slate-800", children: birthdayPersonName })] })), _jsxs("div", { className: "rounded-3xl bg-slate-50 p-4", children: [t('hall'), ": ", _jsx("span", { className: "font-medium text-slate-800", children: selectedHall?.name || t('not_selected') })] }), _jsxs("div", { className: "rounded-3xl bg-slate-50 p-4", children: [t('table_category'), ": ", _jsx("span", { className: "font-medium text-slate-800", children: selectedTableCategory?.name || t('not_selected') })] }), _jsxs("div", { className: "rounded-3xl bg-slate-50 p-4", children: [t('guest_count'), ": ", _jsx("span", { className: "font-medium text-slate-800", children: guestCount })] }), eventDate && (_jsxs("div", { className: "rounded-3xl bg-slate-50 p-4", children: [t('event_date'), ": ", _jsx("span", { className: "font-medium text-slate-800", children: new Date(eventDate).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) })] })), eventTime && (_jsxs("div", { className: "rounded-3xl bg-slate-50 p-4", children: [t('event_time'), ": ", _jsx("span", { className: "font-medium text-slate-800", children: eventTime })] })), eventNotes && (_jsxs("div", { className: "rounded-3xl bg-slate-50 p-4", children: [t('notes'), ": ", _jsx("span", { className: "font-medium text-slate-800", children: eventNotes })] }))] })] }), _jsxs(Card, { className: "p-6", children: [_jsxs("div", { className: "mb-4", children: [_jsx("p", { className: "section-heading", children: t('selected_menu_items') }), _jsx("p", { className: "mt-1 text-sm text-slate-500", children: t('review_selected_dishes') })] }), isLoading ? (_jsx("div", { className: "space-y-3", children: Array.from({ length: 3 }).map((_, index) => (_jsx("div", { className: "h-16 rounded-3xl bg-slate-100" }, index))) })) : selectedMenuItems.length === 0 ? (_jsx("p", { className: "text-sm text-slate-500", children: t('no_items_selected') })) : (_jsx("div", { className: "space-y-3", children: selectedMenuItems.map((item) => (_jsxs("div", { className: "flex items-center justify-between rounded-3xl bg-slate-50 p-4", children: [_jsxs("div", { children: [_jsx("p", { className: "font-medium text-slate-900", children: item.name }), _jsxs("p", { className: "text-sm text-slate-500", children: ["x", selectedItems[item.id]] })] }), _jsxs("p", { className: "font-semibold text-slate-900", children: ["$", ((item.priceCents * selectedItems[item.id]) / 100).toFixed(2)] })] }, item.id))) }))] })] }), _jsxs("aside", { className: "space-y-6", children: [_jsxs(Card, { className: "p-6", children: [_jsx("div", { className: "mb-4", children: _jsx("p", { className: "section-heading", children: t('pricing') }) }), _jsxs("div", { className: "space-y-3 text-sm text-slate-600", children: [_jsxs("div", { className: "flex items-center justify-between rounded-3xl bg-slate-50 p-4", children: [_jsx("span", { children: t('subtotal') }), _jsxs("span", { children: ["$", (pricing.subtotalCents / 100).toFixed(2)] })] }), _jsxs("div", { className: "flex items-center justify-between rounded-3xl bg-slate-50 p-4", children: [_jsx("span", { children: t('service_fee') }), _jsxs("span", { children: ["$", (pricing.serviceFeeCents / 100).toFixed(2)] })] }), _jsxs("div", { className: "flex items-center justify-between rounded-3xl bg-slate-50 p-4", children: [_jsx("span", { children: t('tax') }), _jsxs("span", { children: ["$", (pricing.taxCents / 100).toFixed(2)] })] }), guestCount > 1 && (_jsxs("div", { className: "flex items-center justify-between rounded-3xl bg-slate-50 p-4", children: [_jsx("span", { children: t('price_per_guest') }), _jsxs("span", { children: ["$", (pricing.perGuestCents / 100).toFixed(2)] })] })), _jsxs("div", { className: "flex items-center justify-between rounded-3xl bg-slate-900 p-4 text-white", children: [_jsx("span", { children: t('total') }), _jsxs("span", { children: ["$", (pricing.totalCents / 100).toFixed(2)] })] })] })] }), _jsxs(Card, { className: "p-6 space-y-3", children: [_jsx("p", { className: "section-heading", children: t('actions') }), _jsxs("div", { className: "grid gap-3", children: [_jsx(Button, { variant: "secondary", className: "w-full", onClick: () => navigate('/tablet'), children: t('edit_selection') }), _jsx(Button, { className: "w-full", disabled: confirmDisabled || isSubmitting, onClick: handleConfirm, children: isSubmitting ? t('submitting') : t('confirm') }), submitError && (_jsx("p", { className: "text-center text-xs text-red-600", children: submitError })), _jsx(Button, { variant: "accent", className: "w-full", onClick: () => downloadBlob('/public/export/pdf', 'selection-summary.pdf'), children: t('download_pdf') }), _jsx(Button, { className: "w-full", onClick: () => downloadBlob('/public/export/excel', 'selection-summary.xlsx'), children: t('download_excel') })] })] })] })] })] }) }));
};
