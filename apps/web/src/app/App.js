import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useRef } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AdminEventsPage } from '../pages/AdminEventsPage';
import { AdminMenuPage } from '../pages/AdminMenuPage';
import { AdminTableCategoriesPage } from '../pages/AdminTableCategoriesPage';
import { AdminHallsPage } from '../pages/AdminHallsPage';
import { AdminPhotosPage } from '../pages/AdminPhotosPage';
import { AdminRestaurantsPage } from '../pages/AdminRestaurantsPage';
import { AdminUsersPage } from '../pages/AdminUsersPage';
import { ChiefAdminPage } from '../pages/ChiefAdminPage';
import { OwnerCabinetPage } from '../pages/OwnerCabinetPage';
import { EmployeeEventsPage } from '../pages/EmployeeEventsPage';
import { EmployeeLayout } from './EmployeeLayout';
import { LoginPage } from '../pages/LoginPage';
import { TabletMenuPage } from '../pages/TabletMenuPage';
import { TabletSummaryPage } from '../pages/TabletSummaryPage';
import { AdminLayout } from './AdminLayout';
import { useAuthStore } from '../store/auth.store';
import { isRootDomain, isAdminSubdomain, isCabinetSubdomain, toSubdomainSlug } from '../utils/subdomain';
export const App = () => {
    const handledRef = useRef(false);
    if (!handledRef.current) {
        handledRef.current = true;
        const params = new URLSearchParams(window.location.search);
        const at = params.get('_at');
        const rt = params.get('_rt');
        const u = params.get('_u');
        const r = params.get('_r');
        if (at && rt && u && r) {
            const rid = params.get('_rid');
            const rn = params.get('_rn');
            const exp = Number(params.get('_exp') || '0');
            useAuthStore.getState().setAuth(at, rt, u, exp || 15 * 60 * 1000, r, rid || null, rn || null);
            window.history.replaceState({}, '', window.location.pathname);
        }
    }
    // On root domain, only /login, /tablet and /tablet/summary are accessible
    if (isRootDomain() && window.location.hostname !== 'localhost') {
        const { accessToken, role, restaurantName } = useAuthStore.getState();
        // CHIEF_ADMIN → admin.v-menu.uz
        if (accessToken && role === 'CHIEF_ADMIN' && window.location.pathname !== '/login') {
            window.location.href = 'https://admin.v-menu.uz/';
            return null;
        }
        // Authenticated user on root domain → send to their restaurant subdomain
        if (accessToken && restaurantName && window.location.pathname !== '/login') {
            const slug = toSubdomainSlug(restaurantName);
            window.location.href = `https://${slug}.v-menu.uz/`;
            return null;
        }
        return (_jsxs(Routes, { children: [_jsx(Route, { path: "/login", element: _jsx(LoginPage, {}) }), _jsx(Route, { path: "/tablet", element: _jsx(TabletMenuPage, {}) }), _jsx(Route, { path: "/tablet/summary", element: _jsx(TabletSummaryPage, {}) }), _jsx(Route, { path: "*", element: _jsx(Navigate, { to: "/login", replace: true }) })] }));
    }
    // Cabinet subdomain → owner dashboard
    if (isCabinetSubdomain()) {
        const { accessToken, role } = useAuthStore.getState();
        if (!accessToken || role !== 'OWNER') {
            if (window.location.pathname !== '/login') {
                window.location.href = 'https://v-menu.uz/login';
                return null;
            }
            return (_jsxs(Routes, { children: [_jsx(Route, { path: "/login", element: _jsx(LoginPage, {}) }), _jsx(Route, { path: "*", element: _jsx(Navigate, { to: "/login", replace: true }) })] }));
        }
        return (_jsxs(Routes, { children: [_jsx(Route, { path: "/", element: _jsx(OwnerCabinetPage, {}) }), _jsx(Route, { path: "*", element: _jsx(Navigate, { to: "/", replace: true }) })] }));
    }
    // Admin subdomain → only the chief admin dashboard
    if (isAdminSubdomain()) {
        const { accessToken, role } = useAuthStore.getState();
        if (!accessToken || role !== 'CHIEF_ADMIN') {
            if (window.location.pathname !== '/login') {
                window.location.href = 'https://v-menu.uz/login';
                return null;
            }
            return (_jsxs(Routes, { children: [_jsx(Route, { path: "/login", element: _jsx(LoginPage, {}) }), _jsx(Route, { path: "*", element: _jsx(Navigate, { to: "/login", replace: true }) })] }));
        }
        return (_jsxs(Routes, { children: [_jsx(Route, { path: "/", element: _jsx(ChiefAdminPage, {}) }), _jsx(Route, { path: "*", element: _jsx(Navigate, { to: "/", replace: true }) })] }));
    }
    // EMPLOYEE → simplified layout (with tablet); KITCHEN → same layout but no tablet access
    const role = useAuthStore((s) => s.role);
    if (role === 'EMPLOYEE' || role === 'KITCHEN') {
        return (_jsxs(Routes, { children: [_jsx(Route, { path: "/login", element: _jsx(LoginPage, {}) }), role === 'EMPLOYEE' && _jsx(Route, { path: "/tablet", element: _jsx(TabletMenuPage, {}) }), role === 'EMPLOYEE' && _jsx(Route, { path: "/tablet/summary", element: _jsx(TabletSummaryPage, {}) }), _jsx(Route, { element: _jsx(EmployeeLayout, {}), children: _jsx(Route, { path: "/", element: _jsx(EmployeeEventsPage, {}) }) }), _jsx(Route, { path: "*", element: _jsx(Navigate, { to: "/", replace: true }) })] }));
    }
    return (_jsxs(Routes, { children: [_jsx(Route, { path: "/login", element: _jsx(LoginPage, {}) }), _jsx(Route, { path: "/tablet", element: _jsx(TabletMenuPage, {}) }), _jsx(Route, { path: "/tablet/summary", element: _jsx(TabletSummaryPage, {}) }), _jsxs(Route, { element: _jsx(AdminLayout, {}), children: [_jsx(Route, { path: "/", element: _jsx(AdminEventsPage, {}) }), _jsx(Route, { path: "/admin/menu", element: _jsx(AdminMenuPage, {}) }), _jsx(Route, { path: "/admin/table-categories", element: _jsx(AdminTableCategoriesPage, {}) }), _jsx(Route, { path: "/admin/halls", element: _jsx(AdminHallsPage, {}) }), _jsx(Route, { path: "/admin/photos", element: _jsx(AdminPhotosPage, {}) }), _jsx(Route, { path: "/admin/restaurants", element: _jsx(AdminRestaurantsPage, {}) }), _jsx(Route, { path: "/admin/users", element: _jsx(AdminUsersPage, {}) })] }), _jsx(Route, { path: "*", element: _jsx(Navigate, { to: "/", replace: true }) })] }));
};
