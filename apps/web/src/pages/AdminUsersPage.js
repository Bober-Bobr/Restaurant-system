import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { useState } from 'react';
import { authService } from '../services/auth.service';
import { restaurantService } from '../services/restaurant.service';
import { useAuthStore } from '../store/auth.store';
import { useAdminStore } from '../store/admin.store';
import { translate } from '../utils/translate';
const ROLE_LABELS = {
    CHIEF_ADMIN: 'Chief Administrator',
    OWNER: 'Owner',
    ADMIN: 'Administrator',
    EMPLOYEE: 'Employee',
    KITCHEN: 'Kitchen'
};
const ROLE_BADGE_STYLE = {
    CHIEF_ADMIN: { background: '#dc2626', color: '#fff' },
    OWNER: { background: '#7c3aed', color: '#fff' },
    ADMIN: { background: '#2563eb', color: '#fff' },
    EMPLOYEE: { background: '#16a34a', color: '#fff' },
    KITCHEN: { background: '#ea580c', color: '#fff' }
};
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
const inputStyle = {
    background: 'rgba(15,23,42,0.6)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 10,
    color: '#e2e8f0',
    padding: '0.6rem 0.9rem',
    fontSize: 14,
    fontFamily: 'inherit',
    outline: 'none',
};
export const AdminUsersPage = () => {
    const { locale } = useAdminStore();
    const t = (key) => translate(key, locale);
    const currentRole = useAuthStore((state) => state.role);
    const currentUsername = useAuthStore((state) => state.username);
    const queryClient = useQueryClient();
    const [newUsername, setNewUsername] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [newRole, setNewRole] = useState('EMPLOYEE');
    const [newRestaurantId, setNewRestaurantId] = useState('');
    const [formError, setFormError] = useState(null);
    const { data: restaurants = [] } = useQuery({
        queryKey: ['restaurants'],
        queryFn: () => restaurantService.list()
    });
    const { data: users = [], isLoading, isError } = useQuery({
        queryKey: ['admin-users'],
        queryFn: () => authService.listUsers()
    });
    const restaurantName = (id) => restaurants.find((r) => r.id === id)?.name ?? id ?? '—';
    const effectiveRestaurantId = newRestaurantId;
    const createMutation = useMutation({
        mutationFn: () => authService.createUserAsChief({
            username: newUsername.trim(),
            password: newPassword,
            role: newRole,
            restaurantId: effectiveRestaurantId || null,
        }),
        onSuccess: () => {
            setNewUsername('');
            setNewPassword('');
            setNewRole('EMPLOYEE');
            setNewRestaurantId('');
            setFormError(null);
            queryClient.invalidateQueries({ queryKey: ['admin-users'] });
        },
        onError: (error) => setFormError(formatError(error))
    });
    const deleteMutation = useMutation({
        mutationFn: (id) => authService.deleteUser(id),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-users'] })
    });
    const updateRoleMutation = useMutation({
        mutationFn: ({ id, role }) => authService.updateUserRole(id, role),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-users'] })
    });
    // OWNER can create ADMIN or EMPLOYEE; ADMIN can only create EMPLOYEE
    const creatableRoles = currentRole === 'OWNER' ? ['ADMIN', 'EMPLOYEE', 'KITCHEN'] : ['EMPLOYEE', 'KITCHEN'];
    const requiresRestaurantPicker = currentRole === 'OWNER';
    const canSubmit = !!newUsername.trim() && !!newPassword && (!requiresRestaurantPicker || !!effectiveRestaurantId);
    return (_jsxs("main", { className: "tablet-fade-in", style: { maxWidth: 980, margin: '0 auto', padding: '28px 20px', position: 'relative', zIndex: 1 }, children: [_jsx("h1", { className: "adm-title", style: { marginBottom: 24 }, children: t('users_management') }), _jsxs("section", { className: "adm-card tablet-fade-up adm-section", style: { marginBottom: 28 }, children: [_jsx("h2", { className: "adm-heading", style: { marginTop: 0, marginBottom: 16 }, children: t('create_user') }), _jsxs("div", { className: "form-grid-2", children: [_jsxs("label", { style: { display: 'grid', gap: 4 }, children: [_jsx("span", { style: { fontSize: 12, fontWeight: 500, color: 'rgba(226,232,240,0.7)' }, children: t('name') }), _jsx("input", { value: newUsername, onChange: (e) => setNewUsername(e.target.value), placeholder: "username", style: inputStyle })] }), _jsxs("label", { style: { display: 'grid', gap: 4 }, children: [_jsx("span", { style: { fontSize: 12, fontWeight: 500, color: 'rgba(226,232,240,0.7)' }, children: t('password') }), _jsx("input", { type: "password", value: newPassword, onChange: (e) => setNewPassword(e.target.value), placeholder: "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022", style: inputStyle })] }), _jsxs("label", { style: { display: 'grid', gap: 4 }, children: [_jsx("span", { style: { fontSize: 12, fontWeight: 500, color: 'rgba(226,232,240,0.7)' }, children: t('user_role') }), _jsx("select", { value: newRole, onChange: (e) => setNewRole(e.target.value), style: inputStyle, children: creatableRoles.map((r) => (_jsx("option", { value: r, children: ROLE_LABELS[r] }, r))) })] }), requiresRestaurantPicker && (_jsxs("label", { style: { display: 'grid', gap: 4 }, children: [_jsxs("span", { style: { fontSize: 12, fontWeight: 500, color: 'rgba(226,232,240,0.7)' }, children: [t('my_restaurants'), " *"] }), _jsxs("select", { value: newRestaurantId, onChange: (e) => setNewRestaurantId(e.target.value), style: inputStyle, children: [_jsxs("option", { value: "", children: ["\u2014 ", t('select_restaurant'), " \u2014"] }), restaurants.map((r) => (_jsx("option", { value: r.id, children: r.name }, r.id)))] })] }))] }), _jsxs("div", { style: { marginTop: 12, display: 'flex', gap: 12, alignItems: 'center' }, children: [_jsx("button", { className: "adm-btn-primary", onClick: () => { setFormError(null); createMutation.mutate(); }, disabled: createMutation.isPending || !canSubmit, children: createMutation.isPending ? t('creating') : t('create') }), formError && (_jsx("span", { style: { color: '#fca5a5', fontSize: 13 }, children: formError }))] })] }), isLoading && _jsx("p", { style: { color: 'rgba(226,232,240,0.55)' }, children: t('loading_users') }), isError && _jsx("p", { style: { color: '#fca5a5' }, children: t('failed_load_users') }), !isLoading && users.length === 0 && _jsx("p", { style: { color: 'rgba(226,232,240,0.55)' }, children: t('no_users_yet') }), users.length > 0 && (_jsx("div", { style: { overflowX: 'auto', WebkitOverflowScrolling: 'touch' }, children: _jsxs("table", { style: { width: '100%', borderCollapse: 'collapse', fontSize: 14, minWidth: 500 }, children: [_jsx("thead", { children: _jsxs("tr", { style: { borderBottom: '1px solid rgba(255,255,255,0.1)' }, children: [_jsx("th", { style: { textAlign: 'left', padding: '8px 12px', fontWeight: 600, color: 'rgba(226,232,240,0.7)' }, children: t('name') }), _jsx("th", { style: { textAlign: 'left', padding: '8px 12px', fontWeight: 600, color: 'rgba(226,232,240,0.7)' }, children: t('user_role') }), _jsx("th", { style: { textAlign: 'left', padding: '8px 12px', fontWeight: 600, color: 'rgba(226,232,240,0.7)' }, children: t('my_restaurants') }), _jsx("th", { style: { textAlign: 'right', padding: '8px 12px', fontWeight: 600, color: 'rgba(226,232,240,0.7)' }, children: t('actions') })] }) }), _jsx("tbody", { children: users.map((user) => (_jsxs("tr", { style: { borderBottom: '1px solid rgba(255,255,255,0.05)' }, children: [_jsxs("td", { style: { padding: '10px 12px', color: '#e2e8f0' }, children: [user.username, user.username === currentUsername && (_jsx("span", { style: { marginLeft: 6, fontSize: 11, color: 'rgba(226,232,240,0.55)' }, children: "(you)" }))] }), _jsx("td", { style: { padding: '10px 12px' }, children: _jsx("span", { style: { padding: '2px 8px', borderRadius: 4, fontSize: 12, fontWeight: 600, ...ROLE_BADGE_STYLE[user.role] }, children: ROLE_LABELS[user.role] }) }), _jsx("td", { style: { padding: '10px 12px', color: 'rgba(226,232,240,0.55)', fontSize: 13 }, children: user.role === 'OWNER' ? '—' : restaurantName(user.restaurantId) }), _jsx("td", { style: { padding: '10px 12px', textAlign: 'right' }, children: _jsxs("div", { style: { display: 'inline-flex', gap: 8, alignItems: 'center' }, children: [currentRole === 'OWNER' && user.role !== 'OWNER' && (_jsxs("select", { value: user.role, onChange: (e) => updateRoleMutation.mutate({ id: user.id, role: e.target.value }), style: { padding: '4px 8px', border: '1px solid #d1d5db', borderRadius: 4, fontSize: 12, background: '#fff' }, children: [_jsx("option", { value: "ADMIN", children: ROLE_LABELS.ADMIN }), _jsx("option", { value: "EMPLOYEE", children: ROLE_LABELS.EMPLOYEE }), _jsx("option", { value: "KITCHEN", children: ROLE_LABELS.KITCHEN })] })), user.username !== currentUsername && !(currentRole === 'ADMIN' && user.role !== 'EMPLOYEE' && user.role !== 'KITCHEN') && (_jsx("button", { className: "adm-btn-danger", onClick: () => { if (window.confirm(t('confirm_delete_user')))
                                                        deleteMutation.mutate(user.id); }, disabled: deleteMutation.isPending, style: { fontSize: 12 }, children: t('delete') }))] }) })] }, user.id))) })] }) }))] }));
};
