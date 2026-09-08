import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, Navigate, Outlet, useLocation } from 'react-router-dom';
import { authService } from '../services/auth.service';
import { eventService } from '../services/event.service';
import { restaurantService } from '../services/restaurant.service';
import { overdueDebtEvents } from '../utils/invoice';
import { useAuthStore } from '../store/auth.store';
import { useAdminStore } from '../store/admin.store';
import { Locale, locales, translate } from '../utils/translate';
import { getPhotoUrl } from '../utils/photoUrl';
import { PLATFORM_TITLE } from '../utils/appTitle';
import { buildAbsoluteUrl } from '../utils/subdomain';
import networkingLogoSrc from '../assets/networking-logo.png';

/**
 * The Small Banquets section's shell — supervisor.v-menu.uz/<slug>.
 *
 * It wraps the SAME pages the banquet admin app does, which is the requirement:
 * identical capabilities over separate data. So this is a shell, not a fork —
 * the pages beneath it are byte-identical to the banquet ones and every list
 * they show is confined to this section by the server, from the caller's role.
 *
 * What differs is the look, and it differs in two ways that between them avoid
 * duplicating any page:
 *
 *   1. `.svr-theme` on the root redeclares every `--adm-*` token and restates
 *      the shared primitives (see index.css) — jade on forest, squared corners,
 *      a rail down the leading edge of a card. That reaches all ~40 pages at
 *      once, exactly as `.cadm-theme` does for food service.
 *   2. This file gives the section its own chrome: a vertical rail of sections
 *      rather than the banquet app's horizontal tab bar with an overflow menu.
 *
 * The navigation is deliberately a SIDEBAR. The banquet bar had run out of room
 * — seven of its tabs live behind a "⋯" — and copying that shape would have made
 * the two apps look like the same screen with different colours, which is the
 * one thing this section was not supposed to be.
 */

const LOCALE_LABELS: Record<Locale, string> = { en: 'EN', ru: 'RU', uz: 'UZ' };

const RAIL_WIDTH = 232;

