import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { Fragment, Suspense, lazy, useEffect, useRef, useState } from 'react';
import { authService, type AdminUser } from '../services/auth.service';
import { EditCredentialsForm } from '../components/EditCredentialsForm';
import { DevicesPanel } from '../components/DevicesPanel';
import { companyService, type Company } from '../services/company.service';
import { restaurantService, type Restaurant } from '../services/restaurant.service';
import { useAuthStore } from '../store/auth.store';
import type { AdminRole } from '../store/auth.store';
import { useAdminStore } from '../store/admin.store';
import { locales, translate, type Locale } from '../utils/translate';
import { getPhotoUrl } from '../utils/photoUrl';
import { buildAbsoluteUrl } from '../utils/subdomain';
import { PhotoUploadField } from '../components/PhotoUploadField';
import networkingLogoSrc from '../assets/networking-logo.png';

const formatError = (error: unknown): string => {
  if (axios.isAxiosError(error)) {
    const body = error.response?.data as { message?: unknown } | undefined;
    if (typeof body?.message === 'string') return body.message;
  }
  if (error instanceof Error) return error.message;
  return 'Something went wrong';
};

type Tab = 'companies' | 'reports' | 'users' | 'devices';
const LOCALE_LABELS: Record<Locale, string> = { en: 'EN', ru: 'RU', uz: 'UZ' };

/**
 * The cabinet's four pages, in one list.
 *
 * Stated once because the row of tabs and the mobile menu are two renderings of
 * the SAME four destinations — written out twice, a page added later reaches one
 * of them and is invisible on the other, which on a phone means invisible full
 * stop.
 */
const TABS: { id: Tab; key: Parameters<typeof translate>[0] }[] = [
  { id: 'companies', key: 'companies' },
  { id: 'reports', key: 'reports' },
  { id: 'users', key: 'users' },
  { id: 'devices', key: 'devices' },
];

/**
 * Reports are LAZY, and that is not incidental.
 *
 * The owner's cabinet is imported statically by App.tsx, so everything it pulls
 * in lands in the entry chunk that every public page downloads — the catering
 * site, a published invitation, the page behind an NFC tag. The Reports page
 * carries the chart kit and five payload type surfaces and is opened by one role
 * on purpose, so it is split off. Same reasoning as the product roots in App.tsx
 * (see CLAUDE.md, "Code splitting").
 */
const OwnerReportsPage = lazy(() =>
  import('./OwnerReportsPage').then((module) => ({ default: module.OwnerReportsPage })));

