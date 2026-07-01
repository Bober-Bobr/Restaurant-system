import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { usePriceCalculator } from '../hooks/usePriceCalculator';
import { usePublicDataStore } from '../store/publicData.store';
import { useTabletStore } from '../store/tablet.store';
import { eventService } from '../services/event.service';
import { httpClient } from '../services/http';
import networkingLogoSrc from '../assets/networking-logo.png';
import { Locale, locales, translate } from '../utils/translate';
import { getPhotoUrl } from '../utils/photoUrl';
import { tabletThemeVars } from '../utils/tabletTheme';
import { dishName } from '../utils/menuI18n';
import type { Event, TableCategoryPackageItem } from '../types/domain';
import { formatSum } from '../utils/currency';
import { FingerTrail } from '../components/FingerTrail';
import { useScrollReveal } from '../utils/useScrollReveal';

type EventType = NonNullable<Event['eventType']>;
const eventTypes: EventType[] = ['RESERVATION', 'BANQUET', 'WEDDING', 'BIRTHDAY', 'PRIVATE_PARTY', 'CORPORATE', 'FOTIHA_TUI', 'NACHOR_OSHI'];

// ── Decorative background (shared with menu page) ─────────────────────────

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
      <div style={{
        position: 'absolute', top: '50%', right: '15%',
        width: '300px', height: '300px', borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(var(--rg-accent-rgb),0.07) 0%, transparent 70%)',
        filter: 'blur(30px)',
      }} />
    </div>
  );
}

// ── Shared page header ────────────────────────────────────────────────────

