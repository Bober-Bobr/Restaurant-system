import { useMutation, useQuery } from '@tanstack/react-query';
import { Link, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { authService } from '../services/auth.service';
import { restaurantService } from '../services/restaurant.service';
import { useAuthStore } from '../store/auth.store';
import { useAdminStore } from '../store/admin.store';
import { Locale, locales, translate } from '../utils/translate';
import { getPhotoUrl } from '../utils/photoUrl';
import networkingLogoSrc from '../assets/networking-logo.png';

const LOCALE_LABELS: Record<Locale, string> = { en: 'EN', ru: 'RU', uz: 'UZ' };

export const EmployeeLayout = () => {
  const navigate = useNavigate();
  const accessToken = useAuthStore((state) => state.accessToken);
  const username = useAuthStore((state) => state.username);
  const role = useAuthStore((state) => state.role);
  const authRestaurantId = useAuthStore((state) => state.restaurantId);
  const logout = useAuthStore((state) => state.logout);
  const { locale, setLocale } = useAdminStore();
  const t = (key: Parameters<typeof translate>[0]) => translate(key, locale);
  const location = useLocation();

  const { data: restaurants = [] } = useQuery({
    queryKey: ['restaurants'],
    queryFn: () => restaurantService.list(),
    enabled: !!accessToken,
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
    },
  });

  if (!accessToken) return <Navigate to="/login" replace />;
  if (role !== 'EMPLOYEE' && role !== 'KITCHEN') { navigate('/', { replace: true }); return null; }

  const isActive = (path: string) => path === '/' ? location.pathname === '/' : location.pathname.startsWith(path);
  const roleColor = role === 'KITCHEN' ? { bg: 'rgba(234,88,12,0.18)', fg: '#fb923c', border: 'rgba(234,88,12,0.35)' } : { bg: 'rgba(22,163,74,0.18)', fg: '#4ade80', border: 'rgba(22,163,74,0.35)' };

  return (
    <div className="adm-bg">
      <nav style={{
        position: 'sticky', top: 0, zIndex: 30,
        background: 'rgba(15,23,42,0.78)',
        backdropFilter: 'blur(18px)',
        WebkitBackdropFilter: 'blur(18px)',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
      }}>
        <div className="emp-nav-row" style={{ maxWidth: 1280, margin: '0 auto', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 16 }}>

          {/* Brand */}
          <div className="adm-slide-in-left emp-nav-brand" style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
            <img
              src={restaurantLogoSrc ?? networkingLogoSrc}
              alt={restaurantName ?? 'Logo'}
              style={{ height: 40, width: 'auto', objectFit: 'contain', flexShrink: 0 }}
            />
            <div style={{ minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#f8fafc', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {restaurantName ?? t('banquet_admin')}
              </p>
              <p style={{ margin: '2px 0 0', fontSize: 11, color: 'rgba(226,232,240,0.55)', display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap', overflow: 'hidden' }}>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{username}</span>
                <span className="adm-badge" style={{ background: roleColor.bg, color: roleColor.fg, border: `1px solid ${roleColor.border}`, flexShrink: 0 }}>
                  {t(role === 'KITCHEN' ? 'kitchen_role' : 'employee_role')}
                </span>
              </p>
            </div>
          </div>

          {/* Nav links */}
          <div className="emp-nav-links" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Link
              to="/"
              style={{
                padding: '7px 13px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                textDecoration: 'none', whiteSpace: 'nowrap',
                color: isActive('/') ? '#c9a42c' : 'rgba(226,232,240,0.7)',
                background: isActive('/') ? 'rgba(201,164,44,0.12)' : 'transparent',
                border: isActive('/') ? '1px solid rgba(201,164,44,0.35)' : '1px solid transparent',
                transition: 'all 0.18s',
              }}
            >
              {t('events')}
            </Link>
            {role !== 'KITCHEN' && (
              <Link
                to={`/tablet?restaurantId=${tabletRestaurantId}`}
                style={{
                  padding: '7px 14px', borderRadius: 8, fontSize: 13, fontWeight: 700,
                  textDecoration: 'none', color: '#c9a42c', whiteSpace: 'nowrap',
                  background: 'rgba(201,164,44,0.1)', border: '1px solid rgba(201,164,44,0.4)',
                  transition: 'all 0.18s',
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
            )}
          </div>

          {/* Right side */}
          <div className="adm-slide-in-right emp-nav-right" style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto' }}>
            <div className="emp-nav-locale" style={{ display: 'flex', gap: 4 }}>
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
              className="adm-btn-danger emp-nav-logout"
              onClick={() => logoutMutation.mutate()}
              disabled={logoutMutation.isPending}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
              aria-label={t('logout')}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              <span className="emp-nav-logout-label">{logoutMutation.isPending ? t('logging_out') : t('logout')}</span>
            </button>
          </div>
        </div>
      </nav>

      <div style={{ position: 'relative', zIndex: 1 }}>
        <Outlet />
      </div>

      <style>{`
        @media (max-width: 720px) {
          .emp-nav-row { flex-wrap: wrap; row-gap: 10px; padding: 10px 14px !important; }
          .emp-nav-brand { flex: 1 1 auto; min-width: 0; }
          .emp-nav-links { order: 3; width: 100%; justify-content: center; }
          .emp-nav-links a { flex: 1; justify-content: center; text-align: center; }
          .emp-nav-right { margin-left: 0 !important; }
          .emp-nav-locale { gap: 2px !important; }
          .emp-nav-locale button { padding: 4px 7px !important; font-size: 10px !important; }
          .emp-nav-logout-label { display: none !important; }
          .emp-nav-logout { padding: 7px 9px !important; }
        }
      `}</style>
    </div>
  );
};
