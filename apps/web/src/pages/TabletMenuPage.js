import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MenuItemCard } from '../components/menu/MenuItemCard';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Select } from '../components/ui/select';
import { usePriceCalculator } from '../hooks/usePriceCalculator';
import { usePublicDataStore } from '../store/publicData.store';
import { useTabletStore } from '../store/tablet.store';
import { locales, translate } from '../utils/translate';
import { getPhotoUrl } from '../utils/photoUrl';
import logo from '../assets/logo.png';
const CATEGORY_ORDER = {
    COLD_APPETIZERS: 0,
    HOT_APPETIZERS: 1,
    SALADS: 2,
    FIRST_COURSE: 3,
    SECOND_COURSE: 4,
    DRINKS: 5,
    SWEETS: 6,
    FRUITS: 7,
};
function quickSort(items) {
    if (items.length <= 1)
        return items;
    const pivot = items[Math.floor(items.length / 2)];
    const left = [], equal = [], right = [];
    for (const item of items) {
        const cmp = (CATEGORY_ORDER[item.category] ?? 99) - (CATEGORY_ORDER[pivot.category] ?? 99) ||
            item.name.localeCompare(pivot.name);
        if (cmp < 0)
            left.push(item);
        else if (cmp > 0)
            right.push(item);
        else
            equal.push(item);
    }
    return [...quickSort(left), ...equal, ...quickSort(right)];
}
// Shown in the "Additional" section — first/second course handled separately
const ADDITIONAL_CATEGORIES = [
    'COLD_APPETIZERS',
    'HOT_APPETIZERS',
    'SALADS',
    'DRINKS',
    'SWEETS',
    'FRUITS',
];
const COURSE_CATEGORIES = ['FIRST_COURSE', 'SECOND_COURSE'];
export const TabletMenuPage = () => {
    const navigate = useNavigate();
    const { selectedItems, selectedHallId, selectedTableCategoryId, guestCount, setQuantity, setHall, setTableCategory, setGuestCount, locale, setLocale } = useTabletStore();
    const menuItems = usePublicDataStore((state) => state.menuItems);
    const halls = usePublicDataStore((state) => state.halls);
    const tableCategories = usePublicDataStore((state) => state.tableCategories);
    const isLoading = usePublicDataStore((state) => state.isLoading);
    const error = usePublicDataStore((state) => state.error);
    const loadPublicData = usePublicDataStore((state) => state.loadPublicData);
    const [activeCategory, setActiveCategory] = useState(null);
    const t = (key, params) => translate(key, locale, params);
    useEffect(() => {
        loadPublicData();
    }, [loadPublicData]);
    const sortedAndFiltered = quickSort((menuItems ?? []).filter((item) => ADDITIONAL_CATEGORIES.includes(item.category) &&
        (activeCategory === null || item.category === activeCategory)));
    const courseItems = quickSort((menuItems ?? []).filter((item) => COURSE_CATEGORIES.includes(item.category)));
    const selectedTableCategory = tableCategories?.find((tc) => tc.id === selectedTableCategoryId);
    const pricing = usePriceCalculator(menuItems ?? [], selectedItems, selectedTableCategory, guestCount);
    return (_jsx("main", { className: "min-h-screen bg-slate-50 px-4 py-6 sm:px-6 lg:px-8", children: _jsxs("div", { className: "mx-auto max-w-7xl", children: [_jsxs("header", { className: "flex flex-col gap-4 rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between", children: [_jsxs("div", { className: "flex items-center gap-4", children: [_jsx("img", { src: logo, alt: "Madinabek logo", className: "h-16 w-16 rounded-3xl object-cover" }), _jsxs("div", { children: [_jsx("p", { className: "text-sm uppercase tracking-[0.3em] text-slate-500", children: "Madinabek" }), _jsx("h1", { className: "page-heading", children: t('client_menu_selection') })] })] }), _jsxs("div", { className: "flex flex-col items-start gap-3 sm:items-end", children: [_jsx("span", { className: "text-sm text-slate-500", children: t('language') }), _jsx(Select, { value: locale, onChange: (event) => setLocale(event.target.value), className: "w-full sm:w-auto", children: locales.map((localeOption) => (_jsx("option", { value: localeOption, children: t(localeOption === 'en' ? 'english' : localeOption === 'ru' ? 'russian' : 'uzbek') }, localeOption))) })] })] }), _jsxs("section", { className: "mt-6 grid gap-6 lg:grid-cols-[1.35fr_0.65fr]", children: [_jsxs("div", { className: "space-y-6", children: [_jsxs("section", { className: "card p-6", children: [_jsx("div", { className: "mb-4 flex items-center justify-between gap-4", children: _jsxs("div", { children: [_jsx("p", { className: "section-heading", children: t('room_table_settings') }), _jsx("p", { className: "mt-1 text-sm text-slate-500", children: t('choose_room_table_details') })] }) }), _jsxs("div", { className: "grid gap-4 lg:grid-cols-3", children: [_jsxs("div", { className: "space-y-2", children: [_jsx("label", { className: "text-sm font-medium text-slate-700", children: t('select_room') }), _jsxs(Select, { value: selectedHallId || '', onChange: (e) => setHall(e.target.value), disabled: isLoading, children: [_jsx("option", { value: "", children: t('choose_room') }), halls.filter((hall) => hall.isActive).map((hall) => (_jsxs("option", { value: hall.id, children: [hall.name, " \u2022 ", t('capacity'), ": ", hall.capacity] }, hall.id)))] })] }), _jsxs("div", { className: "space-y-2", children: [_jsx("label", { className: "text-sm font-medium text-slate-700", children: t('select_table_category') }), _jsxs(Select, { value: selectedTableCategoryId || '', onChange: (e) => setTableCategory(e.target.value), disabled: isLoading, children: [_jsx("option", { value: "", children: t('choose_table_category') }), tableCategories.filter((tc) => tc.isActive).map((tableCategory) => (_jsx("option", { value: tableCategory.id, children: tableCategory.name }, tableCategory.id)))] })] }), _jsxs("div", { className: "space-y-2", children: [_jsx("label", { className: "text-sm font-medium text-slate-700", children: t('guests') }), _jsx(Input, { id: "guest-count", type: "number", min: 1, value: guestCount, onChange: (e) => setGuestCount(Number(e.target.value) || 1) })] })] }), selectedHallId && selectedTableCategoryId && (_jsxs("div", { className: "mt-4 rounded-3xl bg-slate-50 p-4 text-sm text-slate-700", children: [_jsxs("span", { className: "font-medium", children: [t('selected'), ":"] }), ' ', halls.find((hall) => hall.id === selectedHallId)?.name, " \u2022", ' ', tableCategories.find((tc) => tc.id === selectedTableCategoryId)?.name, " \u2022 ", guestCount, " ", t('guests')] }))] }), selectedTableCategory && (selectedTableCategory.packageItems ?? []).length > 0 && (_jsxs("section", { className: "card p-6", children: [_jsxs("div", { className: "mb-5", children: [_jsx("p", { className: "section-heading", children: t('included_with_table') }), _jsx("p", { className: "mt-1 text-sm text-slate-500", children: selectedTableCategory.name })] }), Object.entries((selectedTableCategory.packageItems ?? []).reduce((acc, pi) => {
                                            const cat = pi.menuItem.category;
                                            if (!acc[cat])
                                                acc[cat] = [];
                                            acc[cat].push(pi);
                                            return acc;
                                        }, {}))
                                            .sort(([a], [b]) => (CATEGORY_ORDER[a] ?? 99) - (CATEGORY_ORDER[b] ?? 99))
                                            .map(([cat, items]) => (_jsxs("div", { className: "mb-6 last:mb-0", children: [_jsx("p", { className: "mb-3 text-xs font-semibold uppercase tracking-widest text-slate-400", children: t(cat.toLowerCase()) }), _jsx("div", { className: "grid gap-3 sm:grid-cols-2 lg:grid-cols-3", children: items.map((pi) => (_jsxs("div", { className: "flex gap-3 rounded-2xl bg-slate-50 p-3", children: [pi.menuItem.photoUrl ? (_jsx("img", { src: getPhotoUrl(pi.menuItem.photoUrl), alt: pi.menuItem.name, className: "h-16 w-16 flex-shrink-0 rounded-xl object-cover" })) : (_jsx("div", { className: "h-16 w-16 flex-shrink-0 rounded-xl bg-slate-200" })), _jsxs("div", { className: "min-w-0", children: [_jsx("p", { className: "font-medium text-slate-900 leading-snug", children: pi.menuItem.name }), pi.menuItem.description && (_jsx("p", { className: "mt-1 text-xs text-slate-500 line-clamp-2", children: pi.menuItem.description }))] })] }, pi.id))) })] }, cat)))] })), selectedTableCategory && courseItems.length > 0 && (_jsxs("section", { className: "card p-6", children: [_jsxs("div", { className: "mb-4", children: [_jsx("p", { className: "section-heading", children: t('courses') }), _jsx("p", { className: "mt-1 text-sm text-slate-500", children: t('browse_menu_items') })] }), [...COURSE_CATEGORIES].map((cat) => {
                                            const items = courseItems.filter((item) => item.category === cat);
                                            if (items.length === 0)
                                                return null;
                                            return (_jsxs("div", { className: "mb-6 last:mb-0", children: [_jsx("p", { className: "mb-3 text-xs font-semibold uppercase tracking-widest text-slate-400", children: t(cat.toLowerCase()) }), _jsx("div", { className: "grid gap-4 sm:grid-cols-2 lg:grid-cols-3", children: items.map((item) => (_jsx(MenuItemCard, { item: item, quantity: selectedItems[item.id] ?? 0, onQuantityChange: (qty) => setQuantity(item.id, qty) }, item.id))) })] }, cat));
                                        })] })), _jsxs("section", { className: "card p-6", children: [_jsx("div", { className: "mb-4 flex items-center justify-between gap-4", children: _jsxs("div", { children: [_jsx("p", { className: "section-heading", children: t('additional') }), _jsx("p", { className: "mt-1 text-sm text-slate-500", children: t('browse_menu_items') })] }) }), _jsxs("div", { className: "mb-5 flex flex-wrap gap-2", children: [_jsx("button", { onClick: () => setActiveCategory(null), className: `rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${activeCategory === null
                                                        ? 'bg-slate-900 text-white'
                                                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`, children: t('filter_all') }), ADDITIONAL_CATEGORIES.filter((cat) => (menuItems ?? []).some((item) => item.category === cat)).map((cat) => (_jsx("button", { onClick: () => setActiveCategory(cat), className: `rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${activeCategory === cat
                                                        ? 'bg-slate-900 text-white'
                                                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`, children: t(cat.toLowerCase()) }, cat)))] }), isLoading ? (_jsx("div", { className: "grid gap-4 sm:grid-cols-2 lg:grid-cols-3", children: Array.from({ length: 6 }).map((_, idx) => (_jsx("div", { className: "h-56 rounded-3xl bg-slate-100" }, idx))) })) : error ? (_jsx("div", { className: "rounded-3xl bg-rose-50 p-6 text-sm text-rose-700", children: error })) : sortedAndFiltered.length > 0 ? (_jsx("div", { className: "grid gap-4 sm:grid-cols-2 lg:grid-cols-3", children: sortedAndFiltered.map((item) => (_jsx(MenuItemCard, { item: item, quantity: selectedItems[item.id] ?? 0, onQuantityChange: (nextQuantity) => setQuantity(item.id, nextQuantity) }, item.id))) })) : (_jsx("div", { className: "rounded-3xl bg-slate-50 p-6 text-sm text-slate-500", children: "No menu items are available right now." }))] })] }), _jsxs("aside", { className: "space-y-6", children: [_jsxs("section", { className: "card p-6", children: [_jsx("p", { className: "section-heading", children: t('summary') }), _jsxs("div", { className: "mt-4 space-y-3 text-sm text-slate-600", children: [_jsxs("div", { className: "flex items-center justify-between rounded-2xl bg-slate-50 p-3", children: [_jsx("span", { children: t('subtotal') }), _jsxs("span", { children: ["$", (pricing.subtotalCents / 100).toFixed(2)] })] }), _jsxs("div", { className: "flex items-center justify-between rounded-2xl bg-slate-50 p-3", children: [_jsx("span", { children: t('service_fee') }), _jsxs("span", { children: ["$", (pricing.serviceFeeCents / 100).toFixed(2)] })] }), _jsxs("div", { className: "flex items-center justify-between rounded-2xl bg-slate-50 p-3", children: [_jsx("span", { children: t('tax') }), _jsxs("span", { children: ["$", (pricing.taxCents / 100).toFixed(2)] })] }), guestCount > 1 && (_jsxs("div", { className: "flex items-center justify-between rounded-2xl bg-slate-50 p-3", children: [_jsx("span", { children: t('price_per_guest') }), _jsxs("span", { children: ["$", (pricing.perGuestCents / 100).toFixed(2)] })] }))] }), _jsx("div", { className: "mt-6 rounded-3xl bg-slate-900 p-4 text-white", children: _jsxs("div", { className: "flex items-center justify-between text-sm uppercase tracking-[0.2em] text-slate-400", children: [_jsx("span", { children: t('total') }), _jsxs("span", { children: ["$", (pricing.totalCents / 100).toFixed(2)] })] }) })] }), _jsxs("section", { className: "card p-6 space-y-3", children: [_jsx("p", { className: "section-heading", children: t('next_step') }), _jsx("p", { className: "text-sm text-slate-500", children: t('review_and_confirm') }), _jsx(Button, { className: "w-full", onClick: () => navigate('/tablet/summary'), children: t('view_summary') })] })] })] })] }) }));
};
