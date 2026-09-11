import { Suspense, lazy, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { NavLink, Navigate, Outlet, Route, Routes, useNavigate, useLocation } from 'react-router-dom';
import type { Locale } from '../utils/translate';
import { useVInviteStore } from './store';
import { useViT } from './i18n';
import { vinviteService } from './api';
import { ViLoginPage } from './LoginPage';
import { ViLandingPage } from './LandingPage';
import './vinvite.css';

// ── v-invite.uz application shell ─────────────────────────────────────────────
// A separate product from v-menu: its own users, cream/blue shadcn-style look,
// light/dark theme, and the shared block designer for building invitations.
// Served from public/ rather than imported, so the sandboxed template iframe can
// load the same file by absolute URL (see RichRenderer's __ORIGIN__).
export const VI_LOGO = '/v-invite-logo.png';
export const VI_MARK = '/v-invite-mark.png';


// ── Code splitting ───────────────────────────────────────────────────────────
// Everything below is a separate chunk, because this shell is shared by three
// audiences who need almost nothing in common:
//
//   · a logged-out visitor reading the marketing page at /main
//   · a guest opening a published invitation at /<slug>
//   · a signed-in administrator
//
// Statically imported, the builder and the published page put the whole
// template registry — all twelve designs' markup, 374 kB gzipped — into the
// graph of every one of those. The marketing page was measured downloading it
// in order to draw a list of names.
//
// The published invitation pays one extra round trip for this, and that is the
// deliberate half of the trade: it is the load that matters most, but the chunk
// it waits on is several hundred kB, so one RTT against it is small — and it is
// the only page that actually needs the registry.
const PublicVInvitePage = lazy(() => import('./PublicVInvitePage').then((m) => ({ default: m.PublicVInvitePage })));
const ViSettingsPage = lazy(() => import('./SettingsPage').then((m) => ({ default: m.ViSettingsPage })));
const ViDashboardPage = lazy(() => import('./DashboardPage').then((m) => ({ default: m.ViDashboardPage })));
const ViEditorPage = lazy(() => import('./EditorPage').then((m) => ({ default: m.ViEditorPage })));
const ViTemplatesPage = lazy(() => import('./TemplatesPage').then((m) => ({ default: m.ViTemplatesPage })));
const ViTemplateDesignerPage = lazy(() => import('./TemplateDesignerPage').then((m) => ({ default: m.ViTemplateDesignerPage })));
const ViDevicesPage = lazy(() => import('./DevicesPage').then((m) => ({ default: m.ViDevicesPage })));
const ViProfilePage = lazy(() => import('./ProfilePage').then((m) => ({ default: m.ViProfilePage })));
const ViNotificationsPage = lazy(() => import('./NotificationsPage').then((m) => ({ default: m.ViNotificationsPage })));

/* Blank, not a spinner: each of these paints its own background within a frame
   or two, and a spinner that flashes for 40 ms is noise. */
const Chunk = ({ children }: { children: React.ReactNode }) => (
  <Suspense fallback={null}>{children}</Suspense>
);

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
        {/* The promotional site lives at /main. Outside the auth branches on
            purpose: it is a public marketing page, and a signed-in admin has
            every reason to open it to check how it looks. Declared BEFORE the
            /:slug route below — a static segment outranks a dynamic one in
            React Router, and `main` is reserved so no invitation can claim it. */}
        <Route path="/main" element={<ViLandingPage />} />
        {/* Pricing used to be a page of its own. It is now a section of the
            landing page, so this route only forwards — links to it have been
            shared and printed, and a bookmark that 404s is worse than a
            redirect that lands one scroll away. `?template=` is carried across
            because the landing page still reads it. `pricing` stays a reserved
            slug either way, so no invitation can claim it. */}
        <Route path="/pricing" element={<PricingRedirect />} />
        {/* Published invitation: v-invite.uz/<slug> (path-based — no wildcard
            DNS available on .uz). Static app routes above/below always win over
            this dynamic segment. */}
        <Route path="/:slug" element={<Chunk><PublicVInvitePage /></Chunk>} />
        {accessToken ? (
          <>
            {/* The editor is full-bleed (its own top bar), outside the tabbed layout. */}
            <Route path="/projects/:id" element={<Chunk><ViEditorPage /></Chunk>} />
            <Route path="/template-designer/:templateId" element={<Chunk><ViTemplateDesignerPage /></Chunk>} />
            <Route element={<ViLayout />}>
              <Route path="/" element={<Chunk><ViDashboardPage /></Chunk>} />
              <Route path="/templates" element={<Chunk><ViTemplatesPage /></Chunk>} />
              <Route path="/notifications" element={<Chunk><ViNotificationsPage /></Chunk>} />
              <Route path="/devices" element={<Chunk><ViDevicesPage /></Chunk>} />
              <Route path="/profile" element={<Chunk><ViProfilePage /></Chunk>} />
              <Route path="/settings" element={<Chunk><ViSettingsPage /></Chunk>} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </>
        ) : (
          <>
            {/* v-invite.uz itself is the sign-in page; the marketing site is at
                /main. Everything else a logged-out visitor asks for bounces to
                sign-in, as before. */}
            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route path="*" element={<Navigate to="/login" replace />} />
          </>
        )}
      </Routes>
    </div>
  );
};

/** `/pricing?template=x` → `/main?template=x#pricing`, preserving the choice. */
function PricingRedirect() {
  const { search } = useLocation();
  return <Navigate to={`/main${search}#pricing`} replace />;
}

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
// The icon is drawn, not an emoji. An emoji glyph carries its own font metrics,
// which differ per platform — inside a fixed-height button with `overflow:
// hidden` (inherited from .vi-btn, which needs it for the primary sheen) that
// pushed the glyph above its box and clipped the top off. An SVG sits exactly
// where it is put, on every device.
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
      aria-label={dark ? t('theme_light') : t('theme_dark')}
      onClick={() => setUiTheme(dark ? 'light' : 'dark')}
    >
      <span className="vi-theme-icon" aria-hidden>
        {dark ? (
          <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor"
            strokeWidth="1.9" strokeLinecap="round">
            <circle cx="12" cy="12" r="4.2" />
            <path d="M12 2.6v2.2M12 19.2v2.2M2.6 12h2.2M19.2 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M18.7 5.3l-1.6 1.6M6.9 17.1l-1.6 1.6" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor"
            strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20.5 14.6A8.6 8.6 0 1 1 9.4 3.5a6.9 6.9 0 0 0 11.1 11.1Z" />
          </svg>
        )}
      </span>
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
    ...(isSystemAdmin ? [{ to: '/settings', label: t('settings'), icon: '⚙️' }] : []),
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
        {/* Row 1 — brand + account controls. The tabs get their own row below
            so a long nav can never crowd the language/theme/avatar cluster. */}
        <div className="vi-headbar">
          <NavLink to="/" style={{ textDecoration: 'none', color: 'inherit', flexShrink: 0 }}><ViLogo /></NavLink>

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

        {/* Row 2 — navigation. Scrolls sideways rather than wrapping. */}
        <div className="vi-navbar">
          <nav className="vi-tabs">
            {tabs.map((tab) => (
              <NavLink key={tab.to} to={tab.to} end={tab.end} className={({ isActive }) => `vi-tab${isActive ? ' active' : ''}`}>
                <span>{tab.icon}</span>{tab.label}
                {!!tab.badge && <span className="vi-tab-badge">{tab.badge}</span>}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>

      <main style={{ flex: 1, width: '100%', maxWidth: 1180, margin: '0 auto', padding: '26px 20px 60px' }}>
        <Outlet />
      </main>
    </div>
  );
}
