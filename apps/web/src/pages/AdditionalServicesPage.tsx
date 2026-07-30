import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { publicRestaurantService, type PublicRestaurantModules } from '../services/publicRestaurant.service';
import { inviteRequestService } from '../services/inviteRequest.service';
import { publicPerformerService, type PublicPerformer, type PublicPerformerDetail } from '../services/performer.service';
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

// Matches the server's per-request cap in inviteRequest.schema.ts.
const MAX_PHOTOS = 10;

// ── Additional Services ─────────────────────────────────────────────────────
// A standalone product, separate from the banquet section's "Extra services"
// (the priced add-ons attached to an event). It is reached two ways:
//
//   1. banquet.v-menu.uz/<slug> when the restaurant has NO banquet module —
//      this page replaces the admin panel / login screen entirely.
//   2. From the booking-confirmed screen on the tablet Summary page, when the
//      restaurant HAS the addons module.
//
// Sections stack below the header: invitations first, then performers.

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
// Performers are not part of this form — they are their own section below.
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
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
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
  const canSubmit = filledNames.length > 0 && phone.trim() && restaurantName.trim() && eventDate && eventTime && !busy && !uploading;

  // Uploads whatever was picked, trimmed to the remaining slots so the request
  // can never exceed the server's cap of 10.
  const pickPhotos = async (fileList: FileList | null) => {
    const files = Array.from(fileList ?? []).slice(0, MAX_PHOTOS - photoUrls.length);
    if (files.length === 0) return;
    setUploading(true);
    setError(null);
    try {
      const uploaded = await inviteRequestService.uploadPhotos(files);
      setPhotoUrls((prev) => [...prev, ...uploaded].slice(0, MAX_PHOTOS));
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
        photoUrls,
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
          onClick={() => { setSent(false); setNames(Array(defaultNameCount(eventType)).fill('')); setCardNumber(''); setMenu(''); setDressCode(''); setPhotoUrls([]); }}
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
        <label className="rg-label">
          {t('addon_inv_photos')}{optional}
          {photoUrls.length > 0 && ` · ${photoUrls.length}/${MAX_PHOTOS}`}
        </label>
        {photoUrls.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {photoUrls.map((url) => (
              <div key={url} style={{ position: 'relative' }}>
                <img src={getPhotoUrl(url)} alt="" style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 10, display: 'block' }} />
                <button
                  type="button"
                  onClick={() => setPhotoUrls(photoUrls.filter((u) => u !== url))}
                  aria-label="remove"
                  style={{
                    position: 'absolute', top: -6, right: -6, width: 22, height: 22, borderRadius: '50%',
                    background: 'rgba(0,0,0,0.75)', color: '#fff', border: '1px solid rgba(255,255,255,0.25)',
                    fontSize: 13, lineHeight: 1, cursor: 'pointer',
                  }}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
        {photoUrls.length < MAX_PHOTOS && (
          <input
            className="rg-input"
            type="file"
            accept="image/*"
            multiple
            disabled={uploading}
            // Clearing the value lets the same file be picked again after a
            // removal — otherwise the change event never fires a second time.
            onChange={(e) => { void pickPhotos(e.target.files); e.target.value = ''; }}
          />
        )}
        {uploading && <span className="text-sm" style={{ color: 'rgba(255,255,255,0.55)' }}>{t('addon_inv_uploading')}</span>}
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

// ── Section 2: Performers ───────────────────────────────────────────────────
// Every performer registered on the platform, with their availability for the
// chosen date. Opening one shows their photos and videos; booking raises a
// request that lands in that performer's Notifications. Accepting it there
// creates a calendar entry — which is what makes them show as busy here.
function PerformersSection({ t, prefill }: {
  t: (key: Parameters<typeof translate>[0]) => string;
  prefill: InvitationPrefill;
}) {
  const [date, setDate] = useState(prefill.eventDate ?? '');
  const [performers, setPerformers] = useState<PublicPerformer[] | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [detail, setDetail] = useState<PublicPerformerDetail | null>(null);
  const [contactName, setContactName] = useState(prefill.names?.[0] ?? '');
  const [phone, setPhone] = useState(prefill.phone ?? '');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bookedIds, setBookedIds] = useState<string[]>([]);

  // Re-query whenever the date changes: availability is per-date.
  useEffect(() => {
    let cancelled = false;
    publicPerformerService.list(date || undefined).then(
      (list) => { if (!cancelled) setPerformers(list); },
      () => { if (!cancelled) setPerformers([]); },
    );
    return () => { cancelled = true; };
  }, [date]);

  useEffect(() => {
    if (!openId) { setDetail(null); return; }
    let cancelled = false;
    publicPerformerService.get(openId).then(
      (d) => { if (!cancelled) setDetail(d); },
      () => { if (!cancelled) setOpenId(null); },
    );
    return () => { cancelled = true; };
  }, [openId]);

  const book = async (performerId: string) => {
    if (!date || !contactName.trim() || !phone.trim() || !prefill.eventTime) return;
    setBusy(true);
    setError(null);
    try {
      await publicPerformerService.book({
        performerId,
        restaurantName: prefill.restaurantName ?? '',
        contactName: contactName.trim(),
        phone: phone.trim(),
        eventDate: date,
        eventTime: prefill.eventTime,
        eventType: prefill.eventType ?? null,
        note: note.trim() || null,
        restaurantId: prefill.restaurantId ?? null,
        eventNumber: prefill.eventNumber ?? null,
      });
      setBookedIds((prev) => [...prev, performerId]);
      setOpenId(null);
    } catch {
      setError(t('addon_pf_error'));
    } finally {
      setBusy(false);
    }
  };

  const canBook = !!date && !!prefill.eventTime && !!contactName.trim() && !!phone.trim() && !busy;

  // ── Detail view ──
  if (openId && detail) {
    const booked = bookedIds.includes(detail.id);
    return (
      <div className="rg-card tablet-fade-up space-y-4 p-5 sm:p-7">
        <button
          type="button"
          onClick={() => setOpenId(null)}
          className="text-sm font-medium"
          style={{ color: 'var(--rg-accent)', background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
        >
          ← {t('addon_pf_back')}
        </button>

        <div className="flex items-center gap-3">
          {detail.avatarUrl
            ? <img src={getPhotoUrl(detail.avatarUrl)} alt="" style={{ width: 64, height: 64, borderRadius: '50%', objectFit: 'cover' }} />
            : <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(var(--rg-accent-rgb),0.18)' }} />}
          <div className="min-w-0">
            <p className="text-lg font-bold text-white">{detail.displayName}</p>
          </div>
        </div>

        {/* Craft, description and phone — the three things a guest decides on. */}
        {detail.craft && (
          <div className="grid gap-1">
            <span className="rg-label">{t('pf_craft')}</span>
            <p className="text-sm font-semibold" style={{ color: 'var(--rg-accent)' }}>{detail.craft}</p>
          </div>
        )}

        {detail.bio && (
          <div className="grid gap-1">
            <span className="rg-label">{t('pf_bio')}</span>
            <p className="text-sm" style={{ color: 'rgba(255,255,255,0.75)', whiteSpace: 'pre-wrap' }}>{detail.bio}</p>
          </div>
        )}

        {detail.phone && (
          <div className="grid gap-1">
            <span className="rg-label">{t('pf_phone')}</span>
            <a
              href={`tel:${detail.phone}`}
              className="text-sm font-semibold"
              style={{ color: 'var(--rg-accent)', textDecoration: 'none' }}
            >
              {detail.phone}
            </a>
          </div>
        )}

        {detail.photos.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {detail.photos.map((url) => (
              <img key={url} src={getPhotoUrl(url)} alt="" style={{ width: 96, height: 96, objectFit: 'cover', borderRadius: 10 }} />
            ))}
          </div>
        )}

        {detail.videos.length > 0 && (
          <div className="grid gap-2">
            {detail.videos.map((url) => (
              <video key={url} src={getPhotoUrl(url)} controls preload="metadata"
                style={{ width: '100%', borderRadius: 10, background: '#000' }} />
            ))}
          </div>
        )}

        {booked ? (
          <p className="text-sm" style={{ color: '#86efac' }}>{t('addon_pf_booked')}</p>
        ) : (
          <>
            <div className="grid gap-1.5">
              <label className="rg-label">{t('addon_pf_your_name')}</label>
              <input className="rg-input" value={contactName} onChange={(e) => setContactName(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <label className="rg-label">{t('addon_inv_phone')}</label>
              <input className="rg-input" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <label className="rg-label">{t('addon_pf_note')} ({t('addon_inv_optional')})</label>
              <textarea className="rg-input" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
            {error && <p className="text-sm" style={{ color: '#fca5a5' }}>{error}</p>}
            <button
              type="button"
              disabled={!canBook}
              onClick={() => void book(detail.id)}
              className="w-full rounded-xl py-3 text-sm font-bold transition-all"
              style={{
                background: canBook ? 'var(--rg-accent)' : 'rgba(255,255,255,0.12)',
                color: canBook ? 'var(--rg-bg)' : 'rgba(255,255,255,0.4)',
                cursor: canBook ? 'pointer' : 'default',
              }}
            >
              {busy ? t('addon_inv_sending') : t('addon_pf_book')}
            </button>
          </>
        )}
      </div>
    );
  }

  // ── List view ──
  return (
    <div className="rg-card tablet-fade-up space-y-4 p-5 sm:p-7">
      <div className="space-y-1">
        <p className="text-lg font-bold text-white">🎤 {t('addon_pf_title')}</p>
        <p className="text-sm" style={{ color: 'rgba(255,255,255,0.55)' }}>{t('addon_pf_intro')}</p>
      </div>

      <div className="grid gap-1.5">
        <label className="rg-label">{t('addon_pf_date')}</label>
        <input className="rg-input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </div>

      {performers === null && <p className="text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>…</p>}
      {performers?.length === 0 && <p className="text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>{t('addon_pf_none')}</p>}

      <div className="grid gap-2">
        {(performers ?? []).map((p) => (
          <div key={p.id} className="flex items-center gap-3 rounded-xl p-3"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
            {p.avatarUrl
              ? <img src={getPhotoUrl(p.avatarUrl)} alt="" style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
              : <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'rgba(var(--rg-accent-rgb),0.18)', flexShrink: 0 }} />}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-white">{p.displayName}</p>
              {p.craft && <p className="truncate text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>{p.craft}</p>}
              {/* Availability is only meaningful once a date is chosen. */}
              {p.available !== undefined && (
                <span className="text-xs font-semibold" style={{ color: p.available ? '#86efac' : '#fca5a5' }}>
                  {p.available ? t('addon_pf_available') : t('addon_pf_busy')}
                </span>
              )}
            </div>
            {bookedIds.includes(p.id) ? (
              <span className="text-xs font-semibold" style={{ color: '#86efac' }}>✓</span>
            ) : (
              <button
                type="button"
                onClick={() => setOpenId(p.id)}
                className="rounded-xl px-3 py-1.5 text-xs font-semibold"
                style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.85)', border: '1px solid rgba(255,255,255,0.18)', cursor: 'pointer' }}
              >
                {t('addon_pf_view')}
              </button>
            )}
          </div>
        ))}
      </div>
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

        {/* Sections stack in order: invitations, then performers. */}
        {!unavailable && (
          <>
            <InvitationSection
              t={t}
              prefill={{ ...prefill, restaurantName: prefill?.restaurantName || restaurantName || '' }}
            />
            <PerformersSection
              t={t}
              prefill={{ ...prefill, restaurantName: prefill?.restaurantName || restaurantName || '' }}
            />
          </>
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
