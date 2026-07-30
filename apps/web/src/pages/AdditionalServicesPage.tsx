import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { publicRestaurantService, type PublicRestaurantModules } from '../services/publicRestaurant.service';
import { inviteRequestService } from '../services/inviteRequest.service';
import { tabletThemeVars } from '../utils/tabletTheme';
import { translate, defaultLocale, locales, type Locale } from '../utils/translate';
import { getPhotoUrl } from '../utils/photoUrl';
import networkingLogoSrc from '../assets/networking-logo.png';

// The banquet product's event types, reused verbatim so an order that came from
// a confirmed event carries the same type through. Labels come from the shared
// `event_type_*` keys.
const EVENT_TYPES = ['RESERVATION', 'BANQUET', 'WEDDING', 'BIRTHDAY', 'PRIVATE_PARTY', 'CORPORATE', 'FOTIHA_TUI', 'NACHOR_OSHI'] as const;

// How many name fields an event type starts with. A wedding names two people;
// everything else starts with one. The honoree can add or remove rows either
// way — this only sets the starting point.
function defaultNameCount(eventType: string): number {
  return eventType === 'WEDDING' ? 2 : 1;
}

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

// ── Section 1: Invitations ──────────────────────────────────────────────────
// Collects what the v-invite studio needs to build a guest invitation by hand.
// The order lands on the SYSTEM_ADMIN's Notifications page at v-invite.uz.
// Performers are deliberately absent — that field is specified but not yet
// defined, and the column already exists so adding it needs no migration.
type InvitationPrefill = {
  names?: string[];
  eventType?: string;
  phone?: string;
  restaurantName?: string;
  eventDate?: string;
  eventTime?: string;
  menu?: string;
  restaurantId?: string | null;
  eventNumber?: number | null;
};

