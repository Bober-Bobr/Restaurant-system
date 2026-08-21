import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, Navigate, Outlet, useLocation } from 'react-router-dom';
import { authService } from '../services/auth.service';
import { useAuthStore } from '../store/auth.store';
import { useAdminStore } from '../store/admin.store';
import { Locale, locales, translate } from '../utils/translate';
import { buildAbsoluteUrl } from '../utils/subdomain';
import networkingLogoSrc from '../assets/networking-logo.png';

const LOCALE_LABELS: Record<Locale, string> = { en: 'EN', ru: 'RU', uz: 'UZ' };

// The Restaurant Manager dashboard: an expense ledger plus device management.
// Not tied to any restaurant; created only by the Chief Admin.
export const RestaurantManagerLayout = () => {
  const accessToken = useAuthStore((state) => state.accessToken);
  const username = useAuthStore((state) => state.username);
  const logout = useAuthStore((state) => state.logout);
  const { locale, setLocale } = useAdminStore();
  const t = (key: Parameters<typeof translate>[0], params?: Record<string, string | number>) => translate(key, locale, params);
  const location = useLocation();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const logoutMutation = useMutation({
    mutationFn: () => authService.logout(),
    onSettled: () => {
      logout();
      window.location.href = buildAbsoluteUrl('/login');
    },
  });

  if (!accessToken) return <Navigate to="/login" replace />;

  const navItems: { to: string; label: string }[] = [
    { to: '/accounts', label: t('accounts') },
    { to: '/ledger', label: t('expense_ledger') },
    { to: '/additional', label: t('additional_expenses') },
    { to: '/devices', label: t('devices') },
  ];

  const isActive = (path: string) => location.pathname.startsWith(path);

  const linkStyle = (active: boolean): React.CSSProperties => ({
    padding: '7px 13px', borderRadius: 8, fontSize: 13, fontWeight: 600, letterSpacing: '0.01em',
    textDecoration: 'none',
    color: active ? 'var(--adm-accent)' : 'rgba(226,232,240,0.7)',
    background: active ? 'rgba(var(--adm-accent-rgb),0.12)' : 'transparent',
    border: active ? '1px solid rgba(var(--adm-accent-rgb),0.35)' : '1px solid transparent',
    transition: 'all 0.18s',
  });

  return (
    <div className="adm-bg">
      <nav style={{
        position: 'sticky', top: 0, zIndex: 30,
        background: 'rgba(var(--adm-bg-rgb),0.78)',
        backdropFilter: 'blur(18px)',
        WebkitBackdropFilter: 'blur(18px)',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
      }}>
        <div style={{ maxWidth: 1280, margin: '0 auto', padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>

          {/* Brand */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <img src={networkingLogoSrc} alt="Logo" style={{ height: 44, width: 'auto', objectFit: 'contain', flexShrink: 0 }} />
            <div>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#f8fafc', letterSpacing: '-0.01em' }}>
                {t('restaurant_manager_role')}
              </p>
              <p style={{ margin: '2px 0 0', fontSize: 11, color: 'rgba(226,232,240,0.55)', display: 'flex', alignItems: 'center', gap: 6 }}>
                {username}
                <span className="adm-badge" style={{ background: 'rgba(245,158,11,0.18)', color: '#fbbf24', border: '1px solid rgba(245,158,11,0.3)' }}>
                  {t('restaurant_manager_role')}
                </span>
              </p>
            </div>
          </div>

          {/* Desktop nav */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 1, flexWrap: 'wrap' }} className="adm-nav-desktop">
            {navItems.map((item) => (
              <Link key={item.to} to={item.to} className={`adm-nav-item${isActive(item.to) ? ' is-active' : ''}`} style={linkStyle(isActive(item.to))}>
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
                    padding: '5px 10px', border: '1px solid',
                    borderColor: locale === loc ? 'rgba(var(--adm-accent-rgb),0.5)' : 'rgba(255,255,255,0.1)',
                    borderRadius: 6,
                    background: locale === loc ? 'rgba(var(--adm-accent-rgb),0.15)' : 'transparent',
                    color: locale === loc ? 'var(--adm-accent)' : 'rgba(226,232,240,0.6)',
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
                border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, padding: 8,
                color: '#e2e8f0', cursor: 'pointer',
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
        <div style={{ position: 'fixed', inset: 0, zIndex: 29, background: 'rgba(0,0,0,0.5)' }} onClick={() => setMobileNavOpen(false)}>
          <div
            style={{
              position: 'absolute', top: 0, right: 0,
              width: 280, maxWidth: '85vw', height: '100%',
              background: 'rgba(var(--adm-bg-rgb),0.97)',
              backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
              borderLeft: '1px solid rgba(255,255,255,0.08)',
              padding: '72px 16px 24px',
              display: 'flex', flexDirection: 'column', gap: 4,
              boxShadow: '-8px 0 32px rgba(0,0,0,0.4)', overflowY: 'auto',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {navItems.map((item) => (
              <Link key={item.to} to={item.to} onClick={() => setMobileNavOpen(false)}
                style={{ ...linkStyle(isActive(item.to)), padding: '11px 16px', borderRadius: 10, fontSize: 14 }}>
                {item.label}
              </Link>
            ))}

            <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 10, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
              <div style={{ display: 'flex', gap: 6 }}>
                {locales.map((loc) => (
                  <button
                    key={loc}
                    type="button"
                    onClick={() => setLocale(loc)}
                    style={{
                      flex: 1, padding: '7px 10px', border: '1px solid',
                      borderColor: locale === loc ? 'rgba(var(--adm-accent-rgb),0.5)' : 'rgba(255,255,255,0.1)',
                      borderRadius: 8,
                      background: locale === loc ? 'rgba(var(--adm-accent-rgb),0.15)' : 'transparent',
                      color: locale === loc ? 'var(--adm-accent)' : 'rgba(226,232,240,0.6)',
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

      {/* Keyed on the path so React remounts the wrapper on every navigation and
          the entrance animation replays. Without the key the element persists
          across routes and the animation would run once, on first load only. */}
      <div key={location.pathname} className="adm-page-in" style={{ position: 'relative', zIndex: 1 }}>
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
