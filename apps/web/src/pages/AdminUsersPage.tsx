import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { Fragment, useState } from 'react';
import type { AdminUser } from '../services/auth.service';
import { authService } from '../services/auth.service';
import { restaurantService } from '../services/restaurant.service';
import type { AdminRole } from '../store/auth.store';
import { useAuthStore } from '../store/auth.store';
import { useAdminStore } from '../store/admin.store';
import { translate } from '../utils/translate';
import { EditCredentialsForm } from '../components/EditCredentialsForm';

const ROLE_LABELS: Record<AdminRole, string> = {
  CHIEF_ADMIN: 'Chief Administrator',
  MANAGER: 'Manager',
  OWNER: 'Owner',
  ADMIN: 'Administrator',
  CATERING_ADMIN: 'Food Admin',
  RESTAURANT_MANAGER: 'Restaurant Manager',
  EMPLOYEE: 'Employee',
  KITCHEN: 'Kitchen',
  NFC_MAKER: 'NFC Maker',
  PERFORMER: 'Performer',
  HOST: 'Host',
  CATERING_EMPLOYEE: 'Waiter'
};

const ROLE_BADGE_STYLE: Record<AdminRole, React.CSSProperties> = {
  CHIEF_ADMIN: { background: '#dc2626', color: '#fff' },
  MANAGER: { background: '#8b5cf6', color: '#fff' },
  OWNER: { background: '#7c3aed', color: '#fff' },
  ADMIN: { background: '#2563eb', color: '#fff' },
  CATERING_ADMIN: { background: '#0ea5e9', color: '#fff' },
  RESTAURANT_MANAGER: { background: '#d97706', color: '#fff' },
  EMPLOYEE: { background: '#16a34a', color: '#fff' },
  KITCHEN: { background: '#ea580c', color: '#fff' },
  NFC_MAKER: { background: '#c8a97a', color: '#171310' },
  PERFORMER: { background: '#db2777', color: '#fff' },
  HOST: { background: '#be185d', color: '#fff' },
  CATERING_EMPLOYEE: { background: '#0d9488', color: '#fff' }
};

const formatError = (error: unknown): string => {
  if (axios.isAxiosError(error)) {
    const body = error.response?.data as { message?: unknown } | undefined;
    if (typeof body?.message === 'string') return body.message;
  }
  if (error instanceof Error) return error.message;
  return 'Something went wrong';
};

