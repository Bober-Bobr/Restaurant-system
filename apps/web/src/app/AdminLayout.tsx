import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, Navigate, Outlet, useLocation } from 'react-router-dom';
import { authService } from '../services/auth.service';
import { restaurantService } from '../services/restaurant.service';
import { useAuthStore } from '../store/auth.store';
import { useAdminStore } from '../store/admin.store';
import { Locale, locales, translate } from '../utils/translate';
import { getPhotoUrl } from '../utils/photoUrl';
import networkingLogoSrc from '../assets/networking-logo.png';

const LOCALE_LABELS: Record<Locale, string> = { en: 'EN', ru: 'RU', uz: 'UZ' };

export const AdminLayout = () => {
  const accessToken = useAuthStore((state) => state.accessToken);
  const username = useAuthStore((state) => state.username);
  const authRestaurantId = useAuthStore((state) => state.restaurantId);
  const logout = useAuthStore((state) => state.logout);
  const role = useAuthStore((state) => state.role);
  const { locale, setLocale } = useAdminStore();
  const t = (key: Parameters<typeof translate>[0], params?: Record<string, string | number>) => translate(key, locale, params);
  const location = useLocation();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const { data: restaurants = [] } = useQuery({
    queryKey: ['restaurants'],
    queryFn: () => restaurantService.list(),
    enabled: !!accessToken
  });

  const effectiveLogoUrl = restaurants[0]?.logoUrl ?? restaurants[0]?.company?.logoUrl ?? null;
  const restaurantLogoSrc = getPhotoUrl(effectiveLogoUrl);
  const restaurantName = restaurants[0]?.name;
  const tabletRestaurantId = authRestaurantId ?? restaurants[0]?.id ?? '';

  const logoutMutation = useMutation({
    mutationFn: () => authService.logout(),
    onSettled: () => {
      logout();
      window.location.href = 'https://v-menu.uz/login';
    }
  });

  if (!accessToken) return <Navigate to="/login" replace />;
  if (role === 'OWNER') { window.location.href = 'https://cabinet.v-menu.uz/'; return null; }

  const navItems: { to: string; label: string }[] = [
    { to: '/', label: t('events') },
    { to: '/calendar', label: t('calendar') },
    { to: '/admin/menu', label: t('menu') },
    { to: '/admin/table-categories', label: t('tables') },
    { to: '/admin/halls', label: t('halls') },
    { to: '/admin/photos', label: t('photos') },
    ...(role === 'ADMIN' ? [{ to: '/admin/users', label: t('users') }] : []),
  ];

  const isActive = (path: string) => path === '/' ? location.pathname === '/' : location.pathname.startsWith(path);

  return (
    <div className="adm-bg">
      <nav style={{
        position: 'sticky', top: 0, zIndex: 30,
        background: 'rgba(15,23,42,0.78)',
        backdropFilter: 'blur(18px)',
        WebkitBackdropFilter: 'blur(18px)',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
      }}>
        <div style={{ maxWidth: 1280, margin: '0 auto', padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>

          {/* Brand */}
          <div className="adm-slide-in-left" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <img
              src={restaurantLogoSrc ?? networkingLogoSrc}
              alt={restaurantName ?? 'Logo'}
              style={{ height: 44, width: 'auto', objectFit: 'contain', flexShrink: 0 }}
            />
            <div>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#f8fafc', letterSpacing: '-0.01em' }}>
                {restaurantName ?? t('banquet_admin')}
              </p>
              <p style={{ margin: '2px 0 0', fontSize: 11, color: 'rgba(226,232,240,0.55)', display: 'flex', alignItems: 'center', gap: 6 }}>
                {username}
                <span className="adm-badge" style={{ background: 'rgba(59,130,246,0.18)', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.3)' }}>
                  {role}
                </span>
              </p>
            </div>
          </div>

          {/* Desktop nav */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 1, flexWrap: 'wrap' }} className="adm-nav-desktop">
            {navItems.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                style={{
                  padding: '7px 13px',
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 600,
                  letterSpacing: '0.01em',
                  textDecoration: 'none',
                  color: isActive(item.to) ? '#c9a42c' : 'rgba(226,232,240,0.7)',
                  background: isActive(item.to) ? 'rgba(201,164,44,0.12)' : 'transparent',
                  border: isActive(item.to) ? '1px solid rgba(201,164,44,0.35)' : '1px solid transparent',
                  transition: 'all 0.18s',
                }}
                onMouseEnter={(e) => { if (!isActive(item.to)) (e.currentTarget as HTMLElement).style.color = '#fff'; }}
                onMouseLeave={(e) => { if (!isActive(item.to)) (e.currentTarget as HTMLElement).style.color = 'rgba(226,232,240,0.7)'; }}
              >
                {item.label}
              </Link>
            ))}
            <Link
              to={`/tablet?restaurantId=${tabletRestaurantId}`}
              style={{
                marginLeft: 4,
                padding: '7px 14px',
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 700,
                textDecoration: 'none',
                color: '#c9a42c',
                background: 'rgba(201,164,44,0.1)',
                border: '1px solid rgba(201,164,44,0.4)',
                transition: 'all 0.18s',
                display: 'inline-flex', alignItems: 'center', gap: 6,
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(201,164,44,0.2)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(201,164,44,0.1)'; }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="14" rx="2" />
                <line x1="8" y1="20" x2="16" y2="20" />
                <line x1="12" y1="18" x2="12" y2="20" />
              </svg>
              {t('tablet')}
            </Link>
          </div>

          {/* Right side: locale + logout (desktop only) */}
          <div className="adm-slide-in-right adm-nav-right" style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto' }}>
            <div className="adm-nav-locale" style={{ display: 'flex', gap: 4 }}>
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
            <button
              type="button"
              className="adm-btn-danger adm-nav-logout"
              onClick={() => logoutMutation.mutate()}
              disabled={logoutMutation.isPending}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              {logoutMutation.isPending ? t('logging_out') : t('logout')}
            </button>
            <button
              type="button"
              onClick={() => setMobileNavOpen(!mobileNavOpen)}
              className="adm-nav-mobile-toggle"
              style={{
                display: 'none',
                background: 'transparent',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: 8,
                padding: 8,
                color: '#e2e8f0',
                cursor: 'pointer',
              }}
              aria-label="Toggle menu"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                {mobileNavOpen ? (<><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></>) : (<><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="18" x2="21" y2="18" /></>)}
              </svg>
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile nav drawer */}
      {mobileNavOpen && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 29,
          background: 'rgba(0,0,0,0.5)',
        }} onClick={() => setMobileNavOpen(false)}>
          <div
            style={{
              position: 'absolute', top: 0, right: 0,
              width: 280, maxWidth: '85vw', height: '100%',
              background: 'rgba(15,23,42,0.97)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              borderLeft: '1px solid rgba(255,255,255,0.08)',
              padding: '72px 16px 24px',
              display: 'flex', flexDirection: 'column', gap: 4,
              boxShadow: '-8px 0 32px rgba(0,0,0,0.4)',
              overflowY: 'auto',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {navItems.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setMobileNavOpen(false)}
                style={{
                  padding: '11px 16px',
                  borderRadius: 10,
                  fontSize: 14,
                  fontWeight: 600,
                  textDecoration: 'none',
                  color: isActive(item.to) ? '#c9a42c' : 'rgba(226,232,240,0.85)',
                  background: isActive(item.to) ? 'rgba(201,164,44,0.12)' : 'transparent',
                  border: isActive(item.to) ? '1px solid rgba(201,164,44,0.35)' : '1px solid transparent',
                  transition: 'all 0.15s',
                }}
              >
                {item.label}
              </Link>
            ))}
            <Link
              to={`/tablet?restaurantId=${tabletRestaurantId}`}
              onClick={() => setMobileNavOpen(false)}
              style={{
                marginTop: 8,
                padding: '11px 16px',
                borderRadius: 10,
                fontSize: 14,
                fontWeight: 700,
                textDecoration: 'none',
                color: '#c9a42c',
                background: 'rgba(201,164,44,0.1)',
                border: '1px solid rgba(201,164,44,0.4)',
                display: 'flex', alignItems: 'center', gap: 8,
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="14" rx="2" />
                <line x1="8" y1="20" x2="16" y2="20" />
                <line x1="12" y1="18" x2="12" y2="20" />
              </svg>
              {t('tablet')}
            </Link>

            <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 10, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
              <div style={{ display: 'flex', gap: 6 }}>
                {locales.map((loc) => (
                  <button
                    key={loc}
                    type="button"
                    onClick={() => setLocale(loc)}
                    style={{
                      flex: 1,
                      padding: '7px 10px',
                      border: '1px solid',
                      borderColor: locale === loc ? 'rgba(201,164,44,0.5)' : 'rgba(255,255,255,0.1)',
                      borderRadius: 8,
                      background: locale === loc ? 'rgba(201,164,44,0.15)' : 'transparent',
                      color: locale === loc ? '#c9a42c' : 'rgba(226,232,240,0.6)',
                      fontWeight: locale === loc ? 700 : 500,
                      cursor: 'pointer',
                      fontSize: 12,
                      letterSpacing: '0.06em',
                    }}
                  >
                    {LOCALE_LABELS[loc]}
                  </button>
                ))}
              </div>
              <button
                type="button"
                className="adm-btn-danger"
                onClick={() => { setMobileNavOpen(false); logoutMutation.mutate(); }}
                disabled={logoutMutation.isPending}
                style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '10px 14px' }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
                {logoutMutation.isPending ? t('logging_out') : t('logout')}
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={{ position: 'relative', zIndex: 1 }}>
        <Outlet />
      </div>

      <style>{`
        @media (max-width: 900px) {
          .adm-nav-desktop { display: none !important; }
          .adm-nav-mobile-toggle { display: inline-flex !important; align-items: center; justify-content: center; }
          .adm-nav-locale, .adm-nav-logout { display: none !important; }
          .adm-nav-right { gap: 0 !important; }
        }
      `}</style>
    </div>
  );
};
