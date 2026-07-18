import { useMutation, useQuery } from '@tanstack/react-query';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { authService } from '../services/auth.service';
import { invitationService } from '../services/invitation.service';
import { useAuthStore } from '../store/auth.store';
import { useAdminStore } from '../store/admin.store';
import { translate, locales, type Locale } from '../utils/translate';

const LOCALE_LABELS: Record<Locale, string> = { en: 'EN', ru: 'RU', uz: 'UZ' };
import { getPhotoUrl } from '../utils/photoUrl';
import { buildAbsoluteUrl, buildSubdomainBase } from '../utils/subdomain';
import { flyerCoverUrl } from '../blocks/cover';
import networkingLogoSrc from '../assets/networking-logo.png';

export function ManagerNav({ pageTitle, currentRestaurantName, locale }: {
  pageTitle?: string;
  currentRestaurantName?: string | null;
  locale: Locale;
}) {
  const t = (k: Parameters<typeof translate>[0]) => translate(k, locale);
  const username = useAuthStore((s) => s.username);
  const { setLocale } = useAdminStore();
  const logoutMutation = useMutation({
    mutationFn: () => authService.logout(),
    onSettled: () => {
      // Clear persisted auth WITHOUT calling the store action: calling logout()
      // re-renders App, the manager guard returns null (white screen) and races
      // the cross-origin redirect. Clearing storage directly avoids the re-render.
      try { localStorage.removeItem('banquet-admin-auth'); } catch { /* ignore */ }
      window.location.replace(buildAbsoluteUrl('/login'));
    },
  });

  return (
    <nav style={{
      position: 'sticky', top: 0, zIndex: 30,
      background: 'rgba(15,23,42,0.78)',
      backdropFilter: 'blur(18px)',
      WebkitBackdropFilter: 'blur(18px)',
      borderBottom: '1px solid rgba(255,255,255,0.08)',
    }}>
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 12, textDecoration: 'none' }}>
          <img src={networkingLogoSrc} alt="" style={{ height: 40, width: 'auto' }} />
          <div>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#f8fafc' }}>
              {pageTitle ?? t('manager_portal')}
            </p>
            <p style={{ margin: '2px 0 0', fontSize: 11, color: 'rgba(226,232,240,0.55)', display: 'flex', alignItems: 'center', gap: 6 }}>
              {username}
              <span className="adm-badge" style={{ background: 'rgba(139,92,246,0.18)', color: '#c4b5fd', border: '1px solid rgba(139,92,246,0.3)' }}>
                {t('manager_role')}
              </span>
            </p>
          </div>
        </Link>
        {currentRestaurantName && (
          <span className="adm-badge" style={{ background: 'rgba(201,164,44,0.15)', color: '#c9a42c', border: '1px solid rgba(201,164,44,0.3)' }}>
            {currentRestaurantName}
          </span>
        )}
        <Link
          to="/info"
          style={{
            marginLeft: 'auto',
            padding: '7px 13px', borderRadius: 8, fontSize: 13, fontWeight: 600,
            textDecoration: 'none', whiteSpace: 'nowrap',
            color: '#c9a42c', background: 'rgba(201,164,44,0.1)',
            border: '1px solid rgba(201,164,44,0.35)',
          }}
        >
          {t('my_restaurants')}
        </Link>
        <Link
          to="/devices"
          style={{
            padding: '7px 13px', borderRadius: 8, fontSize: 13, fontWeight: 600,
            textDecoration: 'none', whiteSpace: 'nowrap',
            color: '#c9a42c', background: 'rgba(201,164,44,0.1)',
            border: '1px solid rgba(201,164,44,0.35)',
          }}
        >
          {t('devices')}
        </Link>
        <div style={{ display: 'flex', gap: 4 }}>
          {locales.map((loc) => (
            <button
              key={loc}
              type="button"
              onClick={() => setLocale(loc)}
              style={{
                padding: '5px 10px', border: '1px solid', borderRadius: 6, cursor: 'pointer',
                fontSize: 11, letterSpacing: '0.06em', transition: 'all 0.18s',
                borderColor: locale === loc ? 'rgba(201,164,44,0.5)' : 'rgba(255,255,255,0.1)',
                background: locale === loc ? 'rgba(201,164,44,0.15)' : 'transparent',
                color: locale === loc ? '#c9a42c' : 'rgba(226,232,240,0.6)',
                fontWeight: locale === loc ? 700 : 500,
              }}
            >
              {LOCALE_LABELS[loc]}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="adm-btn-danger"
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
      </div>
    </nav>
  );
}

// Top-level switch between the two designer sections: Flyers and Invitations.
export function ManagerTabs({ active, locale }: { active: 'flyers' | 'invitations'; locale: Locale }) {
  const t = (k: Parameters<typeof translate>[0]) => translate(k, locale);
  const navigate = useNavigate();
  const tab = (key: 'flyers' | 'invitations', label: string, to: string) => {
    const on = active === key;
    return (
      <button
        type="button"
        onClick={() => navigate(to)}
        style={{
          padding: '8px 18px', borderRadius: 10, fontSize: 13, fontWeight: 700,
          cursor: 'pointer', border: '1px solid',
          borderColor: on ? 'rgba(201,164,44,0.5)' : 'rgba(255,255,255,0.1)',
          background: on ? 'rgba(201,164,44,0.15)' : 'rgba(255,255,255,0.04)',
          color: on ? '#c9a42c' : 'rgba(226,232,240,0.65)',
        }}
      >
        {label}
      </button>
    );
  };
  return (
    <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
      {tab('flyers', t('flyers'), '/')}
      {tab('invitations', t('invitations'), '/invitations')}
    </div>
  );
}

// ── /  (flyer project gallery, Taplink-style) ─────────────────────────────
// Flyers are standalone projects: each card shows the cover image, the project
// name (slug) and its public link. Restaurants are no longer part of this flow.

export const ManagerPortalPage = () => {
  const role = useAuthStore((s) => s.role);
  const accessToken = useAuthStore((s) => s.accessToken);
  const { locale } = useAdminStore();
  const t = (k: Parameters<typeof translate>[0]) => translate(k, locale);
  const navigate = useNavigate();

  const flyersQuery = useQuery({
    queryKey: ['manager-my-flyers'],
    queryFn: () => invitationService.listMine(),
    enabled: !!accessToken,
  });

  if (!accessToken) return <Navigate to="/login" replace />;
  if (role !== 'MANAGER' && role !== 'CHIEF_ADMIN') return <Navigate to="/login" replace />;

  const flyers = flyersQuery.data ?? [];
  // Path-based flyer link: event.v-menu.uz/<slug>
  const linkText = (slug: string) => buildSubdomainBase('event', `/${slug}`).replace(/^https:\/\//, '');

  return (
    <div className="adm-bg">
      <ManagerNav locale={locale} />
      <main className="tablet-fade-in" style={{ maxWidth: 1180, margin: '0 auto', padding: '28px 20px', position: 'relative', zIndex: 1 }}>
        <ManagerTabs active="flyers" locale={locale} />
        <h1 className="adm-title" style={{ marginBottom: 20 }}>{t('my_flyers')}</h1>

        {flyersQuery.isLoading && <p style={{ color: 'rgba(226,232,240,0.5)' }}>...</p>}

        <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))' }}>
          {/* New project card */}
          <button
            type="button"
            onClick={() => navigate('/flyers/new')}
            className="adm-card adm-card-hover tablet-fade-up"
            style={{
              minHeight: 280, cursor: 'pointer', color: '#e2e8f0',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12,
            }}
          >
            <span style={{
              width: 64, height: 64, borderRadius: '50%', background: 'rgba(255,255,255,0.07)',
              border: '1px solid rgba(255,255,255,0.14)', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 30, fontWeight: 300, color: '#f8fafc',
            }}>+</span>
            <span style={{ fontSize: 13, fontWeight: 600 }}>{t('new_flyer')}</span>
          </button>

          {flyers.map((f) => {
            const cover = flyerCoverUrl(f);
            const coverSrc = cover ? (getPhotoUrl(cover) ?? cover) : null;
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => navigate(`/flyers/${f.id}`)}
                className="adm-card adm-card-hover tablet-fade-up"
                style={{ padding: 0, overflow: 'hidden', cursor: 'pointer', color: '#e2e8f0', textAlign: 'left', display: 'flex', flexDirection: 'column' }}
              >
                {/* Cover */}
                <div style={{
                  height: 210, position: 'relative', flexShrink: 0,
                  background: coverSrc
                    ? `url(${coverSrc}) top center / cover`
                    : `linear-gradient(160deg, ${f.accentColor || '#c9a42c'}22 0%, rgba(15,23,42,0.9) 100%)`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {!coverSrc && (
                    <span style={{ fontSize: 40, fontWeight: 700, color: f.accentColor || '#c9a42c', opacity: 0.8 }}>
                      {f.slug.charAt(0).toUpperCase()}
                    </span>
                  )}
                  {!f.isPublished && (
                    <span className="adm-badge" style={{ position: 'absolute', top: 8, left: 8, background: 'rgba(15,23,42,0.85)', color: 'rgba(226,232,240,0.8)', border: '1px solid rgba(148,163,184,0.35)' }}>
                      {t('unpublished')}
                    </span>
                  )}
                </div>
                {/* Name + link */}
                <div style={{ padding: '10px 12px 12px', borderTop: '1px solid rgba(255,255,255,0.07)' }}>
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#f8fafc', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.slug}</p>
                  <p style={{ margin: '4px 0 0', fontSize: 11, color: '#c9a42c', display: 'flex', alignItems: 'center', gap: 5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    <span style={{ opacity: 0.7 }}>{f.isPublished ? '★' : '☆'}</span>
                    {linkText(f.slug)}
                  </p>
                </div>
              </button>
            );
          })}
        </div>

        {!flyersQuery.isLoading && flyers.length === 0 && (
          <p style={{ color: 'rgba(226,232,240,0.5)', marginTop: 16 }}>{t('no_flyers_yet')}</p>
        )}
      </main>
    </div>
  );
};
