import { useMutation, useQuery } from '@tanstack/react-query';
import { Link, Navigate, Outlet, useLocation } from 'react-router-dom';
import { authService } from '../services/auth.service';
import { publicRestaurantService } from '../services/publicRestaurant.service';
import { getPhotoUrl } from '../utils/photoUrl';
import { orderService } from '../services/order.service';
import { useLiveQuery } from '../services/live';
import { useAuthStore } from '../store/auth.store';
import { useAdminStore } from '../store/admin.store';
import { locales, translate, type Locale, type TranslationKey } from '../utils/translate';
import { buildAbsoluteUrl } from '../utils/subdomain';
import { useWorkArea } from '../utils/useWorkArea';
import { WORK_AREAS, type WorkArea } from '../utils/workArea';

/** The label for each floor, and the class its look is scoped on. */
const AREA_LABEL: Record<WorkArea, TranslationKey> = {
  DINING: 'wa_dining',
  SMALL_BANQUET: 'wa_small_banquet',
};

/**
 * The Small Banquets floor's dark-green scope — see `.sb-floor` in index.css.
 *
 * The dining floor keeps `.cadm-theme`, the monochrome food-service look. They
 * are mutually exclusive on purpose: a waiter who cannot tell which stream
 * they are looking at will acknowledge a call that cannot exist.
 */
export const SB_FLOOR_CLASS = 'sb-floor';

const LOCALE_LABELS: Record<Locale, string> = { en: 'EN', ru: 'RU', uz: 'UZ' };

// ── The food-employee workspace ─────────────────────────────────────────────
// Lives on food-admin.v-menu.uz/<slug> beside the Food Admin, so it needed no
// new host, DNS record or certificate. Two tabs and nothing else: this is a
// phone held by someone crossing a dining room.
export const FoodEmployeeLayout = () => {
  const accessToken = useAuthStore((s) => s.accessToken);
  const username = useAuthStore((s) => s.username);
  const restaurantId = useAuthStore((s) => s.restaurantId);
  const logout = useAuthStore((s) => s.logout);
  const { locale, setLocale } = useAdminStore();
  const t = (key: TranslationKey) => translate(key, locale);
  const location = useLocation();
  // Which floor this person is working, from the server — see useWorkArea.
  const { area, surface, canSwitch, switchTo, switching } = useWorkArea();

  // The one number they must not miss: guests waiting on them right now.
  // Only on the floor that has guest calls at all. In Small Banquets the host
  // ordered through the supervisor and there is no guest device to call from,
  // so this would be a number that is always zero, polled every five seconds.
  const alerts = useLiveQuery<number>('waiterAlerts', {
    queryKey: ['wt-alerts'],
    queryFn: () => orderService.alertCount(),
    enabled: !!accessToken && surface.waiterCalls,
  });
  const calling = alerts.data ?? 0;

  // Read through the PUBLIC endpoint rather than /restaurants: a Food Employee
  // has no rights on the admin restaurant routes, and this returns exactly the
  // two fields the header needs.
  const { data: restaurant } = useQuery({
    queryKey: ['fe-restaurant', restaurantId],
    queryFn: () => publicRestaurantService.get(restaurantId!),
    enabled: !!restaurantId,
    staleTime: 10 * 60_000,
  });
  const logoSrc = restaurant?.logoUrl ? getPhotoUrl(restaurant.logoUrl) : null;

  const logoutMutation = useMutation({
    mutationFn: () => authService.logout(),
    onSettled: () => {
      logout();
      window.location.href = buildAbsoluteUrl('/login');
    },
  });

  if (!accessToken) return <Navigate to="/login" replace />;

  const nav: { to: string; label: string; badge?: number }[] = [
    { to: '/orders', label: t('fe_orders'), badge: calling },
    { to: '/stats', label: t('fe_statistics') },
  ];

  return (
    <div className={`adm-bg ${area === 'SMALL_BANQUET' ? SB_FLOOR_CLASS : 'cadm-theme'}`} style={{ minHeight: '100vh' }}>
      <header style={{
        position: 'sticky', top: 0, zIndex: 30,
        background: 'var(--sbf-header, rgba(10,10,10,0.92))', backdropFilter: 'blur(14px)',
        borderBottom: '1px solid rgba(255,255,255,0.12)',
      }}>
        <div style={{
          maxWidth: 760, margin: '0 auto', padding: '10px 14px',
          display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
        }}>
          {/* Restaurant identity first, then who is signed in — the logo tells a
              employee at a glance that they are on the right venue's floor. */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0 }}>
            {logoSrc && (
              <img src={logoSrc} alt="" style={{
                height: 32, width: 32, flexShrink: 0, objectFit: 'contain',
                borderRadius: 7, background: 'rgba(255,255,255,0.06)',
              }} />
            )}
            <div style={{ display: 'grid', minWidth: 0 }}>
              <strong style={{
                fontSize: 14, letterSpacing: '-0.01em', lineHeight: 1.2,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {restaurant?.name ?? username}
              </strong>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', lineHeight: 1.3 }}>
                {t('food_employee_role')} · {username}
              </span>
            </div>
          </div>

          {/* WHICH FLOOR. First in the row after the venue, because it decides
              what every other thing on the screen means — and it carries the
              current one as a pressed state rather than only offering the
              other, so a glance answers "where am I?" as well as "where can I
              go?". Hidden for roles that work no floor. */}
          {canSwitch && (
            <div style={{ display: 'flex', gap: 3, marginLeft: 'auto' }} role="group" aria-label={t('wa_switch')}>
              {WORK_AREAS.map((option) => (
                <button key={option} type="button" aria-pressed={area === option} disabled={switching}
                  onClick={() => { if (area !== option) switchTo(option); }}
                  style={{
                    padding: '7px 11px', borderRadius: 8, cursor: area === option ? 'default' : 'pointer',
                    fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap',
                    border: '1px solid rgba(255,255,255,0.14)',
                    background: area === option ? 'var(--sbf-tab-on, #fff)' : 'transparent',
                    color: area === option ? 'var(--sbf-tab-ink, #000)' : 'rgba(255,255,255,0.65)',
                  }}>
                  {t(AREA_LABEL[option])}
                </button>
              ))}
            </div>
          )}

          <nav style={{ display: 'flex', gap: 4, marginLeft: canSwitch ? undefined : 'auto' }}>
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
                      padding: '0 5px', borderRadius: 999, background: '#fff', color: '#000',
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
