import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AdminEventsPage } from '../pages/AdminEventsPage';
import { AdminMenuPage } from '../pages/AdminMenuPage';
import { AdminTableCategoriesPage } from '../pages/AdminTableCategoriesPage';
import { AdminHallsPage } from '../pages/AdminHallsPage';
import { AdminPhotosPage } from '../pages/AdminPhotosPage';
import { AdminRestaurantsPage } from '../pages/AdminRestaurantsPage';
import { LoginPage } from '../pages/LoginPage';
import { TabletMenuPage } from '../pages/TabletMenuPage';
import { TabletSummaryPage } from '../pages/TabletSummaryPage';
import { AdminLayout } from './AdminLayout';
import { useAuthStore } from '../store/auth.store';
export const App = () => {
    const setAuth = useAuthStore((s) => s.setAuth);
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const at = params.get('_at');
        const rt = params.get('_rt');
        const u = params.get('_u');
        const r = params.get('_r');
        const rid = params.get('_rid');
        const rn = params.get('_rn');
        const exp = Number(params.get('_exp') || '0');
        if (at && rt && u && r) {
            setAuth(at, rt, u, exp || 15 * 60 * 1000, r, rid || null, rn || null);
            window.history.replaceState({}, '', window.location.pathname);
        }
    }, [setAuth]);
    return (_jsxs(Routes, { children: [_jsx(Route, { path: "/login", element: _jsx(LoginPage, {}) }), _jsx(Route, { path: "/tablet", element: _jsx(TabletMenuPage, {}) }), _jsx(Route, { path: "/tablet/summary", element: _jsx(TabletSummaryPage, {}) }), _jsxs(Route, { element: _jsx(AdminLayout, {}), children: [_jsx(Route, { path: "/", element: _jsx(AdminEventsPage, {}) }), _jsx(Route, { path: "/admin/menu", element: _jsx(AdminMenuPage, {}) }), _jsx(Route, { path: "/admin/table-categories", element: _jsx(AdminTableCategoriesPage, {}) }), _jsx(Route, { path: "/admin/halls", element: _jsx(AdminHallsPage, {}) }), _jsx(Route, { path: "/admin/photos", element: _jsx(AdminPhotosPage, {}) }), _jsx(Route, { path: "/admin/restaurants", element: _jsx(AdminRestaurantsPage, {}) })] }), _jsx(Route, { path: "*", element: _jsx(Navigate, { to: "/", replace: true }) })] }));
};