export const SupervisorLayout = () => {
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
    enabled: !!accessToken,
  });

  // Overdue-debt notifications for the bell. `['events']` is this section's
  // events and nothing else — the server scopes the list by the caller's role —
  // so the badge counts small-banquet debts only, which is what a supervisor
  // can actually act on.
  const { data: bellEvents = [] } = useQuery({
    queryKey: ['events'],
    queryFn: () => eventService.list(),
    enabled: !!accessToken,
    refetchInterval: 60_000,
  });
  const overdueCount = overdueDebtEvents(bellEvents).length;

  const effectiveLogoUrl = restaurants[0]?.logoUrl ?? restaurants[0]?.company?.logoUrl ?? null;
  const restaurantLogoSrc = getPhotoUrl(effectiveLogoUrl);
  const restaurantName = restaurants[0]?.name;
  const tabletRestaurantId = authRestaurantId ?? restaurants[0]?.id ?? '';

  const logoutMutation = useMutation({
    mutationFn: () => authService.logout(),
    onSettled: () => {
      logout();
      window.location.href = buildAbsoluteUrl('/login');
    },
  });

  if (!accessToken) return <Navigate to="/login" replace />;
  // Only a supervisor belongs on this host. Anyone else signed in is sent to the
  // root domain, which routes them to their own app.
  if (role !== 'SUPERVISOR') { window.location.href = buildAbsoluteUrl('/login'); return null; }

  // Grouped rather than flat: the rail has the vertical room the banquet tab bar
  // did not, so nothing needs an overflow menu and every page is one click away.
  const navGroups: { label: string; items: { to: string; label: string }[] }[] = [
    {
      label: t('nav_group_bookings'),
      items: [
        { to: '/', label: t('events') },
        { to: '/calendar', label: t('calendar') },
        { to: '/admin/invoices', label: t('invoices') },
        { to: '/admin/notifications', label: t('notifications') },
      ],
    },
    {
      label: t('nav_group_menu'),
      items: [
        { to: '/admin/menu', label: t('menu') },
        { to: '/admin/subcategories', label: t('subcategories') },
        { to: '/admin/additional', label: t('additional') },
        { to: '/admin/arrangement', label: t('arrangement') },
        { to: '/admin/photos', label: t('photos') },
      ],
    },
    {
      label: t('nav_group_venue'),
      items: [
        { to: '/admin/table-categories', label: t('tables') },
        { to: '/admin/halls', label: t('halls') },
        { to: '/admin/extra-services', label: t('extra_services') },
      ],
    },
    {
      label: t('nav_group_system'),
      items: [
        { to: '/admin/settings', label: t('settings') },
        { to: '/devices', label: t('devices') },
      ],
    },
  ];

  const isActive = (path: string) => (path === '/' ? location.pathname === '/' : location.pathname.startsWith(path));

  const railLinkStyle = (active: boolean): React.CSSProperties => ({
    display: 'block',
    padding: '8px 12px',
    borderRadius: 3,
    fontSize: 13,
    fontWeight: active ? 700 : 500,
    textDecoration: 'none',
    letterSpacing: '0.01em',
    color: active ? 'var(--adm-accent)' : 'rgba(var(--adm-text-rgb),0.72)',
    background: active ? 'rgba(var(--adm-accent-rgb),0.1)' : 'transparent',
    borderLeft: `2px solid ${active ? 'var(--adm-accent)' : 'transparent'}`,
    transition: 'all 0.16s',
  });

  const rail = (onNavigate?: () => void) => (
    <>
      {navGroups.map((group) => (
        <div key={group.label} style={{ marginBottom: 16 }}>
          <p style={{
            margin: '0 0 5px 12px', fontSize: 10, fontWeight: 700,
            letterSpacing: '0.14em', textTransform: 'uppercase',
            color: 'rgba(var(--adm-text-rgb),0.34)',
          }}>
            {group.label}
          </p>
          {group.items.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              onClick={onNavigate}
              className={`adm-nav-item${isActive(item.to) ? ' is-active' : ''}`}
              style={railLinkStyle(isActive(item.to))}
            >
              {item.label}
            </Link>
          ))}
        </div>
      ))}
    </>
  );

  return (
    <div className="adm-bg svr-theme" style={{ minHeight: '100vh' }}>
      {/* Masthead. Kept sticky like the banquet one, but it carries only the
          identity and the session controls — the sections live in the rail. */}
      <header className="adm-topbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '12px 20px' }}>
          <button
            type="button"
            onClick={() => setMobileNavOpen((v) => !v)}
            className="svr-nav-toggle"
            aria-label={t('more')}
            style={{
              display: 'none', background: 'transparent',
              border: '1px solid var(--adm-line)', borderRadius: 3,
              padding: 8, color: 'var(--adm-text)', cursor: 'pointer',
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              {mobileNavOpen
                ? (<><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></>)
                : (<><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="18" x2="21" y2="18" /></>)}
            </svg>
          </button>

          <img
            src={restaurantLogoSrc ?? networkingLogoSrc}
            alt={restaurantName ?? 'Logo'}
            style={{ height: 36, width: 'auto', objectFit: 'contain', flexShrink: 0 }}
          />
          <div style={{ minWidth: 0 }}>
            <p style={{
              margin: 0, fontSize: 13, fontWeight: 800, color: 'var(--adm-title)',
              textTransform: 'uppercase', letterSpacing: '0.08em',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>
              {restaurantName ?? PLATFORM_TITLE}
            </p>
            <p style={{ margin: '2px 0 0', fontSize: 11, color: 'rgba(var(--adm-text-rgb),0.5)', display: 'flex', alignItems: 'center', gap: 6 }}>
              {username}
              <span className="adm-badge" style={{
                background: 'rgba(var(--adm-accent-rgb),0.14)',
                color: 'var(--adm-accent)',
                border: '1px solid rgba(var(--adm-accent-rgb),0.32)',
              }}>
                {t('section_small_banquets')}
              </span>
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto' }}>
            <Link
              to={`/tablet?restaurantId=${tabletRestaurantId}`}
              style={{
                padding: '7px 14px', borderRadius: 3, fontSize: 13, fontWeight: 700,
                textDecoration: 'none', color: 'var(--adm-accent-ink)',
                background: 'var(--adm-accent)',
                display: 'inline-flex', alignItems: 'center', gap: 6,
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="14" rx="2" />
                <line x1="8" y1="20" x2="16" y2="20" />
                <line x1="12" y1="18" x2="12" y2="20" />
              </svg>
              {t('tablet')}
            </Link>

            {/* Overdue small-banquet debts only — see the query above. */}
            <Link
              to="/admin/notifications"
              aria-label={t('notifications')}
              title={t('notifications')}
              style={{
                position: 'relative',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                width: 34, height: 34, borderRadius: 3,
                color: isActive('/admin/notifications') ? 'var(--adm-accent)' : 'rgba(var(--adm-text-rgb),0.7)',
                background: 'rgba(var(--adm-surface-rgb),0.7)',
                border: '1px solid var(--adm-line)',
                textDecoration: 'none',
              }}
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
              {overdueCount > 0 && (
                <span style={{
                  position: 'absolute', top: -5, right: -5,
                  minWidth: 17, height: 17, padding: '0 4px', borderRadius: 999,
                  background: '#dc2626', color: '#fff',
                  fontSize: 10, fontWeight: 800, lineHeight: '17px', textAlign: 'center',
                  border: '2px solid rgba(var(--adm-bg-rgb),0.9)', boxSizing: 'content-box',
                }}>
                  {overdueCount > 99 ? '99+' : overdueCount}
                </span>
              )}
            </Link>

            <div className="svr-locale" style={{ display: 'flex', gap: 4 }}>
              {locales.map((loc) => (
                <button
                  key={loc}
                  type="button"
                  onClick={() => setLocale(loc)}
                  style={{
                    padding: '5px 9px', borderRadius: 3,
                    border: `1px solid ${locale === loc ? 'rgba(var(--adm-accent-rgb),0.5)' : 'var(--adm-line)'}`,
                    background: locale === loc ? 'rgba(var(--adm-accent-rgb),0.14)' : 'transparent',
                    color: locale === loc ? 'var(--adm-accent)' : 'rgba(var(--adm-text-rgb),0.6)',
                    fontWeight: locale === loc ? 700 : 500,
                    cursor: 'pointer', fontSize: 11, letterSpacing: '0.06em',
                  }}
                >
                  {LOCALE_LABELS[loc]}
                </button>
              ))}
            </div>

            <button
              type="button"
              className="adm-btn-danger svr-logout"
              onClick={() => logoutMutation.mutate()}
              disabled={logoutMutation.isPending}
            >
              {logoutMutation.isPending ? t('logging_out') : t('logout')}
            </button>
          </div>
        </div>
      </header>

      <div style={{ display: 'flex', alignItems: 'flex-start' }}>
        {/* The rail. `position: sticky` works here because `.adm-bg` clips on the
            X axis only — making it a scroll container would pin this to the
            bottom of the page instead of the viewport. */}
        <nav
          className="svr-rail"
          style={{
            width: RAIL_WIDTH, flexShrink: 0,
            position: 'sticky', top: 68, alignSelf: 'flex-start',
            maxHeight: 'calc(100vh - 68px)', overflowY: 'auto',
            padding: '18px 10px 24px',
            borderRight: '1px solid var(--adm-line)',
          }}
        >
          {rail()}
        </nav>

        {/* Keyed on the path so the entrance animation replays on navigation —
            without the key the element persists and it would run once. */}
        <main key={location.pathname} className="adm-page-in" style={{ flex: 1, minWidth: 0, position: 'relative', zIndex: 1 }}>
          <Outlet />
        </main>
      </div>

      {/* Mobile: the same rail in a drawer. */}
      {mobileNavOpen && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 29, background: 'rgba(0,0,0,0.55)' }}
          onClick={() => setMobileNavOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'absolute', top: 0, left: 0,
              width: 264, maxWidth: '85vw', height: '100%',
              background: 'rgba(var(--adm-bg-rgb),0.98)',
              backdropFilter: 'blur(18px)',
              WebkitBackdropFilter: 'blur(18px)',
              borderRight: '1px solid var(--adm-line)',
              padding: '72px 12px 24px',
              overflowY: 'auto',
            }}
          >
            {rail(() => setMobileNavOpen(false))}
            <button
              type="button"
              className="adm-btn-danger"
              onClick={() => { setMobileNavOpen(false); logoutMutation.mutate(); }}
              disabled={logoutMutation.isPending}
              style={{ width: '100%', marginTop: 8, padding: '10px 14px' }}
            >
              {logoutMutation.isPending ? t('logging_out') : t('logout')}
            </button>
          </div>
        </div>
      )}

      <style>{`
        @media (max-width: 1000px) {
          .svr-rail { display: none !important; }
          .svr-nav-toggle { display: inline-flex !important; align-items: center; justify-content: center; }
          .svr-locale, .svr-logout { display: none !important; }
        }
      `}</style>
    </div>
  );
};
