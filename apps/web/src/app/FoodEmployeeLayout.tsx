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
  const { area, surface, canSwitch, onAFloor, switchTo, switching } = useWorkArea();

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
      {/* ── The header ──
          Two rows, not one. It was a single flex row carrying the venue, the
          floor, two tabs, three languages and a sign-out button, with 3px
          gaps: on a phone — which is the only device this page runs on — the
          controls ran into each other and several were under 44px, so a
          thumb hit the wrong one. The identity and the session controls share
          the top row; the TABS get a row of their own, full width, because
          they are what gets pressed. */}
      <header className="fef-head">
        <div className="fef-bar">
          {/* The venue first: the logo tells somebody at a glance that they
              are on the right restaurant's floor. */}
          <div className="fef-id">
            {logoSrc && <img src={logoSrc} alt="" className="fef-logo" />}
            <div className="fef-who">
              <strong>{restaurant?.name ?? username}</strong>
              <span>{t('food_employee_role')} · {username}</span>
            </div>
          </div>

          <div className="fef-tools">
            {/* WHICH FLOOR.
                A waiter is TOLD, not asked: the floor is an assignment their
                manager makes (see canSetWorkArea), and serving the wrong
                stream by accident is the whole thing this guards against — so
                the badge is never absent, only sometimes pressable. A manager
                gets the same thing as two buttons with the current one
                pressed, which answers "where am I?" as well as "where can I
                go?". */}
            {onAFloor && (canSwitch ? (
              <div className="fef-area" role="group" aria-label={t('wa_switch')}>
                {WORK_AREAS.map((option) => (
                  <button key={option} type="button" aria-pressed={area === option} disabled={switching}
                    className={`fef-area-btn${area === option ? ' is-on' : ''}`}
                    onClick={() => { if (area !== option) switchTo(option); }}>
                    {t(AREA_LABEL[option])}
                  </button>
                ))}
              </div>
            ) : (
              <span className="fef-area-badge" title={t('wa_assigned')}>
                <i aria-hidden="true" />
                {t(AREA_LABEL[area])}
              </span>
            ))}

            <div className="fef-langs">
              {locales.map((loc) => (
                <button key={loc} type="button" onClick={() => setLocale(loc)}
                  aria-pressed={locale === loc}
                  className={`fef-lang${locale === loc ? ' is-on' : ''}`}>
                  {LOCALE_LABELS[loc]}
                </button>
              ))}
            </div>

            <button type="button" className="fef-out" onClick={() => logoutMutation.mutate()}>
              {t('logout')}
            </button>
          </div>
        </div>

        <nav className="fef-nav">
          {nav.map(({ to, label, badge }) => {
            const active = location.pathname.startsWith(to);
            return (
              <Link key={to} to={to} className={`fef-tab${active ? ' is-on' : ''}`}>
                {label}
                {!!badge && badge > 0 && <span className="fef-badge">{badge}</span>}
              </Link>
            );
          })}
        </nav>
      </header>

      <style>{`
        .fef-head {
          position: sticky; top: 0; z-index: 30;
          background: var(--sbf-header, rgba(10, 10, 10, 0.92));
          backdrop-filter: blur(14px);
          border-bottom: 1px solid rgba(255, 255, 255, 0.12);
        }
        .fef-bar, .fef-nav { max-width: 760px; margin: 0 auto; padding: 0 14px; }
        .fef-bar {
          display: flex; align-items: center; gap: 12px; flex-wrap: wrap;
          padding-top: 10px; padding-bottom: 8px;
        }
        .fef-id { display: flex; align-items: center; gap: 9px; min-width: 0; }
        .fef-logo {
          height: 34px; width: 34px; flex-shrink: 0; object-fit: contain;
          border-radius: 7px; background: rgba(255, 255, 255, 0.06);
        }
        /* min-width: 0 so a long venue name ellipsises instead of pushing the
           controls off the row — .adm-bg CLIPS horizontally, so an overflow
           here is content that silently cannot be reached. */
        .fef-who { display: grid; min-width: 0; }
        .fef-who strong {
          font-size: 14px; line-height: 1.2; letter-spacing: -0.01em;
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .fef-who span { font-size: 11px; line-height: 1.3; color: rgba(255, 255, 255, 0.5); }

        .fef-tools { display: flex; align-items: center; gap: 10px; margin-left: auto; }

        /* Every target here is at least 44px tall, which is the whole point of
           the rebuild: these are pressed with a thumb, in a hurry. */
        .fef-area { display: flex; gap: 6px; }
        .fef-area-btn, .fef-lang, .fef-out, .fef-area-badge {
          min-height: 44px; display: inline-flex; align-items: center; justify-content: center;
          border-radius: 10px; white-space: nowrap;
          border: 1px solid rgba(255, 255, 255, 0.16);
          background: rgba(255, 255, 255, 0.04); color: rgba(255, 255, 255, 0.72);
        }
        .fef-area-btn { padding: 0 13px; font-size: 12.5px; font-weight: 700; cursor: pointer; }
        .fef-area-btn.is-on {
          background: var(--sbf-tab-on, #fff); color: var(--sbf-tab-ink, #000);
          border-color: transparent; cursor: default;
        }
        /* The assigned floor, for somebody who cannot change it. A dot rather
           than a disabled button: a greyed-out control invites a press and
           then refuses it, and this is information, not an action. */
        .fef-area-badge { padding: 0 13px; gap: 7px; font-size: 12.5px; font-weight: 700; }
        .fef-area-badge i {
          width: 8px; height: 8px; border-radius: 999px; flex-shrink: 0;
          background: var(--sbf-tab-on, #fff);
        }
        .fef-langs { display: flex; gap: 6px; }
        .fef-lang { min-width: 44px; padding: 0 10px; font-size: 12px; font-weight: 700; cursor: pointer; }
        .fef-lang.is-on {
          background: var(--sbf-tab-on, #fff); color: var(--sbf-tab-ink, #000); border-color: transparent;
        }
        .fef-out { padding: 0 14px; font-size: 13px; font-weight: 600; cursor: pointer; }

        /* The tabs: their own row, and each one half of it. */
        .fef-nav { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; padding-bottom: 10px; }
        .fef-tab {
          position: relative; min-height: 46px;
          display: inline-flex; align-items: center; justify-content: center;
          border-radius: 11px; font-size: 14.5px; font-weight: 700; text-decoration: none;
          background: rgba(255, 255, 255, 0.05); color: rgba(255, 255, 255, 0.72);
          border: 1px solid rgba(255, 255, 255, 0.1);
        }
        .fef-tab.is-on {
          background: var(--sbf-tab-on, #fff); color: var(--sbf-tab-ink, #000); border-color: transparent;
        }
        .fef-badge {
          position: absolute; top: -5px; right: -5px; min-width: 20px; height: 20px;
          padding: 0 6px; border-radius: 999px;
          background: var(--sbf-tab-on, #fff); color: var(--sbf-tab-ink, #000);
          font-size: 11.5px; font-weight: 800;
          display: inline-flex; align-items: center; justify-content: center;
        }

        /* ── A phone ──
           Below 560px the tools wrap onto their own line and spread across it,
           so nothing is squeezed and nothing has to be aimed at. The venue
           keeps the first line to itself, which is also the line that answers
           "am I on the right restaurant's floor?". */
        @media (max-width: 560px) {
          .fef-id { width: 100%; }
          .fef-tools { width: 100%; margin-left: 0; gap: 8px; }
          .fef-area { flex: 1; }
          .fef-area-btn { flex: 1; padding: 0 8px; }
          .fef-area-badge { flex: 1; }
          .fef-out { margin-left: auto; }
        }
        /* Narrower still: two floor buttons plus three languages plus sign-out
           cannot share a line at 360px, so the languages and sign-out take
           their own. */
        @media (max-width: 400px) {
          .fef-tools { flex-wrap: wrap; }
          .fef-area { flex: 1 0 100%; }
          .fef-langs { flex: 1; }
          .fef-lang { flex: 1; }
        }
      `}</style>

      <main style={{ maxWidth: 760, margin: '0 auto', padding: '18px 14px 60px' }}>
        <Outlet />
      </main>
    </div>
  );
};
