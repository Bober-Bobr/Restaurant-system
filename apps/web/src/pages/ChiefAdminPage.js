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
    return (_jsxs("div", { style: { minHeight: '100vh', background: '#0f172a', color: '#e2e8f0', fontFamily: 'system-ui, sans-serif' }, children: [_jsxs("header", { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', borderBottom: '1px solid #1e293b', background: '#0b1220' }, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 12 }, children: [_jsx("img", { src: networkingLogoSrc, alt: "Networking", style: { height: 40, width: 40, objectFit: 'contain' } }), _jsxs("div", { children: [_jsx("h1", { style: { margin: 0, fontSize: 18, fontWeight: 700 }, children: "Chief Administrator" }), _jsx("p", { style: { margin: 0, fontSize: 12, color: '#94a3b8' }, children: username })] })] }), _jsx("button", { onClick: handleLogout, style: { padding: '8px 14px', background: '#dc2626', border: 'none', borderRadius: 6, color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600 }, children: "Logout" })] }), _jsx("nav", { style: { display: 'flex', gap: 4, padding: '0 24px', borderBottom: '1px solid #1e293b' }, children: ['companies', 'users'].map((t) => (_jsx("button", { onClick: () => setTab(t), style: {
                        padding: '12px 20px', background: 'none', border: 'none',
                        borderBottom: tab === t ? '2px solid #3b82f6' : '2px solid transparent',
                        color: tab === t ? '#fff' : '#94a3b8', cursor: 'pointer', fontSize: 14, fontWeight: 600,
                        textTransform: 'capitalize',
                    }, children: t }, t))) }), _jsxs("main", { style: { maxWidth: 1100, margin: '0 auto', padding: 24 }, children: [tab === 'companies' && (_jsxs(_Fragment, { children: [_jsxs("p", { style: { color: '#64748b', fontSize: 13, marginBottom: 20 }, children: [companies.length, " ", companies.length === 1 ? 'company' : 'companies', " registered"] }), companiesQuery.isLoading && _jsx("p", { style: { color: '#64748b' }, children: "Loading\u2026" }), _jsxs("div", { style: { display: 'grid', gap: 16 }, children: [companies.map((company) => (_jsxs("div", { style: { background: '#1e293b', borderRadius: 10, overflow: 'hidden', border: '1px solid #334155' }, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', background: '#0f172a', borderBottom: '1px solid #334155' }, children: [company.logoUrl && (_jsx("img", { src: getPhotoUrl(company.logoUrl), alt: company.name, style: { width: 36, height: 36, borderRadius: 6, objectFit: 'cover' } })), _jsxs("div", { style: { flex: 1 }, children: [_jsx("p", { style: { margin: 0, fontWeight: 700, fontSize: 15 }, children: company.name }), _jsxs("p", { style: { margin: 0, fontSize: 12, color: '#94a3b8' }, children: ["Owner:", ' ', _jsx("span", { style: { color: '#a78bfa', fontWeight: 600 }, children: company.owner.username }), _jsx("span", { style: { marginLeft: 6, padding: '1px 6px', background: '#7c3aed', borderRadius: 4, fontSize: 10, fontWeight: 700 }, children: "OWNER" })] })] }), _jsx("button", { onClick: () => { if (confirm(`Delete company "${company.name}" and all its restaurants?`))
                                                            deleteCompany.mutate(company.id); }, style: { ...btnStyle, background: '#dc2626', fontSize: 12, padding: '5px 10px' }, children: "Delete company" })] }), _jsxs("div", { style: { padding: '10px 16px 14px' }, children: [_jsxs("p", { style: { margin: '0 0 8px', fontSize: 12, color: '#475569', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }, children: ["Restaurants (", company.restaurants.length, ")"] }), company.restaurants.length === 0 ? (_jsx("p", { style: { margin: 0, color: '#475569', fontSize: 13 }, children: "No restaurants yet." })) : (_jsx("div", { style: { display: 'grid', gap: 8 }, children: company.restaurants.map((r) => (_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: '#0f172a', borderRadius: 7 }, children: [r.logoUrl && (_jsx("img", { src: getPhotoUrl(r.logoUrl), alt: r.name, style: { width: 32, height: 32, borderRadius: 5, objectFit: 'cover' } })), _jsxs("div", { style: { flex: 1 }, children: [_jsx("p", { style: { margin: 0, fontWeight: 600, fontSize: 14 }, children: r.name }), r.address && _jsx("p", { style: { margin: 0, fontSize: 12, color: '#64748b' }, children: r.address })] }), _jsx("button", { onClick: () => { if (confirm(`Delete restaurant "${r.name}"?`))
                                                                        deleteRestaurant.mutate(r.id); }, style: { ...btnStyle, background: '#7f1d1d', fontSize: 11, padding: '4px 8px' }, children: "Delete" })] }, r.id))) }))] })] }, company.id))), companies.length === 0 && !companiesQuery.isLoading && (_jsx("p", { style: { color: '#475569' }, children: "No companies registered yet." }))] })] })), tab === 'users' && (_jsxs(_Fragment, { children: [_jsxs("section", { style: { background: '#1e293b', padding: 20, borderRadius: 8, marginBottom: 24 }, children: [_jsx("h2", { style: { marginTop: 0, fontSize: 16 }, children: "Create user" }), _jsxs("div", { style: { display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }, children: [_jsx("input", { placeholder: "Username", value: uName, onChange: (e) => setUName(e.target.value), style: inputStyle }), _jsx("input", { placeholder: "Password", type: "password", value: uPwd, onChange: (e) => setUPwd(e.target.value), style: inputStyle }), _jsxs("select", { value: uRole, onChange: (e) => setURole(e.target.value), style: inputStyle, children: [_jsx("option", { value: "OWNER", children: "OWNER" }), _jsx("option", { value: "ADMIN", children: "ADMIN" }), _jsx("option", { value: "EMPLOYEE", children: "EMPLOYEE" }), _jsx("option", { value: "KITCHEN", children: "KITCHEN" })] })] }), uError && _jsx("p", { style: { color: '#f87171', marginTop: 8 }, children: uError }), _jsx("button", { onClick: () => createUser.mutate(), disabled: !uName.trim() || !uPwd || createUser.isPending, style: { ...btnStyle, marginTop: 12, opacity: (!uName.trim() || !uPwd) ? 0.5 : 1 }, children: createUser.isPending ? 'Creating...' : 'Create' })] }), _jsxs("section", { children: [_jsxs("h2", { style: { fontSize: 16, marginBottom: 12 }, children: ["All users (", users.length, ")"] }), _jsx("div", { style: { display: 'grid', gap: 8 }, children: users.map((u) => (_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 12, padding: 12, background: '#1e293b', borderRadius: 8 }, children: [_jsxs("div", { style: { flex: 1 }, children: [_jsx("p", { style: { margin: 0, fontWeight: 600 }, children: u.username }), _jsx("p", { style: { margin: 0, fontSize: 12, color: '#94a3b8' }, children: companies.find((c) => c.owner.id === u.id)?.name
                                                                ?? companies.flatMap((c) => c.restaurants).find((r) => r.id === u.restaurantId)?.name
                                                                ?? (u.role === 'CHIEF_ADMIN' ? '— system —' : '— unassigned —') })] }), _jsxs("select", { value: u.role, onChange: (e) => updateRole.mutate({ id: u.id, role: e.target.value }), disabled: u.role === 'CHIEF_ADMIN', style: { ...inputStyle, width: 130 }, children: [_jsx("option", { value: "CHIEF_ADMIN", children: "CHIEF_ADMIN" }), _jsx("option", { value: "OWNER", children: "OWNER" }), _jsx("option", { value: "ADMIN", children: "ADMIN" }), _jsx("option", { value: "EMPLOYEE", children: "EMPLOYEE" }), _jsx("option", { value: "KITCHEN", children: "KITCHEN" })] }), u.role !== 'CHIEF_ADMIN' && (_jsx("button", { onClick: () => { if (confirm(`Delete user ${u.username}?`))
                                                        deleteUser.mutate(u.id); }, style: { ...btnStyle, background: '#dc2626' }, children: "Delete" }))] }, u.id))) })] })] }))] })] }));
};
const inputStyle = {
    padding: '8px 12px', background: '#0f172a', border: '1px solid #334155', borderRadius: 6,
    color: '#e2e8f0', fontSize: 14, fontFamily: 'inherit',
};
const btnStyle = {
    padding: '8px 14px', background: '#3b82f6', border: 'none', borderRadius: 6,
    color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600,
};
