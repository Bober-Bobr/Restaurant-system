import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { useState } from 'react';
import { authService, type AdminUser } from '../services/auth.service';
import { companyService, type Company } from '../services/company.service';
import { restaurantService, type Restaurant } from '../services/restaurant.service';
import { useAuthStore } from '../store/auth.store';
import type { AdminRole } from '../store/auth.store';
import { useAdminStore } from '../store/admin.store';
import { locales, translate, type Locale } from '../utils/translate';
import { getPhotoUrl } from '../utils/photoUrl';
import networkingLogoSrc from '../assets/networking-logo.png';

const formatError = (error: unknown): string => {
  if (axios.isAxiosError(error)) {
    const body = error.response?.data as { message?: unknown } | undefined;
    if (typeof body?.message === 'string') return body.message;
  }
  if (error instanceof Error) return error.message;
  return 'Something went wrong';
};

type Tab = 'companies' | 'users';
const LOCALE_LABELS: Record<Locale, string> = { en: 'EN', ru: 'RU', uz: 'UZ' };

export const OwnerCabinetPage = () => {
  const username = useAuthStore((s) => s.username);
  const logout = useAuthStore((s) => s.logout);
  const queryClient = useQueryClient();
  const { locale, setLocale } = useAdminStore();
  const t = (key: Parameters<typeof translate>[0], params?: Record<string, string | number>) =>
    translate(key, locale, params);
  const [tab, setTab] = useState<Tab>('companies');

  // ── Companies ──
  const companiesQuery = useQuery<Company[]>({
    queryKey: ['owner-companies'],
    queryFn: () => companyService.listMine(),
  });
  const companies: Company[] = companiesQuery.data ?? [];

  // New-company form state
  const [newName, setNewName] = useState('');
  const [newLogo, setNewLogo] = useState('');
  const [newError, setNewError] = useState<string | null>(null);

  const createCompany = useMutation({
    mutationFn: () => companyService.create({ name: newName.trim(), logoUrl: newLogo.trim() || undefined }),
    onSuccess: () => {
      setNewName(''); setNewLogo(''); setNewError(null);
      queryClient.invalidateQueries({ queryKey: ['owner-companies'] });
    },
    onError: (e) => setNewError(formatError(e)),
  });

  const updateCompany = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: { name?: string; logoUrl?: string } }) =>
      companyService.update(id, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['owner-companies'] }),
  });

  const deleteCompanyMut = useMutation({
    mutationFn: (id: string) => companyService.deleteCompany(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['owner-companies'] });
      queryClient.invalidateQueries({ queryKey: ['owner-restaurants'] });
    },
  });

  // ── Restaurants ──
  const restaurantsQuery = useQuery<Restaurant[]>({
    queryKey: ['owner-restaurants'],
    queryFn: () => restaurantService.list(),
  });
  const restaurants: Restaurant[] = restaurantsQuery.data ?? [];

  const restaurantsByCompany = (companyId: string) =>
    restaurants.filter((r) => r.companyId === companyId);

  // Per-company "add restaurant" form state
  const [activeForm, setActiveForm] = useState<string | null>(null);
  const [rName, setRName] = useState('');
  const [rAddress, setRAddress] = useState('');
  const [rError, setRError] = useState<string | null>(null);

  const createRestaurant = useMutation({
    mutationFn: (companyId: string) =>
      restaurantService.create({
        name: rName.trim(),
        address: rAddress.trim() || undefined,
        companyId,
      }),
    onSuccess: () => {
      setRName(''); setRAddress(''); setRError(null); setActiveForm(null);
      queryClient.invalidateQueries({ queryKey: ['owner-restaurants'] });
    },
    onError: (e) => setRError(formatError(e)),
  });

  const deleteRestaurant = useMutation({
    mutationFn: (id: string) => restaurantService.remove(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['owner-restaurants'] }),
  });

  // ── Users ──
  const usersQuery = useQuery<AdminUser[]>({
    queryKey: ['owner-users'],
    queryFn: () => authService.listUsers(),
  });
  const users: AdminUser[] = usersQuery.data ?? [];

  const [uName, setUName] = useState('');
  const [uPwd, setUPwd] = useState('');
  const [uRole, setURole] = useState<AdminRole>('ADMIN');
  const [uRestaurantId, setURestaurantId] = useState('');
  const [uError, setUError] = useState<string | null>(null);

  const createUser = useMutation({
    mutationFn: () =>
      authService.createUserAsChief({
        username: uName.trim(),
        password: uPwd,
        role: uRole,
        restaurantId: uRestaurantId || null,
      }),
    onSuccess: () => {
      setUName(''); setUPwd(''); setURole('ADMIN'); setURestaurantId(''); setUError(null);
      queryClient.invalidateQueries({ queryKey: ['owner-users'] });
    },
    onError: (e) => setUError(formatError(e)),
  });

  const deleteUser = useMutation({
    mutationFn: (id: string) => authService.deleteUser(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['owner-users'] }),
  });

  const updateRole = useMutation({
    mutationFn: ({ id, role }: { id: string; role: AdminRole }) => authService.updateUserRole(id, role),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['owner-users'] }),
  });

  const handleLogout = async () => {
    try { await authService.logout(); } catch {}
    logout();
    window.location.href = 'https://v-menu.uz/login';
  };

  const ROLE_LABEL_KEY: Record<AdminRole, Parameters<typeof translate>[0]> = {
    CHIEF_ADMIN: 'chief_admin_role',
    OWNER: 'owner_role',
    ADMIN: 'administrator_role',
    EMPLOYEE: 'employee_role',
    KITCHEN: 'kitchen_role',
  };

  return (
    <div className="adm-bg" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
      <header className="tablet-fade-in" style={{
        position: 'sticky', top: 0, zIndex: 30,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 24px',
        background: 'rgba(15,23,42,0.78)', backdropFilter: 'blur(18px)',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        flexWrap: 'wrap', gap: 12,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <img src={networkingLogoSrc} alt="Networking" style={{ height: 44, width: 'auto', objectFit: 'contain', flexShrink: 0 }} />
          <div>
            <h1 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#f8fafc', letterSpacing: '-0.01em' }}>{t('owner_cabinet')}</h1>
            <p style={{ margin: '2px 0 0', fontSize: 11, color: 'rgba(226,232,240,0.55)', display: 'flex', alignItems: 'center', gap: 6 }}>
              {username}
              <span className="adm-badge" style={{ background: 'rgba(124,58,237,0.18)', color: '#c4b5fd', border: '1px solid rgba(124,58,237,0.3)' }}>
                OWNER
              </span>
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ display: 'flex', gap: 4 }}>
            {locales.map((loc) => (
              <button
                key={loc}
                type="button"
                onClick={() => setLocale(loc)}
                style={{
                  padding: '5px 10px',
                  border: '1px solid',
                  borderColor: locale === loc ? 'rgba(201,164,44,0.5)' : 'rgba(255,255,255,0.1)',
                  borderRadius: 6,
                  background: locale === loc ? 'rgba(201,164,44,0.15)' : 'transparent',
                  color: locale === loc ? '#c9a42c' : 'rgba(226,232,240,0.6)',
                  fontWeight: locale === loc ? 700 : 500,
                  cursor: 'pointer',
                  fontSize: 11,
                  letterSpacing: '0.06em',
                  transition: 'all 0.18s',
                }}
              >
                {LOCALE_LABELS[loc]}
              </button>
            ))}
          </div>
          <button onClick={handleLogout} className="adm-btn-danger" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            {t('logout')}
          </button>
        </div>
      </header>

      <nav style={{ display: 'flex', gap: 4, padding: '0 24px', borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(15,23,42,0.5)' }}>
        <button onClick={() => setTab('companies')} style={tabStyle(tab === 'companies')}>
          {t('companies')}
        </button>
        <button onClick={() => setTab('users')} style={tabStyle(tab === 'users')}>
          {t('users')}
        </button>
      </nav>

      <main className="tablet-fade-in" style={{ maxWidth: 1180, margin: '0 auto', padding: '28px 24px', position: 'relative', zIndex: 1 }}>

        {tab === 'companies' && (
          <>
            {/* New company form */}
            <section className="adm-card tablet-fade-up adm-section" style={{ marginBottom: 24 }}>
              <h2 className="adm-heading" style={{ marginTop: 0, marginBottom: 16 }}>{t('new_company')}</h2>
              <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
                <input
                  placeholder={t('company_name')}
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  style={inputStyle}
                />
                <input
                  placeholder={t('logo_url_hint')}
                  value={newLogo}
                  onChange={(e) => setNewLogo(e.target.value)}
                  style={inputStyle}
                />
              </div>
              {newError && <p style={{ color: '#f87171', marginTop: 8 }}>{newError}</p>}
              <button
                onClick={() => createCompany.mutate()}
                disabled={!newName.trim() || createCompany.isPending}
                style={{ ...btnStyle, marginTop: 12, opacity: !newName.trim() ? 0.5 : 1 }}
              >
                {createCompany.isPending ? t('creating') : t('create')}
              </button>
            </section>

            {/* Companies list */}
            {companiesQuery.isLoading && <p style={{ color: 'rgba(226,232,240,0.5)' }}>...</p>}

            <div style={{ display: 'grid', gap: 16 }}>
              {companies.map((company) => {
                const restaurantsHere = restaurantsByCompany(company.id);
                const showForm = activeForm === company.id;
                const companyLogoSrc = company.logoUrl ? getPhotoUrl(company.logoUrl) : null;

                return (
                  <div key={company.id} className="adm-card adm-card-hover tablet-fade-up" style={{ overflow: 'hidden' }}>
                    {/* Company header */}
                    <div className="owner-company-header" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', background: 'rgba(15,23,42,0.55)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                      {companyLogoSrc && (
                        <img src={companyLogoSrc} alt={company.name} style={{ height: 36, width: 'auto', maxWidth: 80, objectFit: 'contain', flexShrink: 0 }} />
                      )}
                      <div className="owner-company-name" style={{ flex: 1, minWidth: 0 }}>
                        <input
                          defaultValue={company.name}
                          onBlur={(e) => {
                            const newName = e.target.value.trim();
                            if (newName && newName !== company.name) {
                              updateCompany.mutate({ id: company.id, payload: { name: newName } });
                            }
                          }}
                          style={{ ...inputStyle, fontWeight: 600, fontSize: 14, padding: '4px 8px', width: '100%' }}
                        />
                      </div>
                      <input
                        className="owner-company-logo-input"
                        defaultValue={company.logoUrl ?? ''}
                        placeholder={t('logo_url')}
                        onBlur={(e) => {
                          const newLogo = e.target.value.trim();
                          if (newLogo !== (company.logoUrl ?? '')) {
                            updateCompany.mutate({ id: company.id, payload: { logoUrl: newLogo || undefined } });
                          }
                        }}
                        style={{ ...inputStyle, width: 220, padding: '4px 8px', fontSize: 12 }}
                      />
                      <button
                        onClick={() => {
                          if (confirm(t('delete_company_confirm', { name: company.name }))) {
                            deleteCompanyMut.mutate(company.id);
                          }
                        }}
                        style={{ ...btnStyle, background: '#dc2626', fontSize: 12, padding: '5px 10px', flexShrink: 0 }}
                      >
                        {t('delete')}
                      </button>
                    </div>

                    {/* Restaurants list */}
                    <div style={{ padding: '12px 16px' }}>
                      <p style={{ margin: '0 0 8px', fontSize: 12, color: 'rgba(226,232,240,0.45)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        {t('restaurants_in', { name: company.name })} ({restaurantsHere.length})
                      </p>

                      {restaurantsHere.length === 0 ? (
                        <p style={{ margin: '0 0 8px', color: 'rgba(226,232,240,0.45)', fontSize: 13 }}>—</p>
                      ) : (
                        <div style={{ display: 'grid', gap: 8, marginBottom: 12 }}>
                          {restaurantsHere.map((r) => {
                            const effLogo = r.logoUrl ?? r.company?.logoUrl ?? null;
                            return (
                              <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: 'rgba(15,23,42,0.55)', borderRadius: 7 }}>
                                {effLogo && <img src={getPhotoUrl(effLogo)} alt={r.name} style={{ height: 32, width: 'auto', maxWidth: 72, objectFit: 'contain', flexShrink: 0 }} />}
                                <div style={{ flex: 1 }}>
                                  <p style={{ margin: 0, fontWeight: 600, fontSize: 14 }}>{r.name}</p>
                                  {r.address && <p style={{ margin: 0, fontSize: 12, color: 'rgba(226,232,240,0.5)' }}>{r.address}</p>}
                                </div>
                                <button
                                  onClick={() => {
                                    if (confirm(t('delete_restaurant_confirm', { name: r.name }))) {
                                      deleteRestaurant.mutate(r.id);
                                    }
                                  }}
                                  style={{ ...btnStyle, background: '#7f1d1d', fontSize: 11, padding: '4px 8px' }}
                                >
                                  {t('delete')}
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Add restaurant form (toggle per company) */}
                      {showForm ? (
                        <div style={{ background: 'rgba(15,23,42,0.55)', padding: 12, borderRadius: 7 }}>
                          <p style={{ margin: '0 0 8px', fontSize: 12, color: 'rgba(226,232,240,0.55)' }}>{t('company_logo_used')}</p>
                          <div style={{ display: 'grid', gap: 8, gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
                            <input placeholder={t('name')} value={rName} onChange={(e) => setRName(e.target.value)} style={inputStyle} />
                            <input placeholder={t('address')} value={rAddress} onChange={(e) => setRAddress(e.target.value)} style={inputStyle} />
                          </div>
                          {rError && <p style={{ color: '#f87171', marginTop: 8, fontSize: 12 }}>{rError}</p>}
                          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                            <button
                              onClick={() => createRestaurant.mutate(company.id)}
                              disabled={!rName.trim() || createRestaurant.isPending}
                              style={{ ...btnStyle, opacity: !rName.trim() ? 0.5 : 1, fontSize: 12, padding: '6px 12px' }}
                            >
                              {createRestaurant.isPending ? t('adding') : t('add')}
                            </button>
                            <button
                              onClick={() => { setActiveForm(null); setRName(''); setRAddress(''); setRError(null); }}
                              style={{ ...btnStyle, background: '#334155', fontSize: 12, padding: '6px 12px' }}
                            >
                              {t('cancel')}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => { setActiveForm(company.id); setRName(''); setRAddress(''); setRError(null); }}
                          style={{ ...btnStyle, background: '#1e3a8a', fontSize: 12, padding: '6px 12px' }}
                        >
                          + {t('add_restaurant_to', { name: company.name })}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}

              {!companiesQuery.isLoading && companies.length === 0 && (
                <p style={{ color: 'rgba(226,232,240,0.5)' }}>{t('no_companies_yet')}</p>
              )}
            </div>
          </>
        )}

        {tab === 'users' && (
          <>
            <section style={{ background: 'rgba(30,41,59,0.4)', padding: 20, borderRadius: 8, marginBottom: 24 }}>
              <h2 style={{ marginTop: 0, fontSize: 16 }}>{t('create_user')}</h2>
              <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
                <input placeholder={t('username')} value={uName} onChange={(e) => setUName(e.target.value)} style={inputStyle} />
                <input placeholder={t('password')} type="password" value={uPwd} onChange={(e) => setUPwd(e.target.value)} style={inputStyle} />
                <select value={uRole} onChange={(e) => setURole(e.target.value as AdminRole)} style={inputStyle}>
                  <option value="ADMIN">{t('administrator_role')}</option>
                  <option value="EMPLOYEE">{t('employee_role')}</option>
                  <option value="KITCHEN">{t('kitchen_role')}</option>
                </select>
                <select value={uRestaurantId} onChange={(e) => setURestaurantId(e.target.value)} style={inputStyle}>
                  <option value="">{t('select_restaurant_dash')}</option>
                  {restaurants.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </div>
              {uError && <p style={{ color: '#f87171', marginTop: 8 }}>{uError}</p>}
              <button
                onClick={() => createUser.mutate()}
                disabled={!uName.trim() || !uPwd || createUser.isPending}
                style={{ ...btnStyle, marginTop: 12, opacity: (!uName.trim() || !uPwd) ? 0.5 : 1 }}
              >
                {createUser.isPending ? t('creating') : t('create')}
              </button>
            </section>

            <section>
              <h2 style={{ fontSize: 16, marginBottom: 12 }}>{t('all_users')} ({users.length})</h2>
              <div style={{ display: 'grid', gap: 8 }}>
                {users.map((u) => (
                  <div key={u.id} className="owner-user-row" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12, background: 'rgba(30,41,59,0.4)', borderRadius: 8 }}>
                    <div className="owner-user-info" style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.username}</p>
                      <p style={{ margin: 0, fontSize: 12, color: 'rgba(226,232,240,0.55)', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {restaurants.find((r) => r.id === u.restaurantId)?.name ?? '—'}
                      </p>
                    </div>
                    <span className="owner-user-badge" style={{
                      padding: '2px 8px', borderRadius: 4, fontSize: 12, fontWeight: 600, flexShrink: 0,
                      background: u.role === 'ADMIN' ? '#2563eb' : u.role === 'OWNER' ? '#7c3aed' : '#16a34a',
                      color: '#fff'
                    }}>
                      {t(ROLE_LABEL_KEY[u.role])}
                    </span>
                    {u.role !== 'OWNER' && (
                      <select
                        className="owner-user-role-select"
                        value={u.role}
                        onChange={(e) => updateRole.mutate({ id: u.id, role: e.target.value as AdminRole })}
                        style={{ ...inputStyle, width: 130 }}
                      >
                        <option value="ADMIN">{t('administrator_role')}</option>
                        <option value="EMPLOYEE">{t('employee_role')}</option>
                        <option value="KITCHEN">{t('kitchen_role')}</option>
                      </select>
                    )}
                    {u.role !== 'OWNER' && (
                      <button
                        onClick={() => { if (confirm(t('delete_user_confirm', { name: u.username }))) deleteUser.mutate(u.id); }}
                        style={{ ...btnStyle, background: '#dc2626', flexShrink: 0 }}
                      >
                        {t('delete')}
                      </button>
                    )}
                  </div>
                ))}
                {users.length === 0 && <p style={{ color: 'rgba(226,232,240,0.5)' }}>{t('no_users_yet')}</p>}
              </div>
            </section>
          </>
        )}
      </main>

      <style>{`
        @media (max-width: 720px) {
          .owner-company-header {
            flex-wrap: wrap;
            row-gap: 8px !important;
          }
          .owner-company-name {
            flex: 1 1 calc(100% - 60px) !important;
          }
          .owner-company-logo-input {
            order: 3;
            width: 100% !important;
            flex: 1 1 100% !important;
          }
          .owner-user-row {
            flex-wrap: wrap;
            row-gap: 8px !important;
          }
          .owner-user-info {
            flex: 1 1 calc(100% - 110px) !important;
          }
          .owner-user-role-select {
            order: 3;
            flex: 1;
            width: auto !important;
            min-width: 0;
          }
        }
      `}</style>
    </div>
  );
};

const tabStyle = (active: boolean): React.CSSProperties => ({
  padding: '12px 20px', background: 'none', border: 'none',
  borderBottom: active ? '2px solid #c9a42c' : '2px solid transparent',
  color: active ? '#c9a42c' : 'rgba(226,232,240,0.6)',
  cursor: 'pointer', fontSize: 14, fontWeight: 600,
  textTransform: 'capitalize',
  transition: 'all 0.18s',
});

const inputStyle: React.CSSProperties = {
  background: 'rgba(15,23,42,0.6)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 10,
  color: '#e2e8f0',
  padding: '0.6rem 0.9rem',
  fontSize: 14,
  fontFamily: 'inherit',
  outline: 'none',
};

const btnStyle: React.CSSProperties = {
  padding: '0.6rem 1.2rem',
  background: 'linear-gradient(135deg, #c9a42c 0%, #d4af37 100%)',
  border: 'none',
  borderRadius: 10,
  color: '#0f172a',
  cursor: 'pointer',
  fontSize: 13,
  fontWeight: 700,
  letterSpacing: '0.02em',
  transition: 'transform 0.15s, box-shadow 0.15s',
};
