import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
import { Link, Navigate, Route, Routes } from 'react-router-dom';
import { AdminEventsPage } from '../pages/AdminEventsPage';
import { AdminMenuPage } from '../pages/AdminMenuPage';
import { AdminTableCategoriesPage } from '../pages/AdminTableCategoriesPage';
import { AdminHallsPage } from '../pages/AdminHallsPage';
import { LoginPage } from '../pages/LoginPage';
import { TabletMenuPage } from '../pages/TabletMenuPage';
import { TabletSummaryPage } from '../pages/TabletSummaryPage';
import { AdminLayout } from './AdminLayout';
export const App = () => {
    return (_jsxs(Routes, { children: [_jsx(Route, { path: "/login", element: _jsx(LoginPage, {}) }), _jsx(Route, { path: "/tablet", element: _jsxs(_Fragment, { children: [_jsx("nav", { style: { display: 'flex', gap: 12, padding: 12, borderBottom: '1px solid #ddd' }, children: _jsx(Link, { to: "/login", children: "Admin login" }) }), _jsx(TabletMenuPage, {})] }) }), _jsx(Route, { path: "/tablet/summary", element: _jsxs(_Fragment, { children: [_jsx("nav", { style: { display: 'flex', gap: 12, padding: 12, borderBottom: '1px solid #ddd' }, children: _jsx(Link, { to: "/login", children: "Admin login" }) }), _jsx(TabletSummaryPage, {})] }) }), _jsxs(Route, { element: _jsx(AdminLayout, {}), children: [_jsx(Route, { path: "/", element: _jsx(AdminEventsPage, {}) }), _jsx(Route, { path: "/admin/menu", element: _jsx(AdminMenuPage, {}) }), _jsx(Route, { path: "/admin/table-categories", element: _jsx(AdminTableCategoriesPage, {}) }), _jsx(Route, { path: "/admin/halls", element: _jsx(AdminHallsPage, {}) })] }), _jsx(Route, { path: "*", element: _jsx(Navigate, { to: "/", replace: true }) })] }));
};
