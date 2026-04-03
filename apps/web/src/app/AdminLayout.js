import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useMutation } from '@tanstack/react-query';
import { Link, Navigate, Outlet, useNavigate } from 'react-router-dom';
import { authService } from '../services/auth.service';
import { useAuthStore } from '../store/auth.store';
export const AdminLayout = () => {
    const navigate = useNavigate();
    const accessToken = useAuthStore((state) => state.accessToken);
    const username = useAuthStore((state) => state.username);
    const logout = useAuthStore((state) => state.logout);
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
                }, children: [_jsx("div", { style: { fontWeight: 600, fontSize: 14, color: '#333' }, children: "\uD83C\uDF7D\uFE0F Banquet" }), _jsx(Link, { to: "/", style: {
                            color: '#2196F3',
                            textDecoration: 'none',
                            fontSize: 14,
                            fontWeight: 500,
                            transition: 'color 200ms'
                        }, onMouseEnter: (e) => (e.currentTarget.style.color = '#1976D2'), onMouseLeave: (e) => (e.currentTarget.style.color = '#2196F3'), children: "Events" }), _jsx(Link, { to: "/admin/menu", style: {
                            color: '#2196F3',
                            textDecoration: 'none',
                            fontSize: 14,
                            fontWeight: 500,
                            transition: 'color 200ms'
                        }, onMouseEnter: (e) => (e.currentTarget.style.color = '#1976D2'), onMouseLeave: (e) => (e.currentTarget.style.color = '#2196F3'), children: "Menu" }), _jsx(Link, { to: "/admin/table-categories", style: {
                            color: '#2196F3',
                            textDecoration: 'none',
                            fontSize: 14,
                            fontWeight: 500,
                            transition: 'color 200ms'
                        }, onMouseEnter: (e) => (e.currentTarget.style.color = '#1976D2'), onMouseLeave: (e) => (e.currentTarget.style.color = '#2196F3'), children: "Tables" }), _jsx(Link, { to: "/admin/halls", style: {
                            color: '#2196F3',
                            textDecoration: 'none',
                            fontSize: 14,
                            fontWeight: 500,
                            transition: 'color 200ms'
                        }, onMouseEnter: (e) => (e.currentTarget.style.color = '#1976D2'), onMouseLeave: (e) => (e.currentTarget.style.color = '#2196F3'), children: "Halls" }), _jsx(Link, { to: "/tablet", style: {
                            color: '#2196F3',
                            textDecoration: 'none',
                            fontSize: 14,
                            fontWeight: 500,
                            transition: 'color 200ms'
                        }, onMouseEnter: (e) => (e.currentTarget.style.color = '#1976D2'), onMouseLeave: (e) => (e.currentTarget.style.color = '#2196F3'), children: "Tablet" }), _jsxs("div", { style: { marginLeft: 'auto', display: 'flex', gap: 16, alignItems: 'center' }, children: [_jsxs("div", { style: {
                                    fontSize: 13,
                                    color: '#666',
                                    padding: '6px 12px',
                                    background: '#fff',
                                    borderRadius: 4,
                                    border: '1px solid #e0e0e0'
                                }, children: ["\uD83D\uDC64 ", username] }), _jsx("button", { type: "button", onClick: () => logoutMutation.mutate(), disabled: logoutMutation.isPending, style: {
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
                                }, children: logoutMutation.isPending ? 'Logging out...' : 'Log out' })] })] }), _jsx(Outlet, {})] }));
};
