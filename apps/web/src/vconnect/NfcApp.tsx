import { useEffect } from 'react';
import { NavLink, Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { authService } from '../services/auth.service';
import { useAuthStore } from '../store/auth.store';
import { useAdminStore } from '../store/admin.store';
import { translate, locales, type Locale } from '../utils/translate';
import { buildConnectLoginUrl } from '../utils/subdomain';
import { NfcPlaquesPage } from './NfcPlaquesPage';
import { NfcBuilderPage } from './NfcBuilderPage';
import { VC_LOGO } from './branding';
import './vconnect.css';

const LOCALE_LABELS: Record<Locale, string> = { en: 'EN', ru: 'RU', uz: 'UZ' };

// ── nfc.v-connect.uz — the NFC plaque builder ────────────────────────────────
// Its own shell (black + beige) rather than the v-menu AdminLayout: this is a
// separate product with a single job. Auth is the shared AdminUser session, so
// an unauthenticated visitor is bounced to v-connect.uz/login.
export const NfcApp = () => {
  const accessToken = useAuthStore((s) => s.accessToken);
  const role = useAuthStore((s) => s.role);

  useEffect(() => {
    document.title = 'NFC · v-connect.uz';
  }, []);

  const allowed = !!accessToken && (role === 'NFC_MAKER' || role === 'CHIEF_ADMIN');

  if (!allowed) {
    window.location.href = buildConnectLoginUrl();
    return null;
  }

  return (
    <div className="vc-root">
      <Routes>
        <Route element={<NfcLayout />}>
          <Route path="/" element={<NfcPlaquesPage />} />
        </Route>
        {/* The editor is full-bleed — it brings its own top bar. */}
        <Route path="/plaques/new" element={<NfcBuilderPage />} />
        <Route path="/plaques/:plaqueId" element={<NfcBuilderPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
};

function NfcLayout() {
  const username = useAuthStore((s) => s.username);
  const logout = useAuthStore((s) => s.logout);
  const { locale, setLocale } = useAdminStore();
  const t = (key: Parameters<typeof translate>[0]) => translate(key, locale);

  const doLogout = async () => {
    try { await authService.logout(); } catch { /* the session is going away regardless */ }
    logout();
    window.location.href = buildConnectLoginUrl();
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header style={{
        position: 'sticky', top: 0, zIndex: 40,
        background: 'rgba(11,11,10,0.86)',
        backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)',
        borderBottom: '1px solid var(--vc-line)',
      }}>
        <div style={{ maxWidth: 1120, margin: '0 auto', padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          <NavLink to="/" style={{ display: 'flex', alignItems: 'center', gap: 11, textDecoration: 'none', color: 'inherit' }}>
            <img src={VC_LOGO} alt="" style={{ height: 34, width: 'auto', objectFit: 'contain' }} />
            <span style={{ fontSize: 15, fontWeight: 300, letterSpacing: '0.06em' }}>
              v-connect<span style={{ color: 'var(--vc-accent)' }}>.uz</span>
            </span>
          </NavLink>

          <span className="vc-badge" style={{ marginLeft: 4 }}>NFC</span>

          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ display: 'flex', gap: 4 }}>
              {locales.map((loc) => (
                <button
                  key={loc}
                  type="button"
                  onClick={() => setLocale(loc)}
                  style={{
                    padding: '5px 10px',
                    border: '1px solid',
                    borderColor: locale === loc ? 'var(--vc-accent)' : 'var(--vc-line)',
                    borderRadius: 6,
                    background: locale === loc ? 'var(--vc-accent-dim)' : 'transparent',
                    color: locale === loc ? 'var(--vc-accent)' : 'var(--vc-beige-dim)',
                    fontWeight: locale === loc ? 700 : 500,
                    cursor: 'pointer', fontSize: 11, letterSpacing: '0.06em',
                  }}
                >
                  {LOCALE_LABELS[loc]}
                </button>
              ))}
            </div>
            {username && (
              <span className="vc-muted" style={{ fontSize: 12.5, maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {username}
              </span>
            )}
            <button type="button" className="vc-btn vc-btn-ghost" style={{ fontSize: 12.5, padding: '8px 14px' }} onClick={doLogout}>
              {t('logout')}
            </button>
          </div>
        </div>
      </header>

      <main style={{ flex: 1, width: '100%', maxWidth: 1120, margin: '0 auto', padding: '28px 20px 64px' }}>
        <Outlet />
      </main>
    </div>
  );
}
