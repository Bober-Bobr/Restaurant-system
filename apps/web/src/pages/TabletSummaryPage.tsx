import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Select } from '../components/ui/select';
import { usePriceCalculator } from '../hooks/usePriceCalculator';
import { usePublicDataStore } from '../store/publicData.store';
import { useTabletStore } from '../store/tablet.store';
import { eventService } from '../services/event.service';
import { httpClient } from '../services/http';
import logo from '../assets/logo.png';
import { Locale, locales, translate } from '../utils/translate';
import type { Event } from '../types/domain';

type EventType = NonNullable<Event['eventType']>;
const eventTypes: EventType[] = ['RESERVATION', 'BANQUET', 'WEDDING', 'BIRTHDAY', 'PRIVATE_PARTY', 'CORPORATE'];

export const TabletSummaryPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const restaurantId = searchParams.get('restaurantId') ?? '';
  const { selectedItems, selectedHallId, selectedTableCategoryId, guestCount, locale, setLocale, reset } = useTabletStore();
  const menuItems       = usePublicDataStore((s) => s.menuItems);
  const halls           = usePublicDataStore((s) => s.halls);
  const tableCategories = usePublicDataStore((s) => s.tableCategories);
  const isLoading       = usePublicDataStore((s) => s.isLoading);
  const loadPublicData  = usePublicDataStore((s) => s.loadPublicData);

  const [customerName, setCustomerName]         = useState('');
  const [customerPhone, setCustomerPhone]       = useState('');
  const [eventDate, setEventDate]               = useState('');
  const [eventTime, setEventTime]               = useState('');
  const [eventNotes, setEventNotes]             = useState('');
  const [eventType, setEventType]               = useState<EventType>('RESERVATION');
  const [birthdayPersonName, setBirthdayPersonName] = useState('');
  const [brideName, setBrideName]               = useState('');
  const [groomName, setGroomName]               = useState('');
  const [honoreePersonName, setHonoreeName]     = useState('');
  const [isSubmitting, setIsSubmitting]         = useState(false);
  const [confirmedEventId, setConfirmedEventId] = useState<number | null>(null);
  const [submitError, setSubmitError]           = useState<string | null>(null);

  const t = (key: Parameters<typeof translate>[0], params?: Record<string, string | number>) =>
    translate(key, locale, params);

  useEffect(() => {
    if (restaurantId) loadPublicData(restaurantId);
  }, [loadPublicData, restaurantId]);

  const selectedTableCategory = tableCategories.find((tc) => tc.id === selectedTableCategoryId);
  const selectedHall          = halls.find((h) => h.id === selectedHallId);
  const selectedMenuItems     = useMemo(
    () => (menuItems || []).filter((item) => selectedItems[item.id] > 0),
    [menuItems, selectedItems]
  );

  const pricing       = usePriceCalculator(menuItems ?? [], selectedItems, selectedTableCategory, guestCount);
  const confirmDisabled = !customerName.trim() || !customerPhone.trim() || !eventDate || !eventTime;

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
        notes: eventNotes.trim() || undefined,
        birthdayPersonName:  eventType === 'BIRTHDAY' && birthdayPersonName.trim() ? birthdayPersonName.trim() : undefined,
        brideName:           eventType === 'WEDDING' && brideName.trim() ? brideName.trim() : undefined,
        groomName:           eventType === 'WEDDING' && groomName.trim() ? groomName.trim() : undefined,
        honoreePersonName:   !['BIRTHDAY', 'WEDDING'].includes(eventType) && honoreePersonName.trim() ? honoreePersonName.trim() : undefined,
      });
      setConfirmedEventId(event.id);
      reset();
    } catch {
      setSubmitError(t('event_create_error'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const downloadBlob = async (url: string, filename: string) => {
    try {
      const response = await httpClient.post(
        url,
        { customerName, customerPhone, hallName: selectedHall?.name || '', tableCategoryName: selectedTableCategory?.name || '', guestCount, selectedItems, menuItems: menuItems || [], pricing, locale, restaurantName: 'Madinabek' },
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

  const pricingRows = [
    { key: 'subtotal',    label: t('subtotal'),        value: pricing.subtotalCents },
    { key: 'service_fee', label: t('service_fee'),     value: pricing.serviceFeeCents },
    { key: 'tax',         label: t('tax'),             value: pricing.taxCents },
    ...(guestCount > 1
      ? [{ key: 'per_guest', label: t('price_per_guest'), value: pricing.perGuestCents }]
      : []),
  ];

  // ── Shared header ─────────────────────────────────────────────────────────
  const PageHeader = () => (
    <header className="tablet-fade-in overflow-hidden rounded-[32px] bg-stone-900 px-8 py-6 shadow-xl">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <img
            src={logo}
            alt="logo"
            className="h-14 w-14 rounded-2xl object-cover shadow-lg ring-2 ring-stone-500 ring-offset-2 ring-offset-stone-900 bg-white"
          />
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.3em] text-stone-400">Madinabek</p>
            <h1 className="text-2xl font-semibold text-white">{t('selection_summary')}</h1>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Select
            value={locale}
            onChange={(e) => setLocale(e.target.value as Locale)}
            className="w-auto border-stone-700 bg-stone-800 text-black focus:border-stone-500 focus:ring-stone-700"
            disabled={isLoading}
          >
            {locales.map((l) => (
              <option key={l} value={l}>
                {t(l === 'en' ? 'english' : l === 'ru' ? 'russian' : 'uzbek')}
              </option>
            ))}
          </Select>
        </div>
      </div>
    </header>
  );

  // ── Success screen ────────────────────────────────────────────────────────
  if (confirmedEventId !== null) {
    return (
      <main className="min-h-screen bg-[#f9f7f4] px-4 py-12 sm:px-6">
        <div className="mx-auto max-w-md space-y-6">
          <PageHeader />

          <div className="card p-10 text-center space-y-6 tablet-fade-up" style={{ animationDelay: '80ms' }}>
            <div className="scale-in mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-emerald-50">
              <svg className="h-12 w-12 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div className="space-y-2">
              <p className="text-2xl font-semibold text-stone-900">{t('event_confirmed')}</p>
              <p className="text-sm text-stone-500">{t('thank_you')}</p>
              <p className="mt-3 font-mono text-sm text-stone-400">Event #{confirmedEventId}</p>
            </div>
            <Button
              size="lg"
              className="w-full"
              onClick={() => {
                setConfirmedEventId(null);
                setCustomerName(''); setCustomerPhone(''); setEventDate(''); setEventTime('');
                setEventNotes(''); setEventType('RESERVATION');
                setBirthdayPersonName(''); setBrideName(''); setGroomName(''); setHonoreeName('');
                navigate('/tablet');
              }}
            >
              {t('start_new_booking')}
            </Button>
          </div>
        </div>
      </main>
    );
  }

  // ── Main summary screen ───────────────────────────────────────────────────
  return (
    <main className="min-h-screen bg-[#f9f7f4] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <PageHeader />

        <div className="grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">

          {/* ── Left column ── */}
          <div className="space-y-6">

            {/* Customer details */}
            <section className="card p-6 tablet-fade-up" style={{ animationDelay: '60ms' }}>
              <p className="section-heading">{t('customer_details')}</p>
              <p className="mt-1 mb-5 text-sm text-stone-500">{t('enter_customer_information')}</p>

              <div className="grid gap-4">
                <div className="grid gap-1.5">
                  <label className="text-xs font-semibold uppercase tracking-widest text-stone-400">
                    {t('customer_name')}
                  </label>
                  <Input
                    placeholder={t('customer_name')}
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                  />
                </div>

                <div className="grid gap-1.5">
                  <label className="text-xs font-semibold uppercase tracking-widest text-stone-400">
                    {t('customer_phone')}
                  </label>
                  <Input
                    placeholder={t('customer_phone')}
                    type="tel"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-1.5">
                    <label className="text-xs font-semibold uppercase tracking-widest text-stone-400">
                      {t('event_date')}
                    </label>
                    <Input
                      type="date"
                      value={eventDate}
                      onChange={(e) => setEventDate(e.target.value)}
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <label className="text-xs font-semibold uppercase tracking-widest text-stone-400">
                      {t('event_time')}
                    </label>
                    <Input
                      type="time"
                      value={eventTime}
                      onChange={(e) => setEventTime(e.target.value)}
                    />
                  </div>
                </div>

                <div className="grid gap-1.5">
                  <label className="text-xs font-semibold uppercase tracking-widest text-stone-400">
                    {t('event_type')}
                  </label>
                  <Select value={eventType} onChange={(e) => setEventType(e.target.value as EventType)}>
                    {eventTypes.map((type) => (
                      <option key={type} value={type}>
                        {t(`event_type_${type.toLowerCase()}` as Parameters<typeof t>[0])}
                      </option>
                    ))}
                  </Select>
                </div>

                {eventType === 'BIRTHDAY' && (
                  <div className="grid gap-1.5 tablet-fade-in">
                    <label className="text-xs font-semibold uppercase tracking-widest text-stone-400">
                      {t('birthday_person_name')}
                    </label>
                    <Input
                      placeholder={t('birthday_person_name_placeholder')}
                      value={birthdayPersonName}
                      onChange={(e) => setBirthdayPersonName(e.target.value)}
                    />
                  </div>
                )}

                {eventType === 'WEDDING' && (
                  <>
                    <div className="grid gap-1.5 tablet-fade-in">
                      <label className="text-xs font-semibold uppercase tracking-widest text-stone-400">
                        {t('bride_name')}
                      </label>
                      <Input
                        placeholder={t('bride_groom_name_placeholder')}
                        value={brideName}
                        onChange={(e) => setBrideName(e.target.value)}
                      />
                    </div>
                    <div className="grid gap-1.5 tablet-fade-in">
                      <label className="text-xs font-semibold uppercase tracking-widest text-stone-400">
                        {t('groom_name')}
                      </label>
                      <Input
                        placeholder={t('bride_groom_name_placeholder')}
                        value={groomName}
                        onChange={(e) => setGroomName(e.target.value)}
                      />
                    </div>
                  </>
                )}

                {!['BIRTHDAY', 'WEDDING'].includes(eventType) && (
                  <div className="grid gap-1.5 tablet-fade-in">
                    <label className="text-xs font-semibold uppercase tracking-widest text-stone-400">
                      {t('honoree_person_name')}
                    </label>
                    <Input
                      placeholder={t('honoree_person_name_placeholder')}
                      value={honoreePersonName}
                      onChange={(e) => setHonoreeName(e.target.value)}
                    />
                  </div>
                )}

                <div className="grid gap-1.5">
                  <label className="text-xs font-semibold uppercase tracking-widest text-stone-400">
                    {t('notes')}
                    <span className="ml-1 normal-case font-normal text-stone-300">
                      ({t('description_optional').toLowerCase()})
                    </span>
                  </label>
                  <textarea
                    rows={3}
                    placeholder={t('notes_placeholder')}
                    value={eventNotes}
                    onChange={(e) => setEventNotes(e.target.value)}
                    className="w-full resize-none rounded-xl border-2 border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-600 focus:outline-none focus:ring-2 focus:ring-slate-300"
                  />
                </div>
              </div>
            </section>

            {/* Event overview */}
            <section className="card p-6 tablet-fade-up" style={{ animationDelay: '100ms' }}>
              <p className="section-heading mb-4">{t('event_details')}</p>

              <div className="grid gap-2 sm:grid-cols-2">
                {[
                  { label: t('event_type'), value: t(`event_type_${eventType.toLowerCase()}` as Parameters<typeof t>[0]) },
                  { label: t('hall'), value: selectedHall?.name || t('not_selected') },
                  { label: t('table_category'), value: selectedTableCategory?.name || t('not_selected') },
                  { label: t('guest_count'), value: String(guestCount) },
                  ...(eventDate ? [{ label: t('event_date'), value: new Date(eventDate).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) }] : []),
                  ...(eventTime ? [{ label: t('event_time'), value: eventTime }] : []),
                  ...(eventType === 'BIRTHDAY' && birthdayPersonName ? [{ label: t('birthday_person_name'), value: birthdayPersonName }] : []),
                  ...(eventType === 'WEDDING' && brideName ? [{ label: t('bride_name'), value: brideName }] : []),
                  ...(eventType === 'WEDDING' && groomName ? [{ label: t('groom_name'), value: groomName }] : []),
                  ...(!['BIRTHDAY', 'WEDDING'].includes(eventType) && honoreePersonName ? [{ label: t('honoree_person_name'), value: honoreePersonName }] : []),
                  ...(eventNotes ? [{ label: t('notes'), value: eventNotes }] : []),
                ].map(({ label, value }) => (
                  <div key={label} className="rounded-2xl bg-stone-50 px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-widest text-stone-400">{label}</p>
                    <p className="mt-0.5 text-sm font-medium text-stone-900">{value}</p>
                  </div>
                ))}
              </div>
            </section>

            {/* Selected items */}
            <section className="card p-6 tablet-fade-up" style={{ animationDelay: '140ms' }}>
              <p className="section-heading mb-4">{t('selected_menu_items')}</p>

              {isLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="skeleton-shimmer h-14 rounded-2xl" style={{ animationDelay: `${i * 80}ms` }} />
                  ))}
                </div>
              ) : selectedMenuItems.length === 0 ? (
                <p className="text-sm text-stone-400">{t('no_items_selected')}</p>
              ) : (
                <div className="space-y-2">
                  {selectedMenuItems.map((item) => (
                    <div key={item.id} className="flex items-center justify-between rounded-2xl bg-stone-50 px-4 py-3">
                      <div className="flex items-center gap-3">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-stone-900 text-xs font-bold text-white">
                          {selectedItems[item.id]}
                        </span>
                        <p className="text-sm font-medium text-stone-900">{item.name}</p>
                      </div>
                      <p className="text-sm font-semibold text-stone-900">
                        ${((item.priceCents * selectedItems[item.id]) / 100).toFixed(2)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>

          {/* ── Sidebar ── */}
          <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">

            {/* Pricing */}
            <section
              className="overflow-hidden rounded-3xl border border-stone-200 bg-white shadow-sm tablet-fade-up"
              style={{ animationDelay: '80ms' }}
            >
              <div className="bg-stone-900 px-6 py-4">
                <p className="text-xs font-semibold uppercase tracking-widest text-stone-400">
                  {t('pricing')}
                </p>
              </div>
              <div className="px-6 pt-2 pb-2">
                <div className="divide-y divide-stone-100">
                  {pricingRows.map(({ key, label, value }) => (
                    <div key={key} className="flex items-center justify-between py-3 text-sm">
                      <span className="text-stone-500">{label}</span>
                      <span className="font-medium text-stone-900">${(value / 100).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="px-6 pb-6">
                <div className="rounded-2xl bg-stone-900 px-5 py-4 text-white">
                  <div className="flex items-baseline justify-between">
                    <span className="text-xs font-semibold uppercase tracking-widest text-stone-400">
                      {t('total')}
                    </span>
                    <span className="text-2xl font-bold">
                      ${(pricing.totalCents / 100).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            </section>

            {/* Actions */}
            <section
              className="card p-5 space-y-3 tablet-fade-up"
              style={{ animationDelay: '120ms' }}
            >
              <p className="text-xs font-semibold uppercase tracking-widest text-stone-400">
                {t('actions')}
              </p>

              <button
                type="button"
                onClick={() => navigate('/tablet')}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-stone-200 bg-white px-5 py-2.5 text-sm font-medium text-stone-700 transition-colors hover:bg-stone-50"
              >
                ← {t('edit_selection')}
              </button>

              <Button
                className="w-full"
                size="lg"
                disabled={confirmDisabled || isSubmitting}
                onClick={handleConfirm}
              >
                {isSubmitting ? t('submitting') : t('confirm')}
              </Button>

              {submitError && (
                <p className="text-center text-xs text-red-600">{submitError}</p>
              )}

              <div className="border-t border-stone-100 pt-3 grid gap-2">
                <button
                  type="button"
                  onClick={() => downloadBlob('/public/export/pdf', 'selection-summary.pdf')}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-stone-200 bg-white px-5 py-2.5 text-sm font-medium text-stone-700 transition-colors hover:bg-stone-50"
                >
                  <svg className="h-4 w-4 text-stone-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  {t('download_pdf')}
                </button>
                <button
                  type="button"
                  onClick={() => downloadBlob('/public/export/excel', 'selection-summary.xlsx')}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-stone-200 bg-white px-5 py-2.5 text-sm font-medium text-stone-700 transition-colors hover:bg-stone-50"
                >
                  <svg className="h-4 w-4 text-stone-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  {t('download_excel')}
                </button>
              </div>
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
};
