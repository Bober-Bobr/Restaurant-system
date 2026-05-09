import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { useState } from 'react';
import { authService, type AdminUser } from '../services/auth.service';
import { restaurantService, type Restaurant } from '../services/restaurant.service';
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

type Tab = 'restaurants' | 'users';

export const ChiefAdminPage = () => {
  const username = useAuthStore((s) => s.username);
  const logout = useAuthStore((s) => s.logout);
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>('restaurants');

  const restaurantsQuery = useQuery({ queryKey: ['cad-restaurants'], queryFn: () => restaurantService.list() });
  const usersQuery = useQuery({ queryKey: ['cad-users'], queryFn: () => authService.listUsers() });

  const [rName, setRName] = useState('');
  const [rAddress, setRAddress] = useState('');
  const [rLogoUrl, setRLogoUrl] = useState('');
  const [rError, setRError] = useState<string | null>(null);

  const createRestaurant = useMutation({
    mutationFn: () => restaurantService.create({
      name: rName.trim(),
      address: rAddress.trim() || undefined,
      logoUrl: rLogoUrl.trim() || undefined,
    }),
    onSuccess: () => {
      setRName(''); setRAddress(''); setRLogoUrl(''); setRError(null);
      queryClient.invalidateQueries({ queryKey: ['cad-restaurants'] });
    },
    onError: (e) => setRError(formatError(e)),
  });

  const deleteRestaurant = useMutation({
    mutationFn: (id: string) => restaurantService.remove(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['cad-restaurants'] }),
  });

  const [uName, setUName] = useState('');
  const [uPwd, setUPwd] = useState('');
  const [uRole, setURole] = useState<AdminRole>('OWNER');
  const [uRestaurantId, setURestaurantId] = useState('');
  const [uError, setUError] = useState<string | null>(null);

  const createUser = useMutation({
    mutationFn: () => authService.createUserAsChief({
      username: uName.trim(),
      password: uPwd,
      role: uRole,
      restaurantId: uRestaurantId || null,
    }),
    onSuccess: () => {
      setUName(''); setUPwd(''); setURole('OWNER'); setURestaurantId(''); setUError(null);
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

  const restaurants: Restaurant[] = restaurantsQuery.data ?? [];
  const users: AdminUser[] = usersQuery.data ?? [];
  const restaurantById = (id: string | null) => restaurants.find((r) => r.id === id);

  const handleLogout = async () => {
    try { await authService.logout(); } catch {}
    logout();
    window.location.href = 'https://v-menu.uz/login';
  };

  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', color: '#e2e8f0', fontFamily: 'system-ui, sans-serif' }}>
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', borderBottom: '1px solid #1e293b', background: '#0b1220' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <img src={networkingLogoSrc} alt="Networking" style={{ height: 40, width: 40, objectFit: 'contain' }} />
          <div>
            <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Chief Administrator</h1>
            <p style={{ margin: 0, fontSize: 12, color: '#94a3b8' }}>{username}</p>
          </div>
        </div>
        <button onClick={handleLogout} style={{ padding: '8px 14px', background: '#dc2626', border: 'none', borderRadius: 6, color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
          Logout
        </button>
      </header>

      <nav style={{ display: 'flex', gap: 4, padding: '0 24px', borderBottom: '1px solid #1e293b' }}>
        {(['restaurants', 'users'] as Tab[]).map((t) => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: '12px 20px', background: 'none', border: 'none',
            borderBottom: tab === t ? '2px solid #3b82f6' : '2px solid transparent',
            color: tab === t ? '#fff' : '#94a3b8', cursor: 'pointer', fontSize: 14, fontWeight: 600,
            textTransform: 'capitalize',
          }}>
            {t}
          </button>
        ))}
      </nav>

      <main style={{ maxWidth: 1100, margin: '0 auto', padding: 24 }}>
        {tab === 'restaurants' && (
          <>
            <section style={{ background: '#1e293b', padding: 20, borderRadius: 8, marginBottom: 24 }}>
              <h2 style={{ marginTop: 0, fontSize: 16 }}>Create restaurant</h2>
              <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
                <input placeholder="Name" value={rName} onChange={(e) => setRName(e.target.value)} style={inputStyle} />
                <input placeholder="Address" value={rAddress} onChange={(e) => setRAddress(e.target.value)} style={inputStyle} />
                <input placeholder="Logo URL (e.g. /uploads/logo.png)" value={rLogoUrl} onChange={(e) => setRLogoUrl(e.target.value)} style={inputStyle} />
              </div>
              {rError && <p style={{ color: '#f87171', marginTop: 8 }}>{rError}</p>}
              <button
                onClick={() => createRestaurant.mutate()}
                disabled={!rName.trim() || createRestaurant.isPending}
                style={{ ...btnStyle, marginTop: 12, opacity: !rName.trim() ? 0.5 : 1 }}
              >
                {createRestaurant.isPending ? 'Creating...' : 'Create'}
              </button>
            </section>

            <section>
              <h2 style={{ fontSize: 16, marginBottom: 12 }}>All restaurants ({restaurants.length})</h2>
              <div style={{ display: 'grid', gap: 12 }}>
                {restaurants.map((r) => (
                  <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 16, background: '#1e293b', borderRadius: 8 }}>
                    {r.logoUrl && <img src={getPhotoUrl(r.logoUrl)} alt={r.name} style={{ width: 48, height: 48, borderRadius: 8, objectFit: 'cover' }} />}
                    <div style={{ flex: 1 }}>
                      <p style={{ margin: 0, fontWeight: 600 }}>{r.name}</p>
                      <p style={{ margin: 0, fontSize: 12, color: '#94a3b8' }}>{r.address ?? '—'}</p>
                    </div>
                    <button onClick={() => { if (confirm(`Delete ${r.name}? This will also delete all its data.`)) deleteRestaurant.mutate(r.id); }}
                      style={{ ...btnStyle, background: '#dc2626' }}>
                      Delete
                    </button>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}

        {tab === 'users' && (
          <>
            <section style={{ background: '#1e293b', padding: 20, borderRadius: 8, marginBottom: 24 }}>
              <h2 style={{ marginTop: 0, fontSize: 16 }}>Create user</h2>
              <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
                <input placeholder="Username" value={uName} onChange={(e) => setUName(e.target.value)} style={inputStyle} />
                <input placeholder="Password" type="password" value={uPwd} onChange={(e) => setUPwd(e.target.value)} style={inputStyle} />
                <select value={uRole} onChange={(e) => setURole(e.target.value as AdminRole)} style={inputStyle}>
                  <option value="OWNER">OWNER</option>
                  <option value="ADMIN">ADMIN</option>
                  <option value="EMPLOYEE">EMPLOYEE</option>
                </select>
                {uRole !== 'OWNER' && (
                  <select value={uRestaurantId} onChange={(e) => setURestaurantId(e.target.value)} style={inputStyle}>
                    <option value="">— No restaurant —</option>
                    {restaurants.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>
                )}
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
                  <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12, background: '#1e293b', borderRadius: 8 }}>
                    <div style={{ flex: 1 }}>
                      <p style={{ margin: 0, fontWeight: 600 }}>{u.username}</p>
                      <p style={{ margin: 0, fontSize: 12, color: '#94a3b8' }}>
                        {restaurantById(u.restaurantId)?.name ?? '— no restaurant —'}
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
                    </select>
                    {u.role !== 'CHIEF_ADMIN' && (
                      <button onClick={() => { if (confirm(`Delete user ${u.username}?`)) deleteUser.mutate(u.id); }}
                        style={{ ...btnStyle, background: '#dc2626' }}>
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
  padding: '8px 12px', background: '#0f172a', border: '1px solid #334155', borderRadius: 6,
  color: '#e2e8f0', fontSize: 14, fontFamily: 'inherit',
};

const btnStyle: React.CSSProperties = {
  padding: '8px 14px', background: '#3b82f6', border: 'none', borderRadius: 6,
  color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600,
};
