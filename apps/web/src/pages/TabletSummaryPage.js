import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { usePriceCalculator } from '../hooks/usePriceCalculator';
import { usePublicDataStore } from '../store/publicData.store';
import { useTabletStore } from '../store/tablet.store';
import { eventService } from '../services/event.service';
import { httpClient } from '../services/http';
import logo from '../assets/logo.png';
import { locales, translate } from '../utils/translate';
import { formatSum } from '../utils/currency';
const eventTypes = ['RESERVATION', 'BANQUET', 'WEDDING', 'BIRTHDAY', 'PRIVATE_PARTY', 'CORPORATE'];
// ── Decorative background (shared with menu page) ─────────────────────────
function PageBackground() {
    return (_jsxs("div", { className: "pointer-events-none fixed inset-0 overflow-hidden", children: [_jsx("div", { style: {
                    position: 'absolute', top: '-140px', right: '-140px',
                    width: '560px', height: '560px', borderRadius: '50%',
                    background: 'radial-gradient(circle, rgba(201,164,44,0.22) 0%, transparent 65%)',
                    filter: 'blur(50px)',
                } }), _jsx("div", { style: {
                    position: 'absolute', bottom: '-120px', left: '-120px',
                    width: '520px', height: '520px', borderRadius: '50%',
                    background: 'radial-gradient(circle, rgba(60,110,50,0.35) 0%, transparent 65%)',
                    filter: 'blur(50px)',
                } }), _jsx("div", { style: {
                    position: 'absolute', top: '50%', right: '15%',
                    width: '300px', height: '300px', borderRadius: '50%',
                    background: 'radial-gradient(circle, rgba(201,164,44,0.07) 0%, transparent 70%)',
                    filter: 'blur(30px)',
                } })] }));
}
// ── Shared page header ────────────────────────────────────────────────────
function PageHeader({ title, locale, setLocale, isLoading, t, }) {
    return (_jsx("header", { className: "tablet-fade-in overflow-hidden rounded-[28px] px-8 py-5 shadow-2xl", style: { background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.1)', backdropFilter: 'blur(16px)' }, children: _jsxs("div", { className: "flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between", children: [_jsxs("div", { className: "flex items-center gap-4", children: [_jsx("img", { src: logo, alt: "logo", className: "h-14 w-14 rounded-2xl object-cover shadow-lg bg-white" }), _jsxs("div", { children: [_jsx("p", { className: "rg-label", children: "Madinabek" }), _jsx("h1", { className: "text-2xl font-bold text-white", children: title })] })] }), _jsx("select", { value: locale, onChange: (e) => setLocale(e.target.value), disabled: isLoading, className: "rg-input", style: { width: 'auto', paddingRight: '2rem' }, children: locales.map((l) => (_jsx("option", { value: l, children: t(l === 'en' ? 'english' : l === 'ru' ? 'russian' : 'uzbek') }, l))) })] }) }));
}
// ── Page ──────────────────────────────────────────────────────────────────
export const TabletSummaryPage = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const restaurantId = searchParams.get('restaurantId') ?? '';
    const { selectedItems, selectedHallId, selectedTableCategoryId, guestCount, locale, setLocale, reset } = useTabletStore();
    const menuItems = usePublicDataStore((s) => s.menuItems);
    const halls = usePublicDataStore((s) => s.halls);
    const tableCategories = usePublicDataStore((s) => s.tableCategories);
    const isLoading = usePublicDataStore((s) => s.isLoading);
    const loadPublicData = usePublicDataStore((s) => s.loadPublicData);
    const [customerName, setCustomerName] = useState('');
    const [customerPhone, setCustomerPhone] = useState('');
    const [eventDate, setEventDate] = useState('');
    const [eventTime, setEventTime] = useState('');
    const [eventNotes, setEventNotes] = useState('');
    const [eventType, setEventType] = useState('RESERVATION');
    const [birthdayPersonName, setBirthdayPersonName] = useState('');
    const [brideName, setBrideName] = useState('');
    const [groomName, setGroomName] = useState('');
    const [honoreePersonName, setHonoreeName] = useState('');
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
                brideName: eventType === 'WEDDING' && brideName.trim() ? brideName.trim() : undefined,
                groomName: eventType === 'WEDDING' && groomName.trim() ? groomName.trim() : undefined,
                honoreePersonName: !['BIRTHDAY', 'WEDDING'].includes(eventType) && honoreePersonName.trim() ? honoreePersonName.trim() : undefined,
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
            const response = await httpClient.post(url, { customerName, customerPhone, hallName: selectedHall?.name || '', tableCategoryName: selectedTableCategory?.name || '',
                guestCount, selectedItems, menuItems: menuItems || [], pricing, locale, restaurantName: 'Madinabek' }, { responseType: 'blob' });
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
    const pricingRows = [
        { key: 'subtotal', label: t('subtotal'), value: pricing.subtotalCents },
        { key: 'service_fee', label: t('service_fee'), value: pricing.serviceFeeCents },
        { key: 'tax', label: t('tax'), value: pricing.taxCents },
        ...(guestCount > 1 ? [{ key: 'per_guest', label: t('price_per_guest'), value: pricing.perGuestCents }] : []),
    ];
    // ── Success screen ────────────────────────────────────────────────────────
    if (confirmedEventId !== null) {
        return (_jsxs("main", { className: "rg-bg relative min-h-screen overflow-x-hidden px-4 py-12 sm:px-6", children: [_jsx(PageBackground, {}), _jsxs("div", { className: "relative mx-auto max-w-md space-y-6", children: [_jsx(PageHeader, { title: t('selection_summary'), locale: locale, setLocale: setLocale, isLoading: isLoading, t: t }), _jsxs("div", { className: "rg-card p-10 text-center space-y-6 tablet-fade-up", style: { animationDelay: '80ms' }, children: [_jsx("div", { className: "scale-in mx-auto flex h-24 w-24 items-center justify-center rounded-full", style: { background: 'rgba(201,164,44,0.15)', border: '2px solid rgba(201,164,44,0.4)' }, children: _jsx("svg", { className: "h-12 w-12", style: { color: '#c9a42c' }, fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M5 13l4 4L19 7" }) }) }), _jsxs("div", { className: "space-y-2", children: [_jsx("p", { className: "text-2xl font-bold text-white", children: t('event_confirmed') }), _jsx("p", { className: "text-sm", style: { color: 'rgba(255,255,255,0.55)' }, children: t('thank_you') }), _jsxs("p", { className: "mt-3 font-mono text-sm", style: { color: 'rgba(201,164,44,0.7)' }, children: ["Event #", confirmedEventId] })] }), _jsx("button", { type: "button", onClick: () => {
                                        setConfirmedEventId(null);
                                        setCustomerName('');
                                        setCustomerPhone('');
                                        setEventDate('');
                                        setEventTime('');
                                        setEventNotes('');
                                        setEventType('RESERVATION');
                                        setBirthdayPersonName('');
                                        setBrideName('');
                                        setGroomName('');
                                        setHonoreeName('');
                                        navigate('/tablet');
                                    }, className: "w-full rounded-xl py-3 text-sm font-bold transition-all duration-200 hover:shadow-lg", style: { background: '#c9a42c', color: '#1a3320' }, children: t('start_new_booking') })] })] })] }));
    }
    // ── Main summary screen ───────────────────────────────────────────────────
    return (_jsxs("main", { className: "rg-bg relative min-h-screen overflow-x-hidden px-4 py-6 sm:px-6 lg:px-8", children: [_jsx(PageBackground, {}), _jsxs("div", { className: "relative mx-auto max-w-5xl space-y-6", children: [_jsx(PageHeader, { title: t('selection_summary'), locale: locale, setLocale: setLocale, isLoading: isLoading, t: t }), _jsxs("div", { className: "grid gap-6 lg:grid-cols-[1.3fr_0.7fr]", children: [_jsxs("div", { className: "space-y-6", children: [_jsxs("section", { className: "rg-card p-6 tablet-fade-up", style: { animationDelay: '60ms' }, children: [_jsx("p", { className: "rg-heading", children: t('customer_details') }), _jsx("p", { className: "mt-1 mb-5 text-sm", style: { color: 'rgba(255,255,255,0.5)' }, children: t('enter_customer_information') }), _jsxs("div", { className: "grid gap-4", children: [_jsxs("div", { className: "grid gap-1.5", children: [_jsx("label", { className: "rg-label", children: t('customer_name') }), _jsx("input", { className: "rg-input", placeholder: t('customer_name'), value: customerName, onChange: (e) => setCustomerName(e.target.value) })] }), _jsxs("div", { className: "grid gap-1.5", children: [_jsx("label", { className: "rg-label", children: t('customer_phone') }), _jsx("input", { className: "rg-input", type: "tel", placeholder: t('customer_phone'), value: customerPhone, onChange: (e) => setCustomerPhone(e.target.value) })] }), _jsxs("div", { className: "grid grid-cols-2 gap-3", children: [_jsxs("div", { className: "grid gap-1.5", children: [_jsx("label", { className: "rg-label", children: t('event_date') }), _jsx("input", { className: "rg-input", type: "date", value: eventDate, onChange: (e) => setEventDate(e.target.value) })] }), _jsxs("div", { className: "grid gap-1.5", children: [_jsx("label", { className: "rg-label", children: t('event_time') }), _jsx("input", { className: "rg-input", type: "time", value: eventTime, onChange: (e) => setEventTime(e.target.value) })] })] }), _jsxs("div", { className: "grid gap-1.5", children: [_jsx("label", { className: "rg-label", children: t('event_type') }), _jsx("select", { className: "rg-input", value: eventType, onChange: (e) => setEventType(e.target.value), children: eventTypes.map((type) => (_jsx("option", { value: type, children: t(`event_type_${type.toLowerCase()}`) }, type))) })] }), eventType === 'BIRTHDAY' && (_jsxs("div", { className: "grid gap-1.5 tablet-fade-in", children: [_jsx("label", { className: "rg-label", children: t('birthday_person_name') }), _jsx("input", { className: "rg-input", placeholder: t('birthday_person_name_placeholder'), value: birthdayPersonName, onChange: (e) => setBirthdayPersonName(e.target.value) })] })), eventType === 'WEDDING' && (_jsxs(_Fragment, { children: [_jsxs("div", { className: "grid gap-1.5 tablet-fade-in", children: [_jsx("label", { className: "rg-label", children: t('bride_name') }), _jsx("input", { className: "rg-input", placeholder: t('bride_groom_name_placeholder'), value: brideName, onChange: (e) => setBrideName(e.target.value) })] }), _jsxs("div", { className: "grid gap-1.5 tablet-fade-in", children: [_jsx("label", { className: "rg-label", children: t('groom_name') }), _jsx("input", { className: "rg-input", placeholder: t('bride_groom_name_placeholder'), value: groomName, onChange: (e) => setGroomName(e.target.value) })] })] })), !['BIRTHDAY', 'WEDDING'].includes(eventType) && (_jsxs("div", { className: "grid gap-1.5 tablet-fade-in", children: [_jsx("label", { className: "rg-label", children: t('honoree_person_name') }), _jsx("input", { className: "rg-input", placeholder: t('honoree_person_name_placeholder'), value: honoreePersonName, onChange: (e) => setHonoreeName(e.target.value) })] })), _jsxs("div", { className: "grid gap-1.5", children: [_jsxs("label", { className: "rg-label", children: [t('notes'), _jsxs("span", { className: "ml-1 normal-case font-normal", style: { color: 'rgba(255,255,255,0.3)' }, children: ["(", t('description_optional').toLowerCase(), ")"] })] }), _jsx("textarea", { rows: 3, placeholder: t('notes_placeholder'), value: eventNotes, onChange: (e) => setEventNotes(e.target.value), className: "rg-input resize-none" })] })] })] }), _jsxs("section", { className: "rg-card p-6 tablet-fade-up", style: { animationDelay: '100ms' }, children: [_jsx("p", { className: "rg-heading mb-4", children: t('event_details') }), _jsx("div", { className: "grid gap-2 sm:grid-cols-2", children: [
                                                    { label: t('event_type'), value: t(`event_type_${eventType.toLowerCase()}`) },
                                                    { label: t('hall'), value: selectedHall?.name || t('not_selected') },
                                                    { label: t('table_category'), value: selectedTableCategory?.name || t('not_selected') },
                                                    { label: t('guest_count'), value: String(guestCount) },
                                                    ...(eventDate ? [{ label: t('event_date'), value: new Date(eventDate).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) }] : []),
                                                    ...(eventTime ? [{ label: t('event_time'), value: eventTime }] : []),
                                                    ...(eventType === 'BIRTHDAY' && birthdayPersonName ? [{ label: t('birthday_person_name'), value: birthdayPersonName }] : []),
                                                    ...(eventType === 'WEDDING' && brideName ? [{ label: t('bride_name'), value: brideName }] : []),
                                                    ...(eventType === 'WEDDING' && groomName ? [{ label: t('groom_name'), value: groomName }] : []),
                                                    ...(!['BIRTHDAY', 'WEDDING'].includes(eventType) && honoreePersonName ? [{ label: t('honoree_person_name'), value: honoreePersonName }] : []),
                                                    ...(eventNotes ? [{ label: t('notes'), value: eventNotes }] : []),
                                                ].map(({ label, value }) => (_jsxs("div", { className: "rounded-2xl px-4 py-3", style: { background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }, children: [_jsx("p", { className: "rg-label", children: label }), _jsx("p", { className: "mt-0.5 text-sm font-medium text-white", children: value })] }, label))) })] }), _jsxs("section", { className: "rg-card p-6 tablet-fade-up", style: { animationDelay: '140ms' }, children: [_jsx("p", { className: "rg-heading mb-4", children: t('selected_menu_items') }), isLoading ? (_jsx("div", { className: "space-y-3", children: Array.from({ length: 3 }).map((_, i) => (_jsx("div", { className: "rg-shimmer h-14 rounded-2xl", style: { animationDelay: `${i * 80}ms` } }, i))) })) : selectedMenuItems.length === 0 ? (_jsx("p", { className: "text-sm", style: { color: 'rgba(255,255,255,0.4)' }, children: t('no_items_selected') })) : (_jsx("div", { className: "space-y-2", children: selectedMenuItems.map((item) => (_jsxs("div", { className: "flex items-center justify-between rounded-2xl px-4 py-3", style: { background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }, children: [_jsxs("div", { className: "flex items-center gap-3", children: [_jsx("span", { className: "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold", style: { background: '#c9a42c', color: '#1a3320' }, children: selectedItems[item.id] }), _jsx("p", { className: "text-sm font-medium text-white", children: item.name })] }), _jsx("p", { className: "text-sm font-semibold", style: { color: '#c9a42c' }, children: formatSum(item.priceCents * selectedItems[item.id]) })] }, item.id))) }))] })] }), _jsxs("aside", { className: "space-y-4 lg:sticky lg:top-6 lg:self-start", children: [_jsxs("section", { className: "overflow-hidden rounded-3xl tablet-fade-up", style: { animationDelay: '80ms',
                                            background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', backdropFilter: 'blur(12px)' }, children: [_jsx("div", { className: "px-6 py-4", style: { borderBottom: '1px solid rgba(255,255,255,0.08)' }, children: _jsx("p", { className: "rg-label", children: t('pricing') }) }), _jsx("div", { className: "px-6 py-2", children: pricingRows.map(({ key, label, value }) => (_jsxs("div", { className: "flex items-center justify-between py-3 text-sm", style: { borderBottom: '1px solid rgba(255,255,255,0.07)' }, children: [_jsx("span", { style: { color: 'rgba(255,255,255,0.55)' }, children: label }), _jsx("span", { className: "font-medium text-white", children: formatSum(value) })] }, key))) }), _jsx("div", { className: "px-6 pb-6 pt-4", children: _jsx("div", { className: "rounded-2xl px-5 py-4", style: { background: 'rgba(201,164,44,0.15)', border: '1px solid rgba(201,164,44,0.4)' }, children: _jsxs("div", { className: "flex items-baseline justify-between", children: [_jsx("span", { className: "rg-label", children: t('total') }), _jsx("span", { className: "text-2xl font-bold", style: { color: '#c9a42c' }, children: formatSum(pricing.totalCents) })] }) }) })] }), _jsxs("section", { className: "rg-card p-5 space-y-3 tablet-fade-up", style: { animationDelay: '120ms' }, children: [_jsx("p", { className: "rg-label", children: t('actions') }), _jsxs("button", { type: "button", onClick: () => navigate('/tablet'), className: "inline-flex w-full items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-medium transition-all", style: { background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.75)', border: '1px solid rgba(255,255,255,0.15)' }, children: ["\u2190 ", t('edit_selection')] }), _jsx("button", { type: "button", disabled: confirmDisabled || isSubmitting, onClick: handleConfirm, className: "w-full rounded-xl py-3 text-sm font-bold transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed hover:shadow-lg", style: { background: '#c9a42c', color: '#1a3320' }, children: isSubmitting ? t('submitting') : t('confirm') }), submitError && (_jsx("p", { className: "text-center text-xs", style: { color: '#fca5a5' }, children: submitError })), _jsx("div", { className: "grid gap-2 pt-3", style: { borderTop: '1px solid rgba(255,255,255,0.08)' }, children: [
                                                    { label: t('download_pdf'), fn: () => downloadBlob('/public/export/pdf', 'selection-summary.pdf'),
                                                        icon: 'M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
                                                    { label: t('download_excel'), fn: () => downloadBlob('/public/export/excel', 'selection-summary.xlsx'),
                                                        icon: 'M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
                                                ].map(({ label, fn, icon }) => (_jsxs("button", { type: "button", onClick: fn, className: "inline-flex w-full items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-medium transition-all", style: { background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.75)', border: '1px solid rgba(255,255,255,0.15)' }, children: [_jsx("svg", { className: "h-4 w-4", style: { color: 'rgba(201,164,44,0.7)' }, fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: icon }) }), label] }, label))) })] })] })] })] })] }));
};
