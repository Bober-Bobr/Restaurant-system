import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { useState } from 'react';
import type { AdminUser } from '../services/auth.service';
import { authService } from '../services/auth.service';
import type { AdminRole } from '../store/auth.store';
import { useAuthStore } from '../store/auth.store';
import { useAdminStore } from '../store/admin.store';
import { translate } from '../utils/translate';

const ROLE_LABELS: Record<AdminRole, string> = {
  OWNER: 'Owner',
  ADMIN: 'Administrator',
  EMPLOYEE: 'Employee'
};

const ROLE_BADGE_STYLE: Record<AdminRole, React.CSSProperties> = {
  OWNER: { background: '#7c3aed', color: '#fff' },
  ADMIN: { background: '#2563eb', color: '#fff' },
  EMPLOYEE: { background: '#16a34a', color: '#fff' }
};

const formatError = (error: unknown): string => {
  if (axios.isAxiosError(error)) {
    const body = error.response?.data as { message?: unknown } | undefined;
    if (typeof body?.message === 'string') return body.message;
  }
  if (error instanceof Error) return error.message;
  return 'Something went wrong';
};

export const AdminUsersPage = () => {
  const { locale } = useAdminStore();
  const t = (key: Parameters<typeof translate>[0]) => translate(key, locale);

  const currentRole = useAuthStore((state) => state.role);
  const currentUsername = useAuthStore((state) => state.username);
  const queryClient = useQueryClient();

  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<AdminRole>('EMPLOYEE');
  const [formError, setFormError] = useState<string | null>(null);

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
    mutationFn: (id: string) => authService.deleteUser(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-users'] })
  });

  const updateRoleMutation = useMutation({
    mutationFn: ({ id, role }: { id: string; role: AdminRole }) => authService.updateUserRole(id, role),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-users'] })
  });

  // OWNER can create ADMIN or EMPLOYEE; ADMIN can only create EMPLOYEE
  const creatableRoles: AdminRole[] = currentRole === 'OWNER' ? ['ADMIN', 'EMPLOYEE'] : ['EMPLOYEE'];

  return (
    <main style={{ maxWidth: 900, margin: '0 auto', padding: '24px 16px' }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 24 }}>{t('users_management')}</h1>

      {/* Create user form */}
      <section style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, padding: 20, marginBottom: 32 }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>{t('create_user')}</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 180px auto', gap: 12, alignItems: 'end' }}>
          <label style={{ display: 'grid', gap: 4 }}>
            <span style={{ fontSize: 12, fontWeight: 500, color: '#374151' }}>{t('name')}</span>
            <input
              value={newUsername}
              onChange={(e) => setNewUsername(e.target.value)}
              placeholder="username"
              style={{ padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 14, fontFamily: 'inherit' }}
            />
          </label>
          <label style={{ display: 'grid', gap: 4 }}>
            <span style={{ fontSize: 12, fontWeight: 500, color: '#374151' }}>{t('password')}</span>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="••••••••"
              style={{ padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 14, fontFamily: 'inherit' }}
            />
          </label>
          <label style={{ display: 'grid', gap: 4 }}>
            <span style={{ fontSize: 12, fontWeight: 500, color: '#374151' }}>{t('user_role')}</span>
            <select
              value={newRole}
              onChange={(e) => setNewRole(e.target.value as AdminRole)}
              style={{ padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 14, fontFamily: 'inherit', background: '#fff' }}
            >
              {creatableRoles.map((r) => (
                <option key={r} value={r}>{ROLE_LABELS[r]}</option>
              ))}
            </select>
          </label>
          <button
            onClick={() => {
              setFormError(null);
              createMutation.mutate();
            }}
            disabled={createMutation.isPending || !newUsername.trim() || !newPassword}
            style={{
              padding: '8px 16px',
              background: createMutation.isPending || !newUsername.trim() || !newPassword ? '#9ca3af' : '#2563eb',
              color: '#fff',
              border: 'none',
              borderRadius: 6,
              fontSize: 14,
              fontWeight: 600,
              cursor: createMutation.isPending || !newUsername.trim() || !newPassword ? 'not-allowed' : 'pointer',
              whiteSpace: 'nowrap'
            }}
          >
            {createMutation.isPending ? t('creating') : t('create')}
          </button>
        </div>
        {formError && (
          <div style={{ marginTop: 10, padding: '8px 12px', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 6, color: '#dc2626', fontSize: 13 }}>
            {formError}
          </div>
        )}
      </section>

      {/* User list */}
      {isLoading && <p style={{ color: '#6b7280' }}>{t('loading_users')}</p>}
      {isError && <p style={{ color: '#dc2626' }}>{t('failed_load_users')}</p>}

      {!isLoading && users.length === 0 && (
        <p style={{ color: '#6b7280' }}>{t('no_users_yet')}</p>
      )}

      {users.length > 0 && (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
              <th style={{ textAlign: 'left', padding: '8px 12px', fontWeight: 600, color: '#374151' }}>{t('name')}</th>
              <th style={{ textAlign: 'left', padding: '8px 12px', fontWeight: 600, color: '#374151' }}>{t('user_role')}</th>
              <th style={{ textAlign: 'right', padding: '8px 12px', fontWeight: 600, color: '#374151' }}>{t('actions')}</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user: AdminUser) => (
              <tr key={user.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                <td style={{ padding: '10px 12px', color: '#111827' }}>
                  {user.username}
                  {user.username === currentUsername && (
                    <span style={{ marginLeft: 6, fontSize: 11, color: '#6b7280' }}>(you)</span>
                  )}
                </td>
                <td style={{ padding: '10px 12px' }}>
                  <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 12, fontWeight: 600, ...ROLE_BADGE_STYLE[user.role] }}>
                    {ROLE_LABELS[user.role]}
                  </span>
                </td>
                <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                  <div style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
                    {/* Role change — OWNER only, can't change other OWNER */}
                    {currentRole === 'OWNER' && user.role !== 'OWNER' && (
                      <select
                        value={user.role}
                        onChange={(e) => {
                          if (window.confirm(t('confirm_delete_user').replace('delete this user', 'change this role'))) {
                            updateRoleMutation.mutate({ id: user.id, role: e.target.value as AdminRole });
                          }
                        }}
                        style={{ padding: '4px 8px', border: '1px solid #d1d5db', borderRadius: 4, fontSize: 12, background: '#fff' }}
                      >
                        <option value="ADMIN">{ROLE_LABELS.ADMIN}</option>
                        <option value="EMPLOYEE">{ROLE_LABELS.EMPLOYEE}</option>
                      </select>
                    )}

                    {/* Delete — can't delete self or OWNER (if you're ADMIN) */}
                    {user.username !== currentUsername && !(currentRole === 'ADMIN' && user.role !== 'EMPLOYEE') && (
                      <button
                        onClick={() => {
                          if (window.confirm(t('confirm_delete_user'))) {
                            deleteMutation.mutate(user.id);
                          }
                        }}
                        disabled={deleteMutation.isPending}
                        style={{ padding: '4px 10px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: 4, fontSize: 12, cursor: 'pointer' }}
                      >
                        {t('delete')}
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
};
