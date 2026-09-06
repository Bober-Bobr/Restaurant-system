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
import type { Event, EventMenuConfig, ExtraService, TableCategoryPackageItem } from '../types/domain';
import { formatSum, groupDigits, parseSumToTiyin } from '../utils/currency';
import { MoneyInput } from '../components/ui/MoneyInput';
import { tableCategoryLabel } from '../utils/tableCategoryLabel';
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
  title, locale, setLocale, isLoading, t, restaurantLogoUrl, restaurantName, onBack,
}: {
  title: string;
  locale: Locale;
  setLocale: (l: Locale) => void;
  isLoading: boolean;
  t: (key: Parameters<typeof translate>[0]) => string;
  restaurantLogoUrl: string | null;
  restaurantName: string | null;
  // When provided, a prominent "Back" button is rendered top-left, beneath the logo.
  onBack?: () => void;
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
            <h1 className="rg-display text-base sm:text-2xl text-white truncate">{title}</h1>
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

      {/* Prominent "Back" — top-left of the screen, directly beneath the logo. */}
      {onBack && (
        <div className="mt-4 flex">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-2.5 rounded-2xl px-6 sm:px-8 py-3 sm:py-4 text-base sm:text-lg font-bold transition-all duration-200 hover:shadow-lg active:scale-[0.98]"
            style={{
              background: 'rgba(var(--rg-accent-rgb),0.16)',
              color: 'var(--rg-accent)',
              border: '1.5px solid rgba(var(--rg-accent-rgb),0.45)',
            }}
          >
            <svg className="h-5 w-5 sm:h-6 sm:w-6" fill="none" stroke="currentColor" strokeWidth={2.4} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            {t('back')}
          </button>
        </div>
      )}
    </header>
  );
}

// ── Additional-service card (media + price + Select) ──────────────────────

const isVideoUrl = (url: string) => /\.(mp4|webm|ogg|mov|m4v)$/i.test(url);

