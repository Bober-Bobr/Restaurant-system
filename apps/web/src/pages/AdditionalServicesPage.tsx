import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { publicRestaurantService, type PublicRestaurantModules } from '../services/publicRestaurant.service';
import { tabletThemeVars } from '../utils/tabletTheme';
import { translate, defaultLocale, locales, type Locale } from '../utils/translate';
import { getPhotoUrl } from '../utils/photoUrl';
import networkingLogoSrc from '../assets/networking-logo.png';

// ── Additional Services ─────────────────────────────────────────────────────
// A standalone product, separate from the banquet section's "Extra services"
// (the priced add-ons attached to an event). It is reached two ways:
//
//   1. banquet.v-menu.uz/<slug> when the restaurant has NO banquet module —
//      this page replaces the admin panel / login screen entirely.
//   2. From the booking-confirmed screen on the tablet Summary page, when the
//      restaurant HAS the addons module.
//
// The contents are still to be specified; everything below the header is a
// deliberate placeholder so the entry points, routing and gating can ship and
// be verified now.

function PageBackground() {
  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden">
      <div style={{
        position: 'absolute', top: '-140px', right: '-140px',
        width: '560px', height: '560px', borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(var(--rg-accent-rgb),0.22) 0%, transparent 65%)',
        filter: 'blur(50px)',
      }} />
      <div style={{
        position: 'absolute', bottom: '-120px', left: '-120px',
        width: '520px', height: '520px', borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(60,110,50,0.35) 0%, transparent 65%)',
        filter: 'blur(50px)',
      }} />
    </div>
  );
}

type Props = {
  /** Restaurant name shown in the header; omitted while resolving by slug. */
  restaurantName?: string | null;
  restaurantLogoUrl?: string | null;
  /** Event this was opened from, when it came off the confirmed screen. */
  eventNumber?: number | null;
  /** Tablet palette, when the caller already knows it. */
  accentColor?: string | null;
  bgColor?: string | null;
  /** Rendered when the restaurant has no addons module (slug entry only). */
  unavailable?: boolean;
  onBack?: () => void;
};

export const AdditionalServicesView = ({
  restaurantName, restaurantLogoUrl, eventNumber, accentColor, bgColor, unavailable, onBack,
}: Props) => {
  const [locale, setLocale] = useState<Locale>(defaultLocale);
  const t = (key: Parameters<typeof translate>[0]) => translate(key, locale);
  const themeStyle = tabletThemeVars({ accent: accentColor ?? null, bg: bgColor ?? null }) as React.CSSProperties;
  const logoSrc = restaurantLogoUrl ? getPhotoUrl(restaurantLogoUrl) : null;

  return (
    <main className="rg-bg relative min-h-screen overflow-x-hidden px-4 py-12 sm:px-6" style={themeStyle}>
      <PageBackground />
      <div className="relative mx-auto max-w-md space-y-6">

        <header className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <img
              src={logoSrc ?? networkingLogoSrc}
              alt={restaurantName ?? 'logo'}
              className="h-10 sm:h-12"
              style={{ width: 'auto', objectFit: 'contain', flexShrink: 0 }}
            />
            <div className="min-w-0">
              {restaurantName && <p className="rg-label truncate">{restaurantName}</p>}
              <p className="truncate text-lg font-bold text-white">{t('addon_services')}</p>
            </div>
          </div>
          <select
            value={locale}
            onChange={(e) => setLocale(e.target.value as Locale)}
            className="rounded-lg px-2 py-1 text-xs"
            style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.8)', border: '1px solid rgba(255,255,255,0.15)' }}
          >
            {locales.map((l) => <option key={l} value={l} style={{ color: '#111' }}>{l.toUpperCase()}</option>)}
          </select>
        </header>

        <div className="rg-card tablet-fade-up space-y-5 p-6 text-center sm:p-10" style={{ animationDelay: '80ms' }}>
          <div
            className="scale-in mx-auto flex h-20 w-20 items-center justify-center rounded-full"
            style={{ background: 'rgba(var(--rg-accent-rgb),0.15)', border: '2px solid rgba(var(--rg-accent-rgb),0.4)' }}
          >
            <svg className="h-10 w-10" style={{ color: 'var(--rg-accent)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
            </svg>
          </div>

          {eventNumber != null && (
            <p className="font-mono text-sm" style={{ color: 'rgba(var(--rg-accent-rgb),0.75)' }}>
              {t('addon_services_for_event')} #{eventNumber}
            </p>
          )}

          <div className="space-y-2">
            <p className="text-xl font-bold text-white">{t('addon_services')}</p>
            <p className="text-sm" style={{ color: 'rgba(255,255,255,0.6)' }}>
              {unavailable ? t('addon_services_unavailable') : t('addon_services_intro')}
            </p>
          </div>

          {!unavailable && (
            <p
              className="rounded-xl px-4 py-3 text-sm"
              style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.55)', border: '1px dashed rgba(255,255,255,0.15)' }}
            >
              {t('addon_services_soon')}
            </p>
          )}

          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-medium transition-all"
              style={{ background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.75)', border: '1px solid rgba(255,255,255,0.15)' }}
            >
              ← {t('back')}
            </button>
          )}
        </div>
      </div>
    </main>
  );
};

// Entry point 1: banquet.v-menu.uz/<slug> for a restaurant without the banquet
// module. Nobody is signed in here, so the restaurant and its entitlements are
// resolved from the URL slug through the public API.
export const AdditionalServicesBySlug = ({ slug }: { slug: string }) => {
  const [state, setState] = useState<'loading' | 'ready' | 'missing'>('loading');
  const [restaurant, setRestaurant] = useState<PublicRestaurantModules | null>(null);

  useEffect(() => {
    let cancelled = false;
    publicRestaurantService.modulesBySlug(slug).then(
      (r) => { if (!cancelled) { setRestaurant(r); setState('ready'); } },
      () => { if (!cancelled) setState('missing'); },
    );
    return () => { cancelled = true; };
  }, [slug]);

  if (state === 'loading') {
    return (
      <main className="rg-bg flex min-h-screen items-center justify-center" style={tabletThemeVars({ accent: null, bg: null }) as React.CSSProperties}>
        <p style={{ color: 'rgba(255,255,255,0.6)' }}>…</p>
      </main>
    );
  }
  if (state === 'missing' || !restaurant) {
    return <AdditionalServicesView unavailable restaurantName={null} />;
  }
  return (
    <AdditionalServicesView
      restaurantName={restaurant.name}
      restaurantLogoUrl={restaurant.logoUrl}
      // A restaurant with neither module gets the "not available yet" state
      // rather than a login screen it could never get past.
      unavailable={!restaurant.moduleAddons}
    />
  );
};

// Entry point 2: the in-app route reached from the booking-confirmed screen.
// The restaurant is already loaded there, so it is handed over as query params.
export const AdditionalServicesPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const eventNumber = Number(searchParams.get('eventNumber'));

  return (
    <AdditionalServicesView
      restaurantName={searchParams.get('restaurantName')}
      restaurantLogoUrl={searchParams.get('restaurantLogoUrl')}
      eventNumber={Number.isFinite(eventNumber) && eventNumber > 0 ? eventNumber : null}
      accentColor={searchParams.get('accent')}
      bgColor={searchParams.get('bg')}
      onBack={() => navigate(-1)}
    />
  );
};
