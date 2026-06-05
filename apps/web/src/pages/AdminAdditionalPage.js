import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { menuService } from '../services/menu.service';
import { useAdminStore } from '../store/admin.store';
import { translate } from '../utils/translate';
import { getPhotoUrl } from '../utils/photoUrl';
import { formatSum } from '../utils/currency';
// The "Additional" section on the tablet shows these categories.
const ADDITIONAL_CATEGORIES = [
    'COLD_APPETIZERS', 'HOT_APPETIZERS', 'SALADS', 'DRINKS', 'SWEETS', 'FRUITS',
];
const CATEGORY_LABEL_KEY = {
    COLD_APPETIZERS: 'cold_appetizers',
    HOT_APPETIZERS: 'hot_appetizers',
    SALADS: 'salads',
    FIRST_COURSE: 'first_course',
    SECOND_COURSE: 'second_course',
    DRINKS: 'drinks',
    SWEETS: 'sweets',
    FRUITS: 'fruits',
};
export const AdminAdditionalPage = () => {
    const { locale } = useAdminStore();
    const t = (key) => translate(key, locale);
    const queryClient = useQueryClient();
    const { data, isLoading } = useQuery({
        queryKey: ['menu-items', 'admin', 'all'],
        queryFn: () => menuService.listAllForAdmin(),
    });
    const toggleMutation = useMutation({
        mutationFn: ({ id, showOnTablet }) => menuService.update(id, { showOnTablet }),
        // Optimistic toggle
        onMutate: async ({ id, showOnTablet }) => {
            await queryClient.cancelQueries({ queryKey: ['menu-items', 'admin', 'all'] });
            const prev = queryClient.getQueryData(['menu-items', 'admin', 'all']);
            queryClient.setQueryData(['menu-items', 'admin', 'all'], (old) => (old ?? []).map((it) => (it.id === id ? { ...it, showOnTablet } : it)));
            return { prev };
        },
        onError: (_e, _v, ctx) => {
            if (ctx?.prev)
                queryClient.setQueryData(['menu-items', 'admin', 'all'], ctx.prev);
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ['menu-items', 'admin', 'all'] });
            queryClient.invalidateQueries({ queryKey: ['menu-items'] });
        },
    });
    const grouped = useMemo(() => {
        const items = (data ?? []).filter((it) => ADDITIONAL_CATEGORIES.includes(it.category));
        const map = new Map();
        for (const cat of ADDITIONAL_CATEGORIES) {
            const list = items.filter((it) => it.category === cat).sort((a, b) => a.name.localeCompare(b.name));
            if (list.length > 0)
                map.set(cat, list);
        }
        return map;
    }, [data]);
    return (_jsxs("main", { className: "tablet-fade-in", style: { maxWidth: 1080, margin: '0 auto', padding: '28px 20px', position: 'relative', zIndex: 1 }, children: [_jsx("h1", { className: "adm-title", style: { marginBottom: 6 }, children: t('additional_management') }), _jsx("p", { style: { margin: '0 0 22px', color: 'rgba(226,232,240,0.55)', fontSize: 14 }, children: t('additional_help') }), isLoading && _jsx("p", { style: { color: 'rgba(226,232,240,0.5)' }, children: t('loading_menu') }), !isLoading && grouped.size === 0 && (_jsx("p", { style: { color: 'rgba(226,232,240,0.5)' }, children: t('no_additional_dishes') })), _jsx("div", { style: { display: 'flex', flexDirection: 'column', gap: 18 }, children: [...grouped.entries()].map(([cat, items]) => (_jsxs("section", { className: "adm-card tablet-fade-up", style: { padding: 16 }, children: [_jsx("h2", { className: "adm-heading", style: { margin: '0 0 12px' }, children: t(CATEGORY_LABEL_KEY[cat]) }), _jsx("div", { style: { display: 'grid', gap: 8, gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }, children: items.map((item) => {
                                const shown = item.showOnTablet !== false;
                                const photo = item.photoUrl ? getPhotoUrl(item.photoUrl) : null;
                                return (_jsxs("div", { style: {
                                        display: 'flex', alignItems: 'center', gap: 12,
                                        padding: '10px 12px', borderRadius: 12,
                                        background: shown ? 'rgba(34,197,94,0.08)' : 'rgba(15,23,42,0.5)',
                                        border: `1px solid ${shown ? 'rgba(34,197,94,0.3)' : 'rgba(255,255,255,0.08)'}`,
                                    }, children: [photo
                                            ? _jsx("img", { src: photo ?? undefined, alt: "", style: { width: 44, height: 44, borderRadius: 9, objectFit: 'cover', flexShrink: 0 } })
                                            : _jsx("div", { style: { width: 44, height: 44, borderRadius: 9, background: 'rgba(255,255,255,0.06)', flexShrink: 0 } }), _jsxs("div", { style: { flex: 1, minWidth: 0 }, children: [_jsx("p", { style: { margin: 0, fontSize: 14, fontWeight: 600, color: '#f8fafc', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }, children: item.name }), _jsx("p", { style: { margin: '2px 0 0', fontSize: 12, color: '#c9a42c', fontWeight: 600 }, children: formatSum(item.priceCents) })] }), _jsx("button", { type: "button", onClick: () => toggleMutation.mutate({ id: item.id, showOnTablet: !shown }), title: shown ? t('shown') : t('hidden'), style: {
                                                flexShrink: 0,
                                                width: 50, height: 28, borderRadius: 999,
                                                border: 'none', cursor: 'pointer', position: 'relative',
                                                background: shown ? '#22c55e' : 'rgba(255,255,255,0.15)',
                                                transition: 'background 0.18s',
                                            }, children: _jsx("span", { style: {
                                                    position: 'absolute', top: 3, left: shown ? 25 : 3,
                                                    width: 22, height: 22, borderRadius: '50%', background: '#fff',
                                                    transition: 'left 0.18s',
                                                } }) })] }, item.id));
                            }) })] }, cat))) })] }));
};
