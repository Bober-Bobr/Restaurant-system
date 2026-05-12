import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { useState } from 'react';
import { authService } from '../services/auth.service';
import { companyService } from '../services/company.service';
import { restaurantService } from '../services/restaurant.service';
import { useAuthStore } from '../store/auth.store';
import { getPhotoUrl } from '../utils/photoUrl';
import networkingLogoSrc from '../assets/networking-logo.png';
const formatError = (error) => {
    if (axios.isAxiosError(error)) {
        const body = error.response?.data;
        if (typeof body?.message === 'string')
            return body.message;
    }
    if (error instanceof Error)
        return error.message;
    return 'Something went wrong';
};
export const ChiefAdminPage = () => {
    const username = useAuthStore((s) => s.username);
    const logout = useAuthStore((s) => s.logout);
    const queryClient = useQueryClient();
    const [tab, setTab] = useState('companies');
    const companiesQuery = useQuery({
        queryKey: ['cad-companies'],
        queryFn: () => companyService.listAll(),
    });
    const usersQuery = useQuery({
        queryKey: ['cad-users'],
        queryFn: () => authService.listUsers(),
    });
    const companies = companiesQuery.data ?? [];
    const users = usersQuery.data ?? [];
    // ── Company actions ──────────────────────────────────────────────────────
    const deleteCompany = useMutation({
        mutationFn: (id) => companyService.deleteCompany(id),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['cad-companies'] }),
    });
    const deleteRestaurant = useMutation({
        mutationFn: (id) => restaurantService.remove(id),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['cad-companies'] }),
    });
    // ── User actions ─────────────────────────────────────────────────────────
    const [uName, setUName] = useState('');
    const [uPwd, setUPwd] = useState('');
    const [uRole, setURole] = useState('OWNER');
    const [uError, setUError] = useState(null);
    const createUser = useMutation({
        mutationFn: () => authService.createUserAsChief({ username: uName.trim(), password: uPwd, role: uRole, restaurantId: null }),
        onSuccess: () => {
            setUName('');
            setUPwd('');
            setURole('OWNER');
            setUError(null);
            queryClient.invalidateQueries({ queryKey: ['cad-users'] });
        },
        onError: (e) => setUError(formatError(e)),
    });
    const deleteUser = useMutation({
        mutationFn: (id) => authService.deleteUser(id),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['cad-users'] }),
    });
    const updateRole = useMutation({
        mutationFn: ({ id, role }) => authService.updateUserRole(id, role),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['cad-users'] }),
    });
    const handleLogout = async () => {
        try {
            await authService.logout();
        }
        catch { }
        logout();
        window.location.href = 'https://v-menu.uz/login';
    };
    // Collect all restaurant IDs that belong to a company
    const assignedRestaurantIds = new Set(companies.flatMap((c) => c.restaurants.map((r) => r.id)));
    return (_jsxs("div", { className: "adm-bg", style: { fontFamily: 'Inter, system-ui, sans-serif' }, children: [_jsxs("header", { className: "tablet-fade-in", style: {
                    position: 'sticky', top: 0, zIndex: 30,
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '14px 24px',
                    background: 'rgba(15,23,42,0.78)', backdropFilter: 'blur(18px)',
                    borderBottom: '1px solid rgba(255,255,255,0.08)',
                }, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 14 }, children: [_jsx("div", { style: {
                                    width: 44, height: 44, borderRadius: 12, overflow: 'hidden',
                                    border: '1px solid rgba(201,164,44,0.35)',
                                    background: 'rgba(15,23,42,0.5)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                }, children: _jsx("img", { src: networkingLogoSrc, alt: "Networking", style: { width: 32, height: 32, objectFit: 'contain' } }) }), _jsxs("div", { children: [_jsx("h1", { style: { margin: 0, fontSize: 16, fontWeight: 700, color: '#f8fafc', letterSpacing: '-0.01em' }, children: "Chief Administrator" }), _jsxs("p", { style: { margin: '2px 0 0', fontSize: 11, color: 'rgba(226,232,240,0.55)', display: 'flex', alignItems: 'center', gap: 6 }, children: [username, _jsx("span", { className: "adm-badge", style: { background: 'rgba(220,38,38,0.18)', color: '#fca5a5', border: '1px solid rgba(220,38,38,0.3)' }, children: "CHIEF" })] })] })] }), _jsxs("button", { onClick: handleLogout, className: "adm-btn-danger", style: { display: 'inline-flex', alignItems: 'center', gap: 6 }, children: [_jsxs("svg", { width: "13", height: "13", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2.2", strokeLinecap: "round", strokeLinejoin: "round", children: [_jsx("path", { d: "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" }), _jsx("polyline", { points: "16 17 21 12 16 7" }), _jsx("line", { x1: "21", y1: "12", x2: "9", y2: "12" })] }), "Logout"] })] }), _jsx("nav", { style: { display: 'flex', gap: 4, padding: '0 24px', borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(15,23,42,0.5)' }, children: ['companies', 'users'].map((tabKey) => (_jsx("button", { onClick: () => setTab(tabKey), style: {
                        padding: '12px 20px', background: 'none', border: 'none',
                        borderBottom: tab === tabKey ? '2px solid #c9a42c' : '2px solid transparent',
                        color: tab === tabKey ? '#c9a42c' : 'rgba(226,232,240,0.6)', cursor: 'pointer', fontSize: 14, fontWeight: 600,
                        textTransform: 'capitalize',
                        transition: 'all 0.18s',
                    }, children: tabKey }, tabKey))) }), _jsxs("main", { className: "tablet-fade-in", style: { maxWidth: 1180, margin: '0 auto', padding: '28px 24px', position: 'relative', zIndex: 1 }, children: [tab === 'companies' && (_jsxs(_Fragment, { children: [_jsxs("p", { style: { color: 'rgba(226,232,240,0.55)', fontSize: 13, marginBottom: 20 }, children: [companies.length, " ", companies.length === 1 ? 'company' : 'companies', " registered"] }), companiesQuery.isLoading && _jsx("p", { style: { color: 'rgba(226,232,240,0.55)' }, children: "Loading\u2026" }), _jsxs("div", { style: { display: 'grid', gap: 14 }, children: [companies.map((company, idx) => (_jsxs("div", { className: "adm-card adm-card-hover tablet-fade-up", style: { overflow: 'hidden', animationDelay: `${idx * 60}ms` }, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 12, padding: '16px 18px', background: 'rgba(15,23,42,0.5)', borderBottom: '1px solid rgba(255,255,255,0.06)' }, children: [company.logoUrl && (_jsx("img", { src: getPhotoUrl(company.logoUrl), alt: company.name, style: { width: 36, height: 36, borderRadius: 6, objectFit: 'cover' } })), _jsxs("div", { style: { flex: 1 }, children: [_jsx("p", { style: { margin: 0, fontWeight: 700, fontSize: 15 }, children: company.name }), _jsxs("p", { style: { margin: 0, fontSize: 12, color: 'rgba(226,232,240,0.55)' }, children: ["Owner:", ' ', _jsx("span", { style: { color: '#a78bfa', fontWeight: 600 }, children: company.owner.username }), _jsx("span", { style: { marginLeft: 6, padding: '1px 6px', background: '#7c3aed', borderRadius: 4, fontSize: 10, fontWeight: 700 }, children: "OWNER" })] })] }), _jsx("button", { onClick: () => { if (confirm(`Delete company "${company.name}" and all its restaurants?`))
                                                            deleteCompany.mutate(company.id); }, style: { ...btnStyle, background: '#dc2626', fontSize: 12, padding: '5px 10px' }, children: "Delete company" })] }), _jsxs("div", { style: { padding: '10px 16px 14px' }, children: [_jsxs("p", { style: { margin: '0 0 8px', fontSize: 12, color: 'rgba(226,232,240,0.45)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }, children: ["Restaurants (", company.restaurants.length, ")"] }), company.restaurants.length === 0 ? (_jsx("p", { style: { margin: 0, color: 'rgba(226,232,240,0.45)', fontSize: 13 }, children: "No restaurants yet." })) : (_jsx("div", { style: { display: 'grid', gap: 8 }, children: company.restaurants.map((r) => (_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: 'rgba(15,23,42,0.5)', borderRadius: 7 }, children: [r.logoUrl && (_jsx("img", { src: getPhotoUrl(r.logoUrl), alt: r.name, style: { width: 32, height: 32, borderRadius: 5, objectFit: 'cover' } })), _jsxs("div", { style: { flex: 1 }, children: [_jsx("p", { style: { margin: 0, fontWeight: 600, fontSize: 14 }, children: r.name }), r.address && _jsx("p", { style: { margin: 0, fontSize: 12, color: 'rgba(226,232,240,0.5)' }, children: r.address })] }), _jsx("button", { onClick: () => { if (confirm(`Delete restaurant "${r.name}"?`))
                                                                        deleteRestaurant.mutate(r.id); }, style: { ...btnStyle, background: '#7f1d1d', fontSize: 11, padding: '4px 8px' }, children: "Delete" })] }, r.id))) }))] })] }, company.id))), companies.length === 0 && !companiesQuery.isLoading && (_jsx("p", { style: { color: 'rgba(226,232,240,0.45)' }, children: "No companies registered yet." }))] })] })), tab === 'users' && (_jsxs(_Fragment, { children: [_jsxs("section", { style: { background: 'rgba(30,41,59,0.4)', padding: 20, borderRadius: 8, marginBottom: 24 }, children: [_jsx("h2", { style: { marginTop: 0, fontSize: 16 }, children: "Create user" }), _jsxs("div", { style: { display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }, children: [_jsx("input", { placeholder: "Username", value: uName, onChange: (e) => setUName(e.target.value), style: inputStyle }), _jsx("input", { placeholder: "Password", type: "password", value: uPwd, onChange: (e) => setUPwd(e.target.value), style: inputStyle }), _jsxs("select", { value: uRole, onChange: (e) => setURole(e.target.value), style: inputStyle, children: [_jsx("option", { value: "OWNER", children: "OWNER" }), _jsx("option", { value: "ADMIN", children: "ADMIN" }), _jsx("option", { value: "EMPLOYEE", children: "EMPLOYEE" }), _jsx("option", { value: "KITCHEN", children: "KITCHEN" })] })] }), uError && _jsx("p", { style: { color: '#f87171', marginTop: 8 }, children: uError }), _jsx("button", { onClick: () => createUser.mutate(), disabled: !uName.trim() || !uPwd || createUser.isPending, style: { ...btnStyle, marginTop: 12, opacity: (!uName.trim() || !uPwd) ? 0.5 : 1 }, children: createUser.isPending ? 'Creating...' : 'Create' })] }), _jsxs("section", { children: [_jsxs("h2", { style: { fontSize: 16, marginBottom: 12 }, children: ["All users (", users.length, ")"] }), _jsx("div", { style: { display: 'grid', gap: 8 }, children: users.map((u) => (_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 12, padding: 12, background: 'rgba(30,41,59,0.4)', borderRadius: 8 }, children: [_jsxs("div", { style: { flex: 1 }, children: [_jsx("p", { style: { margin: 0, fontWeight: 600 }, children: u.username }), _jsx("p", { style: { margin: 0, fontSize: 12, color: 'rgba(226,232,240,0.55)' }, children: companies.find((c) => c.owner.id === u.id)?.name
                                                                ?? companies.flatMap((c) => c.restaurants).find((r) => r.id === u.restaurantId)?.name
                                                                ?? (u.role === 'CHIEF_ADMIN' ? '— system —' : '— unassigned —') })] }), _jsxs("select", { value: u.role, onChange: (e) => updateRole.mutate({ id: u.id, role: e.target.value }), disabled: u.role === 'CHIEF_ADMIN', style: { ...inputStyle, width: 130 }, children: [_jsx("option", { value: "CHIEF_ADMIN", children: "CHIEF_ADMIN" }), _jsx("option", { value: "OWNER", children: "OWNER" }), _jsx("option", { value: "ADMIN", children: "ADMIN" }), _jsx("option", { value: "EMPLOYEE", children: "EMPLOYEE" }), _jsx("option", { value: "KITCHEN", children: "KITCHEN" })] }), u.role !== 'CHIEF_ADMIN' && (_jsx("button", { onClick: () => { if (confirm(`Delete user ${u.username}?`))
                                                        deleteUser.mutate(u.id); }, style: { ...btnStyle, background: '#dc2626' }, children: "Delete" }))] }, u.id))) })] })] }))] })] }));
};
const inputStyle = {
    padding: '8px 12px', background: 'rgba(15,23,42,0.5)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 6,
    color: '#e2e8f0', fontSize: 14, fontFamily: 'inherit',
};
const btnStyle = {
    padding: '8px 14px', background: '#3b82f6', border: 'none', borderRadius: 6,
    color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600,
};
