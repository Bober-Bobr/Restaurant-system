import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { MenuItemCard } from '../components/menu/MenuItemCard';
import { Input } from '../components/ui/input';
import { Select } from '../components/ui/select';
import { Button } from '../components/ui/button';
import { usePriceCalculator } from '../hooks/usePriceCalculator';
import { usePublicDataStore } from '../store/publicData.store';
import { useTabletStore } from '../store/tablet.store';
import { locales, translate } from '../utils/translate';
import { getPhotoUrl } from '../utils/photoUrl';
import { Lightbox } from '../components/ui/lightbox';
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
const ADDITIONAL_CATEGORIES = [
    'COLD_APPETIZERS',
    'HOT_APPETIZERS',
    'SALADS',
    'DRINKS',
    'SWEETS',
    'FRUITS',
];
const COURSE_CATEGORIES = ['FIRST_COURSE', 'SECOND_COURSE'];
function TableCategoryCard({ tc, isSelected, onSelect, onLightbox, t, }) {
    const photos = (tc.photos ?? []).filter(Boolean);
    const [photoIdx, setPhotoIdx] = useState(0);
    const prev = (e) => {
        e.stopPropagation();
        setPhotoIdx((i) => (i - 1 + photos.length) % photos.length);
    };
    const next = (e) => {
        e.stopPropagation();
        setPhotoIdx((i) => (i + 1) % photos.length);
    };
    const includedCats = tc.includedCategories
        ? tc.includedCategories.split(',').map((s) => s.trim()).filter(Boolean)
        : [];
    return (_jsxs("div", { className: `relative flex shrink-0 flex-col overflow-hidden rounded-3xl border bg-white shadow-sm transition-all duration-300 hover:shadow-xl ${isSelected ? 'border-stone-900 ring-2 ring-stone-900' : 'border-stone-200 hover:border-stone-400'}`, style: { width: 300 }, children: [_jsxs("div", { className: "relative h-52 bg-stone-100", children: [photos.length > 0 ? (_jsxs(_Fragment, { children: [_jsx("button", { type: "button", onClick: () => onLightbox(getPhotoUrl(photos[photoIdx]) ?? ''), className: "block h-full w-full", children: _jsx("img", { src: getPhotoUrl(photos[photoIdx]), alt: tc.name, className: "scale-in h-full w-full object-cover" }, photoIdx) }), photos.length > 1 && (_jsxs(_Fragment, { children: [_jsx("button", { type: "button", onClick: prev, className: "absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/40 p-1.5 text-white opacity-0 transition-opacity duration-200 hover:bg-black/60 group-hover:opacity-100", style: { opacity: 1 }, children: _jsx("svg", { className: "h-4 w-4", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M15 19l-7-7 7-7" }) }) }), _jsx("button", { type: "button", onClick: next, className: "absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/40 p-1.5 text-white opacity-0 transition-opacity duration-200 hover:bg-black/60 group-hover:opacity-100", style: { opacity: 1 }, children: _jsx("svg", { className: "h-4 w-4", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M9 5l7 7-7 7" }) }) }), _jsx("div", { className: "absolute bottom-2 left-1/2 flex -translate-x-1/2 gap-1.5", children: photos.map((_, i) => (_jsx("button", { type: "button", onClick: (e) => { e.stopPropagation(); setPhotoIdx(i); }, className: `rounded-full bg-white transition-all duration-200 ${i === photoIdx ? 'w-4 opacity-100' : 'w-1.5 opacity-60'} h-1.5` }, i))) })] }))] })) : (_jsx("div", { className: "flex h-full items-center justify-center", children: _jsx("svg", { className: "h-12 w-12 text-stone-200", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 1, d: "M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" }) }) })), _jsxs("div", { className: "absolute right-3 top-3 rounded-full bg-stone-900/90 px-3 py-1 text-xs font-semibold text-white shadow backdrop-blur-sm", children: ["$", (tc.ratePerPerson / 100).toFixed(0), ' ', _jsxs("span", { className: "font-normal opacity-75", children: ["/ ", t('person')] })] })] }), _jsxs("div", { className: "flex flex-1 flex-col gap-3 p-4", children: [_jsxs("div", { children: [_jsx("h3", { className: "text-base font-semibold text-stone-900", children: tc.name }), tc.description && (_jsx("p", { className: "mt-1 line-clamp-2 text-xs text-stone-500", children: tc.description }))] }), includedCats.length > 0 && (_jsx("div", { className: "flex flex-wrap gap-1.5", children: includedCats.map((cat) => (_jsx("span", { className: "rounded-full bg-stone-100 px-2.5 py-0.5 text-[11px] font-medium text-stone-600", children: t(cat.toLowerCase()) }, cat))) })), _jsx("button", { type: "button", onClick: onSelect, className: `mt-auto w-full rounded-xl py-2.5 text-sm font-semibold transition-all duration-200 ${isSelected
                            ? 'bg-emerald-500 text-white shadow-md'
                            : 'bg-stone-900 text-white hover:bg-stone-700'}`, children: isSelected ? '✓ ' + t('selected') : t('select_table') })] })] }));
}
// ── TableCategoryShowcase ─────────────────────────────────────────────────
function TableCategoryShowcase({ tableCategories, selectedId, onSelect, onLightbox, t, }) {
    const scrollRef = useRef(null);
    const scroll = (dir) => {
        scrollRef.current?.scrollBy({ left: dir === 'left' ? -340 : 340, behavior: 'smooth' });
    };
    const active = tableCategories.filter((tc) => tc.isActive);
    if (active.length === 0)
        return null;
    return (_jsxs("section", { className: "tablet-fade-up", style: { animationDelay: '40ms' }, children: [_jsxs("div", { className: "mb-4 flex items-center justify-between px-1", children: [_jsxs("div", { children: [_jsx("p", { className: "text-xs font-semibold uppercase tracking-widest text-stone-400", children: t('choose_table_category') }), _jsx("p", { className: "mt-0.5 text-xl font-semibold text-stone-900", children: t('table_categories') })] }), _jsxs("div", { className: "flex gap-2", children: [_jsx("button", { type: "button", onClick: () => scroll('left'), className: "flex h-10 w-10 items-center justify-center rounded-full border border-stone-200 bg-white text-stone-600 shadow-sm transition-all duration-200 hover:border-stone-400 hover:bg-stone-50 hover:shadow", children: "\u2039" }), _jsx("button", { type: "button", onClick: () => scroll('right'), className: "flex h-10 w-10 items-center justify-center rounded-full border border-stone-200 bg-white text-stone-600 shadow-sm transition-all duration-200 hover:border-stone-400 hover:bg-stone-50 hover:shadow", children: "\u203A" })] })] }), _jsx("div", { ref: scrollRef, className: "scrollbar-none flex gap-4 overflow-x-auto pb-2", children: active.map((tc, i) => (_jsx("div", { className: "tablet-fade-up", style: { animationDelay: `${i * 60}ms` }, children: _jsx(TableCategoryCard, { tc: tc, isSelected: tc.id === selectedId, onSelect: () => onSelect(tc.id), onLightbox: onLightbox, t: t }) }, tc.id))) })] }));
}
// ── Page ──────────────────────────────────────────────────────────────────
export const TabletMenuPage = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const restaurantId = searchParams.get('restaurantId') ?? '';
    const { selectedItems, selectedHallId, selectedTableCategoryId, guestCount, setQuantity, setHall, setTableCategory, setGuestCount, locale, setLocale } = useTabletStore();
    const menuItems = usePublicDataStore((s) => s.menuItems);
    const halls = usePublicDataStore((s) => s.halls);
    const tableCategories = usePublicDataStore((s) => s.tableCategories);
    const isLoading = usePublicDataStore((s) => s.isLoading);
    const error = usePublicDataStore((s) => s.error);
    const loadPublicData = usePublicDataStore((s) => s.loadPublicData);
    const [activeCategory, setActiveCategory] = useState(null);
    const [lightboxSrc, setLightboxSrc] = useState(null);
    const t = (key, params) => translate(key, locale, params);
    useEffect(() => {
        if (restaurantId)
            loadPublicData(restaurantId);
    }, [loadPublicData, restaurantId]);
    const sortedAndFiltered = quickSort((menuItems ?? []).filter((item) => ADDITIONAL_CATEGORIES.includes(item.category) &&
        (activeCategory === null || item.category === activeCategory)));
    const courseItems = quickSort((menuItems ?? []).filter((item) => COURSE_CATEGORIES.includes(item.category)));
    const selectedTableCategory = tableCategories?.find((tc) => tc.id === selectedTableCategoryId);
    const pricing = usePriceCalculator(menuItems ?? [], selectedItems, selectedTableCategory, guestCount);
    const pricingRows = [
        { key: 'subtotal', label: t('subtotal'), value: pricing.subtotalCents },
        { key: 'service_fee', label: t('service_fee'), value: pricing.serviceFeeCents },
        { key: 'tax', label: t('tax'), value: pricing.taxCents },
        ...(guestCount > 1
            ? [{ key: 'per_guest', label: t('price_per_guest'), value: pricing.perGuestCents }]
            : []),
    ];
    return (_jsxs("main", { className: "min-h-screen bg-[#f9f7f4] px-4 py-6 sm:px-6 lg:px-8", children: [lightboxSrc && _jsx(Lightbox, { src: lightboxSrc, onClose: () => setLightboxSrc(null) }), _jsxs("div", { className: "mx-auto max-w-7xl space-y-6", children: [_jsx("header", { className: "tablet-fade-in overflow-hidden rounded-[32px] bg-stone-900 px-8 py-6 shadow-xl", children: _jsxs("div", { className: "flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between", children: [_jsxs("div", { className: "flex items-center gap-4", children: [_jsx("img", { src: logo, alt: "logo", className: "h-14 w-14 rounded-2xl object-cover shadow-lg ring-2 ring-stone-500 ring-offset-2 ring-offset-stone-900 bg-white" }), _jsxs("div", { children: [_jsx("p", { className: "text-xs font-medium uppercase tracking-[0.3em] text-stone-400", children: "Madinabek" }), _jsx("h1", { className: "text-2xl font-semibold text-white", children: t('client_menu_selection') })] })] }), _jsxs("div", { className: "flex items-center gap-3", children: [_jsx(Select, { value: locale, onChange: (e) => setLocale(e.target.value), className: "w-auto border-stone-700 bg-stone-800 text-black focus:border-stone-500 focus:ring-stone-700", children: locales.map((l) => (_jsx("option", { value: l, children: t(l === 'en' ? 'english' : l === 'ru' ? 'russian' : 'uzbek') }, l))) }), _jsxs("button", { type: "button", onClick: () => navigate('/'), className: "inline-flex items-center gap-2 rounded-xl border border-stone-700 bg-stone-800 px-4 py-2.5 text-sm font-medium text-stone-200 transition-colors hover:bg-stone-700", children: ["\u2190 ", t('events')] })] })] }) }), !isLoading && tableCategories.filter((tc) => tc.isActive).length > 0 && (_jsx(TableCategoryShowcase, { tableCategories: tableCategories, selectedId: selectedTableCategoryId ?? null, onSelect: (id) => setTableCategory(id), onLightbox: setLightboxSrc, t: t })), _jsxs("section", { className: "grid gap-6 lg:grid-cols-[1.35fr_0.65fr]", children: [_jsxs("div", { className: "space-y-6", children: [_jsxs("section", { className: "card p-6 tablet-fade-up", style: { animationDelay: '60ms' }, children: [_jsx("p", { className: "section-heading", children: t('room_table_settings') }), _jsx("p", { className: "mt-1 mb-5 text-sm text-stone-500", children: t('choose_room_table_details') }), _jsxs("div", { className: "grid gap-4 lg:grid-cols-3", children: [_jsxs("div", { className: "space-y-1.5", children: [_jsx("label", { className: "text-xs font-semibold uppercase tracking-widest text-stone-400", children: t('select_room') }), _jsxs(Select, { value: selectedHallId || '', onChange: (e) => setHall(e.target.value), disabled: isLoading, children: [_jsx("option", { value: "", children: t('choose_room') }), halls.filter((h) => h.isActive).map((h) => (_jsxs("option", { value: h.id, children: [h.name, " \u00B7 ", t('capacity'), ": ", h.capacity] }, h.id)))] })] }), _jsxs("div", { className: "space-y-1.5", children: [_jsx("label", { className: "text-xs font-semibold uppercase tracking-widest text-stone-400", children: t('select_table_category') }), _jsxs(Select, { value: selectedTableCategoryId || '', onChange: (e) => setTableCategory(e.target.value), disabled: isLoading, children: [_jsx("option", { value: "", children: t('choose_table_category') }), tableCategories.filter((tc) => tc.isActive).map((tc) => (_jsx("option", { value: tc.id, children: tc.name }, tc.id)))] })] }), _jsxs("div", { className: "space-y-1.5", children: [_jsx("label", { className: "text-xs font-semibold uppercase tracking-widest text-stone-400", children: t('guests') }), _jsx(Input, { type: "number", min: 1, value: guestCount, onChange: (e) => setGuestCount(Number(e.target.value) || 1) })] })] }), selectedHallId && selectedTableCategoryId && (_jsxs("div", { className: "mt-5 flex flex-wrap gap-2 tablet-fade-in", children: [_jsxs("span", { className: "inline-flex items-center gap-2 rounded-full bg-stone-900 px-4 py-1.5 text-sm font-medium text-white", children: [_jsx("span", { className: "h-2 w-2 rounded-full bg-emerald-400" }), halls.find((h) => h.id === selectedHallId)?.name] }), _jsx("span", { className: "inline-flex items-center rounded-full bg-stone-100 px-4 py-1.5 text-sm font-medium text-stone-700", children: tableCategories.find((tc) => tc.id === selectedTableCategoryId)?.name }), _jsxs("span", { className: "inline-flex items-center rounded-full bg-stone-100 px-4 py-1.5 text-sm font-medium text-stone-700", children: [guestCount, " ", t('guests')] })] }))] }), selectedTableCategory && (selectedTableCategory.photos ?? []).length > 0 && (_jsxs("section", { className: "card overflow-hidden tablet-fade-up", style: { animationDelay: '90ms' }, children: [_jsxs("div", { className: "px-6 pt-5 pb-3", children: [_jsx("p", { className: "text-xs font-semibold uppercase tracking-widest text-stone-400", children: selectedTableCategory.name }), _jsx("p", { className: "section-heading mt-1", children: t('table_photos') })] }), _jsx("div", { className: "scrollbar-none flex gap-3 overflow-x-auto px-6 pb-5", children: (selectedTableCategory.photos ?? []).map((url, i) => (_jsxs("button", { type: "button", onClick: () => setLightboxSrc(getPhotoUrl(url) ?? null), className: "group relative shrink-0 overflow-hidden rounded-2xl shadow-sm transition-all duration-300 hover:shadow-lg tablet-fade-up", style: { animationDelay: `${i * 60}ms`, width: 200, height: 140 }, children: [_jsx("img", { src: getPhotoUrl(url), alt: "", className: "h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.06]" }), _jsx("div", { className: "absolute inset-0 flex items-center justify-center bg-black/0 transition-colors duration-200 group-hover:bg-black/15", children: _jsx("svg", { className: "h-8 w-8 text-white opacity-0 drop-shadow transition-opacity duration-200 group-hover:opacity-100", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 1.5, d: "M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" }) }) })] }, i))) })] })), selectedTableCategory && (selectedTableCategory.packageItems ?? []).length > 0 && (_jsxs("section", { className: "card p-6 tablet-fade-up", style: { animationDelay: '100ms' }, children: [_jsxs("div", { className: "mb-5", children: [_jsx("p", { className: "text-xs font-semibold uppercase tracking-widest text-stone-400", children: selectedTableCategory.name }), _jsx("p", { className: "section-heading mt-1", children: t('included_with_table') })] }), Object.entries((selectedTableCategory.packageItems ?? []).reduce((acc, pi) => {
                                                const cat = pi.menuItem.category;
                                                if (!acc[cat])
                                                    acc[cat] = [];
                                                acc[cat].push(pi);
                                                return acc;
                                            }, {}))
                                                .sort(([a], [b]) => (CATEGORY_ORDER[a] ?? 99) -
                                                (CATEGORY_ORDER[b] ?? 99))
                                                .map(([cat, items]) => (_jsxs("div", { className: "mb-6 last:mb-0", children: [_jsx("p", { className: "mb-3 text-xs font-semibold uppercase tracking-widest text-stone-400", children: t(cat.toLowerCase()) }), _jsx("div", { className: "grid gap-3 sm:grid-cols-2 lg:grid-cols-3", children: items.map((pi, i) => (_jsxs("div", { className: "group overflow-hidden rounded-2xl border border-stone-100 bg-white shadow-sm transition-all duration-300 hover:shadow-md tablet-fade-up", style: { animationDelay: `${i * 50}ms` }, children: [pi.menuItem.photoUrl ? (_jsx("button", { type: "button", onClick: () => setLightboxSrc(getPhotoUrl(pi.menuItem.photoUrl) ?? null), className: "block w-full overflow-hidden", children: _jsx("img", { src: getPhotoUrl(pi.menuItem.photoUrl), alt: pi.menuItem.name, className: "h-36 w-full object-cover transition-transform duration-300 group-hover:scale-[1.05]" }) })) : (_jsx("div", { className: "flex h-36 items-center justify-center bg-stone-50", children: _jsx("svg", { className: "h-8 w-8 text-stone-200", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 1, d: "M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" }) }) })), _jsxs("div", { className: "p-3", children: [_jsx("p", { className: "text-sm font-semibold leading-snug text-stone-900", children: pi.menuItem.name }), pi.menuItem.description && (_jsx("p", { className: "mt-0.5 line-clamp-2 text-xs text-stone-400", children: pi.menuItem.description }))] })] }, pi.id))) })] }, cat)))] })), selectedTableCategory && courseItems.length > 0 && (_jsxs("section", { className: "card p-6 tablet-fade-up", style: { animationDelay: '140ms' }, children: [_jsxs("div", { className: "mb-5", children: [_jsx("p", { className: "section-heading", children: t('courses') }), _jsx("p", { className: "mt-1 text-sm text-stone-500", children: t('browse_menu_items') })] }), COURSE_CATEGORIES.map((cat) => {
                                                const items = courseItems.filter((item) => item.category === cat);
                                                if (items.length === 0)
                                                    return null;
                                                return (_jsxs("div", { className: "mb-6 last:mb-0", children: [_jsx("p", { className: "mb-3 text-xs font-semibold uppercase tracking-widest text-stone-400", children: t(cat.toLowerCase()) }), _jsx("div", { className: "grid gap-4 sm:grid-cols-2 lg:grid-cols-3", children: items.map((item, i) => (_jsx("div", { className: "tablet-fade-up", style: { animationDelay: `${i * 50}ms` }, children: _jsx(MenuItemCard, { item: item, quantity: selectedItems[item.id] ?? 0, onQuantityChange: (qty) => setQuantity(item.id, qty) }) }, item.id))) })] }, cat));
                                            })] })), _jsxs("section", { className: "card p-6 tablet-fade-up", style: { animationDelay: '180ms' }, children: [_jsxs("div", { className: "mb-5", children: [_jsx("p", { className: "section-heading", children: t('additional') }), _jsx("p", { className: "mt-1 text-sm text-stone-500", children: t('browse_menu_items') })] }), _jsxs("div", { className: "scrollbar-none mb-5 flex gap-2 overflow-x-auto pb-1", children: [_jsx("button", { type: "button", onClick: () => setActiveCategory(null), className: `shrink-0 whitespace-nowrap rounded-full px-5 py-2 text-sm font-medium transition-all duration-200 ${activeCategory === null
                                                            ? 'bg-stone-900 text-white shadow-md'
                                                            : 'border border-stone-200 bg-white text-stone-600 hover:border-stone-400 hover:bg-stone-50'}`, children: t('filter_all') }), ADDITIONAL_CATEGORIES.filter((cat) => (menuItems ?? []).some((item) => item.category === cat)).map((cat) => (_jsx("button", { type: "button", onClick: () => setActiveCategory(cat), className: `shrink-0 whitespace-nowrap rounded-full px-5 py-2 text-sm font-medium transition-all duration-200 ${activeCategory === cat
                                                            ? 'bg-stone-900 text-white shadow-md'
                                                            : 'border border-stone-200 bg-white text-stone-600 hover:border-stone-400 hover:bg-stone-50'}`, children: t(cat.toLowerCase()) }, cat)))] }), isLoading ? (_jsx("div", { className: "grid gap-4 sm:grid-cols-2 lg:grid-cols-3", children: Array.from({ length: 6 }).map((_, i) => (_jsx("div", { className: "skeleton-shimmer h-72 rounded-3xl", style: { animationDelay: `${i * 80}ms` } }, i))) })) : error ? (_jsx("div", { className: "rounded-3xl bg-rose-50 p-6 text-sm text-rose-700", children: error })) : sortedAndFiltered.length > 0 ? (_jsx("div", { className: "tablet-fade-in grid gap-4 sm:grid-cols-2 lg:grid-cols-3", children: sortedAndFiltered.map((item, i) => (_jsx("div", { className: "tablet-fade-up", style: { animationDelay: `${i * 45}ms` }, children: _jsx(MenuItemCard, { item: item, quantity: selectedItems[item.id] ?? 0, onQuantityChange: (qty) => setQuantity(item.id, qty) }) }, item.id))) }, activeCategory ?? 'all')) : (_jsxs("div", { className: "flex flex-col items-center justify-center rounded-2xl border border-stone-100 py-14 text-stone-400", children: [_jsx("svg", { className: "mb-3 h-9 w-9 text-stone-200", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 1.5, d: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" }) }), _jsx("p", { className: "text-sm", children: "No items in this category" })] }))] })] }), _jsxs("aside", { className: "space-y-4 lg:sticky lg:top-6 lg:self-start", children: [_jsxs("section", { className: "overflow-hidden rounded-3xl border border-stone-200 bg-white shadow-sm tablet-fade-up", style: { animationDelay: '220ms' }, children: [_jsx("div", { className: "bg-stone-900 px-6 py-4", children: _jsx("p", { className: "text-xs font-semibold uppercase tracking-widest text-stone-400", children: t('summary') }) }), _jsx("div", { className: "px-6 pt-2 pb-2", children: _jsx("div", { className: "divide-y divide-stone-100", children: pricingRows.map(({ key, label, value }) => (_jsxs("div", { className: "flex items-center justify-between py-3 text-sm", children: [_jsx("span", { className: "text-stone-500", children: label }), _jsxs("span", { className: "font-medium text-stone-900", children: ["$", (value / 100).toFixed(2)] })] }, key))) }) }), _jsx("div", { className: "px-6 pb-6", children: _jsx("div", { className: "rounded-2xl bg-stone-900 px-5 py-4 text-white", children: _jsxs("div", { className: "flex items-baseline justify-between", children: [_jsx("span", { className: "text-xs font-semibold uppercase tracking-widest text-stone-400", children: t('total') }), _jsxs("span", { className: "text-2xl font-bold", children: ["$", (pricing.totalCents / 100).toFixed(2)] })] }) }) })] }), _jsxs("section", { className: "card p-5 space-y-3 tablet-fade-up", style: { animationDelay: '260ms' }, children: [_jsx("p", { className: "text-sm text-stone-500", children: t('review_and_confirm') }), _jsxs(Button, { className: "w-full", size: "lg", onClick: () => navigate('/tablet/summary'), children: [t('view_summary'), " \u2192"] })] })] })] })] })] }));
};