function ExtraServiceCard({
  service, selected, onToggle, t,
}: {
  service: ExtraService;
  selected: boolean;
  onToggle: () => void;
  t: (key: Parameters<typeof translate>[0]) => string;
}) {
  const media = service.media ?? [];
  const [index, setIndex] = useState(0);
  const current = media[Math.min(index, media.length - 1)];

  return (
    <div
      className="flex flex-col overflow-hidden rounded-2xl transition-all"
      style={{
        background: selected ? 'rgba(var(--rg-accent-rgb),0.12)' : 'rgba(255,255,255,0.06)',
        border: `1px solid ${selected ? 'rgba(var(--rg-accent-rgb),0.5)' : 'rgba(255,255,255,0.08)'}`,
      }}
    >
      {current && (
        <div style={{ position: 'relative', background: 'rgba(0,0,0,0.35)' }}>
          {isVideoUrl(current) ? (
            <video src={getPhotoUrl(current)} controls playsInline
              style={{ width: '100%', height: 170, objectFit: 'cover', display: 'block' }} />
          ) : (
            <img src={getPhotoUrl(current)} alt={service.name}
              style={{ width: '100%', height: 170, objectFit: 'cover', display: 'block' }} />
          )}
          {media.length > 1 && (
            <div className="absolute inset-x-0 bottom-0 flex justify-center gap-1.5 p-2">
              {media.map((m, i) => (
                <button
                  key={m}
                  type="button"
                  aria-label={`${i + 1}`}
                  onClick={() => setIndex(i)}
                  style={{
                    width: 8, height: 8, borderRadius: '50%', padding: 0, border: 'none', cursor: 'pointer',
                    background: i === index ? 'var(--rg-accent)' : 'rgba(255,255,255,0.5)',
                  }}
                />
              ))}
            </div>
          )}
        </div>
      )}

      <div className="flex flex-1 flex-col gap-2 p-4">
        <p className="text-sm font-semibold text-white">{service.name}</p>
        {service.description && (
          <p className="text-xs whitespace-pre-wrap" style={{ color: 'rgba(255,255,255,0.55)' }}>
            {service.description}
          </p>
        )}
        <p className="mt-auto pt-2 text-base font-bold" style={{ color: 'var(--rg-accent)' }}>
          {formatSum(service.priceCents)}
        </p>
        <button
          type="button"
          onClick={onToggle}
          className="w-full rounded-xl py-2.5 text-sm font-bold transition-all duration-200"
          style={selected
            ? { background: 'var(--rg-accent)', color: 'var(--rg-bg)' }
            : { background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.8)', border: '1px solid rgba(255,255,255,0.18)' }}
        >
          {selected ? `✓ ${t('selected')}` : t('select')}
        </button>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────

export const TabletSummaryPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const restaurantId = searchParams.get('restaurantId') ?? '';
  const { selectedItems, selectedHallId, selectedTableCategoryId, guestCount, replacements, removedPackageItemIds,
    childrenTableSelected, childrenCount, childReplacements,
    selectedHotAppetizerIds, childHotAppetizerIds,
    selectedFirstCourseId, selectedSecondCourseIds, selectedThirdCourseIds,
    childFirstCourseId, childSecondCourseIds, childThirdCourseIds,
    editingEventId,
    selectedExtraServiceIds, toggleExtraService,
    locale, setLocale, setGuestCount, reset,
    // Every field below lives in the STORE rather than in this page's useState,
    // so a reload or a browser Back keeps it: the store is persisted to session
    // storage, component state is not. They were local until a guest lost a
    // half-filled booking to a stray refresh.
    customerName, setCustomerName, customerPhone, setCustomerPhone,
    secondCustomerName, setSecondCustomerName, secondCustomerPhone, setSecondCustomerPhone,
    depositCents: draftDepositCents, setDepositCents,
    eventDate, setEventDate, eventTime, setEventTime,
    eventType, setEventType, eventNotes, setEventNotes,
    birthdayPersonName, setBirthdayPersonName,
    brideName, setBrideName, groomName, setGroomName,
    honoreePersonName, setHonoreePersonName } = useTabletStore();

  const menuItems         = usePublicDataStore((s) => s.menuItems);
  const halls             = usePublicDataStore((s) => s.halls);
  const tableCategories   = usePublicDataStore((s) => s.tableCategories);
  const extraServices     = usePublicDataStore((s) => s.extraServices);
  const restaurantName    = usePublicDataStore((s) => s.restaurantName);
  const restaurantLogoUrl = usePublicDataStore((s) => s.restaurantLogoUrl);
  const tabletAccentColor = usePublicDataStore((s) => s.tabletAccentColor);
  const tabletBgColor     = usePublicDataStore((s) => s.tabletBgColor);
  const moduleAddons      = usePublicDataStore((s) => s.moduleAddons);
  const isLoading         = usePublicDataStore((s) => s.isLoading);
  const loadPublicData    = usePublicDataStore((s) => s.loadPublicData);
  const themeStyle = tabletThemeVars({ accent: tabletAccentColor, bg: tabletBgColor }) as React.CSSProperties;

  // Reveal-on-scroll: re-scan once data finishes loading and sections render.
  const revealRef = useScrollReveal<HTMLDivElement>([isLoading]);

  // Most bookings have one contact, so the second pair is folded away behind a
  // button. It starts OPEN when the draft already carries one — an event opened
  // from the Events page for a couple, or a reload mid-edit, must not hide half
  // its contacts while still submitting them.
  const [showSecondCustomer, setShowSecondCustomer] = useState(
    !!secondCustomerName.trim() || !!secondCustomerPhone.trim(),
  );
  // The deposit keeps a local TEXT draft over the store's number, for the same
  // reason `adminMenuDraft` does: "1" on the way to "150" is an unfinished
  // number, not a commitment to a deposit of one so'm.
  const [depositText, setDepositText] = useState(draftDepositCents ? String(Math.round(draftDepositCents / 100)) : '');
  useEffect(() => { setDepositCents(parseSumToTiyin(depositText) ?? 0); }, [depositText, setDepositCents]);
  const [isSubmitting, setIsSubmitting]             = useState(false);
  const [confirmedEventId, setConfirmedEventId]     = useState<number | null>(null);
  const [submitError, setSubmitError]               = useState<string | null>(null);
  const [discountEnabled, setDiscountEnabled]       = useState(false);
  const [discountText, setDiscountText]             = useState('');
  // Manual total override — replaces the computed total (e.g. a negotiated price).
  const [manualTotalEnabled, setManualTotalEnabled] = useState(false);
  const [manualTotalText, setManualTotalText]       = useState('');
  const [confirmedExportSnapshot, setConfirmedExportSnapshot] = useState<null | {
    customerName: string; customerPhone: string; secondCustomerName: string; secondCustomerPhone: string;
    eventDate: string; hallName: string; tableCategoryName: string;
    guestCount: number; selectedItems: Record<string, number>; menuItems: typeof menuItems;
    includedDishes: { name: string; category: string; categoryLabel: string; servings: number }[];
    pricing: { perGuestCents: number; originalPerGuestCents: number; totalCents: number;
      originalTotalCents: number; discountPercent: number; hasDiscount: boolean;
      depositCents: number; amountDueCents: number; guestCount: number };
    childrenTableName?: string; childrenCount?: number; childrenRateCents?: number; childrenSubtotalCents?: number;
    childrenDishes?: { name: string; category: string; categoryLabel: string; servings: number }[];
    extraServices?: { name: string; description?: string | null; priceCents: number }[];
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

  const pricing        = usePriceCalculator(menuItems ?? [], pricedSelections, selectedTableCategory, guestCount, removedPackageItemIds);
  // Who the booking is for, when it is, where it is, what package, and for how
  // many. The hall makes it schedulable, the package makes it priceable, and the
  // package is a PER-PERSON price — so a booking with no head count has no total,
  // and quoting one is what the kiosk is for.
  //
  // This is the kiosk booking flow ONLY. The Events page still creates an
  // entirely blank event for staff to fill in later, which is why the API keeps
  // defaulting `guestCount` to 0 rather than requiring it (§41): the requirement
  // belongs to this screen, not to the record.
  const confirmDisabled = !customerName.trim() || !customerPhone.trim() || !eventDate || !eventTime
    || !selectedHallId || !selectedTableCategoryId || guestCount < 1;

  // The export lists the dishes that make up the table: the non-course included
  // dishes (honoring the guest's free swaps) PLUS the first/second/third courses
  // the guest actually selected. Course options the guest didn't pick are left
  // out, but every other included dish is shown.
  // Hot appetizers are also a guest choice now (up to two), so unpicked ones must
  // not be dumped into the included list — they're handled like the courses below.
  const COURSE_CATEGORIES = ['HOT_APPETIZERS', 'FIRST_COURSE', 'SECOND_COURSE', 'THIRD_COURSE'];
  const dishEntry = (name: string, category: string, servings?: number) => ({
    name,
    category,
    categoryLabel: t(category.toLowerCase() as Parameters<typeof translate>[0]),
    servings: servings ?? 1,
  });

  const buildTableDishes = (
    packageItems: TableCategoryPackageItem[],
    swaps: Record<string, string>,
    firstId: string | undefined,
    secondIds: string[],
    thirdIds: string[],
    hotAppetizerIds: string[],
    removed: string[] = [],
  ) => {
    // Fixed included dishes (salads, appetizers, …), with free swaps applied.
    // Dishes the guest took off the table are gone from the document too — they
    // have already been deducted from the price, so listing them would tell the
    // kitchen to cook something nobody is paying for.
    const included = packageItems
      .filter((pi) => !COURSE_CATEGORIES.includes(pi.menuItem.category) && !removed.includes(pi.id))
      .map((pi) => {
        const swapId = swaps[pi.id];
        const dish = swapId ? ((menuItems ?? []).find((m) => m.id === swapId) ?? pi.menuItem) : pi.menuItem;
        return dishEntry(dish.name, dish.category, pi.servings);
      });
    // Only the selected courses, in course order.
    const course = (category: string, isSelected: (id: string) => boolean) =>
      packageItems
        .filter((pi) => pi.menuItem.category === category && isSelected(pi.menuItem.id))
        .map((pi) => dishEntry(pi.menuItem.name, pi.menuItem.category, pi.servings));
    return [
      ...course('HOT_APPETIZERS', (id) => hotAppetizerIds.includes(id)),
      ...included,
      ...course('FIRST_COURSE', (id) => id === firstId),
      ...course('SECOND_COURSE', (id) => secondIds.includes(id)),
      ...course('THIRD_COURSE', (id) => thirdIds.includes(id)),
    ];
  };

  const buildIncludedDishes = () =>
    buildTableDishes(
      selectedTableCategory?.packageItems ?? [], replacements,
      selectedFirstCourseId, selectedSecondCourseIds, selectedThirdCourseIds,
      selectedHotAppetizerIds,
      removedPackageItemIds,
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
      ? buildTableDishes(
          childrenTableCategory!.packageItems ?? [], childReplacements,
          childFirstCourseId, childSecondCourseIds, childThirdCourseIds,
          childHotAppetizerIds,
        )
      : [];

  // Additional restaurant services the guest ticked — a flat per-event cost each,
  // added on top of the per-guest table pricing.
  const selectedServices = useMemo(
    () => (extraServices || []).filter((s) => selectedExtraServiceIds.includes(s.id)),
    [extraServices, selectedExtraServiceIds],
  );
  const servicesSubtotalCents = selectedServices.reduce((sum, s) => sum + s.priceCents, 0);

  const originalPerGuestCents = pricing.perGuestCents;
  const computedPerGuestCents = Math.round(originalPerGuestCents * factor);
  // Total includes the optional children's table and any chosen extra services
  // (the adult per-guest figure is unchanged).
  const originalTotalCents = pricing.subtotalCents + childrenSubtotalCents + servicesSubtotalCents;
  const computedTotalCents = Math.round(originalTotalCents * factor);
  const finalChildrenSubtotalCents = Math.round(childrenSubtotalCents * factor);

  // Manual total override — when enabled with a valid amount, it REPLACES the
  // computed total (discount included); the per-guest figure is derived from it
  // so the summary + exports stay internally consistent.
  const manualTotalCents = manualTotalEnabled ? (parseSumToTiyin(manualTotalText) ?? null) : null;
  const overriding = manualTotalCents != null;
  const finalTotalCents = overriding ? manualTotalCents : computedTotalCents;
  const finalPerGuestCents = overriding
    ? (guestCount > 0 ? Math.round(manualTotalCents / guestCount) : manualTotalCents)
    : computedPerGuestCents;
  // Discount visuals are suppressed while a manual total is in force.
  const showDiscount = hasDiscount && !overriding;

  // Prepaid deposit — subtracted from the (post-discount / manual) total.
  const depositCents = parseSumToTiyin(depositText) ?? 0;
  const amountDueCents = Math.max(0, finalTotalCents - depositCents);

  // Pricing payload for exports — per-guest and total figures.
  const exportPricing = {
    perGuestCents: finalPerGuestCents,
    originalPerGuestCents: overriding ? finalPerGuestCents : originalPerGuestCents,
    totalCents: finalTotalCents,
    originalTotalCents: overriding ? finalTotalCents : originalTotalCents,
    discountPercent: overriding ? 0 : discountPercent,
    hasDiscount: showDiscount,
    depositCents,
    amountDueCents,
    guestCount,
  };

  // Chosen services for the exports — discount is applied so the PDF adds up.
  const servicesExport = selectedServices.length > 0
    ? {
        extraServices: selectedServices.map((s) => ({
          name: s.name,
          description: s.description ?? null,
          priceCents: overriding ? s.priceCents : Math.round(s.priceCents * factor),
        })),
      }
    : {};

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

  // Snapshot of every tablet selection, persisted on the event so it round-trips
  // back to the tablet when the menu is edited later from the Events page.
  const buildMenuConfig = (): EventMenuConfig => ({
    hotAppetizerIds: selectedHotAppetizerIds,
    firstCourseId: selectedFirstCourseId,
    secondCourseIds: selectedSecondCourseIds,
    thirdCourseIds: selectedThirdCourseIds,
    replacements,
    removedPackageItemIds,
    childHotAppetizerIds: childrenActive ? childHotAppetizerIds : [],
    childFirstCourseId: childrenActive ? childFirstCourseId : undefined,
    childSecondCourseIds: childrenActive ? childSecondCourseIds : [],
    childThirdCourseIds: childrenActive ? childThirdCourseIds : [],
    childReplacements: childrenActive ? childReplacements : {},
    extras: Object.fromEntries(Object.entries(selectedItems).filter(([, q]) => q > 0)),
    extraServiceIds: selectedExtraServiceIds,
  });

  const handleConfirm = async () => {
    if (confirmDisabled || isSubmitting) return;
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      // Fields the menu flow owns — sent on both create and update.
      const menuFields = {
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim() || undefined,
        secondCustomerName: secondCustomerName.trim() || undefined,
        secondCustomerPhone: secondCustomerPhone.trim() || undefined,
        depositCents,
        eventDate: new Date(`${eventDate}T${eventTime}`).toISOString(),
        guestCount,
        status: 'CONFIRMED' as const,
        hallId: selectedHallId || undefined,
        tableCategoryId: selectedTableCategoryId || undefined,
        childrenTableCategoryId: childrenActive ? childrenTableCategory!.id : undefined,
        childrenCount: childrenActive ? childrenCount : 0,
        menuConfig: buildMenuConfig(),
      };
      // Editing an existing event (opened via the Events page) updates it in
      // place; otherwise a new event is created. Event-type/person fields are
      // only set on create so an admin edit doesn't clobber them.
      const event = editingEventId
        ? await eventService.update(editingEventId, menuFields)
        : await eventService.create({
            ...menuFields,
            eventType,
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
        secondCustomerName: secondCustomerName.trim(),
        secondCustomerPhone: secondCustomerPhone.trim(),
        eventDate: new Date(`${eventDate}T${eventTime}`).toISOString(),
        hallName: selectedHall?.name || '',
        tableCategoryName: selectedTableCategory?.name || '',
        guestCount,
        selectedItems: { ...pricedSelections },
        menuItems,
        includedDishes: buildIncludedDishes(),
        pricing: exportPricing,
        ...childrenExport,
        ...servicesExport,
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
        { customerName, customerPhone,
          secondCustomerName: secondCustomerName.trim() || undefined, secondCustomerPhone: secondCustomerPhone.trim() || undefined,
          eventDate: eventDate && eventTime ? new Date(`${eventDate}T${eventTime}`).toISOString() : undefined,
          hallName: selectedHall?.name || '', tableCategoryName: selectedTableCategory?.name || '',
          guestCount, selectedItems: pricedSelections, menuItems: menuItems || [], includedDishes, pricing: exportPricing, ...childrenExport, ...servicesExport, locale, restaurantName: restaurantName ?? '', restaurantLogoUrl: restaurantLogoUrl ?? null },
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

  // Hand the details already entered here over to the Additional Services page
  // so the honoree is not asked for the same things twice. The selections come
  // from the confirmed snapshot rather than live state — `reset()` clears the
  // tablet store as soon as the event is created.
  const buildAddonParams = () => {
    const params = new URLSearchParams();
    params.set('restaurantId', restaurantId);
    params.set('eventNumber', String(confirmedEventId));
    params.set('restaurantName', restaurantName ?? '');
    if (restaurantLogoUrl) params.set('restaurantLogoUrl', restaurantLogoUrl);
    if (tabletAccentColor) params.set('accent', tabletAccentColor);
    if (tabletBgColor) params.set('bg', tabletBgColor);

    params.set('eventType', eventType);
    // Whose celebration it is — a wedding names two people, so `name` repeats.
    const honorees = eventType === 'WEDDING'
      ? [brideName, groomName]
      : eventType === 'BIRTHDAY'
        ? [birthdayPersonName]
        : [honoreePersonName || customerName];
    for (const n of honorees.map((n) => n.trim()).filter(Boolean)) params.append('name', n);

    if (customerPhone.trim()) params.set('phone', customerPhone.trim());
    if (eventDate) params.set('eventDate', eventDate);
    if (eventTime) params.set('eventTime', eventTime);

    const snapshot = confirmedExportSnapshot;
    if (snapshot) {
      const lines: string[] = [];
      if (snapshot.tableCategoryName) lines.push(snapshot.tableCategoryName);
      for (const dish of snapshot.includedDishes ?? []) {
        const label = typeof dish === 'string' ? dish : (dish as { name?: string })?.name;
        if (label) lines.push(label);
      }
      const byId = new Map((snapshot.menuItems ?? []).map((m) => [m.id, m.name]));
      for (const id of Object.keys(snapshot.selectedItems ?? {})) {
        const label = byId.get(id);
        if (label) lines.push(label);
      }
      if (lines.length) params.set('menu', lines.join('\n'));
    }
    return params;
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
              <p className="rg-display text-2xl text-white">{t('event_confirmed')}</p>
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
            {/* Additional Services — only for restaurants that bought the
                module. Prominent, above the reset/back controls. */}
            {moduleAddons && (
              <div className="w-full" style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 16 }}>
                <button
                  type="button"
                  onClick={() => navigate({
                    pathname: '/tablet/additional-services',
                    search: buildAddonParams().toString(),
                  })}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-base font-bold transition-all duration-200 hover:shadow-lg"
                  style={{ background: 'var(--rg-accent)', color: 'var(--rg-bg)' }}
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                  </svg>
                  {t('addon_services_open')}
                </button>
              </div>
            )}

            <div className="grid gap-2 w-full" style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 16 }}>
              <button
                type="button"
                onClick={() => {
                  setConfirmedEventId(null);
                  setCustomerName(''); setCustomerPhone(''); setSecondCustomerName(''); setSecondCustomerPhone(''); setDepositText(''); setEventDate(''); setEventTime('');
                  setEventNotes(''); setEventType('RESERVATION');
                  setBirthdayPersonName(''); setBrideName(''); setGroomName(''); setHonoreePersonName('');
                  navigate('/tablet');
                }}
                className="w-full rounded-xl py-3 text-sm font-bold transition-all duration-200 hover:shadow-lg"
                // Steps down to an outline when the Additional Services button is
                // present, so the two do not compete as identical accent blocks.
                style={moduleAddons
                  ? { background: 'transparent', color: 'var(--rg-accent)', border: '1px solid rgba(var(--rg-accent-rgb),0.5)' }
                  : { background: 'var(--rg-accent)', color: 'var(--rg-bg)' }}
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
        {/* Back to the menu to tweak the current selection — the fromSummary flag
            tells the tablet to keep the saved table/settings/dishes instead of
            resetting to the table-category picker. */}
        <PageHeader title={t('selection_summary')} locale={locale} setLocale={setLocale} isLoading={isLoading} t={t} restaurantLogoUrl={restaurantLogoUrl} restaurantName={restaurantName}
          onBack={() => navigate('/tablet', { state: { fromSummary: true } })} />

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

                {/* A second contact is the exception — a wedding's two families,
                    a company booking with a deputy — so it is folded away rather
                    than sitting between the caller and the date as two more
                    fields to skip past. Closing it CLEARS both, or hidden values
                    would still be submitted with the booking. */}
                {!showSecondCustomer ? (
                  <button type="button" onClick={() => setShowSecondCustomer(true)}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-all"
                    style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.75)', border: '1px dashed rgba(var(--rg-accent-rgb),0.45)' }}>
                    <span aria-hidden="true" style={{ color: 'var(--rg-accent)', fontSize: 16, lineHeight: 1 }}>+</span>
                    {t('add_second_customer')}
                  </button>
                ) : (
                  <div className="grid gap-4 tablet-fade-in">
                    <div className="grid gap-1.5">
                      <label className="rg-label">{t('second_customer_name')}</label>
                      <input className="rg-input" placeholder={t('second_customer_name')}
                        value={secondCustomerName} onChange={(e) => setSecondCustomerName(e.target.value)} />
                    </div>

                    <div className="grid gap-1.5">
                      <label className="rg-label">{t('second_customer_phone')}</label>
                      <input className="rg-input" type="tel" placeholder={t('second_customer_phone')}
                        value={secondCustomerPhone} onChange={(e) => setSecondCustomerPhone(e.target.value)} />
                    </div>

                    <button type="button"
                      onClick={() => { setSecondCustomerName(''); setSecondCustomerPhone(''); setShowSecondCustomer(false); }}
                      className="justify-self-start text-xs font-medium underline underline-offset-4"
                      style={{ color: 'rgba(255,255,255,0.5)' }}>
                      {t('remove_second_customer')}
                    </button>
                  </div>
                )}

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
                  {/* Required, but still no `min`/`max` on the input: the 5000
                      ceiling was a guess enforced only by the API, so a bigger
                      event failed with a generic error naming nothing, and a
                      `min` would fight the typing rather than the empty value.
                      Negatives are clamped — the store does it too, but a number
                      typed here reaches the totals before it reaches the store. */}
                  <input className="rg-input" type="number"
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
                      value={honoreePersonName} onChange={(e) => setHonoreePersonName(e.target.value)} />
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
                  // A table category is a price package: naming it without its
                  // rate leaves the guest confirming a total they cannot check.
                  { label: t('table_category'), value: selectedTableCategory ? tableCategoryLabel(selectedTableCategory, t('person')) : t('not_selected') },
                  { label: t('guest_count'), value: String(guestCount) },
                  ...(childrenActive ? [{ label: t('children_table'), value: `${tableCategoryLabel(childrenTableCategory!, t('person'))} · ${childrenCount}` }] : []),
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

            {/* Additional restaurant services — shown before the booking is
                finalized; ticking one adds its price to the total. */}
            {extraServices.length > 0 && (
              <section className="rg-card p-4 sm:p-6 reveal">
                <p className="rg-heading">{t('extra_services')}</p>
                <p className="mt-1 mb-5 text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>
                  {t('extra_services_pick_hint')}
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  {extraServices.map((service) => (
                    <ExtraServiceCard
                      key={service.id}
                      service={service}
                      selected={selectedExtraServiceIds.includes(service.id)}
                      onToggle={() => toggleExtraService(service.id)}
                      t={t}
                    />
                  ))}
                </div>
                {servicesSubtotalCents > 0 && (
                  <div className="mt-4 flex items-baseline justify-between gap-2 rounded-2xl px-4 py-3"
                    style={{ background: 'rgba(var(--rg-accent-rgb),0.12)', border: '1px solid rgba(var(--rg-accent-rgb),0.35)' }}>
                    <span className="rg-label">{t('services_subtotal')}</span>
                    <span className="text-base font-bold whitespace-nowrap" style={{ color: 'var(--rg-accent)' }}>
                      {formatSum(servicesSubtotalCents)}
                    </span>
                  </div>
                )}
              </section>
            )}
          </div>

          {/* ── Sidebar ── */}
          <aside className="min-w-0 space-y-4 lg:sticky lg:top-6 lg:self-start">

            {/* Pricing */}
            <section className="overflow-hidden rounded-2xl sm:rounded-3xl reveal" style={{
              background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', backdropFilter: 'blur(12px)' }}>
              <div className="px-4 sm:px-6 py-3 sm:py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                <p className="rg-label">{t('pricing')}</p>
              </div>

              {/* Discount control — the label only appears once the box is ticked */}
              <div className="px-4 sm:px-6 pt-3 sm:pt-4">
                <label className="flex items-center gap-3 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={discountEnabled}
                    onChange={(e) => setDiscountEnabled(e.target.checked)}
                    style={{ accentColor: 'var(--rg-accent)', width: 18, height: 18 }}
                  />
                  {discountEnabled && (
                    <span className="text-sm" style={{ color: 'rgba(255,255,255,0.8)' }}>{t('apply_discount')}</span>
                  )}
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

                {/* Manual total override — the label only appears once ticked */}
                <label className="mt-3 flex items-center gap-3 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={manualTotalEnabled}
                    onChange={(e) => setManualTotalEnabled(e.target.checked)}
                    style={{ accentColor: 'var(--rg-accent)', width: 18, height: 18 }}
                  />
                  {manualTotalEnabled && (
                    <span className="text-sm" style={{ color: 'rgba(255,255,255,0.8)' }}>{t('edit_amount_manually')}</span>
                  )}
                </label>
                {manualTotalEnabled && (
                  <div className="mt-3 flex items-center gap-2">
                    <MoneyInput
                      value={manualTotalText}
                      onChange={setManualTotalText}
                      placeholder={groupDigits(String(Math.round(computedTotalCents / 100)))}
                      className="rg-input"
                      style={{ width: 200 }}
                    />
                    <span className="text-sm" style={{ color: 'rgba(255,255,255,0.6)' }}>so'm</span>
                  </div>
                )}

                {/* Deposit — subtracted from the total below */}
                <div className="mt-3">
                  <label className="rg-label">{t('deposit')}</label>
                  <div className="mt-1.5 flex items-center gap-2">
                    <MoneyInput
                      value={depositText}
                      onChange={setDepositText}
                      placeholder="0"
                      className="rg-input"
                      style={{ width: 160 }}
                    />
                    <span className="text-sm" style={{ color: 'rgba(255,255,255,0.6)' }}>so'm</span>
                  </div>
                </div>
              </div>

              {/* Price per guest */}
              <div className="px-4 sm:px-6 pt-3 sm:pt-4">
                <div className="flex items-baseline justify-between gap-2 py-3"
                  style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                  <span style={{ color: 'rgba(255,255,255,0.55)' }} className="text-sm">{t('price_per_guest')}</span>
                  <div className="flex flex-col items-end">
                    {showDiscount && (
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

              {/* Additional services line */}
              {selectedServices.length > 0 && (
                <div className="px-4 sm:px-6 pt-3">
                  <div className="flex items-baseline justify-between gap-2 py-3"
                    style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                    <span style={{ color: 'rgba(255,255,255,0.55)' }} className="text-sm">
                      {t('extra_services')}
                      <span style={{ color: 'rgba(255,255,255,0.4)' }}> · {selectedServices.length}</span>
                    </span>
                    <span className="font-semibold whitespace-nowrap text-white">
                      {formatSum(Math.round(servicesSubtotalCents * factor))}
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
                      {showDiscount && (
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

                {/* Deposit + amount due (only when a deposit was entered) */}
                {depositCents > 0 && (
                  <div className="mt-3 space-y-2">
                    <div className="flex items-baseline justify-between gap-2">
                      <span style={{ color: 'rgba(255,255,255,0.55)' }} className="text-sm">{t('deposit')}</span>
                      <span className="font-semibold whitespace-nowrap" style={{ color: '#f87171' }}>
                        −{formatSum(depositCents)}
                      </span>
                    </div>
                    <div className="rounded-2xl px-4 sm:px-5 py-3"
                      style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.14)' }}>
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="rg-label">{t('amount_due')}</span>
                        <span className="text-lg sm:text-2xl font-bold whitespace-nowrap text-white">
                          {formatSum(amountDueCents)}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </section>

            {/* Actions */}
            <section className="rg-card p-4 sm:p-5 space-y-3 reveal">
              <p className="rg-label">{t('actions')}</p>

              <button type="button"
                disabled={confirmDisabled || isSubmitting}
                onClick={handleConfirm}
                className="w-full rounded-xl py-3 text-sm font-bold transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed hover:shadow-lg"
                style={{ background: 'var(--rg-accent)', color: 'var(--rg-bg)' }}>
                {isSubmitting ? t('submitting') : t('confirm')}
              </button>

              {/* Neither can be chosen from this page, so say where to go. */}
              {(!selectedHallId || !selectedTableCategoryId || guestCount < 1) && (
                <p className="text-center text-xs" style={{ color: '#fca5a5' }}>
                  {!selectedHallId ? t('select_room_required')
                    : !selectedTableCategoryId ? t('choose_table_category')
                    : t('guest_count_required')}
                </p>
              )}

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
