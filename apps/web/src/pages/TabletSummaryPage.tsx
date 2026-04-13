import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Select } from '../components/ui/select';
import { Card } from '../components/ui/card';
import { usePriceCalculator } from '../hooks/usePriceCalculator';
import { usePublicDataStore } from '../store/publicData.store';
import { useTabletStore } from '../store/tablet.store';
import { eventService } from '../services/event.service';
import { httpClient } from '../services/http';
import logo from '../assets/logo.png';
import { Locale, locales, translate } from '../utils/translate';

export const TabletSummaryPage = () => {
  const navigate = useNavigate();
  const { selectedItems, selectedHallId, selectedTableCategoryId, guestCount, locale, setLocale, reset } = useTabletStore();
  const menuItems = usePublicDataStore((state) => state.menuItems);
  const halls = usePublicDataStore((state) => state.halls);
  const tableCategories = usePublicDataStore((state) => state.tableCategories);
  const isLoading = usePublicDataStore((state) => state.isLoading);
  const loadPublicData = usePublicDataStore((state) => state.loadPublicData);

  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [eventTime, setEventTime] = useState('');
  const [eventNotes, setEventNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmedEventId, setConfirmedEventId] = useState<number | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const t = (key: Parameters<typeof translate>[0], params?: Record<string, string | number>) => translate(key, locale, params);

  useEffect(() => {
    loadPublicData();
  }, [loadPublicData]);

  const selectedTableCategory = tableCategories.find((tc) => tc.id === selectedTableCategoryId);
  const selectedHall = halls.find((h) => h.id === selectedHallId);
  const selectedMenuItems = useMemo(
    () => (menuItems || []).filter((item) => selectedItems[item.id] > 0),
    [menuItems, selectedItems]
  );

  const pricing = usePriceCalculator(menuItems ?? [], selectedItems, selectedTableCategory, guestCount);

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
        hallId: selectedHallId || undefined,
        tableCategoryId: selectedTableCategoryId || undefined,
        notes: eventNotes.trim() || undefined,
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
        {
          customerName,
          customerPhone,
          hallName: selectedHall?.name || '',
          tableCategoryName: selectedTableCategory?.name || '',
          guestCount,
          selectedItems,
          menuItems: menuItems || [],
          pricing,
          locale,
          restaurantName: 'Madinabek'
        },
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

  // ── Success screen ────────────────────────────────────────────────────────
  if (confirmedEventId !== null) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-lg">
          <header className="mb-8 flex items-center gap-4">
            <img src={logo} alt="Madinabek logo" className="h-14 w-14 rounded-3xl object-cover" />
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-slate-500">Madinabek</p>
              <h1 className="page-heading">{t('selection_summary')}</h1>
            </div>
          </header>

          <Card className="p-8 text-center space-y-6">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100">
              <svg className="h-10 w-10 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div className="space-y-2">
              <p className="text-xl font-semibold text-slate-900">{t('event_confirmed')}</p>
              <p className="text-sm text-slate-500">
                {t('thank_you')}
              </p>
              <p className="mt-3 font-mono text-sm text-slate-400">Event #{confirmedEventId}</p>
            </div>
            <Button
              className="w-full"
              onClick={() => {
                setConfirmedEventId(null);
                setCustomerName('');
                setCustomerPhone('');
                setEventDate('');
                setEventTime('');
                setEventNotes('');
                navigate('/tablet');
              }}
            >
              {t('start_new_booking')}
            </Button>
          </Card>
        </div>
      </main>
    );
  }

  // ── Main summary screen ───────────────────────────────────────────────────
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="card flex flex-col gap-6 rounded-[32px] border-slate-200 bg-white p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <img src={logo} alt="Madinabek logo" className="h-16 w-16 rounded-3xl object-cover" />
            <div>
              <p className="text-sm uppercase tracking-[0.24em] text-slate-500">Madinabek</p>
              <h1 className="page-heading">{t('selection_summary')}</h1>
            </div>
          </div>
          <div className="flex flex-col items-start gap-3 sm:items-end">
            <span className="text-sm text-slate-500">{t('language')}</span>
            <Select value={locale} onChange={(event) => setLocale(event.target.value as Locale)} disabled={isLoading} className="w-full sm:w-auto">
              {locales.map((localeOption) => (
                <option key={localeOption} value={localeOption}>
                  {t(localeOption === 'en' ? 'english' : localeOption === 'ru' ? 'russian' : 'uzbek')}
                </option>
              ))}
            </Select>
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">
          <div className="space-y-6">

            {/* Customer + booking details */}
            <Card className="p-6">
              <div className="mb-4">
                <p className="section-heading">{t('customer_details')}</p>
                <p className="mt-1 text-sm text-slate-500">{t('enter_customer_information')}</p>
              </div>
              <div className="grid gap-4">
                <div className="grid gap-2">
                  <label className="text-sm font-medium text-slate-700">{t('customer_name')}</label>
                  <Input
                    placeholder={t('customer_name')}
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <label className="text-sm font-medium text-slate-700">{t('customer_phone')}</label>
                  <Input
                    placeholder={t('customer_phone')}
                    type="tel"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-2">
                    <label className="text-sm font-medium text-slate-700">{t('event_date')}</label>
                    <Input
                      type="date"
                      value={eventDate}
                      onChange={(e) => setEventDate(e.target.value)}
                    />
                  </div>
                  <div className="grid gap-2">
                    <label className="text-sm font-medium text-slate-700">{t('event_time')}</label>
                    <Input
                      type="time"
                      value={eventTime}
                      onChange={(e) => setEventTime(e.target.value)}
                    />
                  </div>
                </div>
                <div className="grid gap-2">
                  <label className="text-sm font-medium text-slate-700">
                    {t('notes')}
                    <span className="ml-1 font-normal text-slate-400">({t('description_optional').toLowerCase()})</span>
                  </label>
                  <textarea
                    rows={3}
                    placeholder={t('notes_placeholder')}
                    value={eventNotes}
                    onChange={(e) => setEventNotes(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200 resize-none"
                  />
                </div>
              </div>
            </Card>

            {/* Event details */}
            <Card className="p-6">
              <div className="mb-4">
                <p className="section-heading">{t('event_details')}</p>
                <p className="mt-1 text-sm text-slate-500">{t('overview_of_selection')}</p>
              </div>
              <div className="space-y-3 text-sm text-slate-600">
                <div className="rounded-3xl bg-slate-50 p-4">{t('hall')}: <span className="font-medium text-slate-800">{selectedHall?.name || t('not_selected')}</span></div>
                <div className="rounded-3xl bg-slate-50 p-4">{t('table_category')}: <span className="font-medium text-slate-800">{selectedTableCategory?.name || t('not_selected')}</span></div>
                <div className="rounded-3xl bg-slate-50 p-4">{t('guest_count')}: <span className="font-medium text-slate-800">{guestCount}</span></div>
                {eventDate && (
                  <div className="rounded-3xl bg-slate-50 p-4">
                    {t('event_date')}: <span className="font-medium text-slate-800">
                      {new Date(eventDate).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                )}
                {eventTime && (
                  <div className="rounded-3xl bg-slate-50 p-4">
                    {t('event_time')}: <span className="font-medium text-slate-800">{eventTime}</span>
                  </div>
                )}
                {eventNotes && (
                  <div className="rounded-3xl bg-slate-50 p-4">
                    {t('notes')}: <span className="font-medium text-slate-800">{eventNotes}</span>
                  </div>
                )}
              </div>
            </Card>

            {/* Selected menu items */}
            <Card className="p-6">
              <div className="mb-4">
                <p className="section-heading">{t('selected_menu_items')}</p>
                <p className="mt-1 text-sm text-slate-500">{t('review_selected_dishes')}</p>
              </div>
              {isLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 3 }).map((_, index) => (
                    <div key={index} className="h-16 rounded-3xl bg-slate-100" />
                  ))}
                </div>
              ) : selectedMenuItems.length === 0 ? (
                <p className="text-sm text-slate-500">{t('no_items_selected')}</p>
              ) : (
                <div className="space-y-3">
                  {selectedMenuItems.map((item) => (
                    <div key={item.id} className="flex items-center justify-between rounded-3xl bg-slate-50 p-4">
                      <div>
                        <p className="font-medium text-slate-900">{item.name}</p>
                        <p className="text-sm text-slate-500">x{selectedItems[item.id]}</p>
                      </div>
                      <p className="font-semibold text-slate-900">
                        ${((item.priceCents * selectedItems[item.id]) / 100).toFixed(2)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>

          <aside className="space-y-6">
            {/* Pricing */}
            <Card className="p-6">
              <div className="mb-4">
                <p className="section-heading">{t('pricing')}</p>
              </div>
              <div className="space-y-3 text-sm text-slate-600">
                <div className="flex items-center justify-between rounded-3xl bg-slate-50 p-4">
                  <span>{t('subtotal')}</span>
                  <span>${(pricing.subtotalCents / 100).toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between rounded-3xl bg-slate-50 p-4">
                  <span>{t('service_fee')}</span>
                  <span>${(pricing.serviceFeeCents / 100).toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between rounded-3xl bg-slate-50 p-4">
                  <span>{t('tax')}</span>
                  <span>${(pricing.taxCents / 100).toFixed(2)}</span>
                </div>
                {guestCount > 1 && (
                  <div className="flex items-center justify-between rounded-3xl bg-slate-50 p-4">
                    <span>{t('price_per_guest')}</span>
                    <span>${(pricing.perGuestCents / 100).toFixed(2)}</span>
                  </div>
                )}
                <div className="flex items-center justify-between rounded-3xl bg-slate-900 p-4 text-white">
                  <span>{t('total')}</span>
                  <span>${(pricing.totalCents / 100).toFixed(2)}</span>
                </div>
              </div>
            </Card>

            {/* Actions */}
            <Card className="p-6 space-y-3">
              <p className="section-heading">{t('actions')}</p>
              <div className="grid gap-3">
                <Button variant="secondary" className="w-full" onClick={() => navigate('/tablet')}>
                  {t('edit_selection')}
                </Button>
                <Button
                  className="w-full"
                  disabled={confirmDisabled || isSubmitting}
                  onClick={handleConfirm}
                >
                  {isSubmitting ? t('submitting') : t('confirm')}
                </Button>
                {submitError && (
                  <p className="text-center text-xs text-red-600">{submitError}</p>
                )}
                <Button
                  variant="accent"
                  className="w-full"
                  onClick={() => downloadBlob('/public/export/pdf', 'selection-summary.pdf')}
                >
                  {t('download_pdf')}
                </Button>
                <Button
                  className="w-full"
                  onClick={() => downloadBlob('/public/export/excel', 'selection-summary.xlsx')}
                >
                  {t('download_excel')}
                </Button>
              </div>
            </Card>
          </aside>
        </div>
      </div>
    </main>
  );
};