function InvitationSection({ t, prefill }: {
  t: (key: Parameters<typeof translate>[0]) => string;
  prefill: InvitationPrefill;
}) {
  const [eventType, setEventType] = useState(prefill.eventType || 'WEDDING');
  const [names, setNames] = useState<string[]>(
    prefill.names?.length ? prefill.names : Array(defaultNameCount(prefill.eventType || 'WEDDING')).fill(''),
  );
  const [phone, setPhone] = useState(prefill.phone ?? '');
  const [cardNumber, setCardNumber] = useState('');
  const [restaurantName, setRestaurantName] = useState(prefill.restaurantName ?? '');
  const [eventDate, setEventDate] = useState(prefill.eventDate ?? '');
  const [eventTime, setEventTime] = useState(prefill.eventTime ?? '');
  const [menu, setMenu] = useState(prefill.menu ?? '');
  const [dressCode, setDressCode] = useState('');
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  // Switching the event type re-shapes the name rows, but only while they are
  // still untouched — retyping over someone's entered names would be rude.
  const changeEventType = (next: string) => {
    setEventType(next);
    const want = defaultNameCount(next);
    setNames((prev) => (prev.every((n) => !n.trim())
      ? Array(want).fill('')
      : prev));
  };

  const filledNames = names.map((n) => n.trim()).filter(Boolean);
  const canSubmit = filledNames.length > 0 && phone.trim() && restaurantName.trim() && eventDate && eventTime && !busy;

  const pickPhoto = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      setPhotoUrl(await inviteRequestService.uploadPhoto(file));
    } catch {
      setError(t('addon_inv_photo_error'));
    } finally {
      setUploading(false);
    }
  };

  const submit = async () => {
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      await inviteRequestService.submit({
        names: filledNames,
        eventType,
        phone: phone.trim(),
        cardNumber: cardNumber.trim() || null,
        restaurantName: restaurantName.trim(),
        eventDate,
        eventTime,
        menu: menu.trim() || null,
        dressCode: dressCode.trim() || null,
        photoUrl,
        restaurantId: prefill.restaurantId ?? null,
        eventNumber: prefill.eventNumber ?? null,
      });
      setSent(true);
    } catch {
      setError(t('addon_inv_error'));
    } finally {
      setBusy(false);
    }
  };

  const optional = ` (${t('addon_inv_optional')})`;

  if (sent) {
    return (
      <div className="rg-card tablet-fade-up space-y-4 p-6 text-center sm:p-8">
        <div className="scale-in mx-auto flex h-16 w-16 items-center justify-center rounded-full"
          style={{ background: 'rgba(var(--rg-accent-rgb),0.15)', border: '2px solid rgba(var(--rg-accent-rgb),0.4)' }}>
          <svg className="h-8 w-8" style={{ color: 'var(--rg-accent)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <p className="text-sm" style={{ color: 'rgba(255,255,255,0.75)' }}>{t('addon_inv_sent')}</p>
        <button
          type="button"
          onClick={() => { setSent(false); setNames(Array(defaultNameCount(eventType)).fill('')); setCardNumber(''); setMenu(''); setDressCode(''); setPhotoUrl(null); }}
          className="inline-flex w-full items-center justify-center rounded-xl px-5 py-2.5 text-sm font-medium transition-all"
          style={{ background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.75)', border: '1px solid rgba(255,255,255,0.15)' }}
        >
          {t('addon_inv_send_another')}
        </button>
      </div>
    );
  }

  return (
    <div className="rg-card tablet-fade-up space-y-4 p-5 sm:p-7">
      <div className="space-y-1">
        <p className="text-lg font-bold text-white">💌 {t('addon_inv_title')}</p>
        <p className="text-sm" style={{ color: 'rgba(255,255,255,0.55)' }}>{t('addon_inv_intro')}</p>
      </div>

      {/* Names — one row per honoree */}
      <div className="grid gap-1.5">
        <label className="rg-label">{t('addon_inv_names')}</label>
        {names.map((name, i) => (
          <div key={i} className="flex gap-2">
            <input
              className="rg-input flex-1"
              value={name}
              onChange={(e) => setNames(names.map((n, j) => (j === i ? e.target.value : n)))}
            />
            {names.length > 1 && (
              <button
                type="button"
                onClick={() => setNames(names.filter((_, j) => j !== i))}
                className="rounded-xl px-3 text-sm"
                style={{ background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.15)' }}
                aria-label="remove"
              >
                ×
              </button>
            )}
          </div>
        ))}
        {names.length < 6 && (
          <button
            type="button"
            onClick={() => setNames([...names, ''])}
            className="self-start text-sm font-medium"
            style={{ color: 'var(--rg-accent)', background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
          >
            {t('addon_inv_add_name')}
          </button>
        )}
      </div>

      <div className="grid gap-1.5">
        <label className="rg-label">{t('addon_inv_event_type')}</label>
        <select className="rg-input" value={eventType} onChange={(e) => changeEventType(e.target.value)}>
          {EVENT_TYPES.map((type) => (
            <option key={type} value={type}>
              {t(`event_type_${type.toLowerCase()}` as Parameters<typeof translate>[0])}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-1.5">
        <label className="rg-label">{t('addon_inv_phone')}</label>
        <input className="rg-input" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
      </div>

      <div className="grid gap-1.5">
        <label className="rg-label">{t('addon_inv_card')}{optional}</label>
        <input className="rg-input" inputMode="numeric" value={cardNumber} onChange={(e) => setCardNumber(e.target.value)} />
      </div>

      <div className="grid gap-1.5">
        <label className="rg-label">{t('addon_inv_restaurant')}</label>
        <input className="rg-input" value={restaurantName} onChange={(e) => setRestaurantName(e.target.value)} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-1.5">
          <label className="rg-label">{t('addon_inv_date')}</label>
          <input className="rg-input" type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} />
        </div>
        <div className="grid gap-1.5">
          <label className="rg-label">{t('addon_inv_time')}</label>
          <input className="rg-input" type="time" value={eventTime} onChange={(e) => setEventTime(e.target.value)} />
        </div>
      </div>

      <div className="grid gap-1.5">
        <label className="rg-label">{t('addon_inv_menu')}{optional}</label>
        <textarea className="rg-input" rows={3} value={menu} onChange={(e) => setMenu(e.target.value)} />
      </div>

      <div className="grid gap-1.5">
        <label className="rg-label">{t('addon_inv_dress_code')}{optional}</label>
        <input className="rg-input" value={dressCode} onChange={(e) => setDressCode(e.target.value)} />
      </div>

      <div className="grid gap-1.5">
        <label className="rg-label">{t('addon_inv_photo')}{optional}</label>
        {photoUrl ? (
          <div className="flex items-center gap-3">
            <img src={getPhotoUrl(photoUrl)} alt="" style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 10 }} />
            <button
              type="button"
              onClick={() => setPhotoUrl(null)}
              className="rounded-xl px-3 py-1.5 text-sm"
              style={{ background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.7)', border: '1px solid rgba(255,255,255,0.15)' }}
            >
              ×
            </button>
          </div>
        ) : (
          <input
            className="rg-input"
            type="file"
            accept="image/*"
            disabled={uploading}
            onChange={(e) => void pickPhoto(e.target.files?.[0])}
          />
        )}
      </div>

      {error && <p className="text-sm" style={{ color: '#fca5a5' }}>{error}</p>}

      <button
        type="button"
        disabled={!canSubmit}
        onClick={() => void submit()}
        className="w-full rounded-xl py-3 text-sm font-bold transition-all duration-200 hover:shadow-lg"
        style={{
          background: canSubmit ? 'var(--rg-accent)' : 'rgba(255,255,255,0.12)',
          color: canSubmit ? 'var(--rg-bg)' : 'rgba(255,255,255,0.4)',
          cursor: canSubmit ? 'pointer' : 'default',
        }}
      >
        {busy ? t('addon_inv_sending') : t('addon_inv_submit')}
      </button>
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
  /** Seeds the invitation form from a confirmed banquet event. */
  prefill?: InvitationPrefill;
  onBack?: () => void;
};

export const AdditionalServicesView = ({
  restaurantName, restaurantLogoUrl, eventNumber, accentColor, bgColor, unavailable, prefill, onBack,
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

        {/* Section 1 — Invitations. Further sections will stack below. */}
        {!unavailable && (
          <InvitationSection
            t={t}
            prefill={{ ...prefill, restaurantName: prefill?.restaurantName || restaurantName || '' }}
          />
        )}
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
  const rawEventNumber = Number(searchParams.get('eventNumber'));
  const eventNumber = Number.isFinite(rawEventNumber) && rawEventNumber > 0 ? rawEventNumber : null;
  const restaurantName = searchParams.get('restaurantName');

  // Data the honoree already entered on the Summary page, handed over so they
  // are not asked for the same details twice.
  const names = searchParams.getAll('name').filter(Boolean);

  return (
    <AdditionalServicesView
      restaurantName={restaurantName}
      restaurantLogoUrl={searchParams.get('restaurantLogoUrl')}
      eventNumber={eventNumber}
      accentColor={searchParams.get('accent')}
      bgColor={searchParams.get('bg')}
      prefill={{
        names: names.length ? names : undefined,
        eventType: searchParams.get('eventType') || undefined,
        phone: searchParams.get('phone') || undefined,
        restaurantName: restaurantName || undefined,
        eventDate: searchParams.get('eventDate') || undefined,
        eventTime: searchParams.get('eventTime') || undefined,
        menu: searchParams.get('menu') || undefined,
        restaurantId: searchParams.get('restaurantId'),
        eventNumber,
      }}
      onBack={() => navigate(-1)}
    />
  );
};
