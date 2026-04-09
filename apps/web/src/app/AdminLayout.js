import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useMutation } from '@tanstack/react-query';
import { Link, Navigate, Outlet, useNavigate } from 'react-router-dom';
import { authService } from '../services/auth.service';
import { useAuthStore } from '../store/auth.store';
import { useAdminStore } from '../store/admin.store';
import { locales, translate } from '../utils/translate';
import logo from '../assets/logo.png';
export const AdminLayout = () => {
    const navigate = useNavigate();
    const accessToken = useAuthStore((state) => state.accessToken);
    const username = useAuthStore((state) => state.username);
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
    return (_jsxs(_Fragment, { children: [_jsxs("nav", { style: {
                    display: 'flex',
                    gap: 20,
                    padding: '12px 20px',
                    borderBottom: '1px solid #e0e0e0',
                    alignItems: 'center',
                    background: '#fafafa'
                }, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 10 }, children: [_jsx("img", { src: logo, alt: "Restaurant logo", style: { height: 40, width: 40, objectFit: 'contain', borderRadius: 8 } }), _jsx("div", { style: { fontWeight: 600, fontSize: 14, color: '#333' }, children: t('banquet_admin') })] }), _jsx(Link, { to: "/", style: {
                            color: '#2196F3',
                            textDecoration: 'none',
                            fontSize: 14,
                            fontWeight: 500,
                            transition: 'color 200ms'
                        }, onMouseEnter: (e) => (e.currentTarget.style.color = '#1976D2'), onMouseLeave: (e) => (e.currentTarget.style.color = '#2196F3'), children: t('events') }), _jsx(Link, { to: "/admin/menu", style: {
                            color: '#2196F3',
                            textDecoration: 'none',
                            fontSize: 14,
                            fontWeight: 500,
                            transition: 'color 200ms'
                        }, onMouseEnter: (e) => (e.currentTarget.style.color = '#1976D2'), onMouseLeave: (e) => (e.currentTarget.style.color = '#2196F3'), children: t('menu') }), _jsx(Link, { to: "/admin/table-categories", style: {
                            color: '#2196F3',
                            textDecoration: 'none',
                            fontSize: 14,
                            fontWeight: 500,
                            transition: 'color 200ms'
                        }, onMouseEnter: (e) => (e.currentTarget.style.color = '#1976D2'), onMouseLeave: (e) => (e.currentTarget.style.color = '#2196F3'), children: t('tables') }), _jsx(Link, { to: "/admin/halls", style: {
                            color: '#2196F3',
                            textDecoration: 'none',
                            fontSize: 14,
                            fontWeight: 500,
                            transition: 'color 200ms'
                        }, onMouseEnter: (e) => (e.currentTarget.style.color = '#1976D2'), onMouseLeave: (e) => (e.currentTarget.style.color = '#2196F3'), children: t('halls') }), _jsx(Link, { to: "/tablet", style: {
                            color: '#2196F3',
                            textDecoration: 'none',
                            fontSize: 14,
                            fontWeight: 500,
                            transition: 'color 200ms'
                        }, onMouseEnter: (e) => (e.currentTarget.style.color = '#1976D2'), onMouseLeave: (e) => (e.currentTarget.style.color = '#2196F3'), children: t('tablet') }), _jsxs("div", { style: { marginLeft: 'auto', display: 'flex', gap: 16, alignItems: 'center' }, children: [_jsxs("div", { style: {
                                    fontSize: 13,
                                    color: '#666',
                                    padding: '6px 12px',
                                    background: '#fff',
                                    borderRadius: 4,
                                    border: '1px solid #e0e0e0'
                                }, children: ["\uD83D\uDC64 ", username] }), _jsxs("label", { style: { display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }, children: [_jsxs("span", { children: [t('language'), ":"] }), _jsx("select", { value: locale, onChange: (event) => setLocale(event.target.value), style: { padding: '6px', borderRadius: 4, border: '1px solid #ccc' }, children: locales.map((localeOption) => (_jsx("option", { value: localeOption, children: t(localeOption === 'en' ? 'english' : localeOption === 'ru' ? 'russian' : 'uzbek') }, localeOption))) })] }), _jsx("button", { type: "button", onClick: () => logoutMutation.mutate(), disabled: logoutMutation.isPending, style: {
                                    padding: '8px 16px',
                                    background: '#f44336',
                                    color: '#fff',
                                    border: 'none',
                                    borderRadius: 4,
                                    fontSize: 13,
                                    fontWeight: 500,
                                    cursor: logoutMutation.isPending ? 'not-allowed' : 'pointer',
                                    opacity: logoutMutation.isPending ? 0.6 : 1,
                                    transition: 'opacity 200ms'
                                }, children: logoutMutation.isPending ? t('logging_out') : t('logout') })] })] }), _jsx(Outlet, {})] }));
};
