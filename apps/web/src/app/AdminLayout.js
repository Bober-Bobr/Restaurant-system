import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useMutation } from '@tanstack/react-query';
import { Link, Navigate, Outlet, useNavigate } from 'react-router-dom';
import { authService } from '../services/auth.service';
import { useAuthStore } from '../store/auth.store';
import { useAdminStore } from '../store/admin.store';
import { locales, translate } from '../utils/translate';
import { Button } from '../components/ui/button';
import { Select } from '../components/ui/select';
import logo from '../assets/logo.png';
const ROLE_LABELS = {
    OWNER: 'Owner',
    ADMIN: 'Admin',
    EMPLOYEE: 'Employee'
};
const ROLE_COLORS = {
    OWNER: '#7c3aed',
    ADMIN: '#2563eb',
    EMPLOYEE: '#16a34a'
};
export const AdminLayout = () => {
    const navigate = useNavigate();
    const accessToken = useAuthStore((state) => state.accessToken);
    const username = useAuthStore((state) => state.username);
    const role = useAuthStore((state) => state.role);
    const logout = useAuthStore((state) => state.logout);
    const { locale, setLocale } = useAdminStore();
    const t = (key, params) => translate(key, locale, params);
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
    return (_jsxs(_Fragment, { children: [_jsx("nav", { className: "sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur-xl", children: _jsxs("div", { className: "mx-auto flex flex-wrap items-center gap-4 px-4 py-4 sm:px-6 lg:px-8", children: [_jsxs("div", { className: "flex items-center gap-3", children: [_jsx("img", { src: logo, alt: "Madinabek logo", className: "h-11 w-11 rounded-2xl object-cover" }), _jsxs("div", { children: [_jsx("p", { className: "text-sm font-semibold text-slate-900", children: t('banquet_admin') }), _jsxs("p", { className: "text-xs text-slate-500", children: [username, role && (_jsx("span", { style: { marginLeft: 6, padding: '1px 6px', borderRadius: 4, background: ROLE_COLORS[role] ?? '#888', color: '#fff', fontSize: 10, fontWeight: 600, verticalAlign: 'middle' }, children: ROLE_LABELS[role] ?? role }))] })] })] }), _jsxs("div", { className: "flex flex-wrap items-center gap-3 text-sm font-medium text-slate-700", children: [role !== 'OWNER' && (_jsxs(_Fragment, { children: [_jsx(Link, { className: "transition hover:text-slate-900", to: "/", children: t('events') }), _jsx(Link, { className: "transition hover:text-slate-900", to: "/admin/menu", children: t('menu') }), _jsx(Link, { className: "transition hover:text-slate-900", to: "/admin/table-categories", children: t('tables') }), _jsx(Link, { className: "transition hover:text-slate-900", to: "/admin/halls", children: t('halls') }), _jsx(Link, { className: "transition hover:text-slate-900", to: "/admin/photos", children: t('photos') }), role === 'ADMIN' && (_jsx(Link, { className: "transition hover:text-slate-900", to: "/admin/users", children: t('users') })), _jsx(Link, { className: "rounded-full border border-slate-200 px-3 py-2 transition hover:border-slate-300 hover:bg-slate-50", to: "/tablet", children: t('tablet') })] })), role === 'OWNER' && (_jsxs(_Fragment, { children: [_jsx(Link, { className: "transition hover:text-slate-900", to: "/admin/restaurants", children: t('my_restaurants') }), _jsx(Link, { className: "transition hover:text-slate-900", to: "/admin/users", children: t('users') })] }))] }), _jsxs("div", { className: "ml-auto flex flex-wrap items-center gap-3", children: [_jsx(Select, { value: locale, onChange: (event) => setLocale(event.target.value), className: "w-32", "aria-label": "Language", children: locales.map((localeOption) => (_jsx("option", { value: localeOption, children: t(localeOption === 'en' ? 'english' : localeOption === 'ru' ? 'russian' : 'uzbek') }, localeOption))) }), _jsx(Button, { variant: "destructive", size: "sm", onClick: () => logoutMutation.mutate(), disabled: logoutMutation.isPending, children: logoutMutation.isPending ? t('logging_out') : t('logout') })] })] }) }), _jsx(Outlet, {})] }));
};
