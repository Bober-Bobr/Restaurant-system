import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { MenuItemCard } from '../components/menu/MenuItemCard';
import { usePublicDataStore } from '../store/publicData.store';
import { useTabletStore } from '../store/tablet.store';
import { locales, translate } from '../utils/translate';
import { getPhotoUrl } from '../utils/photoUrl';
import { Lightbox } from '../components/ui/lightbox';
import { formatSum } from '../utils/currency';
import logo from '../assets/logo.png';
const CATEGORY_ORDER = {
    COLD_APPETIZERS: 0, HOT_APPETIZERS: 1, SALADS: 2,
    FIRST_COURSE: 3, SECOND_COURSE: 4, DRINKS: 5, SWEETS: 6, FRUITS: 7,
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
    'COLD_APPETIZERS', 'HOT_APPETIZERS', 'SALADS', 'DRINKS', 'SWEETS', 'FRUITS',
];
const COURSE_CATEGORIES = ['FIRST_COURSE', 'SECOND_COURSE'];
// ── Decorative background ─────────────────────────────────────────────────
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
// ── TableCategoryCard ─────────────────────────────────────────────────────
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
    return (_jsxs("div", { className: `relative flex shrink-0 flex-col overflow-hidden rounded-3xl transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl ${isSelected
            ? 'ring-2 ring-[#c9a42c] shadow-[0_0_30px_rgba(201,164,44,0.3)]'
            : 'shadow-lg hover:shadow-[0_0_25px_rgba(201,164,44,0.15)]'}`, style: {
            width: 'min(300px, 85vw)',
            background: 'rgba(255,255,255,0.09)',
            border: isSelected ? '1px solid rgba(201,164,44,0.6)' : '1px solid rgba(255,255,255,0.14)',
            backdropFilter: 'blur(12px)',
        }, children: [_jsxs("div", { className: "relative h-52", style: { background: 'rgba(0,0,0,0.25)' }, children: [photos.length > 0 ? (_jsxs(_Fragment, { children: [_jsx("button", { type: "button", onClick: () => onLightbox(getPhotoUrl(photos[photoIdx]) ?? ''), className: "block h-full w-full", children: _jsx("img", { src: getPhotoUrl(photos[photoIdx]), alt: tc.name, className: "scale-in h-full w-full object-cover opacity-90" }, photoIdx) }), photos.length > 1 && (_jsxs(_Fragment, { children: [_jsx("button", { type: "button", onClick: prev, className: "absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-1.5 text-white backdrop-blur-sm transition hover:bg-black/70", children: _jsx("svg", { className: "h-4 w-4", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M15 19l-7-7 7-7" }) }) }), _jsx("button", { type: "button", onClick: next, className: "absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-1.5 text-white backdrop-blur-sm transition hover:bg-black/70", children: _jsx("svg", { className: "h-4 w-4", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M9 5l7 7-7 7" }) }) }), _jsx("div", { className: "absolute bottom-2 left-1/2 flex -translate-x-1/2 gap-1.5", children: photos.map((_, i) => (_jsx("button", { type: "button", onClick: (e) => { e.stopPropagation(); setPhotoIdx(i); }, className: `rounded-full bg-white transition-all duration-200 h-1.5 ${i === photoIdx ? 'w-4 opacity-100' : 'w-1.5 opacity-50'}` }, i))) })] }))] })) : (_jsx("div", { className: "flex h-full items-center justify-center", children: _jsx("svg", { className: "h-12 w-12", style: { color: 'rgba(255,255,255,0.15)' }, fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 1, d: "M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" }) }) })), _jsxs("div", { className: "absolute right-3 top-3 rounded-full px-3 py-1 text-xs font-bold shadow backdrop-blur-sm", style: { background: 'rgba(201,164,44,0.9)', color: '#1a3320' }, children: [formatSum(tc.ratePerPerson), _jsxs("span", { className: "ml-1 font-normal opacity-80", children: ["/ ", t('person')] })] })] }), _jsxs("div", { className: "flex flex-1 flex-col gap-3 p-4", children: [_jsxs("div", { children: [_jsx("h3", { className: "text-base font-bold text-white", children: tc.name }), tc.description && (_jsx("p", { className: "mt-1 line-clamp-2 text-xs", style: { color: 'rgba(255,255,255,0.55)' }, children: tc.description }))] }), includedCats.length > 0 && (_jsx("div", { className: "flex flex-wrap gap-1.5", children: includedCats.map((cat) => (_jsx("span", { className: "rounded-full px-2.5 py-0.5 text-[11px] font-medium", style: { background: 'rgba(201,164,44,0.15)', color: '#c9a42c', border: '1px solid rgba(201,164,44,0.3)' }, children: t(cat.toLowerCase()) }, cat))) })), _jsx("button", { type: "button", onClick: onSelect, className: "mt-auto w-full rounded-xl py-2.5 text-sm font-bold transition-all duration-200", style: isSelected
                            ? { background: '#c9a42c', color: '#1a3320' }
                            : { background: 'rgba(201,164,44,0.15)', color: '#c9a42c', border: '1px solid rgba(201,164,44,0.4)' }, children: isSelected ? '✓ ' + t('selected') : t('select_table') })] })] }));
}
// ── TableCategoryShowcase ─────────────────────────────────────────────────
function TableCategoryShowcase({ tableCategories, selectedId, onSelect, onLightbox, t, }) {
    const scrollRef = useRef(null);
    const scroll = (dir) => scrollRef.current?.scrollBy({ left: dir === 'left' ? -340 : 340, behavior: 'smooth' });
    const active = tableCategories.filter((tc) => tc.isActive);
    if (active.length === 0)
        return null;
    return (_jsxs("section", { className: "tablet-fade-up", style: { animationDelay: '40ms' }, children: [_jsxs("div", { className: "mb-4 flex items-center justify-between px-1", children: [_jsxs("div", { children: [_jsx("p", { className: "rg-label", children: t('choose_table_category') }), _jsx("p", { className: "mt-1 text-2xl font-bold text-white", children: t('table_categories') })] }), _jsx("div", { className: "flex gap-2", children: ['left', 'right'].map((dir) => (_jsx("button", { type: "button", onClick: () => scroll(dir), className: "flex h-10 w-10 items-center justify-center rounded-full text-lg font-bold transition-all duration-200", style: { background: 'rgba(201,164,44,0.15)', color: '#c9a42c', border: '1px solid rgba(201,164,44,0.35)' }, children: dir === 'left' ? '‹' : '›' }, dir))) })] }), _jsx("div", { ref: scrollRef, className: "scrollbar-none flex gap-4 overflow-x-auto px-1 py-3", children: active.map((tc, i) => (_jsx("div", { className: "tablet-fade-up", style: { animationDelay: `${i * 60}ms` }, children: _jsx(TableCategoryCard, { tc: tc, isSelected: tc.id === selectedId, onSelect: () => onSelect(tc.id), onLightbox: onLightbox, t: t }) }, tc.id))) })] }));
}
// ── Page ──────────────────────────────────────────────────────────────────
export const TabletMenuPage = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const restaurantId = searchParams.get('restaurantId') ?? '';
    const { selectedItems, selectedHallId, selectedTableCategoryId, guestCount, setQuantity, setHall, setTableCategory, setGuestCount, locale, setLocale, } = useTabletStore();
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
    return (_jsxs("main", { className: "rg-bg relative min-h-screen overflow-x-hidden px-4 py-6 sm:px-6 lg:px-8", children: [_jsx(PageBackground, {}), lightboxSrc && _jsx(Lightbox, { src: lightboxSrc, onClose: () => setLightboxSrc(null) }), _jsxs("div", { className: "relative mx-auto max-w-7xl space-y-6", children: [_jsx("header", { className: "tablet-fade-in overflow-hidden rounded-[28px] px-8 py-5 shadow-2xl", style: { background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.1)', backdropFilter: 'blur(16px)' }, children: _jsxs("div", { className: "flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between", children: [_jsxs("div", { className: "flex items-center gap-4", children: [_jsx("img", { src: logo, alt: "logo", className: "h-14 w-14 rounded-2xl object-cover shadow-lg bg-white ring-2 ring-yellow-600/40" }), _jsxs("div", { children: [_jsx("p", { className: "rg-label", children: "Madinabek" }), _jsx("h1", { className: "text-2xl font-bold text-white", children: t('client_menu_selection') })] })] }), _jsxs("div", { className: "flex items-center gap-3", children: [_jsx("select", { value: locale, onChange: (e) => setLocale(e.target.value), className: "rg-input", style: { width: 'auto', paddingRight: '2rem' }, children: locales.map((l) => (_jsx("option", { value: l, children: t(l === 'en' ? 'english' : l === 'ru' ? 'russian' : 'uzbek') }, l))) }), _jsxs("button", { type: "button", onClick: () => navigate('/'), className: "inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-all", style: { background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.8)', border: '1px solid rgba(255,255,255,0.15)' }, children: ["\u2190 ", t('events')] })] })] }) }), !isLoading && tableCategories.filter((tc) => tc.isActive).length > 0 && (_jsx(TableCategoryShowcase, { tableCategories: tableCategories, selectedId: selectedTableCategoryId ?? null, onSelect: (id) => setTableCategory(id), onLightbox: setLightboxSrc, t: t })), _jsxs("section", { className: "grid gap-6 lg:grid-cols-[1.35fr_0.65fr]", children: [_jsxs("div", { className: "space-y-6", children: [_jsxs("section", { className: "rg-card p-6 tablet-fade-up", style: { animationDelay: '60ms' }, children: [_jsx("p", { className: "rg-heading", children: t('room_table_settings') }), _jsx("p", { className: "mt-1 mb-5 text-sm", style: { color: 'rgba(255,255,255,0.5)' }, children: t('choose_room_table_details') }), _jsxs("div", { className: "grid gap-4 lg:grid-cols-3", children: [[
                                                        { label: t('select_room'), value: selectedHallId || '', onChange: setHall,
                                                            options: [{ value: '', label: t('choose_room') },
                                                                ...halls.filter((h) => h.isActive).map((h) => ({ value: h.id, label: `${h.name} · ${t('capacity')}: ${h.capacity}` }))] },
                                                        { label: t('select_table_category'), value: selectedTableCategoryId || '', onChange: setTableCategory,
                                                            options: [{ value: '', label: t('choose_table_category') },
                                                                ...tableCategories.filter((tc) => tc.isActive).map((tc) => ({ value: tc.id, label: tc.name }))] },
                                                    ].map(({ label, value, onChange, options }) => (_jsxs("div", { className: "space-y-1.5", children: [_jsx("p", { className: "rg-label", children: label }), _jsx("select", { value: value, onChange: (e) => onChange(e.target.value), disabled: isLoading, className: "rg-input", children: options.map((o) => _jsx("option", { value: o.value, children: o.label }, o.value)) })] }, label))), _jsxs("div", { className: "space-y-1.5", children: [_jsx("p", { className: "rg-label", children: t('guests') }), _jsx("input", { type: "number", min: 1, value: guestCount, onChange: (e) => setGuestCount(Number(e.target.value) || 1), className: "rg-input" })] })] }), selectedHallId && selectedTableCategoryId && (_jsxs("div", { className: "mt-5 flex flex-wrap gap-2 tablet-fade-in", children: [_jsxs("span", { className: "inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium", style: { background: 'rgba(201,164,44,0.2)', color: '#c9a42c', border: '1px solid rgba(201,164,44,0.35)' }, children: [_jsx("span", { className: "h-2 w-2 rounded-full", style: { background: '#c9a42c' } }), halls.find((h) => h.id === selectedHallId)?.name] }), _jsx("span", { className: "inline-flex items-center rounded-full px-4 py-1.5 text-sm font-medium", style: { background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.85)' }, children: tableCategories.find((tc) => tc.id === selectedTableCategoryId)?.name }), _jsxs("span", { className: "inline-flex items-center rounded-full px-4 py-1.5 text-sm font-medium", style: { background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.85)' }, children: [guestCount, " ", t('guests')] })] }))] }), selectedTableCategory && (selectedTableCategory.photos ?? []).length > 0 && (_jsxs("section", { className: "rg-card overflow-hidden tablet-fade-up", style: { animationDelay: '90ms' }, children: [_jsxs("div", { className: "px-6 pt-5 pb-3", children: [_jsx("p", { className: "rg-label", children: selectedTableCategory.name }), _jsx("p", { className: "rg-heading mt-1", children: t('table_photos') })] }), _jsx("div", { className: "scrollbar-none flex gap-3 overflow-x-auto px-6 pb-5", children: (selectedTableCategory.photos ?? []).map((url, i) => (_jsxs("button", { type: "button", onClick: () => setLightboxSrc(getPhotoUrl(url) ?? null), className: "group relative shrink-0 overflow-hidden rounded-2xl transition-all duration-300 hover:shadow-xl tablet-fade-up", style: { animationDelay: `${i * 60}ms`, width: 200, height: 140 }, children: [_jsx("img", { src: getPhotoUrl(url), alt: "", className: "h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.06]" }), _jsx("div", { className: "absolute inset-0 flex items-center justify-center bg-black/0 transition-colors duration-200 group-hover:bg-black/20", children: _jsx("svg", { className: "h-8 w-8 text-white opacity-0 drop-shadow transition-opacity duration-200 group-hover:opacity-100", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 1.5, d: "M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" }) }) })] }, i))) })] })), selectedTableCategory && (selectedTableCategory.packageItems ?? []).length > 0 && (_jsxs("section", { className: "rg-card p-6 tablet-fade-up", style: { animationDelay: '100ms' }, children: [_jsxs("div", { className: "mb-5", children: [_jsx("p", { className: "rg-label", children: selectedTableCategory.name }), _jsx("p", { className: "rg-heading mt-1", children: t('included_with_table') })] }), Object.entries((selectedTableCategory.packageItems ?? []).reduce((acc, pi) => { const cat = pi.menuItem.category; if (!acc[cat])
                                                acc[cat] = []; acc[cat].push(pi); return acc; }, {})).sort(([a], [b]) => (CATEGORY_ORDER[a] ?? 99) - (CATEGORY_ORDER[b] ?? 99))
                                                .map(([cat, items]) => (_jsxs("div", { className: "mb-6 last:mb-0", children: [_jsx("p", { className: "mb-3 rg-label", children: t(cat.toLowerCase()) }), _jsx("div", { className: "grid gap-3 sm:grid-cols-2 lg:grid-cols-3", children: items.map((pi, i) => (_jsxs("div", { className: "group overflow-hidden rounded-2xl transition-all duration-300 hover:shadow-lg tablet-fade-up", style: { animationDelay: `${i * 50}ms`, background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)' }, children: [pi.menuItem.photoUrl ? (_jsx("button", { type: "button", onClick: () => setLightboxSrc(getPhotoUrl(pi.menuItem.photoUrl) ?? null), className: "block w-full overflow-hidden", children: _jsx("img", { src: getPhotoUrl(pi.menuItem.photoUrl), alt: pi.menuItem.name, className: "h-36 w-full object-cover transition-transform duration-300 group-hover:scale-[1.05]" }) })) : (_jsx("div", { className: "flex h-36 items-center justify-center", style: { background: 'rgba(0,0,0,0.2)' }, children: _jsx("svg", { className: "h-8 w-8", style: { color: 'rgba(255,255,255,0.15)' }, fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 1, d: "M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" }) }) })), _jsxs("div", { className: "p-3", children: [_jsx("p", { className: "text-sm font-semibold leading-snug text-white", children: pi.menuItem.name }), pi.menuItem.description && (_jsx("p", { className: "mt-0.5 line-clamp-2 text-xs", style: { color: 'rgba(255,255,255,0.5)' }, children: pi.menuItem.description }))] })] }, pi.id))) })] }, cat)))] })), selectedTableCategory && courseItems.length > 0 && (_jsxs("section", { className: "rg-card p-6 tablet-fade-up", style: { animationDelay: '140ms' }, children: [_jsx("p", { className: "rg-heading mb-1", children: t('courses') }), _jsx("p", { className: "mb-5 text-sm", style: { color: 'rgba(255,255,255,0.5)' }, children: t('browse_menu_items') }), COURSE_CATEGORIES.map((cat) => {
                                                const items = courseItems.filter((item) => item.category === cat);
                                                if (items.length === 0)
                                                    return null;
                                                return (_jsxs("div", { className: "mb-6 last:mb-0", children: [_jsx("p", { className: "mb-3 rg-label", children: t(cat.toLowerCase()) }), _jsx("div", { className: "grid gap-4 sm:grid-cols-2 lg:grid-cols-3", children: items.map((item, i) => (_jsx("div", { className: "tablet-fade-up", style: { animationDelay: `${i * 50}ms` }, children: _jsx(MenuItemCard, { item: item, quantity: selectedItems[item.id] ?? 0, onQuantityChange: (qty) => setQuantity(item.id, qty), dark: true }) }, item.id))) })] }, cat));
                                            })] })), _jsxs("section", { className: "rg-card p-6 tablet-fade-up", style: { animationDelay: '180ms' }, children: [_jsx("p", { className: "rg-heading mb-1", children: t('additional') }), _jsx("p", { className: "mb-5 text-sm", style: { color: 'rgba(255,255,255,0.5)' }, children: t('browse_menu_items') }), _jsx("div", { className: "scrollbar-none mb-5 flex gap-2 overflow-x-auto pb-1", children: [null, ...ADDITIONAL_CATEGORIES.filter((cat) => (menuItems ?? []).some((item) => item.category === cat))].map((cat) => (_jsx("button", { type: "button", onClick: () => setActiveCategory(cat), className: "shrink-0 whitespace-nowrap rounded-full px-5 py-2 text-sm font-semibold transition-all duration-200", style: activeCategory === cat
                                                        ? { background: '#c9a42c', color: '#1a3320' }
                                                        : { background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.7)', border: '1px solid rgba(255,255,255,0.15)' }, children: cat === null ? t('filter_all') : t(cat.toLowerCase()) }, cat ?? 'all'))) }), isLoading ? (_jsx("div", { className: "grid gap-4 sm:grid-cols-2 lg:grid-cols-3", children: Array.from({ length: 6 }).map((_, i) => (_jsx("div", { className: "rg-shimmer h-72 rounded-3xl", style: { animationDelay: `${i * 80}ms` } }, i))) })) : error ? (_jsx("div", { className: "rounded-2xl p-6 text-sm", style: { background: 'rgba(220,38,38,0.15)', color: '#fca5a5' }, children: error })) : sortedAndFiltered.length > 0 ? (_jsx("div", { className: "tablet-fade-in grid gap-4 sm:grid-cols-2 lg:grid-cols-3", children: sortedAndFiltered.map((item, i) => (_jsx("div", { className: "tablet-fade-up", style: { animationDelay: `${i * 45}ms` }, children: _jsx(MenuItemCard, { item: item, quantity: selectedItems[item.id] ?? 0, onQuantityChange: (qty) => setQuantity(item.id, qty) }) }, item.id))) }, activeCategory ?? 'all')) : (_jsxs("div", { className: "flex flex-col items-center justify-center rounded-2xl py-14", style: { border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.3)' }, children: [_jsx("svg", { className: "mb-3 h-9 w-9", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 1.5, d: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" }) }), _jsx("p", { className: "text-sm", children: "No items in this category" })] }))] })] }), _jsx("aside", { className: "space-y-4 lg:sticky lg:top-6 lg:self-start", children: _jsxs("section", { className: "rg-card p-5 space-y-3 tablet-fade-up", style: { animationDelay: '220ms' }, children: [_jsx("p", { className: "text-sm", style: { color: 'rgba(255,255,255,0.55)' }, children: t('review_and_confirm') }), _jsxs("button", { type: "button", onClick: () => navigate('/tablet/summary'), className: "w-full rounded-xl py-3 text-sm font-bold transition-all duration-200 hover:shadow-lg", style: { background: '#c9a42c', color: '#1a3320' }, children: [t('view_summary'), " \u2192"] })] }) })] })] })] }));
};
