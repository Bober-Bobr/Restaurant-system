import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { NavLink, Navigate, Outlet, Route, Routes, useNavigate } from 'react-router-dom';
import type { Locale } from '../utils/translate';
import { useVInviteStore } from './store';
import { useViT } from './i18n';
import { vinviteService } from './api';
import { ViLoginPage } from './LoginPage';
import { ViLandingPage } from './LandingPage';
import { ViDashboardPage } from './DashboardPage';
import { ViEditorPage } from './EditorPage';
import { ViTemplatesPage } from './TemplatesPage';
import { ViTemplateDesignerPage } from './TemplateDesignerPage';
import { ViDevicesPage } from './DevicesPage';
import { ViProfilePage } from './ProfilePage';
import { ViNotificationsPage } from './NotificationsPage';
import { PublicVInvitePage } from './PublicVInvitePage';
import './vinvite.css';

// ── v-invite.uz application shell ─────────────────────────────────────────────
// A separate product from v-menu: its own users, cream/blue shadcn-style look,
// light/dark theme, and the shared block designer for building invitations.
// Served from public/ rather than imported, so the sandboxed template iframe can
// load the same file by absolute URL (see RichRenderer's __ORIGIN__).
export const VI_LOGO = '/v-invite-logo.png';
export const VI_MARK = '/v-invite-mark.png';

export const VInviteApp = () => {
  const uiTheme = useVInviteStore((s) => s.uiTheme);
  const accessToken = useVInviteStore((s) => s.accessToken);

  // index.html is shared with v-menu, so brand this tab as v-invite.
  useEffect(() => {
    document.title = 'v-invite.uz';
    const rels = ['icon', 'shortcut icon', 'apple-touch-icon'];
    document.querySelectorAll('link[rel~="icon"], link[rel="apple-touch-icon"]').forEach((l) => l.remove());
    for (const rel of rels) {
      const link = document.createElement('link');
      link.rel = rel;
      link.href = VI_MARK;
      document.head.appendChild(link);
    }
  }, []);

  return (
    <div className="vi-root" data-theme={uiTheme}>
      <Routes>
        <Route path="/login" element={accessToken ? <Navigate to="/" replace /> : <ViLoginPage />} />
        {/* Published invitation: v-invite.uz/<slug> (path-based — no wildcard
            DNS available on .uz). Static app routes above/below always win over
            this dynamic segment. */}
        <Route path="/:slug" element={<PublicVInvitePage />} />
        {accessToken ? (
          <>
            {/* The editor is full-bleed (its own top bar), outside the tabbed layout. */}
            <Route path="/projects/:id" element={<ViEditorPage />} />
            <Route path="/template-designer/:templateId" element={<ViTemplateDesignerPage />} />
            <Route element={<ViLayout />}>
              <Route path="/" element={<ViDashboardPage />} />
              <Route path="/templates" element={<ViTemplatesPage />} />
              <Route path="/notifications" element={<ViNotificationsPage />} />
              <Route path="/devices" element={<ViDevicesPage />} />
              <Route path="/profile" element={<ViProfilePage />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </>
        ) : (
          <>
            {/* Logged-out visitors land on the marketing page rather than the
                sign-in form; every other app route still bounces to /login. */}
            <Route path="/" element={<ViLandingPage />} />
            <Route path="*" element={<Navigate to="/login" replace />} />
          </>
        )}
      </Routes>
    </div>
  );
};

export function ViLogo({ size = 34 }: { size?: number }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
      <img src={VI_MARK} alt="" style={{ width: size, height: size, objectFit: 'contain' }} />
      <span style={{ fontSize: size * 0.52, fontWeight: 800, letterSpacing: '-0.02em' }}>
        v-invite<span style={{ color: 'var(--vi-accent)' }}>.uz</span>
      </span>
    </span>
  );
}

