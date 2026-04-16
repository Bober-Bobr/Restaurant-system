import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { useState } from 'react';
import { authService } from '../services/auth.service';
import { useAuthStore } from '../store/auth.store';
import { useAdminStore } from '../store/admin.store';
import { translate } from '../utils/translate';
const ROLE_LABELS = {
    OWNER: 'Owner',
    ADMIN: 'Administrator',
    EMPLOYEE: 'Employee'
};
const ROLE_BADGE_STYLE = {
    OWNER: { background: '#7c3aed', color: '#fff' },
    ADMIN: { background: '#2563eb', color: '#fff' },
    EMPLOYEE: { background: '#16a34a', color: '#fff' }
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
export const AdminUsersPage = () => {
    const { locale } = useAdminStore();
    const t = (key) => translate(key, locale);
    const currentRole = useAuthStore((state) => state.role);
    const currentUsername = useAuthStore((state) => state.username);
    const queryClient = useQueryClient();
    const [newUsername, setNewUsername] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [newRole, setNewRole] = useState('EMPLOYEE');
    const [formError, setFormError] = useState(null);
    const { data: users = [], isLoading, isError } = useQuery({
        queryKey: ['admin-users'],
        queryFn: () => authService.listUsers()
    });
    const createMutation = useMutation({
        mutationFn: () => authService.register(newUsername.trim(), newPassword, newRole),
        onSuccess: () => {
            setNewUsername('');
            setNewPassword('');
            setNewRole('EMPLOYEE');
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
    const creatableRoles = currentRole === 'OWNER' ? ['ADMIN', 'EMPLOYEE'] : ['EMPLOYEE'];
    return (_jsxs("main", { style: { maxWidth: 900, margin: '0 auto', padding: '24px 16px' }, children: [_jsx("h1", { style: { fontSize: 22, fontWeight: 700, marginBottom: 24 }, children: t('users_management') }), _jsxs("section", { style: { background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, padding: 20, marginBottom: 32 }, children: [_jsx("h2", { style: { fontSize: 16, fontWeight: 600, marginBottom: 16 }, children: t('create_user') }), _jsxs("div", { style: { display: 'grid', gridTemplateColumns: '1fr 1fr 180px auto', gap: 12, alignItems: 'end' }, children: [_jsxs("label", { style: { display: 'grid', gap: 4 }, children: [_jsx("span", { style: { fontSize: 12, fontWeight: 500, color: '#374151' }, children: t('name') }), _jsx("input", { value: newUsername, onChange: (e) => setNewUsername(e.target.value), placeholder: "username", style: { padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 14, fontFamily: 'inherit' } })] }), _jsxs("label", { style: { display: 'grid', gap: 4 }, children: [_jsx("span", { style: { fontSize: 12, fontWeight: 500, color: '#374151' }, children: t('password') }), _jsx("input", { type: "password", value: newPassword, onChange: (e) => setNewPassword(e.target.value), placeholder: "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022", style: { padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 14, fontFamily: 'inherit' } })] }), _jsxs("label", { style: { display: 'grid', gap: 4 }, children: [_jsx("span", { style: { fontSize: 12, fontWeight: 500, color: '#374151' }, children: t('user_role') }), _jsx("select", { value: newRole, onChange: (e) => setNewRole(e.target.value), style: { padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 14, fontFamily: 'inherit', background: '#fff' }, children: creatableRoles.map((r) => (_jsx("option", { value: r, children: ROLE_LABELS[r] }, r))) })] }), _jsx("button", { onClick: () => {
                                    setFormError(null);
                                    createMutation.mutate();
                                }, disabled: createMutation.isPending || !newUsername.trim() || !newPassword, style: {
                                    padding: '8px 16px',
                                    background: createMutation.isPending || !newUsername.trim() || !newPassword ? '#9ca3af' : '#2563eb',
                                    color: '#fff',
                                    border: 'none',
                                    borderRadius: 6,
                                    fontSize: 14,
                                    fontWeight: 600,
                                    cursor: createMutation.isPending || !newUsername.trim() || !newPassword ? 'not-allowed' : 'pointer',
                                    whiteSpace: 'nowrap'
                                }, children: createMutation.isPending ? t('creating') : t('create') })] }), formError && (_jsx("div", { style: { marginTop: 10, padding: '8px 12px', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 6, color: '#dc2626', fontSize: 13 }, children: formError }))] }), isLoading && _jsx("p", { style: { color: '#6b7280' }, children: t('loading_users') }), isError && _jsx("p", { style: { color: '#dc2626' }, children: t('failed_load_users') }), !isLoading && users.length === 0 && (_jsx("p", { style: { color: '#6b7280' }, children: t('no_users_yet') })), users.length > 0 && (_jsxs("table", { style: { width: '100%', borderCollapse: 'collapse', fontSize: 14 }, children: [_jsx("thead", { children: _jsxs("tr", { style: { borderBottom: '2px solid #e5e7eb' }, children: [_jsx("th", { style: { textAlign: 'left', padding: '8px 12px', fontWeight: 600, color: '#374151' }, children: t('name') }), _jsx("th", { style: { textAlign: 'left', padding: '8px 12px', fontWeight: 600, color: '#374151' }, children: t('user_role') }), _jsx("th", { style: { textAlign: 'right', padding: '8px 12px', fontWeight: 600, color: '#374151' }, children: t('actions') })] }) }), _jsx("tbody", { children: users.map((user) => (_jsxs("tr", { style: { borderBottom: '1px solid #f3f4f6' }, children: [_jsxs("td", { style: { padding: '10px 12px', color: '#111827' }, children: [user.username, user.username === currentUsername && (_jsx("span", { style: { marginLeft: 6, fontSize: 11, color: '#6b7280' }, children: "(you)" }))] }), _jsx("td", { style: { padding: '10px 12px' }, children: _jsx("span", { style: { padding: '2px 8px', borderRadius: 4, fontSize: 12, fontWeight: 600, ...ROLE_BADGE_STYLE[user.role] }, children: ROLE_LABELS[user.role] }) }), _jsx("td", { style: { padding: '10px 12px', textAlign: 'right' }, children: _jsxs("div", { style: { display: 'inline-flex', gap: 8, alignItems: 'center' }, children: [currentRole === 'OWNER' && user.role !== 'OWNER' && (_jsxs("select", { value: user.role, onChange: (e) => {
                                                    if (window.confirm(t('confirm_delete_user').replace('delete this user', 'change this role'))) {
                                                        updateRoleMutation.mutate({ id: user.id, role: e.target.value });
                                                    }
                                                }, style: { padding: '4px 8px', border: '1px solid #d1d5db', borderRadius: 4, fontSize: 12, background: '#fff' }, children: [_jsx("option", { value: "ADMIN", children: ROLE_LABELS.ADMIN }), _jsx("option", { value: "EMPLOYEE", children: ROLE_LABELS.EMPLOYEE })] })), user.username !== currentUsername && !(currentRole === 'ADMIN' && user.role !== 'EMPLOYEE') && (_jsx("button", { onClick: () => {
                                                    if (window.confirm(t('confirm_delete_user'))) {
                                                        deleteMutation.mutate(user.id);
                                                    }
                                                }, disabled: deleteMutation.isPending, style: { padding: '4px 10px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: 4, fontSize: 12, cursor: 'pointer' }, children: t('delete') }))] }) })] }, user.id))) })] }))] }));
};
