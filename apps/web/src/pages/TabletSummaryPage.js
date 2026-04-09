import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Select } from '../components/ui/select';
import { Card } from '../components/ui/card';
import { usePriceCalculator } from '../hooks/usePriceCalculator';
import { usePublicDataStore } from '../store/publicData.store';
import { useTabletStore } from '../store/tablet.store';
import { httpClient } from '../services/http';
import logo from '../assets/logo.png';
import { locales, translate } from '../utils/translate';
export const TabletSummaryPage = () => {
    const navigate = useNavigate();
    const { selectedItems, selectedHallId, selectedTableCategoryId, guestCount, locale, setLocale } = useTabletStore();
    const menuItems = usePublicDataStore((state) => state.menuItems);
    const halls = usePublicDataStore((state) => state.halls);
    const tableCategories = usePublicDataStore((state) => state.tableCategories);
    const isLoading = usePublicDataStore((state) => state.isLoading);
    const error = usePublicDataStore((state) => state.error);
    const loadPublicData = usePublicDataStore((state) => state.loadPublicData);
    const [customerName, setCustomerName] = useState('');
    const [customerPhone, setCustomerPhone] = useState('');
    const t = (key, params) => translate(key, locale, params);
    useEffect(() => {
        loadPublicData();
    }, [loadPublicData]);
    const selectedTableCategory = tableCategories.find((tc) => tc.id === selectedTableCategoryId);
    const selectedHall = halls.find((h) => h.id === selectedHallId);
    const selectedMenuItems = useMemo(() => (menuItems || []).filter((item) => selectedItems[item.id] > 0), [menuItems, selectedItems]);
    const pricing = usePriceCalculator(menuItems ?? [], selectedItems, selectedTableCategory, guestCount);
    const confirmDisabled = !customerName || !customerPhone;
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
        catch (error) {
            alert(t('download_failed'));
        }
    };
    return (_jsx("main", { className: "min-h-screen bg-slate-50 px-4 py-6 sm:px-6 lg:px-8", children: _jsxs("div", { className: "mx-auto max-w-5xl space-y-6", children: [_jsxs("header", { className: "card flex flex-col gap-6 rounded-[32px] border-slate-200 bg-white p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between", children: [_jsxs("div", { className: "flex items-center gap-4", children: [_jsx("img", { src: logo, alt: "Madinabek logo", className: "h-16 w-16 rounded-3xl object-cover" }), _jsxs("div", { children: [_jsx("p", { className: "text-sm uppercase tracking-[0.24em] text-slate-500", children: "Madinabek" }), _jsx("h1", { className: "page-heading", children: t('selection_summary') })] })] }), _jsxs("div", { className: "flex flex-col items-start gap-3 sm:items-end", children: [_jsx("span", { className: "text-sm text-slate-500", children: t('language') }), _jsx(Select, { value: locale, onChange: (event) => setLocale(event.target.value), disabled: isLoading, className: "w-full sm:w-auto", children: locales.map((localeOption) => (_jsx("option", { value: localeOption, children: t(localeOption === 'en' ? 'english' : localeOption === 'ru' ? 'russian' : 'uzbek') }, localeOption))) })] })] }), _jsxs("div", { className: "grid gap-6 lg:grid-cols-[1.3fr_0.7fr]", children: [_jsxs("div", { className: "space-y-6", children: [_jsxs(Card, { className: "p-6", children: [_jsxs("div", { className: "mb-4", children: [_jsx("p", { className: "section-heading", children: t('customer_details') }), _jsx("p", { className: "mt-1 text-sm text-slate-500", children: t('enter_customer_information') })] }), _jsxs("div", { className: "grid gap-4", children: [_jsxs("div", { className: "grid gap-2", children: [_jsx("label", { className: "text-sm font-medium text-slate-700", children: t('customer_name') }), _jsx(Input, { placeholder: t('customer_name'), value: customerName, onChange: (e) => setCustomerName(e.target.value) })] }), _jsxs("div", { className: "grid gap-2", children: [_jsx("label", { className: "text-sm font-medium text-slate-700", children: t('customer_phone') }), _jsx(Input, { placeholder: t('customer_phone'), type: "tel", value: customerPhone, onChange: (e) => setCustomerPhone(e.target.value) })] })] })] }), _jsxs(Card, { className: "p-6", children: [_jsxs("div", { className: "mb-4", children: [_jsx("p", { className: "section-heading", children: t('event_details') }), _jsx("p", { className: "mt-1 text-sm text-slate-500", children: t('overview_of_selection') })] }), _jsxs("div", { className: "space-y-3 text-sm text-slate-600", children: [_jsxs("div", { className: "rounded-3xl bg-slate-50 p-4", children: [t('hall'), ": ", selectedHall?.name || t('not_selected')] }), _jsxs("div", { className: "rounded-3xl bg-slate-50 p-4", children: [t('table_category'), ": ", selectedTableCategory?.name || t('not_selected')] }), _jsxs("div", { className: "rounded-3xl bg-slate-50 p-4", children: [t('guest_count'), ": ", guestCount] })] })] }), _jsxs(Card, { className: "p-6", children: [_jsxs("div", { className: "mb-4", children: [_jsx("p", { className: "section-heading", children: t('selected_menu_items') }), _jsx("p", { className: "mt-1 text-sm text-slate-500", children: t('review_selected_dishes') })] }), isLoading ? (_jsx("div", { className: "space-y-3", children: Array.from({ length: 3 }).map((_, index) => (_jsx("div", { className: "h-16 rounded-3xl bg-slate-100" }, index))) })) : selectedMenuItems.length === 0 ? (_jsx("p", { className: "text-sm text-slate-500", children: t('no_items_selected') })) : (_jsx("div", { className: "space-y-3", children: selectedMenuItems.map((item) => (_jsxs("div", { className: "flex items-center justify-between rounded-3xl bg-slate-50 p-4", children: [_jsxs("div", { children: [_jsx("p", { className: "font-medium text-slate-900", children: item.name }), _jsxs("p", { className: "text-sm text-slate-500", children: ["x", selectedItems[item.id]] })] }), _jsxs("p", { className: "font-semibold text-slate-900", children: ["$", ((item.priceCents * selectedItems[item.id]) / 100).toFixed(2)] })] }, item.id))) }))] })] }), _jsxs("aside", { className: "space-y-6", children: [_jsxs(Card, { className: "p-6", children: [_jsx("div", { className: "mb-4", children: _jsx("p", { className: "section-heading", children: t('pricing') }) }), _jsxs("div", { className: "space-y-3 text-sm text-slate-600", children: [_jsxs("div", { className: "flex items-center justify-between rounded-3xl bg-slate-50 p-4", children: [_jsx("span", { children: t('subtotal') }), _jsxs("span", { children: ["$", (pricing.subtotalCents / 100).toFixed(2)] })] }), _jsxs("div", { className: "flex items-center justify-between rounded-3xl bg-slate-50 p-4", children: [_jsx("span", { children: t('service_fee') }), _jsxs("span", { children: ["$", (pricing.serviceFeeCents / 100).toFixed(2)] })] }), _jsxs("div", { className: "flex items-center justify-between rounded-3xl bg-slate-50 p-4", children: [_jsx("span", { children: t('tax') }), _jsxs("span", { children: ["$", (pricing.taxCents / 100).toFixed(2)] })] }), guestCount > 1 && (_jsxs("div", { className: "flex items-center justify-between rounded-3xl bg-slate-50 p-4", children: [_jsx("span", { children: t('price_per_guest') }), _jsxs("span", { children: ["$", (pricing.perGuestCents / 100).toFixed(2)] })] })), _jsxs("div", { className: "flex items-center justify-between rounded-3xl bg-slate-900 p-4 text-white", children: [_jsx("span", { children: t('total') }), _jsxs("span", { children: ["$", (pricing.totalCents / 100).toFixed(2)] })] })] })] }), _jsxs(Card, { className: "p-6 space-y-3", children: [_jsx("p", { className: "section-heading", children: t('actions') }), _jsxs("div", { className: "grid gap-3", children: [_jsx(Button, { variant: "secondary", className: "w-full", onClick: () => navigate('/tablet'), children: t('edit_selection') }), _jsx(Button, { className: "w-full", disabled: confirmDisabled, onClick: () => { if (!confirmDisabled)
                                                        alert(t('event_confirmed')); }, children: t('confirm') }), _jsx(Button, { variant: "accent", className: "w-full", onClick: () => downloadBlob('/public/export/pdf', 'selection-summary.pdf'), children: t('download_pdf') }), _jsx(Button, { className: "w-full", onClick: () => downloadBlob('/public/export/excel', 'selection-summary.xlsx'), children: t('download_excel') })] })] })] })] })] }) }));
};
