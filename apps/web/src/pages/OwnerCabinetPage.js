import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { useState } from 'react';
import { authService } from '../services/auth.service';
import { companyService } from '../services/company.service';
import { restaurantService } from '../services/restaurant.service';
import { useAuthStore } from '../store/auth.store';
import { useAdminStore } from '../store/admin.store';
import { locales, translate } from '../utils/translate';
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
const LOCALE_LABELS = { en: 'EN', ru: 'RU', uz: 'UZ' };
export const OwnerCabinetPage = () => {
    const username = useAuthStore((s) => s.username);
    const logout = useAuthStore((s) => s.logout);
    const queryClient = useQueryClient();
    const { locale, setLocale } = useAdminStore();
    const t = (key, params) => translate(key, locale, params);
    const [tab, setTab] = useState('companies');
    // ── Companies ──
    const companiesQuery = useQuery({
        queryKey: ['owner-companies'],
        queryFn: () => companyService.listMine(),
    });
    const companies = companiesQuery.data ?? [];
    // New-company form state
    const [newName, setNewName] = useState('');
    const [newLogo, setNewLogo] = useState('');
    const [newError, setNewError] = useState(null);
    const createCompany = useMutation({
        mutationFn: () => companyService.create({ name: newName.trim(), logoUrl: newLogo.trim() || undefined }),
        onSuccess: () => {
            setNewName('');
            setNewLogo('');
            setNewError(null);
            queryClient.invalidateQueries({ queryKey: ['owner-companies'] });
        },
        onError: (e) => setNewError(formatError(e)),
    });
    const updateCompany = useMutation({
        mutationFn: ({ id, payload }) => companyService.update(id, payload),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['owner-companies'] }),
    });
    const deleteCompanyMut = useMutation({
        mutationFn: (id) => companyService.deleteCompany(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['owner-companies'] });
            queryClient.invalidateQueries({ queryKey: ['owner-restaurants'] });
        },
    });
    // ── Restaurants ──
    const restaurantsQuery = useQuery({
        queryKey: ['owner-restaurants'],
        queryFn: () => restaurantService.list(),
    });
    const restaurants = restaurantsQuery.data ?? [];
    const restaurantsByCompany = (companyId) => restaurants.filter((r) => r.companyId === companyId);
    // Per-company "add restaurant" form state
    const [activeForm, setActiveForm] = useState(null);
    const [rName, setRName] = useState('');
    const [rAddress, setRAddress] = useState('');
    const [rError, setRError] = useState(null);
    const createRestaurant = useMutation({
        mutationFn: (companyId) => restaurantService.create({
            name: rName.trim(),
            address: rAddress.trim() || undefined,
            companyId,
        }),
        onSuccess: () => {
            setRName('');
            setRAddress('');
            setRError(null);
            setActiveForm(null);
            queryClient.invalidateQueries({ queryKey: ['owner-restaurants'] });
        },
        onError: (e) => setRError(formatError(e)),
    });
    const deleteRestaurant = useMutation({
        mutationFn: (id) => restaurantService.remove(id),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['owner-restaurants'] }),
    });
    // ── Users ──
    const usersQuery = useQuery({
        queryKey: ['owner-users'],
        queryFn: () => authService.listUsers(),
    });
    const users = usersQuery.data ?? [];
    const [uName, setUName] = useState('');
    const [uPwd, setUPwd] = useState('');
    const [uRole, setURole] = useState('ADMIN');
    const [uRestaurantId, setURestaurantId] = useState('');
    const [uError, setUError] = useState(null);
    const createUser = useMutation({
        mutationFn: () => authService.createUserAsChief({
            username: uName.trim(),
            password: uPwd,
            role: uRole,
            restaurantId: uRestaurantId || null,
        }),
        onSuccess: () => {
            setUName('');
            setUPwd('');
            setURole('ADMIN');
            setURestaurantId('');
            setUError(null);
            queryClient.invalidateQueries({ queryKey: ['owner-users'] });
        },
        onError: (e) => setUError(formatError(e)),
    });
    const deleteUser = useMutation({
        mutationFn: (id) => authService.deleteUser(id),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['owner-users'] }),
    });
    const updateRole = useMutation({
        mutationFn: ({ id, role }) => authService.updateUserRole(id, role),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['owner-users'] }),
    });
    const handleLogout = async () => {
        try {
            await authService.logout();
        }
        catch { }
        logout();
        window.location.href = 'https://v-menu.uz/login';
    };
    const ROLE_LABEL_KEY = {
        CHIEF_ADMIN: 'chief_admin_role',
        OWNER: 'owner_role',
        ADMIN: 'administrator_role',
        EMPLOYEE: 'employee_role',
        KITCHEN: 'kitchen_role',
    };
    return (_jsxs("div", { style: { minHeight: '100vh', background: '#0f172a', color: '#e2e8f0', fontFamily: 'system-ui, sans-serif' }, children: [_jsxs("header", { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', borderBottom: '1px solid #1e293b', background: '#0b1220', flexWrap: 'wrap', gap: 12 }, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 12 }, children: [_jsx("img", { src: networkingLogoSrc, alt: "Networking", style: { height: 40, width: 40, objectFit: 'contain' } }), _jsxs("div", { children: [_jsx("h1", { style: { margin: 0, fontSize: 18, fontWeight: 700 }, children: t('owner_cabinet') }), _jsx("p", { style: { margin: 0, fontSize: 12, color: '#94a3b8' }, children: username })] })] }), _jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 8 }, children: [_jsx("div", { style: { display: 'flex', gap: 4 }, children: locales.map((loc) => (_jsx("button", { type: "button", onClick: () => setLocale(loc), style: {
                                        padding: '4px 10px',
                                        border: '1px solid',
                                        borderColor: locale === loc ? '#3b82f6' : '#334155',
                                        borderRadius: 4,
                                        background: locale === loc ? '#1e3a8a' : '#1e293b',
                                        color: locale === loc ? '#fff' : '#94a3b8',
                                        fontWeight: locale === loc ? 600 : 400,
                                        cursor: 'pointer',
                                        fontSize: 12,
                                    }, children: LOCALE_LABELS[loc] }, loc))) }), _jsx("button", { onClick: handleLogout, style: { padding: '8px 14px', background: '#dc2626', border: 'none', borderRadius: 6, color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600 }, children: t('logout') })] })] }), _jsxs("nav", { style: { display: 'flex', gap: 4, padding: '0 24px', borderBottom: '1px solid #1e293b' }, children: [_jsx("button", { onClick: () => setTab('companies'), style: tabStyle(tab === 'companies'), children: t('companies') }), _jsx("button", { onClick: () => setTab('users'), style: tabStyle(tab === 'users'), children: t('users') })] }), _jsxs("main", { style: { maxWidth: 1100, margin: '0 auto', padding: 24 }, children: [tab === 'companies' && (_jsxs(_Fragment, { children: [_jsxs("section", { style: { background: '#1e293b', padding: 20, borderRadius: 8, marginBottom: 24 }, children: [_jsx("h2", { style: { marginTop: 0, fontSize: 16 }, children: t('new_company') }), _jsxs("div", { style: { display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }, children: [_jsx("input", { placeholder: t('company_name'), value: newName, onChange: (e) => setNewName(e.target.value), style: inputStyle }), _jsx("input", { placeholder: t('logo_url_hint'), value: newLogo, onChange: (e) => setNewLogo(e.target.value), style: inputStyle })] }), newError && _jsx("p", { style: { color: '#f87171', marginTop: 8 }, children: newError }), _jsx("button", { onClick: () => createCompany.mutate(), disabled: !newName.trim() || createCompany.isPending, style: { ...btnStyle, marginTop: 12, opacity: !newName.trim() ? 0.5 : 1 }, children: createCompany.isPending ? t('creating') : t('create') })] }), companiesQuery.isLoading && _jsx("p", { style: { color: '#64748b' }, children: "..." }), _jsxs("div", { style: { display: 'grid', gap: 16 }, children: [companies.map((company) => {
                                        const restaurantsHere = restaurantsByCompany(company.id);
                                        const showForm = activeForm === company.id;
                                        const companyLogoSrc = company.logoUrl ? getPhotoUrl(company.logoUrl) : null;
                                        return (_jsxs("div", { style: { background: '#1e293b', borderRadius: 10, overflow: 'hidden', border: '1px solid #334155' }, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', background: '#0f172a', borderBottom: '1px solid #334155' }, children: [companyLogoSrc && (_jsx("img", { src: companyLogoSrc, alt: company.name, style: { width: 36, height: 36, borderRadius: 6, objectFit: 'cover' } })), _jsx("div", { style: { flex: 1 }, children: _jsx("input", { defaultValue: company.name, onBlur: (e) => {
                                                                    const newName = e.target.value.trim();
                                                                    if (newName && newName !== company.name) {
                                                                        updateCompany.mutate({ id: company.id, payload: { name: newName } });
                                                                    }
                                                                }, style: { ...inputStyle, fontWeight: 600, fontSize: 14, padding: '4px 8px' } }) }), _jsx("input", { defaultValue: company.logoUrl ?? '', placeholder: t('logo_url'), onBlur: (e) => {
                                                                const newLogo = e.target.value.trim();
                                                                if (newLogo !== (company.logoUrl ?? '')) {
                                                                    updateCompany.mutate({ id: company.id, payload: { logoUrl: newLogo || undefined } });
                                                                }
                                                            }, style: { ...inputStyle, width: 220, padding: '4px 8px', fontSize: 12 } }), _jsx("button", { onClick: () => {
                                                                if (confirm(t('delete_company_confirm', { name: company.name }))) {
                                                                    deleteCompanyMut.mutate(company.id);
                                                                }
                                                            }, style: { ...btnStyle, background: '#dc2626', fontSize: 12, padding: '5px 10px' }, children: t('delete') })] }), _jsxs("div", { style: { padding: '12px 16px' }, children: [_jsxs("p", { style: { margin: '0 0 8px', fontSize: 12, color: '#475569', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }, children: [t('restaurants_in', { name: company.name }), " (", restaurantsHere.length, ")"] }), restaurantsHere.length === 0 ? (_jsx("p", { style: { margin: '0 0 8px', color: '#475569', fontSize: 13 }, children: "\u2014" })) : (_jsx("div", { style: { display: 'grid', gap: 8, marginBottom: 12 }, children: restaurantsHere.map((r) => {
                                                                const effLogo = r.logoUrl ?? r.company?.logoUrl ?? null;
                                                                return (_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: '#0f172a', borderRadius: 7 }, children: [effLogo && _jsx("img", { src: getPhotoUrl(effLogo), alt: r.name, style: { width: 32, height: 32, borderRadius: 5, objectFit: 'cover' } }), _jsxs("div", { style: { flex: 1 }, children: [_jsx("p", { style: { margin: 0, fontWeight: 600, fontSize: 14 }, children: r.name }), r.address && _jsx("p", { style: { margin: 0, fontSize: 12, color: '#64748b' }, children: r.address })] }), _jsx("button", { onClick: () => {
                                                                                if (confirm(t('delete_restaurant_confirm', { name: r.name }))) {
                                                                                    deleteRestaurant.mutate(r.id);
                                                                                }
                                                                            }, style: { ...btnStyle, background: '#7f1d1d', fontSize: 11, padding: '4px 8px' }, children: t('delete') })] }, r.id));
                                                            }) })), showForm ? (_jsxs("div", { style: { background: '#0f172a', padding: 12, borderRadius: 7 }, children: [_jsx("p", { style: { margin: '0 0 8px', fontSize: 12, color: '#94a3b8' }, children: t('company_logo_used') }), _jsxs("div", { style: { display: 'grid', gap: 8, gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }, children: [_jsx("input", { placeholder: t('name'), value: rName, onChange: (e) => setRName(e.target.value), style: inputStyle }), _jsx("input", { placeholder: t('address'), value: rAddress, onChange: (e) => setRAddress(e.target.value), style: inputStyle })] }), rError && _jsx("p", { style: { color: '#f87171', marginTop: 8, fontSize: 12 }, children: rError }), _jsxs("div", { style: { display: 'flex', gap: 8, marginTop: 8 }, children: [_jsx("button", { onClick: () => createRestaurant.mutate(company.id), disabled: !rName.trim() || createRestaurant.isPending, style: { ...btnStyle, opacity: !rName.trim() ? 0.5 : 1, fontSize: 12, padding: '6px 12px' }, children: createRestaurant.isPending ? t('adding') : t('add') }), _jsx("button", { onClick: () => { setActiveForm(null); setRName(''); setRAddress(''); setRError(null); }, style: { ...btnStyle, background: '#334155', fontSize: 12, padding: '6px 12px' }, children: t('cancel') })] })] })) : (_jsxs("button", { onClick: () => { setActiveForm(company.id); setRName(''); setRAddress(''); setRError(null); }, style: { ...btnStyle, background: '#1e3a8a', fontSize: 12, padding: '6px 12px' }, children: ["+ ", t('add_restaurant_to', { name: company.name })] }))] })] }, company.id));
                                    }), !companiesQuery.isLoading && companies.length === 0 && (_jsx("p", { style: { color: '#64748b' }, children: t('no_companies_yet') }))] })] })), tab === 'users' && (_jsxs(_Fragment, { children: [_jsxs("section", { style: { background: '#1e293b', padding: 20, borderRadius: 8, marginBottom: 24 }, children: [_jsx("h2", { style: { marginTop: 0, fontSize: 16 }, children: t('create_user') }), _jsxs("div", { style: { display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }, children: [_jsx("input", { placeholder: t('username'), value: uName, onChange: (e) => setUName(e.target.value), style: inputStyle }), _jsx("input", { placeholder: t('password'), type: "password", value: uPwd, onChange: (e) => setUPwd(e.target.value), style: inputStyle }), _jsxs("select", { value: uRole, onChange: (e) => setURole(e.target.value), style: inputStyle, children: [_jsx("option", { value: "ADMIN", children: t('administrator_role') }), _jsx("option", { value: "EMPLOYEE", children: t('employee_role') }), _jsx("option", { value: "KITCHEN", children: t('kitchen_role') })] }), _jsxs("select", { value: uRestaurantId, onChange: (e) => setURestaurantId(e.target.value), style: inputStyle, children: [_jsx("option", { value: "", children: t('select_restaurant_dash') }), restaurants.map((r) => _jsx("option", { value: r.id, children: r.name }, r.id))] })] }), uError && _jsx("p", { style: { color: '#f87171', marginTop: 8 }, children: uError }), _jsx("button", { onClick: () => createUser.mutate(), disabled: !uName.trim() || !uPwd || createUser.isPending, style: { ...btnStyle, marginTop: 12, opacity: (!uName.trim() || !uPwd) ? 0.5 : 1 }, children: createUser.isPending ? t('creating') : t('create') })] }), _jsxs("section", { children: [_jsxs("h2", { style: { fontSize: 16, marginBottom: 12 }, children: [t('all_users'), " (", users.length, ")"] }), _jsxs("div", { style: { display: 'grid', gap: 8 }, children: [users.map((u) => (_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 12, padding: 12, background: '#1e293b', borderRadius: 8 }, children: [_jsxs("div", { style: { flex: 1 }, children: [_jsx("p", { style: { margin: 0, fontWeight: 600 }, children: u.username }), _jsx("p", { style: { margin: 0, fontSize: 12, color: '#94a3b8' }, children: restaurants.find((r) => r.id === u.restaurantId)?.name ?? '—' })] }), _jsx("span", { style: {
                                                            padding: '2px 8px', borderRadius: 4, fontSize: 12, fontWeight: 600,
                                                            background: u.role === 'ADMIN' ? '#2563eb' : u.role === 'OWNER' ? '#7c3aed' : '#16a34a',
                                                            color: '#fff'
                                                        }, children: t(ROLE_LABEL_KEY[u.role]) }), u.role !== 'OWNER' && (_jsxs("select", { value: u.role, onChange: (e) => updateRole.mutate({ id: u.id, role: e.target.value }), style: { ...inputStyle, width: 130 }, children: [_jsx("option", { value: "ADMIN", children: t('administrator_role') }), _jsx("option", { value: "EMPLOYEE", children: t('employee_role') }), _jsx("option", { value: "KITCHEN", children: t('kitchen_role') })] })), u.role !== 'OWNER' && (_jsx("button", { onClick: () => { if (confirm(t('delete_user_confirm', { name: u.username })))
                                                            deleteUser.mutate(u.id); }, style: { ...btnStyle, background: '#dc2626' }, children: t('delete') }))] }, u.id))), users.length === 0 && _jsx("p", { style: { color: '#64748b' }, children: t('no_users_yet') })] })] })] }))] })] }));
};
const tabStyle = (active) => ({
    padding: '12px 20px', background: 'none', border: 'none',
    borderBottom: active ? '2px solid #3b82f6' : '2px solid transparent',
    color: active ? '#fff' : '#94a3b8', cursor: 'pointer', fontSize: 14, fontWeight: 600,
});
const inputStyle = {
    padding: '8px 12px', background: '#0f172a', border: '1px solid #334155', borderRadius: 6,
    color: '#e2e8f0', fontSize: 14, fontFamily: 'inherit',
};
const btnStyle = {
    padding: '8px 14px', background: '#3b82f6', border: 'none', borderRadius: 6,
    color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600,
};
