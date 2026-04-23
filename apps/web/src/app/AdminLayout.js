import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useMutation, useQuery } from '@tanstack/react-query';
import { Link, Navigate, Outlet, useNavigate } from 'react-router-dom';
import { authService } from '../services/auth.service';
import { restaurantService } from '../services/restaurant.service';
import { useAuthStore } from '../store/auth.store';
import { useAdminStore } from '../store/admin.store';
import { locales, translate } from '../utils/translate';
import { Button } from '../components/ui/button';
import { Select } from '../components/ui/select';
import { getPhotoUrl } from '../utils/photoUrl';
export const AdminLayout = () => {
    const navigate = useNavigate();
    const accessToken = useAuthStore((state) => state.accessToken);
    const username = useAuthStore((state) => state.username);
    const authRestaurantId = useAuthStore((state) => state.restaurantId);
    const logout = useAuthStore((state) => state.logout);
    const { locale, setLocale } = useAdminStore();
    const t = (key, params) => translate(key, locale, params);
    const { data: restaurants = [] } = useQuery({
        queryKey: ['restaurants'],
        queryFn: () => restaurantService.list(),
        enabled: !!accessToken
    });
    const restaurantLogoSrc = getPhotoUrl(restaurants[0]?.logoUrl);
    const restaurantName = restaurants[0]?.name;
    const tabletRestaurantId = authRestaurantId ?? restaurants[0]?.id ?? '';
    const logoutMutation = useMutation({
        mutationFn: () => authService.logout(),
        onSettled: () => {
            logout();
            navigate('/login', { replace: true });
        }
    });
    if (!accessToken) {
        return _jsx(Navigate, { to: "/login", replace: true });
    }
    return (_jsxs(_Fragment, { children: [_jsx("nav", { className: "sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur-xl", children: _jsxs("div", { className: "mx-auto flex flex-wrap items-center gap-4 px-4 py-4 sm:px-6 lg:px-8", children: [_jsxs("div", { className: "flex items-center gap-3", children: [restaurantLogoSrc && (_jsx("img", { src: restaurantLogoSrc, alt: restaurantName ?? 'Restaurant logo', className: "h-11 w-11 rounded-2xl object-cover" })), _jsxs("div", { children: [_jsx("p", { className: "text-sm font-semibold text-slate-900", children: restaurantName ?? t('banquet_admin') }), _jsxs("p", { className: "text-xs text-slate-500", children: [username, _jsx("span", { style: { marginLeft: 6, padding: '1px 6px', borderRadius: 4, background: '#2563eb', color: '#fff', fontSize: 10, fontWeight: 600, verticalAlign: 'middle' }, children: "Admin" })] })] })] }), _jsxs("div", { className: "flex flex-wrap items-center gap-3 text-sm font-medium text-slate-700", children: [_jsx(Link, { className: "transition hover:text-slate-900", to: "/", children: t('events') }), _jsx(Link, { className: "transition hover:text-slate-900", to: "/admin/menu", children: t('menu') }), _jsx(Link, { className: "transition hover:text-slate-900", to: "/admin/table-categories", children: t('tables') }), _jsx(Link, { className: "transition hover:text-slate-900", to: "/admin/halls", children: t('halls') }), _jsx(Link, { className: "transition hover:text-slate-900", to: "/admin/photos", children: t('photos') }), _jsx(Link, { className: "rounded-full border border-slate-200 px-3 py-2 transition hover:border-slate-300 hover:bg-slate-50", to: `/tablet?restaurantId=${tabletRestaurantId}`, children: t('tablet') })] }), _jsxs("div", { className: "ml-auto flex flex-wrap items-center gap-3", children: [_jsx(Select, { value: locale, onChange: (event) => setLocale(event.target.value), className: "w-32", "aria-label": "Language", children: locales.map((localeOption) => (_jsx("option", { value: localeOption, children: t(localeOption === 'en' ? 'english' : localeOption === 'ru' ? 'russian' : 'uzbek') }, localeOption))) }), _jsx(Button, { variant: "destructive", size: "sm", onClick: () => logoutMutation.mutate(), disabled: logoutMutation.isPending, children: logoutMutation.isPending ? t('logging_out') : t('logout') })] })] }) }), _jsx(Outlet, {})] }));
};
