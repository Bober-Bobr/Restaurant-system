import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, Navigate, Outlet, useLocation } from 'react-router-dom';
import { authService } from '../services/auth.service';
import { restaurantService } from '../services/restaurant.service';
import { useAuthStore } from '../store/auth.store';
import { useAdminStore } from '../store/admin.store';
import { Locale, locales, translate } from '../utils/translate';
import { buildAbsoluteUrl } from '../utils/subdomain';
import { getPhotoUrl } from '../utils/photoUrl';
import { PLATFORM_TITLE } from '../utils/appTitle';
import networkingLogoSrc from '../assets/networking-logo.png';

const LOCALE_LABELS: Record<Locale, string> = { en: 'EN', ru: 'RU', uz: 'UZ' };

// The Catering Admin dashboard mirrors the restaurant admin but is limited to a
// handful of pages and wears the monochrome catering-site look (via `cadm-theme`).
export const CateringAdminLayout = () => {
  const accessToken = useAuthStore((state) => state.accessToken);
  const username = useAuthStore((state) => state.username);
  const logout = useAuthStore((state) => state.logout);
  const { locale, setLocale } = useAdminStore();
  const t = (key: Parameters<typeof translate>[0], params?: Record<string, string | number>) => translate(key, locale, params);
  const location = useLocation();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const { data: restaurants = [] } = useQuery({
    queryKey: ['restaurants'],
    queryFn: () => restaurantService.list(),
    enabled: !!accessToken,
  });

  const effectiveLogoUrl = restaurants[0]?.logoUrl ?? restaurants[0]?.company?.logoUrl ?? null;
  const restaurantLogoSrc = getPhotoUrl(effectiveLogoUrl);
  const restaurantName = restaurants[0]?.name;

  const logoutMutation = useMutation({
    mutationFn: () => authService.logout(),
    onSettled: () => {
      logout();
      window.location.href = buildAbsoluteUrl('/login');
    },
  });

  if (!accessToken) return <Navigate to="/login" replace />;

  const navItems: { to: string; label: string }[] = [
    { to: '/admin/menu', label: t('menu') },
    { to: '/admin/subcategories', label: t('subcategories') },
    { to: '/admin/arrangement', label: t('arrangement') },
    { to: '/admin/halls', label: t('halls') },
    { to: '/admin/photos', label: t('photos') },
    { to: '/admin/users', label: t('users') },
    { to: '/admin/reviews', label: t('reviews') },
    { to: '/admin/settings', label: t('settings') },
    { to: '/devices', label: t('devices') },
  ];

  const isActive = (path: string) => location.pathname.startsWith(path);

  // Monochrome nav link styling (catering-site palette).
  const linkStyle = (active: boolean): React.CSSProperties => ({
    padding: '7px 13px', borderRadius: 8, fontSize: 13, fontWeight: 600, letterSpacing: '0.01em',
    textDecoration: 'none',
    color: active ? '#fff' : 'rgba(255,255,255,0.7)',
    background: active ? 'rgba(255,255,255,0.12)' : 'transparent',
    border: active ? '1px solid rgba(255,255,255,0.35)' : '1px solid transparent',
    transition: 'all 0.18s',
  });

  return (
    <div className="adm-bg cadm-theme">
      <nav style={{
        position: 'sticky', top: 0, zIndex: 30,
        background: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(18px)',
        WebkitBackdropFilter: 'blur(18px)',
        borderBottom: '1px solid rgba(255,255,255,0.12)',
      }}>
        <div style={{ maxWidth: 1280, margin: '0 auto', padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>

          {/* Brand */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <img
              src={restaurantLogoSrc ?? networkingLogoSrc}
              alt={restaurantName ?? 'Logo'}
              style={{ height: 44, width: 'auto', objectFit: 'contain', flexShrink: 0 }}
            />
            <div>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#fff', letterSpacing: '-0.01em' }}>
                {restaurantName ?? PLATFORM_TITLE}
              </p>
              <p style={{ margin: '2px 0 0', fontSize: 11, color: 'rgba(255,255,255,0.55)', display: 'flex', alignItems: 'center', gap: 6 }}>
                {username}
                <span style={{ padding: '0.15rem 0.55rem', borderRadius: '0.4rem', fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.04em', background: 'rgba(255,255,255,0.12)', color: '#fff', border: '1px solid rgba(255,255,255,0.25)' }}>
                  {t('catering_admin_role')}
                </span>
              </p>
            </div>
          </div>

          {/* Desktop nav */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 1, flexWrap: 'wrap' }} className="adm-nav-desktop">
            {navItems.map((item) => (
              <Link key={item.to} to={item.to} style={linkStyle(isActive(item.to))}>
                {item.label}
              </Link>
            ))}
          </div>

          {/* Right side: locale + logout (desktop only) */}
          <div className="adm-nav-right" style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto' }}>
            <div className="adm-nav-locale" style={{ display: 'flex', gap: 4 }}>
              {locales.map((loc) => (
                <button
                  key={loc}
                  type="button"
                  onClick={() => setLocale(loc)}
                  style={{
                    padding: '5px 10px',
                    border: '1px solid',
                    borderColor: locale === loc ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.12)',
                    borderRadius: 6,
                    background: locale === loc ? 'rgba(255,255,255,0.15)' : 'transparent',
                    color: locale === loc ? '#fff' : 'rgba(255,255,255,0.6)',
                    fontWeight: locale === loc ? 700 : 500,
                    cursor: 'pointer', fontSize: 11, letterSpacing: '0.06em', transition: 'all 0.18s',
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
                display: 'none', background: 'transparent',
                border: '1px solid rgba(255,255,255,0.18)', borderRadius: 8, padding: 8,
                color: '#fff', cursor: 'pointer',
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
        <div style={{ position: 'fixed', inset: 0, zIndex: 29, background: 'rgba(0,0,0,0.6)' }} onClick={() => setMobileNavOpen(false)}>
          <div
            style={{
              position: 'absolute', top: 0, right: 0,
              width: 280, maxWidth: '85vw', height: '100%',
              background: 'rgba(10,10,10,0.97)',
              backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
              borderLeft: '1px solid rgba(255,255,255,0.12)',
              padding: '72px 16px 24px',
              display: 'flex', flexDirection: 'column', gap: 4,
              boxShadow: '-8px 0 32px rgba(0,0,0,0.5)', overflowY: 'auto',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {navItems.map((item) => (
              <Link key={item.to} to={item.to} onClick={() => setMobileNavOpen(false)}
                style={{ ...linkStyle(isActive(item.to)), padding: '11px 16px', borderRadius: 10, fontSize: 14 }}>
                {item.label}
              </Link>
            ))}

            <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 10, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.12)' }}>
              <div style={{ display: 'flex', gap: 6 }}>
                {locales.map((loc) => (
                  <button
                    key={loc}
                    type="button"
                    onClick={() => setLocale(loc)}
                    style={{
                      flex: 1, padding: '7px 10px', border: '1px solid',
                      borderColor: locale === loc ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.12)',
                      borderRadius: 8,
                      background: locale === loc ? 'rgba(255,255,255,0.15)' : 'transparent',
                      color: locale === loc ? '#fff' : 'rgba(255,255,255,0.6)',
                      fontWeight: locale === loc ? 700 : 500, cursor: 'pointer', fontSize: 12, letterSpacing: '0.06em',
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