// Sun/moon light-dark toggle with a springy rotation.
export function ViThemeToggle() {
  const uiTheme = useVInviteStore((s) => s.uiTheme);
  const setUiTheme = useVInviteStore((s) => s.setUiTheme);
  const t = useViT();
  const dark = uiTheme === 'dark';
  return (
    <button
      type="button"
      className="vi-btn vi-btn-ghost vi-theme-toggle"
      title={dark ? t('theme_light') : t('theme_dark')}
      onClick={() => setUiTheme(dark ? 'light' : 'dark')}
      style={{ padding: '9px 12px', fontSize: 16, lineHeight: 1 }}
    >
      {dark ? '☀️' : '🌙'}
    </button>
  );
}

function ViLayout() {
  const t = useViT();
  const user = useVInviteStore((s) => s.user);
  const locale = useVInviteStore((s) => s.locale);
  const setLocale = useVInviteStore((s) => s.setLocale);
  const logout = useVInviteStore((s) => s.logout);
  const navigate = useNavigate();

  const doLogout = async () => {
    await vinviteService.logout();
    logout();
    navigate('/login');
  };

  const isSystemAdmin = user?.role === 'SYSTEM_ADMIN';

  // Unread invitation orders, for the badge on the Notifications tab. Only a
  // SYSTEM_ADMIN may call this, so it stays disabled for everyone else.
  const unreadQuery = useQuery({
    queryKey: ['vi-invite-requests-unread'],
    queryFn: () => vinviteService.inviteRequestUnreadCount(),
    enabled: isSystemAdmin,
    refetchInterval: 60_000,
  });
  const unread = unreadQuery.data ?? 0;

  const tabs: { to: string; label: string; icon: string; end?: boolean; badge?: number }[] = [
    { to: '/', label: t('invitations'), icon: '💌', end: true },
    { to: '/templates', label: t('templates'), icon: '🎨' },
    ...(isSystemAdmin ? [{ to: '/notifications', label: t('notifications'), icon: '🔔', badge: unread }] : []),
    { to: '/devices', label: t('devices'), icon: '📱' },
    { to: '/profile', label: t('profile'), icon: '👤' },
  ];

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header style={{
        position: 'sticky', top: 0, zIndex: 40,
        background: 'color-mix(in srgb, var(--vi-card) 82%, transparent)',
        backdropFilter: 'blur(16px)', borderBottom: '1px solid var(--vi-border)',
      }}>
        <div style={{ maxWidth: 1180, margin: '0 auto', padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
          <NavLink to="/" style={{ textDecoration: 'none', color: 'inherit', flexShrink: 0 }}><ViLogo /></NavLink>

          <nav className="vi-tabs">
            {tabs.map((tab) => (
              <NavLink key={tab.to} to={tab.to} end={tab.end} className={({ isActive }) => `vi-tab${isActive ? ' active' : ''}`}>
                <span>{tab.icon}</span>{tab.label}
                {!!tab.badge && <span className="vi-tab-badge">{tab.badge}</span>}
              </NavLink>
            ))}
          </nav>

          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            <select className="vi-select" style={{ width: 'auto', padding: '8px 10px', fontSize: 13 }} value={locale} onChange={(e) => setLocale(e.target.value as Locale)}>
              <option value="ru">RU</option>
              <option value="uz">UZ</option>
              <option value="en">EN</option>
            </select>
            <ViThemeToggle />
            {user && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600 }}>
                {user.avatarUrl
                  ? <img src={user.avatarUrl} alt="" style={{ width: 30, height: 30, borderRadius: '50%' }} referrerPolicy="no-referrer" />
                  : <span style={{ width: 30, height: 30, borderRadius: '50%', background: 'var(--vi-accent-soft)', color: 'var(--vi-accent)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800 }}>{(user.displayName || user.username).slice(0, 1).toUpperCase()}</span>}
                <span style={{ maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.displayName || user.username}</span>
              </span>
            )}
            <button type="button" className="vi-btn vi-btn-ghost" style={{ fontSize: 13 }} onClick={doLogout}>{t('logout')}</button>
          </div>
        </div>
      </header>

      <main style={{ flex: 1, width: '100%', maxWidth: 1180, margin: '0 auto', padding: '26px 20px 60px' }}>
        <Outlet />
      </main>
    </div>
  );
}