const inputStyle: React.CSSProperties = {
  background: 'rgba(var(--adm-bg-rgb),0.6)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 10,
  color: '#e2e8f0',
  padding: '0.6rem 0.9rem',
  height: 42,
  fontSize: 14,
  fontFamily: 'inherit',
  outline: 'none',
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
  const [newRestaurantId, setNewRestaurantId] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const { data: restaurants = [] } = useQuery({
    queryKey: ['restaurants'],
    queryFn: () => restaurantService.list()
  });

  const { data: users = [], isLoading, isError } = useQuery({
    queryKey: ['admin-users'],
    queryFn: () => authService.listUsers()
  });

  const restaurantName = (id: string | null) =>
    restaurants.find((r) => r.id === id)?.name ?? id ?? '—';

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
    mutationFn: (id: string) => authService.deleteUser(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-users'] })
  });

  const updateRoleMutation = useMutation({
    mutationFn: ({ id, role }: { id: string; role: AdminRole }) => authService.updateUserRole(id, role),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-users'] })
  });

  // Mirrors auth.service.createUserAsChief exactly. Offering a role the server
  // will refuse produces a 403 with no explanation, so these lists are kept in
  // step with it deliberately.
  //
  // The two staff sides do not overlap: a banquet ADMIN staffs the banquet
  // (EMPLOYEE), a Food Admin staffs the food-service floor (CATERING_EMPLOYEE).
  // Only the Owner, Chief Admin and Food Admin manage Food Employees at all.
  const creatableRoles: AdminRole[] = currentRole === 'OWNER'
    ? ['ADMIN', 'CATERING_ADMIN', 'CATERING_EMPLOYEE', 'EMPLOYEE', 'KITCHEN', 'PERFORMER', 'HOST']
    : currentRole === 'ADMIN'
      ? ['EMPLOYEE', 'KITCHEN', 'PERFORMER', 'HOST']
      : ['CATERING_EMPLOYEE', 'KITCHEN'];

  // A banquet ADMIN shares a restaurant with its Food Employees but does not
  // manage them; the server filters them out of the list too.
  const canSeeFoodEmployees = currentRole === 'OWNER' || currentRole === 'CHIEF_ADMIN' || currentRole === 'CATERING_ADMIN';
  const visibleUsers: AdminUser[] = canSeeFoodEmployees
    ? users
    : users.filter((user: AdminUser) => user.role !== 'CATERING_EMPLOYEE');
  const requiresRestaurantPicker = currentRole === 'OWNER';

  const canSubmit = !!newUsername.trim() && !!newPassword && (!requiresRestaurantPicker || !!effectiveRestaurantId);

  return (
    <main className="tablet-fade-in" style={{ maxWidth: 980, margin: '0 auto', padding: '28px 20px', position: 'relative', zIndex: 1 }}>
      <h1 className="adm-title" style={{ marginBottom: 24 }}>{t('users_management')}</h1>

      {/* Create user form */}
      <section className="adm-card tablet-fade-up adm-section" style={{ marginBottom: 28 }}>
        <h2 className="adm-heading" style={{ marginTop: 0, marginBottom: 16 }}>{t('create_user')}</h2>
        <div className="form-grid-2">
          <label style={{ display: 'grid', gap: 4 }}>
            <span style={{ fontSize: 12, fontWeight: 500, color: 'rgba(226,232,240,0.7)' }}>{t('name')}</span>
            <input value={newUsername} onChange={(e) => setNewUsername(e.target.value)} placeholder="username" style={inputStyle} />
          </label>
          <label style={{ display: 'grid', gap: 4 }}>
            <span style={{ fontSize: 12, fontWeight: 500, color: 'rgba(226,232,240,0.7)' }}>{t('password')}</span>
            <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="••••••••" style={inputStyle} />
          </label>
          <label style={{ display: 'grid', gap: 4 }}>
            <span style={{ fontSize: 12, fontWeight: 500, color: 'rgba(226,232,240,0.7)' }}>{t('user_role')}</span>
            <select value={newRole} onChange={(e) => setNewRole(e.target.value as AdminRole)} style={inputStyle}>
              {creatableRoles.map((r) => (
                <option key={r} value={r}>{ROLE_LABELS[r]}</option>
              ))}
            </select>
          </label>
          {requiresRestaurantPicker && (
            <label style={{ display: 'grid', gap: 4 }}>
              <span style={{ fontSize: 12, fontWeight: 500, color: 'rgba(226,232,240,0.7)' }}>{t('my_restaurants')} *</span>
              <select value={newRestaurantId} onChange={(e) => setNewRestaurantId(e.target.value)} style={inputStyle}>
                <option value="">— {t('select_restaurant')} —</option>
                {restaurants.map((r) => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            </label>
          )}
        </div>
        <div style={{ marginTop: 12, display: 'flex', gap: 12, alignItems: 'center' }}>
          <button
            className="adm-btn-primary"
            onClick={() => { setFormError(null); createMutation.mutate(); }}
            disabled={createMutation.isPending || !canSubmit}
          >
            {createMutation.isPending ? t('creating') : t('create')}
          </button>
          {formError && (
            <span style={{ color: '#fca5a5', fontSize: 13 }}>{formError}</span>
          )}
        </div>
      </section>

      {/* User list */}
      {isLoading && <p style={{ color: 'rgba(226,232,240,0.55)' }}>{t('loading_users')}</p>}
      {isError && <p style={{ color: '#fca5a5' }}>{t('failed_load_users')}</p>}
      {!isLoading && users.length === 0 && <p style={{ color: 'rgba(226,232,240,0.55)' }}>{t('no_users_yet')}</p>}

      {users.length > 0 && (
        <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14, minWidth: 500 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
              <th style={{ textAlign: 'left', padding: '8px 12px', fontWeight: 600, color: 'rgba(226,232,240,0.7)' }}>{t('name')}</th>
              <th style={{ textAlign: 'left', padding: '8px 12px', fontWeight: 600, color: 'rgba(226,232,240,0.7)' }}>{t('user_role')}</th>
              <th style={{ textAlign: 'left', padding: '8px 12px', fontWeight: 600, color: 'rgba(226,232,240,0.7)' }}>{t('my_restaurants')}</th>
              <th style={{ textAlign: 'right', padding: '8px 12px', fontWeight: 600, color: 'rgba(226,232,240,0.7)' }}>{t('actions')}</th>
            </tr>
          </thead>
          <tbody>
            {visibleUsers.map((user: AdminUser) => {
              const isSelf = user.username === currentUsername;
              const canEditCreds =
                currentRole === 'OWNER'
                  ? user.role !== 'CHIEF_ADMIN' && (user.role !== 'OWNER' || isSelf)
                  : (currentRole === 'ADMIN' || currentRole === 'CATERING_ADMIN')
                    ? isSelf || user.role === 'EMPLOYEE' || user.role === 'KITCHEN'
                    : false;
              const canDelete =
                !isSelf && !((currentRole === 'ADMIN' || currentRole === 'CATERING_ADMIN') && user.role !== 'EMPLOYEE' && user.role !== 'KITCHEN');
              return (
                <Fragment key={user.id}>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <td style={{ padding: '10px 12px', color: '#e2e8f0' }}>
                    {user.username}
                    {isSelf && (
                      <span style={{ marginLeft: 6, fontSize: 11, color: 'rgba(226,232,240,0.55)' }}>(you)</span>
                    )}
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 12, fontWeight: 600, ...ROLE_BADGE_STYLE[user.role] }}>
                      {ROLE_LABELS[user.role]}
                    </span>
                  </td>
                  <td style={{ padding: '10px 12px', color: 'rgba(226,232,240,0.55)', fontSize: 13 }}>
                    {user.role === 'OWNER' ? '—' : restaurantName(user.restaurantId)}
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
                      {currentRole === 'OWNER' && user.role !== 'OWNER' && (
                        <select
                          value={user.role}
                          onChange={(e) => updateRoleMutation.mutate({ id: user.id, role: e.target.value as AdminRole })}
                          style={{ padding: '4px 8px', border: '1px solid #d1d5db', borderRadius: 4, fontSize: 12, background: '#fff' }}
                        >
                          <option value="ADMIN">{ROLE_LABELS.ADMIN}</option>
                          <option value="CATERING_ADMIN">{ROLE_LABELS.CATERING_ADMIN}</option>
                          <option value="CATERING_EMPLOYEE">{ROLE_LABELS.CATERING_EMPLOYEE}</option>
                          <option value="EMPLOYEE">{ROLE_LABELS.EMPLOYEE}</option>
                          <option value="KITCHEN">{ROLE_LABELS.KITCHEN}</option>
                        </select>
                      )}
                      {canEditCreds && (
                        <button
                          onClick={() => setEditingId(editingId === user.id ? null : user.id)}
                          style={{
                            padding: '5px 10px', fontSize: 12, fontWeight: 600,
                            borderRadius: 6,
                            background: editingId === user.id ? 'rgba(var(--adm-accent-rgb),0.18)' : 'rgba(var(--adm-accent-rgb),0.08)',
                            color: 'var(--adm-accent)',
                            border: '1px solid rgba(var(--adm-accent-rgb),0.35)',
                            cursor: 'pointer',
                          }}
                        >
                          {t('edit_credentials')}
                        </button>
                      )}
                      {canDelete && (
                        <button
                          className="adm-btn-danger"
                          onClick={() => { if (window.confirm(t('confirm_delete_user'))) deleteMutation.mutate(user.id); }}
                          disabled={deleteMutation.isPending}
                          style={{ fontSize: 12 }}
                        >
                          {t('delete')}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
                {editingId === user.id && (
                  <tr>
                    <td colSpan={4} style={{ padding: '0 12px 12px' }}>
                      <EditCredentialsForm
                        userId={user.id}
                        currentUsername={user.username}
                        onClose={() => setEditingId(null)}
                        invalidateKeys={[['admin-users']]}
                        locale={locale}
                      />
                    </td>
                  </tr>
                )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
        </div>
      )}
    </main>
  );
};
