import { useMutation } from '@tanstack/react-query';
import { Link, Navigate, Outlet, useLocation } from 'react-router-dom';
import { authService } from '../services/auth.service';
import { orderService } from '../services/order.service';
import { useLiveQuery } from '../services/live';
import { useAuthStore } from '../store/auth.store';
import { useAdminStore } from '../store/admin.store';
import { locales, translate, type Locale, type TranslationKey } from '../utils/translate';
import { buildAbsoluteUrl } from '../utils/subdomain';

const LOCALE_LABELS: Record<Locale, string> = { en: 'EN', ru: 'RU', uz: 'UZ' };

// ── The waiter workspace ────────────────────────────────────────────────────
// Lives on food-admin.v-menu.uz/<slug> beside the catering admin, so it needed
// no new host, DNS record or certificate. Two tabs and nothing else: this is a
// phone held by someone crossing a dining room.
export const WaiterLayout = () => {
  const accessToken = useAuthStore((s) => s.accessToken);
  const username = useAuthStore((s) => s.username);
  const logout = useAuthStore((s) => s.logout);
  const { locale, setLocale } = useAdminStore();
  const t = (key: TranslationKey) => translate(key, locale);
  const location = useLocation();

  // The one number a waiter must not miss: guests waiting on them right now.
  const alerts = useLiveQuery<number>('waiterAlerts', {
    queryKey: ['wt-alerts'],
    queryFn: () => orderService.alertCount(),
    enabled: !!accessToken,
  });
  const calling = alerts.data ?? 0;

  const logoutMutation = useMutation({
    mutationFn: () => authService.logout(),
    onSettled: () => {
      logout();
      window.location.href = buildAbsoluteUrl('/login');
    },
  });

  if (!accessToken) return <Navigate to="/login" replace />;

  const nav: { to: string; label: string; badge?: number }[] = [
    { to: '/orders', label: t('wt_orders'), badge: calling },
    { to: '/stats', label: t('wt_statistics') },
  ];

  return (
    <div className="adm-bg cadm-theme" style={{ minHeight: '100vh' }}>
      <header style={{
        position: 'sticky', top: 0, zIndex: 30,
        background: 'rgba(10,10,10,0.92)', backdropFilter: 'blur(14px)',
        borderBottom: '1px solid rgba(255,255,255,0.12)',
      }}>
        <div style={{
          maxWidth: 760, margin: '0 auto', padding: '10px 14px',
          display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
        }}>
          <strong style={{ fontSize: 15, letterSpacing: '-0.01em' }}>{username}</strong>

          <nav style={{ display: 'flex', gap: 4, marginLeft: 'auto' }}>
            {nav.map(({ to, label, badge }) => {
              const active = location.pathname.startsWith(to);
              return (
                <Link key={to} to={to} style={{
                  position: 'relative', padding: '8px 14px', borderRadius: 9,
                  fontSize: 14, fontWeight: 700, textDecoration: 'none', whiteSpace: 'nowrap',
                  color: active ? '#000' : 'rgba(255,255,255,0.72)',
                  background: active ? '#fff' : 'rgba(255,255,255,0.05)',
                }}>
                  {label}
                  {!!badge && badge > 0 && (
                    <span style={{
                      position: 'absolute', top: -4, right: -4, minWidth: 18, height: 18,
                      padding: '0 5px', borderRadius: 999, background: '#f59e0b', color: '#000',
                      fontSize: 11, fontWeight: 800, display: 'inline-flex',
                      alignItems: 'center', justifyContent: 'center',
                    }}>
                      {badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>

          <div style={{ display: 'flex', gap: 3 }}>
            {locales.map((loc) => (
              <button key={loc} type="button" onClick={() => setLocale(loc)}
                style={{
                  padding: '5px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer',
                  border: '1px solid rgba(255,255,255,0.14)',
                  background: locale === loc ? '#fff' : 'transparent',
                  color: locale === loc ? '#000' : 'rgba(255,255,255,0.65)',
                }}>
                {LOCALE_LABELS[loc]}
              </button>
            ))}
          </div>

          <button type="button" className="adm-btn-ghost adm-btn-sm"
            onClick={() => logoutMutation.mutate()}>
            {t('logout')}
          </button>
        </div>
      </header>

      <main style={{ maxWidth: 760, margin: '0 auto', padding: '18px 14px 60px' }}>
        <Outlet />
      </main>
    </div>
  );
};
