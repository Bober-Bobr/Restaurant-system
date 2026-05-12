import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, Navigate, Outlet, useLocation } from 'react-router-dom';
import { authService } from '../services/auth.service';
import { restaurantService } from '../services/restaurant.service';
import { useAuthStore } from '../store/auth.store';
import { useAdminStore } from '../store/admin.store';
import { locales, translate } from '../utils/translate';
import { getPhotoUrl } from '../utils/photoUrl';
import networkingLogoSrc from '../assets/networking-logo.png';
const LOCALE_LABELS = { en: 'EN', ru: 'RU', uz: 'UZ' };
export const AdminLayout = () => {
    const accessToken = useAuthStore((state) => state.accessToken);
    const username = useAuthStore((state) => state.username);
    const authRestaurantId = useAuthStore((state) => state.restaurantId);
    const logout = useAuthStore((state) => state.logout);
    const role = useAuthStore((state) => state.role);
    const { locale, setLocale } = useAdminStore();
    const t = (key, params) => translate(key, locale, params);
    const location = useLocation();
    const [mobileNavOpen, setMobileNavOpen] = useState(false);
    const { data: restaurants = [] } = useQuery({
        queryKey: ['restaurants'],
        queryFn: () => restaurantService.list(),
        enabled: !!accessToken
    });
    const effectiveLogoUrl = restaurants[0]?.logoUrl ?? restaurants[0]?.company?.logoUrl ?? null;
    const restaurantLogoSrc = getPhotoUrl(effectiveLogoUrl);
    const restaurantName = restaurants[0]?.name;
    const tabletRestaurantId = authRestaurantId ?? restaurants[0]?.id ?? '';
    const logoutMutation = useMutation({
        mutationFn: () => authService.logout(),
        onSettled: () => {
            logout();
            window.location.href = 'https://v-menu.uz/login';
        }
    });
    if (!accessToken)
        return _jsx(Navigate, { to: "/login", replace: true });
    if (role === 'OWNER') {
        window.location.href = 'https://cabinet.v-menu.uz/';
        return null;
    }
    const navItems = [
        { to: '/', label: t('events') },
        { to: '/admin/menu', label: t('menu') },
        { to: '/admin/table-categories', label: t('tables') },
        { to: '/admin/halls', label: t('halls') },
        { to: '/admin/photos', label: t('photos') },
        ...(role === 'ADMIN' ? [{ to: '/admin/users', label: t('users') }] : []),
    ];
    const isActive = (path) => path === '/' ? location.pathname === '/' : location.pathname.startsWith(path);
    return (_jsxs("div", { className: "adm-bg", children: [_jsx("nav", { style: {
                    position: 'sticky', top: 0, zIndex: 30,
                    background: 'rgba(15,23,42,0.78)',
                    backdropFilter: 'blur(18px)',
                    WebkitBackdropFilter: 'blur(18px)',
                    borderBottom: '1px solid rgba(255,255,255,0.08)',
                }, children: _jsxs("div", { style: { maxWidth: 1280, margin: '0 auto', padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }, children: [_jsxs("div", { className: "adm-slide-in-left", style: { display: 'flex', alignItems: 'center', gap: 12 }, children: [_jsx("div", { style: {
                                        position: 'relative', width: 44, height: 44, borderRadius: 12,
                                        overflow: 'hidden',
                                        border: '1px solid rgba(201,164,44,0.35)',
                                        background: 'rgba(15,23,42,0.5)',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    }, children: _jsx("img", { src: restaurantLogoSrc ?? networkingLogoSrc, alt: restaurantName ?? 'Logo', style: { width: '100%', height: '100%', objectFit: 'cover' } }) }), _jsxs("div", { children: [_jsx("p", { style: { margin: 0, fontSize: 14, fontWeight: 700, color: '#f8fafc', letterSpacing: '-0.01em' }, children: restaurantName ?? t('banquet_admin') }), _jsxs("p", { style: { margin: '2px 0 0', fontSize: 11, color: 'rgba(226,232,240,0.55)', display: 'flex', alignItems: 'center', gap: 6 }, children: [username, _jsx("span", { className: "adm-badge", style: { background: 'rgba(59,130,246,0.18)', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.3)' }, children: role })] })] })] }), _jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 4, flex: 1, flexWrap: 'wrap' }, className: "adm-nav-desktop", children: [navItems.map((item) => (_jsx(Link, { to: item.to, style: {
                                        padding: '7px 13px',
                                        borderRadius: 8,
                                        fontSize: 13,
                                        fontWeight: 600,
                                        letterSpacing: '0.01em',
                                        textDecoration: 'none',
                                        color: isActive(item.to) ? '#c9a42c' : 'rgba(226,232,240,0.7)',
                                        background: isActive(item.to) ? 'rgba(201,164,44,0.12)' : 'transparent',
                                        border: isActive(item.to) ? '1px solid rgba(201,164,44,0.35)' : '1px solid transparent',
                                        transition: 'all 0.18s',
                                    }, onMouseEnter: (e) => { if (!isActive(item.to))
                                        e.currentTarget.style.color = '#fff'; }, onMouseLeave: (e) => { if (!isActive(item.to))
                                        e.currentTarget.style.color = 'rgba(226,232,240,0.7)'; }, children: item.label }, item.to))), _jsxs(Link, { to: `/tablet?restaurantId=${tabletRestaurantId}`, style: {
                                        marginLeft: 4,
                                        padding: '7px 14px',
                                        borderRadius: 8,
                                        fontSize: 13,
                                        fontWeight: 700,
                                        textDecoration: 'none',
                                        color: '#c9a42c',
                                        background: 'rgba(201,164,44,0.1)',
                                        border: '1px solid rgba(201,164,44,0.4)',
                                        transition: 'all 0.18s',
                                        display: 'inline-flex', alignItems: 'center', gap: 6,
                                    }, onMouseEnter: (e) => { e.currentTarget.style.background = 'rgba(201,164,44,0.2)'; }, onMouseLeave: (e) => { e.currentTarget.style.background = 'rgba(201,164,44,0.1)'; }, children: [_jsxs("svg", { width: "14", height: "14", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", children: [_jsx("rect", { x: "3", y: "4", width: "18", height: "14", rx: "2" }), _jsx("line", { x1: "8", y1: "20", x2: "16", y2: "20" }), _jsx("line", { x1: "12", y1: "18", x2: "12", y2: "20" })] }), t('tablet')] })] }), _jsxs("div", { className: "adm-slide-in-right", style: { display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto' }, children: [_jsx("div", { style: { display: 'flex', gap: 4 }, children: locales.map((loc) => (_jsx("button", { type: "button", onClick: () => setLocale(loc), style: {
                                            padding: '5px 10px',
                                            border: '1px solid',
                                            borderColor: locale === loc ? 'rgba(201,164,44,0.5)' : 'rgba(255,255,255,0.1)',
                                            borderRadius: 6,
                                            background: locale === loc ? 'rgba(201,164,44,0.15)' : 'transparent',
                                            color: locale === loc ? '#c9a42c' : 'rgba(226,232,240,0.6)',
                                            fontWeight: locale === loc ? 700 : 500,
                                            cursor: 'pointer',
                                            fontSize: 11,
                                            letterSpacing: '0.06em',
                                            transition: 'all 0.18s',
                                        }, children: LOCALE_LABELS[loc] }, loc))) }), _jsxs("button", { type: "button", className: "adm-btn-danger", onClick: () => logoutMutation.mutate(), disabled: logoutMutation.isPending, style: { display: 'inline-flex', alignItems: 'center', gap: 6 }, children: [_jsxs("svg", { width: "13", height: "13", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2.2", strokeLinecap: "round", strokeLinejoin: "round", children: [_jsx("path", { d: "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" }), _jsx("polyline", { points: "16 17 21 12 16 7" }), _jsx("line", { x1: "21", y1: "12", x2: "9", y2: "12" })] }), logoutMutation.isPending ? t('logging_out') : t('logout')] }), _jsx("button", { type: "button", onClick: () => setMobileNavOpen(!mobileNavOpen), className: "adm-nav-mobile-toggle", style: {
                                        display: 'none',
                                        background: 'transparent',
                                        border: '1px solid rgba(255,255,255,0.12)',
                                        borderRadius: 8,
                                        padding: 8,
                                        color: '#e2e8f0',
                                        cursor: 'pointer',
                                    }, "aria-label": "Toggle menu", children: _jsx("svg", { width: "18", height: "18", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", children: mobileNavOpen ? (_jsxs(_Fragment, { children: [_jsx("line", { x1: "18", y1: "6", x2: "6", y2: "18" }), _jsx("line", { x1: "6", y1: "6", x2: "18", y2: "18" })] })) : (_jsxs(_Fragment, { children: [_jsx("line", { x1: "3", y1: "12", x2: "21", y2: "12" }), _jsx("line", { x1: "3", y1: "6", x2: "21", y2: "6" }), _jsx("line", { x1: "3", y1: "18", x2: "21", y2: "18" })] })) }) })] })] }) }), _jsx("div", { style: { position: 'relative', zIndex: 1 }, children: _jsx(Outlet, {}) }), _jsx("style", { children: `
        @media (max-width: 900px) {
          .adm-nav-desktop { display: none !important; }
          .adm-nav-mobile-toggle { display: inline-flex !important; align-items: center; justify-content: center; }
        }
      ` })] }));
};