function PageHeader({
  title, locale, setLocale, isLoading, t, restaurantLogoUrl, restaurantName,
}: {
  title: string;
  locale: Locale;
  setLocale: (l: Locale) => void;
  isLoading: boolean;
  t: (key: Parameters<typeof translate>[0]) => string;
  restaurantLogoUrl: string | null;
  restaurantName: string | null;
}) {
  const logoSrc = restaurantLogoUrl ? getPhotoUrl(restaurantLogoUrl) : null;
  return (
    <header
      className="tablet-fade-in overflow-hidden rounded-2xl sm:rounded-[28px] px-4 sm:px-8 py-4 sm:py-5 shadow-2xl"
      style={{ background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.1)', backdropFilter: 'blur(16px)' }}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div className="flex items-center gap-3 sm:gap-4 min-w-0">
          <img src={logoSrc ?? networkingLogoSrc} alt={restaurantName ?? 'logo'} className="h-10 sm:h-14" style={{ width: 'auto', objectFit: 'contain', flexShrink: 0 }} />
          <div className="min-w-0">
            {restaurantName && <p className="rg-label truncate">{restaurantName}</p>}
            <h1 className="text-base sm:text-2xl font-bold text-white truncate">{title}</h1>
          </div>
        </div>
        <select
          value={locale}
          onChange={(e) => setLocale(e.target.value as Locale)}
          disabled={isLoading}
          className="rg-input flex-shrink-0"
          style={{ width: 'auto', paddingRight: '2rem', fontSize: '0.8rem' }}
        >
          {locales.map((l) => (
            <option key={l} value={l}>
              {t(l === 'en' ? 'english' : l === 'ru' ? 'russian' : 'uzbek')}
            </option>
          ))}
        </select>
      </div>
    </header>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────

export const TabletSummaryPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const restaurantId = searchParams.get('restaurantId') ?? '';
  const { selectedItems, selectedHallId, selectedTableCategoryId, guestCount,
    childrenTableSelected, childrenCount,
    selectedFirstCourseId, selectedSecondCourseIds, selectedThirdCourseIds,
    childFirstCourseId, childSecondCourseIds, childThirdCourseIds,
    locale, setLocale, setGuestCount, reset,
    customerName: draftCustomerName, customerPhone: draftCustomerPhone,
    eventDate: draftEventDate, eventTime: draftEventTime } = useTabletStore();

  const menuItems         = usePublicDataStore((s) => s.menuItems);
  const halls             = usePublicDataStore((s) => s.halls);
  const tableCategories   = usePublicDataStore((s) => s.tableCategories);
  const restaurantName    = usePublicDataStore((s) => s.restaurantName);
  const restaurantLogoUrl = usePublicDataStore((s) => s.restaurantLogoUrl);
  const tabletAccentColor = usePublicDataStore((s) => s.tabletAccentColor);
  const tabletBgColor     = usePublicDataStore((s) => s.tabletBgColor);
  const isLoading         = usePublicDataStore((s) => s.isLoading);
  const loadPublicData    = usePublicDataStore((s) => s.loadPublicData);
  const themeStyle = tabletThemeVars({ accent: tabletAccentColor, bg: tabletBgColor }) as React.CSSProperties;

  // Reveal-on-scroll: re-scan once data finishes loading and sections render.
  const revealRef = useScrollReveal<HTMLDivElement>([isLoading]);

  // Pre-fill contact + date/time when they were entered on the admin Events page
  // and handed off via "Change Menu" (falls back to empty in the normal flow).
  const [customerName, setCustomerName]             = useState(draftCustomerName);
  const [customerPhone, setCustomerPhone]           = useState(draftCustomerPhone);
  const [eventDate, setEventDate]                   = useState(draftEventDate);
  const [eventTime, setEventTime]                   = useState(draftEventTime);
  const [eventNotes, setEventNotes]                 = useState('');
  const [eventType, setEventType]                   = useState<EventType>('RESERVATION');
  const [birthdayPersonName, setBirthdayPersonName] = useState('');
  const [brideName, setBrideName]                   = useState('');
  const [groomName, setGroomName]                   = useState('');
  const [honoreePersonName, setHonoreeName]         = useState('');
  const [isSubmitting, setIsSubmitting]             = useState(false);
  const [confirmedEventId, setConfirmedEventId]     = useState<number | null>(null);
  const [submitError, setSubmitError]               = useState<string | null>(null);
  const [discountEnabled, setDiscountEnabled]       = useState(false);
  const [discountText, setDiscountText]             = useState('');
  const [confirmedExportSnapshot, setConfirmedExportSnapshot] = useState<null | {
    customerName: string; customerPhone: string; hallName: string; tableCategoryName: string;
    guestCount: number; selectedItems: Record<string, number>; menuItems: typeof menuItems;
    includedDishes: { name: string; category: string; categoryLabel: string; servings: number }[];
    pricing: { perGuestCents: number; originalPerGuestCents: number; totalCents: number;
      originalTotalCents: number; discountPercent: number; hasDiscount: boolean; guestCount: number };
    childrenTableName?: string; childrenCount?: number; childrenRateCents?: number; childrenSubtotalCents?: number;
    childrenDishes?: { name: string; category: string; categoryLabel: string; servings: number }[];
    locale: Locale; restaurantName: string; restaurantLogoUrl: string | null;
  }>(null);

  const t = (key: Parameters<typeof translate>[0], params?: Record<string, string | number>) =>
    translate(key, locale, params);

  useEffect(() => {
    if (restaurantId) loadPublicData(restaurantId);
  }, [loadPublicData, restaurantId]);

  const selectedTableCategory = tableCategories.find((tc) => tc.id === selectedTableCategoryId);
  const childrenTableCategory = tableCategories.find((tc) => tc.isActive && tc.tableType === 'CHILDREN');
  const childrenActive        = childrenTableSelected && !!childrenTableCategory;
  const childrenSubtotalCents = childrenActive ? (childrenTableCategory!.ratePerPerson * childrenCount) : 0;
  const selectedHall          = halls.find((h) => h.id === selectedHallId);
  const selectedMenuItems     = useMemo(
    () => (menuItems || []).filter((item) => selectedItems[item.id] > 0),
    [menuItems, selectedItems]
  );

  // Each selected Extra is served to every guest, so it's priced as
  // price × guestCount. The store only records selection (1/0); the per-guest
  // quantity is derived here from the live guest count for pricing + exports.
  const pricedSelections = useMemo(() => {
    const out: Record<string, number> = {};
    for (const id of Object.keys(selectedItems)) {
      if (selectedItems[id] > 0) out[id] = guestCount;
    }
    return out;
  }, [selectedItems, guestCount]);

  const pricing        = usePriceCalculator(menuItems ?? [], pricedSelections, selectedTableCategory, guestCount);
  const confirmDisabled = !customerName.trim() || !customerPhone.trim() || !eventDate || !eventTime || guestCount < 1;

  // The export lists ONLY the first/second/third courses the guest actually
  // selected on the tablet — not every package option or the fixed included
  // dishes. Package items are filtered to the chosen course ids, in course order.
  const selectedCourseDishes = (
    packageItems: TableCategoryPackageItem[],
    firstId: string | undefined,
    secondIds: string[],
    thirdIds: string[],
  ) => {
    const pick = (category: string, isSelected: (id: string) => boolean) =>
      packageItems
        .filter((pi) => pi.menuItem.category === category && isSelected(pi.menuItem.id))
        .map((pi) => ({
          name: pi.menuItem.name,
          category: pi.menuItem.category,
          categoryLabel: t(pi.menuItem.category.toLowerCase() as Parameters<typeof translate>[0]),
          servings: pi.servings ?? 1,
        }));
    return [
      ...pick('FIRST_COURSE', (id) => id === firstId),
      ...pick('SECOND_COURSE', (id) => secondIds.includes(id)),
      ...pick('THIRD_COURSE', (id) => thirdIds.includes(id)),
    ];
  };

  const buildIncludedDishes = () =>
    selectedCourseDishes(
      selectedTableCategory?.packageItems ?? [],
      selectedFirstCourseId, selectedSecondCourseIds, selectedThirdCourseIds,
    );

  // Ad-hoc discount entered here on the Summary page (not stored on the table category).
  const discountPercent = discountEnabled
    ? Math.min(100, Math.max(0, Math.round(Number(discountText) || 0)))
    : 0;
  const hasDiscount = discountPercent > 0;
  const factor = 1 - discountPercent / 100;

  // Children's dishes for the export (its own package + free swaps), built only
  // when the children's table is included.
  const buildChildrenDishes = () =>
    childrenActive
      ? selectedCourseDishes(
          childrenTableCategory!.packageItems ?? [],
          childFirstCourseId, childSecondCourseIds, childThirdCourseIds,
        )
      : [];

  const originalPerGuestCents = pricing.perGuestCents;
  const finalPerGuestCents = Math.round(originalPerGuestCents * factor);
  // Total includes the optional children's table (adult per-guest figure is unchanged).
  const originalTotalCents = pricing.subtotalCents + childrenSubtotalCents;
  const finalTotalCents = Math.round(originalTotalCents * factor);
  const finalChildrenSubtotalCents = Math.round(childrenSubtotalCents * factor);

  // Pricing payload for exports — per-guest and total figures.
  const exportPricing = {
    perGuestCents: finalPerGuestCents,
    originalPerGuestCents,
    totalCents: finalTotalCents,
    originalTotalCents,
    discountPercent,
    hasDiscount,
    guestCount,
  };

  // Children's-table fields for the event record and exports (empty when off).
  const childrenExport = childrenActive
    ? {
        childrenTableName: childrenTableCategory!.name,
        childrenCount,
        childrenRateCents: childrenTableCategory!.ratePerPerson,
        childrenSubtotalCents: finalChildrenSubtotalCents,
        childrenDishes: buildChildrenDishes(),
      }
    : {};

  const handleConfirm = async () => {
    if (confirmDisabled || isSubmitting) return;
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const event = await eventService.create({
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim() || undefined,
        eventDate: new Date(`${eventDate}T${eventTime}`).toISOString(),
        guestCount,
        status: 'CONFIRMED',
        eventType,
        hallId: selectedHallId || undefined,
        tableCategoryId: selectedTableCategoryId || undefined,
        childrenTableCategoryId: childrenActive ? childrenTableCategory!.id : undefined,
        childrenCount: childrenActive ? childrenCount : undefined,
        notes: eventNotes.trim() || undefined,
        birthdayPersonName:  eventType === 'BIRTHDAY' && birthdayPersonName.trim() ? birthdayPersonName.trim() : undefined,
        brideName:           eventType === 'WEDDING' && brideName.trim() ? brideName.trim() : undefined,
        groomName:           eventType === 'WEDDING' && groomName.trim() ? groomName.trim() : undefined,
        honoreePersonName:   !['BIRTHDAY', 'WEDDING'].includes(eventType) && honoreePersonName.trim() ? honoreePersonName.trim() : undefined,
      });
      setConfirmedEventId(event.id);
      setConfirmedExportSnapshot({
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        hallName: selectedHall?.name || '',
        tableCategoryName: selectedTableCategory?.name || '',
        guestCount,
        selectedItems: { ...pricedSelections },
        menuItems,
        includedDishes: buildIncludedDishes(),
        pricing: exportPricing,
        ...childrenExport,
        locale,
        restaurantName: restaurantName ?? '',
        restaurantLogoUrl: restaurantLogoUrl ?? null,
      });
      reset();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { errors?: { fieldErrors?: Record<string, string[]> } } } };
      const fieldErrors = axiosErr?.response?.data?.errors?.fieldErrors;
      if (fieldErrors) {
        const details = Object.entries(fieldErrors).map(([k, v]) => `${k}: ${v.join(', ')}`).join(' | ');
        console.error('[Event create 400]', details);
        setSubmitError(`${t('event_create_error')} (${details})`);
      } else {
        setSubmitError(t('event_create_error'));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const downloadBlob = async (url: string, filename: string) => {
    try {
      // Dishes that come included with the chosen table category.
      const includedDishes = buildIncludedDishes();
      const response = await httpClient.post(
        url,
        { customerName, customerPhone, hallName: selectedHall?.name || '', tableCategoryName: selectedTableCategory?.name || '',
          guestCount, selectedItems: pricedSelections, menuItems: menuItems || [], includedDishes, pricing: exportPricing, ...childrenExport, locale, restaurantName: restaurantName ?? '', restaurantLogoUrl: restaurantLogoUrl ?? null },
        { responseType: 'blob' }
      );
      const downloadUrl = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch {
      alert(t('download_failed'));
    }
  };

  const downloadConfirmedBlob = async (url: string, filename: string) => {
    if (!confirmedExportSnapshot) return;
    try {
      const response = await httpClient.post(url, confirmedExportSnapshot, { responseType: 'blob' });
      const downloadUrl = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch {
      alert(t('download_failed'));
    }
  };

  // ── Success screen ────────────────────────────────────────────────────────
  if (confirmedEventId !== null) {
    return (
      <main className="rg-bg relative min-h-screen overflow-x-hidden px-4 py-12 sm:px-6" style={themeStyle}>
        <PageBackground />
        <div className="relative mx-auto max-w-md space-y-6">
          <PageHeader title={t('selection_summary')} locale={locale} setLocale={setLocale} isLoading={isLoading} t={t} restaurantLogoUrl={restaurantLogoUrl} restaurantName={restaurantName} />

          <div className="rg-card p-6 sm:p-10 text-center space-y-6 tablet-fade-up" style={{ animationDelay: '80ms' }}>
            <div className="scale-in mx-auto flex h-24 w-24 items-center justify-center rounded-full"
              style={{ background: 'rgba(var(--rg-accent-rgb),0.15)', border: '2px solid rgba(var(--rg-accent-rgb),0.4)' }}>
              <svg className="h-12 w-12" style={{ color: 'var(--rg-accent)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div className="space-y-2">
              <p className="text-2xl font-bold text-white">{t('event_confirmed')}</p>
              <p className="text-sm" style={{ color: 'rgba(255,255,255,0.55)' }}>{t('thank_you')}</p>
              <p className="mt-3 font-mono text-sm" style={{ color: 'rgba(var(--rg-accent-rgb),0.7)' }}>Event #{confirmedEventId}</p>
            </div>
            {confirmedExportSnapshot && (
              <div className="grid gap-2 w-full" style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 16 }}>
                {[
                  { label: t('download_pdf'), fn: () => downloadConfirmedBlob('/public/export/pdf', 'booking-summary.pdf'),
                    icon: 'M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
                  { label: t('download_excel'), fn: () => downloadConfirmedBlob('/public/export/excel', 'booking-summary.xlsx'),
                    icon: 'M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
                ].map(({ label, fn, icon }) => (
                  <button key={label} type="button" onClick={fn}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-medium transition-all"
                    style={{ background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.8)', border: '1px solid rgba(255,255,255,0.15)' }}>
                    <svg className="h-4 w-4" style={{ color: 'rgba(var(--rg-accent-rgb),0.7)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={icon} />
                    </svg>
                    {label}
                  </button>
                ))}
              </div>
            )}
            <div className="grid gap-2 w-full" style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 16 }}>
              <button
                type="button"
                onClick={() => {
                  setConfirmedEventId(null);
                  setCustomerName(''); setCustomerPhone(''); setEventDate(''); setEventTime('');
                  setEventNotes(''); setEventType('RESERVATION');
                  setBirthdayPersonName(''); setBrideName(''); setGroomName(''); setHonoreeName('');
                  navigate('/tablet');
                }}
                className="w-full rounded-xl py-3 text-sm font-bold transition-all duration-200 hover:shadow-lg"
                style={{ background: 'var(--rg-accent)', color: 'var(--rg-bg)' }}
              >
                {t('start_new_booking')}
              </button>
              <button
                type="button"
                onClick={() => navigate('/')}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-medium transition-all"
                style={{ background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.75)', border: '1px solid rgba(255,255,255,0.15)' }}
              >
                ← {t('back')}
              </button>
            </div>
          </div>
        </div>
      </main>
    );
  }

  // ── Main summary screen ───────────────────────────────────────────────────
  return (
    <main className="rg-bg relative min-h-screen overflow-x-hidden px-3 pt-4 pb-6 sm:px-6 sm:pt-6 lg:px-8" style={themeStyle}>

      <PageBackground />
      <FingerTrail accent="var(--rg-accent)" />

      <div ref={revealRef} className="relative mx-auto max-w-5xl space-y-4 sm:space-y-6">
        <PageHeader title={t('selection_summary')} locale={locale} setLocale={setLocale} isLoading={isLoading} t={t} restaurantLogoUrl={restaurantLogoUrl} restaurantName={restaurantName} />

        <div className="grid grid-cols-1 gap-4 lg:gap-6 lg:grid-cols-[1.3fr_0.7fr]">

          {/* ── Left column ── */}
          <div className="min-w-0 space-y-6">

            {/* Customer details */}
            <section className="rg-card p-4 sm:p-6 reveal">
              <p className="rg-heading">{t('customer_details')}</p>
              <p className="mt-1 mb-5 text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>
                {t('enter_customer_information')}
              </p>
              <div className="grid gap-4">

                <div className="grid gap-1.5">
                  <label className="rg-label">{t('customer_name')}</label>
                  <input className="rg-input" placeholder={t('customer_name')}
                    value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
                </div>

                <div className="grid gap-1.5">
                  <label className="rg-label">{t('customer_phone')}</label>
                  <input className="rg-input" type="tel" placeholder={t('customer_phone')}
                    value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-1.5">
                    <label className="rg-label">{t('event_date')}</label>
                    <input className="rg-input" type="date"
                      value={eventDate} onChange={(e) => setEventDate(e.target.value)} />
                  </div>
                  <div className="grid gap-1.5">
                    <label className="rg-label">{t('event_time')}</label>
                    <input className="rg-input" type="time"
                      value={eventTime} onChange={(e) => setEventTime(e.target.value)} />
                  </div>
                </div>

                <div className="grid gap-1.5">
                  <label className="rg-label">
                    {t('guest_count')}
                    {guestCount < 1 && (
                      <span className="ml-2 normal-case font-normal text-xs" style={{ color: '#fca5a5' }}>
                        — {t('required')}
                      </span>
                    )}
                  </label>
                  <input className="rg-input" type="number" min={1} max={5000}
                    value={guestCount || ''}
                    onChange={(e) => setGuestCount(e.target.value === '' ? 0 : Math.max(0, Number(e.target.value)))}
                    placeholder="0" />
                </div>

                <div className="grid gap-1.5">
                  <label className="rg-label">{t('event_type')}</label>
                  <select className="rg-input" value={eventType}
                    onChange={(e) => setEventType(e.target.value as EventType)}>
                    {eventTypes.map((type) => (
                      <option key={type} value={type}>
                        {t(`event_type_${type.toLowerCase()}` as Parameters<typeof t>[0])}
                      </option>
                    ))}
                  </select>
                </div>

                {eventType === 'BIRTHDAY' && (
                  <div className="grid gap-1.5 tablet-fade-in">
                    <label className="rg-label">{t('birthday_person_name')}</label>
                    <input className="rg-input" placeholder={t('birthday_person_name_placeholder')}
                      value={birthdayPersonName} onChange={(e) => setBirthdayPersonName(e.target.value)} />
                  </div>
                )}

                {eventType === 'WEDDING' && (
                  <>
                    <div className="grid gap-1.5 tablet-fade-in">
                      <label className="rg-label">{t('bride_name')}</label>
                      <input className="rg-input" placeholder={t('bride_groom_name_placeholder')}
                        value={brideName} onChange={(e) => setBrideName(e.target.value)} />
                    </div>
                    <div className="grid gap-1.5 tablet-fade-in">
                      <label className="rg-label">{t('groom_name')}</label>
                      <input className="rg-input" placeholder={t('bride_groom_name_placeholder')}
                        value={groomName} onChange={(e) => setGroomName(e.target.value)} />
                    </div>
                  </>
                )}

                {!['BIRTHDAY', 'WEDDING'].includes(eventType) && (
                  <div className="grid gap-1.5 tablet-fade-in">
                    <label className="rg-label">{t('honoree_person_name')}</label>
                    <input className="rg-input" placeholder={t('honoree_person_name_placeholder')}
                      value={honoreePersonName} onChange={(e) => setHonoreeName(e.target.value)} />
                  </div>
                )}

                <div className="grid gap-1.5">
                  <label className="rg-label">
                    {t('notes')}
                    <span className="ml-1 normal-case font-normal" style={{ color: 'rgba(255,255,255,0.3)' }}>
                      ({t('description_optional').toLowerCase()})
                    </span>
                  </label>
                  <textarea rows={3} placeholder={t('notes_placeholder')}
                    value={eventNotes} onChange={(e) => setEventNotes(e.target.value)}
                    className="rg-input resize-none" />
                </div>
              </div>
            </section>

            {/* Event overview */}
            <section className="rg-card p-4 sm:p-6 reveal">
              <p className="rg-heading mb-4">{t('event_details')}</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {[
                  { label: t('event_type'), value: t(`event_type_${eventType.toLowerCase()}` as Parameters<typeof t>[0]) },
                  { label: t('hall'), value: selectedHall?.name || t('not_selected') },
                  { label: t('table_category'), value: selectedTableCategory?.name || t('not_selected') },
                  { label: t('guest_count'), value: String(guestCount) },
                  ...(childrenActive ? [{ label: t('children_table'), value: `${childrenTableCategory!.name} · ${childrenCount}` }] : []),
                  ...(eventDate ? [{ label: t('event_date'), value: new Date(eventDate).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) }] : []),
                  ...(eventTime ? [{ label: t('event_time'), value: eventTime }] : []),
                  ...(eventType === 'BIRTHDAY' && birthdayPersonName ? [{ label: t('birthday_person_name'), value: birthdayPersonName }] : []),
                  ...(eventType === 'WEDDING' && brideName ? [{ label: t('bride_name'), value: brideName }] : []),
                  ...(eventType === 'WEDDING' && groomName ? [{ label: t('groom_name'), value: groomName }] : []),
                  ...(!['BIRTHDAY', 'WEDDING'].includes(eventType) && honoreePersonName ? [{ label: t('honoree_person_name'), value: honoreePersonName }] : []),
                  ...(eventNotes ? [{ label: t('notes'), value: eventNotes }] : []),
                ].map(({ label, value }) => (
                  <div key={label} className="rounded-2xl px-4 py-3"
                    style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}>
                    <p className="rg-label">{label}</p>
                    <p className="mt-0.5 text-sm font-medium text-white">{value}</p>
                  </div>
                ))}
              </div>
            </section>

            {/* Selected items */}
            <section className="rg-card p-4 sm:p-6 reveal">
              <p className="rg-heading mb-4">{t('selected_menu_items')}</p>
              {isLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="rg-shimmer h-14 rounded-2xl" style={{ animationDelay: `${i * 80}ms` }} />
                  ))}
                </div>
              ) : selectedMenuItems.length === 0 ? (
                <p className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>{t('no_items_selected')}</p>
              ) : (
                <div className="space-y-2">
                  {selectedMenuItems.map((item) => (
                    <div key={item.id} className="flex items-center justify-between gap-3 rounded-2xl px-3 sm:px-4 py-3"
                      style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}>
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="flex h-7 min-w-7 shrink-0 items-center justify-center rounded-full px-2 text-xs font-bold"
                          style={{ background: 'var(--rg-accent)', color: 'var(--rg-bg)' }}>
                          ×{guestCount}
                        </span>
                        <p className="text-sm font-medium text-white truncate">{dishName(item, locale)}</p>
                      </div>
                      <p className="text-sm font-semibold whitespace-nowrap" style={{ color: 'var(--rg-accent)' }}>
                        {formatSum(item.priceCents * guestCount)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>

          {/* ── Sidebar ── */}
          <aside className="min-w-0 space-y-4 lg:sticky lg:top-6 lg:self-start">

            {/* Pricing */}
            <section className="overflow-hidden rounded-2xl sm:rounded-3xl reveal" style={{
              background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', backdropFilter: 'blur(12px)' }}>
              <div className="px-4 sm:px-6 py-3 sm:py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                <p className="rg-label">{t('pricing')}</p>
              </div>

              {/* Discount control */}
              <div className="px-4 sm:px-6 pt-3 sm:pt-4">
                <label className="flex items-center gap-3 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={discountEnabled}
                    onChange={(e) => setDiscountEnabled(e.target.checked)}
                    style={{ accentColor: 'var(--rg-accent)', width: 18, height: 18 }}
                  />
                  <span className="text-sm" style={{ color: 'rgba(255,255,255,0.8)' }}>{t('apply_discount')}</span>
                </label>
                {discountEnabled && (
                  <div className="mt-3 flex items-center gap-2">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={discountText}
                      onChange={(e) => setDiscountText(e.target.value)}
                      placeholder="0"
                      className="rg-input"
                      style={{ width: 110 }}
                    />
                    <span className="text-sm font-semibold" style={{ color: 'var(--rg-accent)' }}>%</span>
                  </div>
                )}
              </div>

              {/* Price per guest */}
              <div className="px-4 sm:px-6 pt-3 sm:pt-4">
                <div className="flex items-baseline justify-between gap-2 py-3"
                  style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                  <span style={{ color: 'rgba(255,255,255,0.55)' }} className="text-sm">{t('price_per_guest')}</span>
                  <div className="flex flex-col items-end">
                    {hasDiscount && (
                      <span className="flex items-center gap-2">
                        <span className="text-xs whitespace-nowrap line-through" style={{ color: 'rgba(255,255,255,0.45)' }}>
                          {formatSum(originalPerGuestCents)}
                        </span>
                        <span className="rounded-full px-1.5 py-0.5 text-[10px] font-bold"
                          style={{ background: '#dc2626', color: '#fff' }}>
                          −{discountPercent}%
                        </span>
                      </span>
                    )}
                    <span className="font-semibold whitespace-nowrap text-white">
                      {formatSum(finalPerGuestCents)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Children's table line */}
              {childrenActive && (
                <div className="px-4 sm:px-6 pt-3">
                  <div className="flex items-baseline justify-between gap-2 py-3"
                    style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                    <span style={{ color: 'rgba(255,255,255,0.55)' }} className="text-sm">
                      {t('children_table')}
                      <span style={{ color: 'rgba(255,255,255,0.4)' }}> · {childrenCount} × {formatSum(childrenTableCategory!.ratePerPerson)}</span>
                    </span>
                    <span className="font-semibold whitespace-nowrap text-white">
                      {formatSum(finalChildrenSubtotalCents)}
                    </span>
                  </div>
                </div>
              )}

              {/* Total */}
              <div className="px-4 sm:px-6 pb-4 sm:pb-6 pt-3 sm:pt-4">
                <div className="rounded-2xl px-4 sm:px-5 py-3 sm:py-4"
                  style={{ background: 'rgba(var(--rg-accent-rgb),0.15)', border: '1px solid rgba(var(--rg-accent-rgb),0.4)' }}>
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="rg-label">{t('total')}</span>
                    <div className="flex flex-col items-end">
                      {hasDiscount && (
                        <span className="flex items-center gap-2">
                          <span className="text-sm whitespace-nowrap line-through" style={{ color: 'rgba(255,255,255,0.5)' }}>
                            {formatSum(originalTotalCents)}
                          </span>
                          <span className="rounded-full px-2 py-0.5 text-xs font-bold"
                            style={{ background: '#dc2626', color: '#fff' }}>
                            −{discountPercent}%
                          </span>
                        </span>
                      )}
                      <span className="text-lg sm:text-2xl font-bold whitespace-nowrap" style={{ color: 'var(--rg-accent)' }}>
                        {formatSum(finalTotalCents)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* Actions */}
            <section className="rg-card p-4 sm:p-5 space-y-3 reveal">
              <p className="rg-label">{t('actions')}</p>

              <button type="button" onClick={() => navigate('/tablet')}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-medium transition-all"
                style={{ background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.75)', border: '1px solid rgba(255,255,255,0.15)' }}>
                ← {t('edit_selection')}
              </button>

              <button type="button"
                disabled={confirmDisabled || isSubmitting}
                onClick={handleConfirm}
                className="w-full rounded-xl py-3 text-sm font-bold transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed hover:shadow-lg"
                style={{ background: 'var(--rg-accent)', color: 'var(--rg-bg)' }}>
                {isSubmitting ? t('submitting') : t('confirm')}
              </button>

              {submitError && (
                <p className="text-center text-xs" style={{ color: '#fca5a5' }}>{submitError}</p>
              )}

              <div className="grid gap-2 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                {[
                  { label: t('download_pdf'), fn: () => downloadBlob('/public/export/pdf', 'selection-summary.pdf'),
                    icon: 'M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
                  { label: t('download_excel'), fn: () => downloadBlob('/public/export/excel', 'selection-summary.xlsx'),
                    icon: 'M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
                ].map(({ label, fn, icon }) => (
                  <button key={label} type="button" onClick={fn}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-medium transition-all"
                    style={{ background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.75)', border: '1px solid rgba(255,255,255,0.15)' }}>
                    <svg className="h-4 w-4" style={{ color: 'rgba(var(--rg-accent-rgb),0.7)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={icon} />
                    </svg>
                    {label}
                  </button>
                ))}
              </div>
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
};