export const OwnerCabinetPage = () => {
  const username = useAuthStore((s) => s.username);
  const logout = useAuthStore((s) => s.logout);
  const queryClient = useQueryClient();
  const { locale, setLocale } = useAdminStore();
  const t = (key: Parameters<typeof translate>[0], params?: Record<string, string | number>) =>
    translate(key, locale, params);
  const [tab, setTab] = useState<Tab>('companies');

  // ── The mobile menu ───────────────────────────────────────────────────────
  // The four tabs are a single flex row, and in Russian they measure wider than
  // a phone. `.adm-bg` CLIPS horizontally rather than scrolling (it has to — a
  // scroll container there would break every `position: sticky` descendant, see
  // CLAUDE.md), so the tabs past the edge were not merely awkward: they could
  // not be reached at all. Below the breakpoint the row is replaced by this.
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const burgerRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (event: KeyboardEvent) => {
      // Escape closes it and gives focus BACK to the button that opened it —
      // otherwise focus is left on a node that has just been unmounted and the
      // next Tab starts again from the top of the document.
      if (event.key === 'Escape') { setMenuOpen(false); burgerRef.current?.focus(); }
    };
    const onPointer = (event: PointerEvent) => {
      const target = event.target as Node;
      if (menuRef.current?.contains(target) || burgerRef.current?.contains(target)) return;
      setMenuOpen(false);
    };
    document.addEventListener('keydown', onKey);
    // `pointerdown`, not `click`: a click fires after the press, so a tap that
    // began outside and ended on the panel would close it under the finger.
    document.addEventListener('pointerdown', onPointer);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPointer);
    };
  }, [menuOpen]);

  // Moving to a page closes the menu. Written here rather than in each handler
  // so a destination added to TABS cannot forget it and leave the sheet covering
  // the page it just opened.
  const goTo = (next: Tab) => { setTab(next); setMenuOpen(false); };

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
        name: rName.trim() || undefined,
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

  // Per-restaurant inline edit state
  const [editingRestaurantId, setEditingRestaurantId] = useState<string | null>(null);
  const [edit, setEdit] = useState<{ name: string; address: string; phone: string; email: string; logoUrl: string | null }>(
    { name: '', address: '', phone: '', email: '', logoUrl: null },
  );
  const [editError, setEditError] = useState<string | null>(null);

  const startEditRestaurant = (r: Restaurant) => {
    setEditingRestaurantId(r.id);
    setEditError(null);
    setEdit({
      name: r.name,
      address: r.address ?? '',
      phone: r.phone ?? '',
      email: r.email ?? '',
      logoUrl: r.logoUrl ?? null,
    });
  };

  const updateRestaurant = useMutation({
    mutationFn: (id: string) =>
      restaurantService.update(id, {
        name: edit.name.trim(),
        address: edit.address.trim() || undefined,
        phone: edit.phone.trim() || null,
        email: edit.email.trim() || null,
        logoUrl: edit.logoUrl || undefined,
      }),
    onSuccess: () => {
      setEditingRestaurantId(null);
      setEditError(null);
      queryClient.invalidateQueries({ queryKey: ['owner-restaurants'] });
    },
    onError: (e) => setEditError(formatError(e)),
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
  const [editingUserId, setEditingUserId] = useState<string | null>(null);

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
    window.location.href = buildAbsoluteUrl('/login');
  };

  const ROLE_LABEL_KEY: Record<AdminRole, Parameters<typeof translate>[0]> = {
    CHIEF_ADMIN: 'chief_admin_role',
    MANAGER: 'manager_role',
    OWNER: 'owner_role',
    ADMIN: 'administrator_role',
    CATERING_ADMIN: 'catering_admin_role',
    RESTAURANT_MANAGER: 'restaurant_manager_role',
    EMPLOYEE: 'employee_role',
    KITCHEN: 'kitchen_role',
    NFC_MAKER: 'nfc_maker_role',
    SUPERVISOR: 'supervisor_role',
    SMALL_KITCHEN: 'small_kitchen_role',
    PERFORMER: 'performer_role',
    HOST: 'host_role',
    CATERING_EMPLOYEE: 'food_employee_role',
  };

  return (
    <div className="adm-bg" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
      <header className="tablet-fade-in adm-topbar" style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 24px',
        flexWrap: 'wrap', gap: 12,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
          {/* The button leads the header, where a thumb reaches it and where
              every other app on the phone puts one. It carries the CURRENT page
              as its label, so the header still answers "where am I" — a bare
              icon takes that away, and it is the one thing a collapsed nav must
              not lose. */}
          <button
            ref={burgerRef}
            type="button"
            className="owner-burger"
            aria-expanded={menuOpen}
            aria-controls="owner-menu"
            aria-label={t('menu_navigation')}
            onClick={() => setMenuOpen((open) => !open)}
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
              {menuOpen
                ? <><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></>
                : <><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></>}
            </svg>
            <span className="owner-burger-label">{t(TABS.find((one) => one.id === tab)!.key)}</span>
          </button>
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
                  borderColor: locale === loc ? 'rgba(var(--adm-accent-rgb),0.5)' : 'rgba(255,255,255,0.1)',
                  borderRadius: 6,
                  background: locale === loc ? 'rgba(var(--adm-accent-rgb),0.15)' : 'transparent',
                  color: locale === loc ? 'var(--adm-accent)' : 'rgba(226,232,240,0.6)',
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

      {/* The wide nav. Hidden below the breakpoint, where the button above
          carries the same four destinations. */}
      <nav className="owner-nav" style={{ display: 'flex', gap: 4, padding: '0 24px', borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(var(--adm-bg-rgb),0.5)' }}>
        {TABS.map((one) => (
          <button key={one.id} onClick={() => goTo(one.id)} style={tabStyle(tab === one.id)}>
            {t(one.key)}
          </button>
        ))}
      </nav>

      {/* The mobile menu. Rendered only while open, rather than hidden in CSS,
          so its items are not in the tab order or findable by ctrl-F on a
          desktop where the button itself is not shown. */}
      {menuOpen && (
        <div className="owner-menu-wrap">
          <div
            id="owner-menu"
            ref={menuRef}
            className="owner-menu"
            role="menu"
            aria-label={t('menu_navigation')}
          >
            {TABS.map((one) => (
              <button
                key={one.id}
                type="button"
                role="menuitem"
                // `aria-current`, not just a colour: a screen reader gets the
                // same "you are here" the highlight gives everyone else.
                aria-current={tab === one.id ? 'page' : undefined}
                className={`owner-menu-item${tab === one.id ? ' is-active' : ''}`}
                onClick={() => goTo(one.id)}
              >
                {t(one.key)}
                {tab === one.id && (
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                    strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      <main className="tablet-fade-in" style={{ maxWidth: 1180, margin: '0 auto', padding: '28px 24px', position: 'relative', zIndex: 1 }}>

        {tab === 'companies' && (
          <>
            {/* New company form */}
            <section className="adm-card tablet-fade-up adm-section" style={{ marginBottom: 24 }}>
              <h2 className="adm-heading" style={{ marginTop: 0, marginBottom: 16 }}>{t('new_company')}</h2>
              <div style={{ display: 'grid', gap: 12 }}>
                <input
                  placeholder={t('company_name')}
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  style={inputStyle}
                />
                <PhotoUploadField
                  label={t('logo')}
                  value={newLogo || null}
                  onChange={(url) => setNewLogo(url || '')}
                  restaurantId=""
                  height={120}
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

                return (
                  <div key={company.id} className="adm-card adm-card-hover tablet-fade-up" style={{ overflow: 'hidden' }}>
                    {/* Company header */}
                    <div className="owner-company-header" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', background: 'rgba(var(--adm-bg-rgb),0.55)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                      <div className="owner-company-logo-input" style={{ width: 96, flexShrink: 0 }}>
                        <PhotoUploadField
                          value={company.logoUrl ?? null}
                          onChange={(url) => updateCompany.mutate({ id: company.id, payload: { logoUrl: url || undefined } })}
                          restaurantId=""
                          height={64}
                        />
                      </div>
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
                            const isEditing = editingRestaurantId === r.id;
                            if (isEditing) {
                              return (
                                <div key={r.id} style={{ background: 'rgba(var(--adm-bg-rgb),0.7)', borderRadius: 7, padding: 12, border: '1px solid rgba(var(--adm-accent-rgb),0.3)' }}>
                                  <div style={{ width: 120, marginBottom: 10 }}>
                                    <PhotoUploadField
                                      label={t('logo')}
                                      value={edit.logoUrl}
                                      onChange={(url) => setEdit((s) => ({ ...s, logoUrl: url }))}
                                      restaurantId={r.id}
                                      height={64}
                                    />
                                  </div>
                                  <div style={{ display: 'grid', gap: 8, gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
                                    <input placeholder={t('name')} value={edit.name} onChange={(e) => setEdit((s) => ({ ...s, name: e.target.value }))} style={inputStyle} />
                                    <input placeholder={t('address')} value={edit.address} onChange={(e) => setEdit((s) => ({ ...s, address: e.target.value }))} style={inputStyle} />
                                    <input placeholder={t('phone')} value={edit.phone} onChange={(e) => setEdit((s) => ({ ...s, phone: e.target.value }))} style={inputStyle} />
                                    <input placeholder={t('email')} value={edit.email} onChange={(e) => setEdit((s) => ({ ...s, email: e.target.value }))} style={inputStyle} />
                                  </div>
                                  {editError && <p style={{ color: '#f87171', marginTop: 8, fontSize: 12 }}>{editError}</p>}
                                  <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                                    <button
                                      onClick={() => updateRestaurant.mutate(r.id)}
                                      disabled={updateRestaurant.isPending}
                                      style={{ ...btnStyle, fontSize: 12, padding: '6px 12px' }}
                                    >
                                      {updateRestaurant.isPending ? t('saving') : t('save')}
                                    </button>
                                    <button
                                      onClick={() => { setEditingRestaurantId(null); setEditError(null); }}
                                      style={{ ...btnStyle, background: '#334155', fontSize: 12, padding: '6px 12px' }}
                                    >
                                      {t('cancel')}
                                    </button>
                                  </div>
                                </div>
                              );
                            }
                            return (
                              <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: 'rgba(var(--adm-bg-rgb),0.55)', borderRadius: 7 }}>
                                {effLogo && <img src={getPhotoUrl(effLogo)} alt={r.name} style={{ height: 32, width: 'auto', maxWidth: 72, objectFit: 'contain', flexShrink: 0 }} />}
                                <div style={{ flex: 1 }}>
                                  <p style={{ margin: 0, fontWeight: 600, fontSize: 14 }}>{r.name || r.company?.name || company.name}</p>
                                  {r.address && <p style={{ margin: 0, fontSize: 12, color: 'rgba(226,232,240,0.5)' }}>{r.address}</p>}
                                </div>
                                <button
                                  onClick={() => startEditRestaurant(r)}
                                  style={{ ...btnStyle, background: 'rgba(var(--adm-accent-rgb),0.12)', color: 'var(--adm-accent)', border: '1px solid rgba(var(--adm-accent-rgb),0.35)', fontSize: 11, padding: '4px 8px' }}
                                >
                                  {t('edit')}
                                </button>
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
                        <div style={{ background: 'rgba(var(--adm-bg-rgb),0.55)', padding: 12, borderRadius: 7 }}>
                          <p style={{ margin: '0 0 8px', fontSize: 12, color: 'rgba(226,232,240,0.55)' }}>{t('company_logo_used')}</p>
                          <div style={{ display: 'grid', gap: 8, gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
                            <input placeholder={t('name_optional')} value={rName} onChange={(e) => setRName(e.target.value)} style={inputStyle} />
                            <input placeholder={t('address')} value={rAddress} onChange={(e) => setRAddress(e.target.value)} style={inputStyle} />
                          </div>
                          <p style={{ margin: '6px 0 0', fontSize: 11, color: 'rgba(226,232,240,0.45)' }}>{t('blank_uses_company_name')}</p>
                          {rError && <p style={{ color: '#f87171', marginTop: 8, fontSize: 12 }}>{rError}</p>}
                          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                            <button
                              onClick={() => createRestaurant.mutate(company.id)}
                              disabled={createRestaurant.isPending}
                              style={{ ...btnStyle, fontSize: 12, padding: '6px 12px' }}
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
            <section style={{ background: 'rgba(var(--adm-surface-rgb),0.4)', padding: 20, borderRadius: 8, marginBottom: 24 }}>
              <h2 style={{ marginTop: 0, fontSize: 16 }}>{t('create_user')}</h2>
              <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
                <input placeholder={t('username')} value={uName} onChange={(e) => setUName(e.target.value)} style={inputStyle} />
                <input placeholder={t('password')} type="password" value={uPwd} onChange={(e) => setUPwd(e.target.value)} style={inputStyle} />
                <select value={uRole} onChange={(e) => setURole(e.target.value as AdminRole)} style={inputStyle}>
                  <option value="ADMIN">{t('administrator_role')}</option>
                  <option value="CATERING_ADMIN">{t('catering_admin_role')}</option>
                  <option value="CATERING_EMPLOYEE">{t('food_employee_role')}</option>
                  <option value="RESTAURANT_MANAGER">{t('restaurant_manager_role')}</option>
                  <option value="EMPLOYEE">{t('employee_role')}</option>
                  <option value="KITCHEN">{t('kitchen_role')}</option>
                  <option value="PERFORMER">{t('performer_role')}</option>
                  <option value="HOST">{t('host_role')}</option>
                </select>
                <select value={uRestaurantId} onChange={(e) => setURestaurantId(e.target.value)} style={inputStyle}>
                  <option value="">{t('select_restaurant_dash')}</option>
                  {restaurants.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </div>
              {uRole === 'RESTAURANT_MANAGER' && (
                <p style={{ color: 'rgba(226,232,240,0.5)', fontSize: 12, marginTop: 8 }}>
                  {t('restaurant_manager_needs_restaurant')}
                </p>
              )}
              {uError && <p style={{ color: '#f87171', marginTop: 8 }}>{uError}</p>}
              <button
                onClick={() => createUser.mutate()}
                disabled={!uName.trim() || !uPwd || (uRole === 'RESTAURANT_MANAGER' && !uRestaurantId) || createUser.isPending}
                style={{ ...btnStyle, marginTop: 12, opacity: (!uName.trim() || !uPwd || (uRole === 'RESTAURANT_MANAGER' && !uRestaurantId)) ? 0.5 : 1 }}
              >
                {createUser.isPending ? t('creating') : t('create')}
              </button>
            </section>

            <section>
              <h2 style={{ fontSize: 16, marginBottom: 12 }}>{t('all_users')} ({users.length})</h2>
              <div style={{ display: 'grid', gap: 8 }}>
                {users.map((u) => (
                  <Fragment key={u.id}>
                  <div className="owner-user-row" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12, background: 'rgba(var(--adm-surface-rgb),0.4)', borderRadius: 8 }}>
                    <div className="owner-user-info" style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.username}</p>
                      <p style={{ margin: 0, fontSize: 12, color: 'rgba(226,232,240,0.55)', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {restaurants.find((r) => r.id === u.restaurantId)?.name ?? '—'}
                      </p>
                    </div>
                    <span className="owner-user-badge" style={{
                      padding: '2px 8px', borderRadius: 4, fontSize: 12, fontWeight: 600, flexShrink: 0,
                      background: u.role === 'ADMIN' ? '#2563eb' : u.role === 'CATERING_ADMIN' ? '#0ea5e9' : u.role === 'OWNER' ? '#7c3aed' : '#16a34a',
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
                        <option value="CATERING_ADMIN">{t('catering_admin_role')}</option>
                        <option value="CATERING_EMPLOYEE">{t('food_employee_role')}</option>
                        <option value="RESTAURANT_MANAGER">{t('restaurant_manager_role')}</option>
                        <option value="EMPLOYEE">{t('employee_role')}</option>
                        <option value="KITCHEN">{t('kitchen_role')}</option>
                      </select>
                    )}
                    <button
                      onClick={() => setEditingUserId(editingUserId === u.id ? null : u.id)}
                      style={{
                        padding: '6px 12px', fontSize: 12, fontWeight: 600,
                        borderRadius: 8,
                        background: editingUserId === u.id ? 'rgba(var(--adm-accent-rgb),0.18)' : 'rgba(var(--adm-accent-rgb),0.08)',
                        color: 'var(--adm-accent)',
                        border: '1px solid rgba(var(--adm-accent-rgb),0.35)',
                        cursor: 'pointer', flexShrink: 0,
                      }}
                    >
                      {t('edit_credentials')}
                    </button>
                    {u.role !== 'OWNER' && (
                      <button
                        onClick={() => { if (confirm(t('delete_user_confirm', { name: u.username }))) deleteUser.mutate(u.id); }}
                        style={{ ...btnStyle, background: '#dc2626', flexShrink: 0 }}
                      >
                        {t('delete')}
                      </button>
                    )}
                  </div>
                  {editingUserId === u.id && (
                    <EditCredentialsForm
                      userId={u.id}
                      currentUsername={u.username}
                      onClose={() => setEditingUserId(null)}
                      invalidateKeys={[['owner-users']]}
                      locale={locale}
                    />
                  )}
                  </Fragment>
                ))}
                {users.length === 0 && <p style={{ color: 'rgba(226,232,240,0.5)' }}>{t('no_users_yet')}</p>}
              </div>
            </section>
          </>
        )}

        {tab === 'reports' && (
          // The fallback is a shimmer rather than blank: this chunk is fetched on
          // the tab press, and an empty panel for a round trip reads as a tab
          // that does nothing.
          <Suspense fallback={<div className="skeleton-shimmer" style={{ height: 260, borderRadius: 12 }} />}>
            <OwnerReportsPage locale={locale} />
          </Suspense>
        )}

        {tab === 'devices' && <DevicesPanel locale={locale} />}
      </main>

      <style>{`
        /* ── The mobile menu ───────────────────────────────────────────────
           The four tabs are ONE flex row that neither wraps nor scrolls, and
           .adm-bg clips horizontally rather than scrolling (it must — a scroll
           container there would break every sticky descendant, see CLAUDE.md).
           So a tab past the right edge was not awkward, it was
           UNREACHABLE. Measured, the row needs 444px in English, 542px in
           Russian and 588px in Uzbek — which is the default locale, so the
           worst case is the usual one: at 390px two of the four had no way to be
           pressed.

           720px is the breakpoint because it clears the worst language with room
           to spare and is the one this file already uses for its other mobile
           rules; a second, nearby breakpoint would just be a second number to
           keep in step. */
        .owner-burger { display: none; }
        @media (max-width: 720px) {
          .owner-nav { display: none !important; }
          .owner-burger {
            display: inline-flex; align-items: center; gap: 8px;
            /* 44px tall: a tap target, not a link. */
            min-height: 44px; padding: 8px 13px;
            border-radius: 10px; cursor: pointer;
            border: 1px solid rgba(var(--adm-accent-rgb),0.34);
            background: rgba(var(--adm-accent-rgb),0.11);
            color: var(--adm-accent);
            font-size: 13px; font-weight: 700; font-family: inherit;
            max-width: 52vw;
          }
          .owner-burger-label {
            overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0;
          }
        }
        .owner-menu-wrap {
          position: sticky; top: 0; z-index: 40;
          padding: 0 16px;
        }
        .owner-menu {
          display: grid; gap: 4px;
          margin: 8px 0 0; padding: 7px;
          border-radius: 13px;
          border: 1px solid rgba(255,255,255,0.12);
          /* Opaque, not translucent: it sits over the page's own cards and
             anything see-through makes both unreadable at once. */
          background: #131c30;
          box-shadow: 0 18px 40px rgba(0,0,0,0.5);
        }
        .owner-menu-item {
          display: flex; align-items: center; justify-content: space-between; gap: 10px;
          width: 100%; min-height: 46px; padding: 11px 14px;
          border: 0; border-radius: 9px; cursor: pointer;
          background: transparent; color: #e2e8f0;
          font-size: 14.5px; font-weight: 600; font-family: inherit; text-align: left;
        }
        .owner-menu-item:hover { background: rgba(255,255,255,0.055); }
        .owner-menu-item.is-active {
          background: rgba(var(--adm-accent-rgb),0.15);
          color: var(--adm-accent);
        }
        .owner-menu-item:focus-visible {
          outline: 2px solid var(--adm-accent); outline-offset: -2px;
        }

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
  borderBottom: active ? '2px solid var(--adm-accent)' : '2px solid transparent',
  color: active ? 'var(--adm-accent)' : 'rgba(226,232,240,0.6)',
  cursor: 'pointer', fontSize: 14, fontWeight: 600,
  textTransform: 'capitalize',
  transition: 'all 0.18s',
});

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

const btnStyle: React.CSSProperties = {
  padding: '0.6rem 1.2rem',
  background: 'linear-gradient(135deg, var(--adm-accent) 0%, #d4af37 100%)',
  border: 'none',
  borderRadius: 10,
  color: 'var(--adm-bg)',
  cursor: 'pointer',
  fontSize: 13,
  fontWeight: 700,
  letterSpacing: '0.02em',
  transition: 'transform 0.15s, box-shadow 0.15s',
};
