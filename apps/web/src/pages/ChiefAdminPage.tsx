import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { useState } from 'react';
import { authService, type AdminUser } from '../services/auth.service';
import { companyService, type CompanyWithDetails } from '../services/company.service';
import { restaurantService } from '../services/restaurant.service';
import { useAuthStore } from '../store/auth.store';
import type { AdminRole } from '../store/auth.store';
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

export const ChiefAdminPage = () => {
  const username = useAuthStore((s) => s.username);
  const logout = useAuthStore((s) => s.logout);
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>('companies');

  const companiesQuery = useQuery<CompanyWithDetails[]>({
    queryKey: ['cad-companies'],
    queryFn: () => companyService.listAll(),
  });
  const usersQuery = useQuery<AdminUser[]>({
    queryKey: ['cad-users'],
    queryFn: () => authService.listUsers(),
  });

  const companies: CompanyWithDetails[] = companiesQuery.data ?? [];
  const users: AdminUser[] = usersQuery.data ?? [];

  // ── Company actions ──────────────────────────────────────────────────────
  const deleteCompany = useMutation({
    mutationFn: (id: string) => companyService.deleteCompany(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['cad-companies'] }),
  });

  const deleteRestaurant = useMutation({
    mutationFn: (id: string) => restaurantService.remove(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['cad-companies'] }),
  });

  // ── User actions ─────────────────────────────────────────────────────────
  const [uName, setUName] = useState('');
  const [uPwd, setUPwd] = useState('');
  const [uRole, setURole] = useState<AdminRole>('OWNER');
  const [uError, setUError] = useState<string | null>(null);

  const createUser = useMutation({
    mutationFn: () => authService.createUserAsChief({ username: uName.trim(), password: uPwd, role: uRole, restaurantId: null }),
    onSuccess: () => {
      setUName(''); setUPwd(''); setURole('OWNER'); setUError(null);
      queryClient.invalidateQueries({ queryKey: ['cad-users'] });
    },
    onError: (e) => setUError(formatError(e)),
  });

  const deleteUser = useMutation({
    mutationFn: (id: string) => authService.deleteUser(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['cad-users'] }),
  });

  const updateRole = useMutation({
    mutationFn: ({ id, role }: { id: string; role: AdminRole }) => authService.updateUserRole(id, role),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['cad-users'] }),
  });

  const handleLogout = async () => {
    try { await authService.logout(); } catch {}
    logout();
    window.location.href = 'https://v-menu.uz/login';
  };

  // Collect all restaurant IDs that belong to a company
  const assignedRestaurantIds = new Set(companies.flatMap((c) => c.restaurants.map((r) => r.id)));

  return (
    <div className="adm-bg" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
      <header className="tablet-fade-in" style={{
        position: 'sticky', top: 0, zIndex: 30,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 24px',
        background: 'rgba(15,23,42,0.78)', backdropFilter: 'blur(18px)',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 12, overflow: 'hidden',
            border: '1px solid rgba(201,164,44,0.35)',
            background: 'rgba(15,23,42,0.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <img src={networkingLogoSrc} alt="Networking" style={{ width: 32, height: 32, objectFit: 'contain' }} />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#f8fafc', letterSpacing: '-0.01em' }}>Chief Administrator</h1>
            <p style={{ margin: '2px 0 0', fontSize: 11, color: 'rgba(226,232,240,0.55)', display: 'flex', alignItems: 'center', gap: 6 }}>
              {username}
              <span className="adm-badge" style={{ background: 'rgba(220,38,38,0.18)', color: '#fca5a5', border: '1px solid rgba(220,38,38,0.3)' }}>
                CHIEF
              </span>
            </p>
          </div>
        </div>
        <button onClick={handleLogout} className="adm-btn-danger" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          Logout
        </button>
      </header>

      <nav style={{ display: 'flex', gap: 4, padding: '0 24px', borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(15,23,42,0.5)' }}>
        {(['companies', 'users'] as Tab[]).map((tabKey) => (
          <button key={tabKey} onClick={() => setTab(tabKey)} style={{
            padding: '12px 20px', background: 'none', border: 'none',
            borderBottom: tab === tabKey ? '2px solid #c9a42c' : '2px solid transparent',
            color: tab === tabKey ? '#c9a42c' : 'rgba(226,232,240,0.6)', cursor: 'pointer', fontSize: 14, fontWeight: 600,
            textTransform: 'capitalize',
            transition: 'all 0.18s',
          }}>
            {tabKey}
          </button>
        ))}
      </nav>

      <main className="tablet-fade-in" style={{ maxWidth: 1180, margin: '0 auto', padding: '28px 24px', position: 'relative', zIndex: 1 }}>

        {/* ── Companies tab ── */}
        {tab === 'companies' && (
          <>
            <p style={{ color: 'rgba(226,232,240,0.55)', fontSize: 13, marginBottom: 20 }}>
              {companies.length} {companies.length === 1 ? 'company' : 'companies'} registered
            </p>

            {companiesQuery.isLoading && <p style={{ color: 'rgba(226,232,240,0.55)' }}>Loading…</p>}

            <div style={{ display: 'grid', gap: 14 }}>
              {companies.map((company, idx) => (
                <div key={company.id} className="adm-card adm-card-hover tablet-fade-up" style={{ overflow: 'hidden', animationDelay: `${idx * 60}ms` }}>

                  {/* Company header */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 18px', background: 'rgba(15,23,42,0.5)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                    {company.logoUrl && (
                      <img src={getPhotoUrl(company.logoUrl)} alt={company.name} style={{ width: 36, height: 36, borderRadius: 6, objectFit: 'cover' }} />
                    )}
                    <div style={{ flex: 1 }}>
                      <p style={{ margin: 0, fontWeight: 700, fontSize: 15 }}>{company.name}</p>
                      <p style={{ margin: 0, fontSize: 12, color: 'rgba(226,232,240,0.55)' }}>
                        Owner:{' '}
                        <span style={{ color: '#a78bfa', fontWeight: 600 }}>{company.owner.username}</span>
                        <span style={{ marginLeft: 6, padding: '1px 6px', background: '#7c3aed', borderRadius: 4, fontSize: 10, fontWeight: 700 }}>OWNER</span>
                      </p>
                    </div>
                    <button
                      onClick={() => { if (confirm(`Delete company "${company.name}" and all its restaurants?`)) deleteCompany.mutate(company.id); }}
                      style={{ ...btnStyle, background: '#dc2626', fontSize: 12, padding: '5px 10px' }}
                    >
                      Delete company
                    </button>
                  </div>

                  {/* Restaurants under company */}
                  <div style={{ padding: '10px 16px 14px' }}>
                    <p style={{ margin: '0 0 8px', fontSize: 12, color: 'rgba(226,232,240,0.45)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Restaurants ({company.restaurants.length})
                    </p>
                    {company.restaurants.length === 0 ? (
                      <p style={{ margin: 0, color: 'rgba(226,232,240,0.45)', fontSize: 13 }}>No restaurants yet.</p>
                    ) : (
                      <div style={{ display: 'grid', gap: 8 }}>
                        {company.restaurants.map((r) => (
                          <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: 'rgba(15,23,42,0.5)', borderRadius: 7 }}>
                            {r.logoUrl && (
                              <img src={getPhotoUrl(r.logoUrl)} alt={r.name} style={{ width: 32, height: 32, borderRadius: 5, objectFit: 'cover' }} />
                            )}
                            <div style={{ flex: 1 }}>
                              <p style={{ margin: 0, fontWeight: 600, fontSize: 14 }}>{r.name}</p>
                              {r.address && <p style={{ margin: 0, fontSize: 12, color: 'rgba(226,232,240,0.5)' }}>{r.address}</p>}
                            </div>
                            <button
                              onClick={() => { if (confirm(`Delete restaurant "${r.name}"?`)) deleteRestaurant.mutate(r.id); }}
                              style={{ ...btnStyle, background: '#7f1d1d', fontSize: 11, padding: '4px 8px' }}
                            >
                              Delete
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {companies.length === 0 && !companiesQuery.isLoading && (
                <p style={{ color: 'rgba(226,232,240,0.45)' }}>No companies registered yet.</p>
              )}
            </div>
          </>
        )}

        {/* ── Users tab ── */}
        {tab === 'users' && (
          <>
            <section style={{ background: 'rgba(30,41,59,0.4)', padding: 20, borderRadius: 8, marginBottom: 24 }}>
              <h2 style={{ marginTop: 0, fontSize: 16 }}>Create user</h2>
              <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
                <input placeholder="Username" value={uName} onChange={(e) => setUName(e.target.value)} style={inputStyle} />
                <input placeholder="Password" type="password" value={uPwd} onChange={(e) => setUPwd(e.target.value)} style={inputStyle} />
                <select value={uRole} onChange={(e) => setURole(e.target.value as AdminRole)} style={inputStyle}>
                  <option value="OWNER">OWNER</option>
                  <option value="ADMIN">ADMIN</option>
                  <option value="EMPLOYEE">EMPLOYEE</option>
                  <option value="KITCHEN">KITCHEN</option>
                </select>
              </div>
              {uError && <p style={{ color: '#f87171', marginTop: 8 }}>{uError}</p>}
              <button
                onClick={() => createUser.mutate()}
                disabled={!uName.trim() || !uPwd || createUser.isPending}
                style={{ ...btnStyle, marginTop: 12, opacity: (!uName.trim() || !uPwd) ? 0.5 : 1 }}
              >
                {createUser.isPending ? 'Creating...' : 'Create'}
              </button>
            </section>

            <section>
              <h2 style={{ fontSize: 16, marginBottom: 12 }}>All users ({users.length})</h2>
              <div style={{ display: 'grid', gap: 8 }}>
                {users.map((u) => (
                  <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12, background: 'rgba(30,41,59,0.4)', borderRadius: 8 }}>
                    <div style={{ flex: 1 }}>
                      <p style={{ margin: 0, fontWeight: 600 }}>{u.username}</p>
                      <p style={{ margin: 0, fontSize: 12, color: 'rgba(226,232,240,0.55)' }}>
                        {companies.find((c) => c.owner.id === u.id)?.name
                          ?? companies.flatMap((c) => c.restaurants).find((r) => r.id === u.restaurantId)?.name
                          ?? (u.role === 'CHIEF_ADMIN' ? '— system —' : '— unassigned —')}
                      </p>
                    </div>
                    <select
                      value={u.role}
                      onChange={(e) => updateRole.mutate({ id: u.id, role: e.target.value as AdminRole })}
                      disabled={u.role === 'CHIEF_ADMIN'}
                      style={{ ...inputStyle, width: 130 }}
                    >
                      <option value="CHIEF_ADMIN">CHIEF_ADMIN</option>
                      <option value="OWNER">OWNER</option>
                      <option value="ADMIN">ADMIN</option>
                      <option value="EMPLOYEE">EMPLOYEE</option>
                      <option value="KITCHEN">KITCHEN</option>
                    </select>
                    {u.role !== 'CHIEF_ADMIN' && (
                      <button
                        onClick={() => { if (confirm(`Delete user ${u.username}?`)) deleteUser.mutate(u.id); }}
                        style={{ ...btnStyle, background: '#dc2626' }}
                      >
                        Delete
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
};

const inputStyle: React.CSSProperties = {
  padding: '8px 12px', background: 'rgba(15,23,42,0.5)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 6,
  color: '#e2e8f0', fontSize: 14, fontFamily: 'inherit',
};

const btnStyle: React.CSSProperties = {
  padding: '8px 14px', background: '#3b82f6', border: 'none', borderRadius: 6,
  color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600,
};
