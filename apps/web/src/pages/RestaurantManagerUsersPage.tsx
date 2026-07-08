import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { useState } from 'react';
import { authService, type AdminUser } from '../services/auth.service';
import { useAdminStore } from '../store/admin.store';
import { translate } from '../utils/translate';

const QUERY_KEY = ['rm-users'];

const formatError = (error: unknown): string => {
  if (axios.isAxiosError(error)) {
    const body = error.response?.data as { message?: unknown } | undefined;
    if (typeof body?.message === 'string') return body.message;
  }
  if (error instanceof Error) return error.message;
  return 'Something went wrong';
};

// Restaurant Manager dashboard page: create administrator accounts for the
// manager's own restaurant. The backend forces the new admin into that
// restaurant, so no restaurant picker is needed here.
export const RestaurantManagerUsersPage = () => {
  const { locale } = useAdminStore();
  const t = (key: Parameters<typeof translate>[0], params?: Record<string, string | number>) => translate(key, locale, params);
  const queryClient = useQueryClient();

  const { data: users = [], isLoading, isError } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => authService.listUsers(),
  });

  const [uName, setUName] = useState('');
  const [uPwd, setUPwd] = useState('');
  const [uError, setUError] = useState<string | null>(null);

  const createAdmin = useMutation({
    mutationFn: () => authService.createUserAsChief({ username: uName.trim(), password: uPwd, role: 'ADMIN', restaurantId: null }),
    onSuccess: () => {
      setUName(''); setUPwd(''); setUError(null);
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
    onError: (e) => setUError(formatError(e)),
  });

  // Only the administrators of this restaurant are relevant on this page.
  const admins = users.filter((u) => u.role === 'ADMIN');

  return (
    <main className="tablet-fade-in" style={{ maxWidth: 900, margin: '0 auto', padding: '28px 20px', position: 'relative', zIndex: 1 }}>
      <h1 className="adm-title" style={{ marginBottom: 6 }}>{t('administrators')}</h1>
      <p style={{ color: 'rgba(226,232,240,0.55)', fontSize: 13, marginTop: 0, marginBottom: 20 }}>
        {t('manager_create_admin_help')}
      </p>

      <section className="adm-card tablet-fade-up" style={{ padding: 18, marginBottom: 22 }}>
        <h2 style={{ margin: '0 0 14px', fontSize: 15, fontWeight: 800, color: '#f8fafc' }}>{t('create_admin')}</h2>
        <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
          <input className="adm-input" placeholder={t('username')} value={uName} onChange={(e) => setUName(e.target.value)} />
          <input className="adm-input" type="password" placeholder={t('password')} value={uPwd} onChange={(e) => setUPwd(e.target.value)} />
        </div>
        {uError && <p style={{ color: '#f87171', marginTop: 10, fontSize: 13 }}>{uError}</p>}
        <button type="button" className="adm-btn-primary" onClick={() => createAdmin.mutate()}
          disabled={!uName.trim() || !uPwd || createAdmin.isPending}
          style={{ marginTop: 14, opacity: (!uName.trim() || !uPwd) ? 0.5 : 1 }}>
          {createAdmin.isPending ? t('creating') : t('create_admin')}
        </button>
      </section>

      <section>
        <h2 style={{ fontSize: 15, fontWeight: 800, color: '#f8fafc', marginBottom: 12 }}>
          {t('administrators')} ({admins.length})
        </h2>
        {isLoading && <p style={{ color: 'rgba(226,232,240,0.55)' }}>{t('loading')}</p>}
        {isError && <p style={{ color: '#fca5a5' }}>{t('something_went_wrong')}</p>}
        {!isLoading && admins.length === 0 && <p style={{ color: 'rgba(226,232,240,0.55)' }}>{t('no_users_yet')}</p>}

        <div style={{ display: 'grid', gap: 8 }}>
          {admins.map((u: AdminUser) => (
            <div key={u.id} className="adm-card tablet-fade-up" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px' }}>
              <p style={{ margin: 0, fontWeight: 600, color: '#e2e8f0', flex: 1 }}>{u.username}</p>
              <span className="adm-badge" style={{ background: 'rgba(37,99,235,0.18)', color: '#93c5fd', border: '1px solid rgba(37,99,235,0.3)' }}>
                {t('administrator_role')}
              </span>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
};
