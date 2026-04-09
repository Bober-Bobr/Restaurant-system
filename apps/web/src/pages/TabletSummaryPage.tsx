import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { usePriceCalculator } from '../hooks/usePriceCalculator';
import { publicMenuService } from '../services/publicMenu.service';
import { publicHallService } from '../services/publicHall.service';
import { publicTableCategoryService } from '../services/publicTableCategory.service';
import { useTabletStore } from '../store/tablet.store';
import { httpClient } from '../services/http';
import logo from '../assets/logo.png';
import { defaultLocale, Locale, locales, translate } from '../utils/translate';

export const TabletSummaryPage = () => {
  const navigate = useNavigate();
  const { selectedItems, selectedHallId, selectedTableCategoryId, guestCount, locale, setLocale } = useTabletStore();

  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const t = (key: Parameters<typeof translate>[0], params?: Record<string, string | number>) => translate(key, locale, params);

  const { data: menuItems } = useQuery({
    queryKey: ['menu-items', 'public'],
    queryFn: () => publicMenuService.listActive()
  });

  const { data: halls } = useQuery({
    queryKey: ['halls', 'public'],
    queryFn: () => publicHallService.listActive()
  });

  const { data: tableCategories } = useQuery({
    queryKey: ['table-categories', 'public'],
    queryFn: () => publicTableCategoryService.listActive()
  });

  const selectedTableCategory = tableCategories?.find(tc => tc.id === selectedTableCategoryId);
  const selectedHall = halls?.find(h => h.id === selectedHallId);

  const selectedMenuItems = menuItems?.filter(item => selectedItems[item.id] > 0) || [];

  const pricing = usePriceCalculator(menuItems ?? [], selectedItems, selectedTableCategory, guestCount);

  const confirmMutation = useMutation({
    mutationFn: async () => {
      // For now, just log; in real app, create event via API
      console.log('Confirming event:', {
        customerName,
        customerPhone,
        selectedHallId,
        selectedTableCategoryId,
        guestCount,
        selectedItems
      });
      // Simulate creating event and getting ID
      return { eventId: '123' }; // Mock
    },
    onSuccess: (data) => {
      alert('Event confirmed! Event ID: ' + data.eventId);
      // Enable downloads with eventId
    }
  });

  const downloadPdf = async () => {
    try {
      const response = await httpClient.post('/public/export/pdf', {
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
      }, { responseType: 'blob' });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'selection-summary.pdf');
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      alert('Failed to download PDF');
    }
  };

  const downloadExcel = async () => {
    try {
      const response = await httpClient.post('/public/export/excel', {
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
      }, { responseType: 'blob' });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'selection-summary.xlsx');
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      alert('Failed to download Excel');
    }
  };

  return (
    <main style={{ padding: 20, maxWidth: 800, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
        <div style={{ textAlign: 'center', flex: 1 }}>
          <img
            src={logo}
            alt="Restaurant logo"
            style={{ width: 96, height: 'auto', margin: '0 auto 16px', borderRadius: 16, objectFit: 'contain' }}
          />
          <h1>{t('selection_summary')}</h1>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
          <label style={{ fontSize: 14, fontWeight: 600 }}>
            {t('language')}:
            <select
              value={locale}
              onChange={(event) => setLocale(event.target.value as Locale)}
              style={{ marginLeft: 8, padding: 6, borderRadius: 4, border: '1px solid #ccc' }}
            >
              {locales.map((localeOption) => (
                <option key={localeOption} value={localeOption}>
                  {t(localeOption === 'en' ? 'english' : localeOption === 'ru' ? 'russian' : 'uzbek')}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div style={{ display: 'grid', gap: 24 }}>
        {/* Customer Details */}
        <section style={{ padding: 20, border: '1px solid #ddd', borderRadius: 8, backgroundColor: '#fafafa' }}>
          <h2>{t('customer_details')}</h2>
          <div style={{ display: 'grid', gap: 12 }}>
            <label>
              <span style={{ display: 'block', marginBottom: 4, fontWeight: 'bold' }}>{t('customer_name')}:</span>
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder={t('customer_name')}
                style={{ width: '100%', padding: 8, borderRadius: 4, border: '1px solid #ccc' }}
              />
            </label>
            <label>
              <span style={{ display: 'block', marginBottom: 4, fontWeight: 'bold' }}>{t('customer_phone')}:</span>
              <input
                type="tel"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder={t('customer_phone')}
                style={{ width: '100%', padding: 8, borderRadius: 4, border: '1px solid #ccc' }}
              />
            </label>
          </div>
        </section>

        {/* Event Details */}
        <section style={{ padding: 20, border: '1px solid #ddd', borderRadius: 8, backgroundColor: '#fafafa' }}>
          <h2>{t('event_details')}</h2>
          <div style={{ display: 'grid', gap: 8 }}>
            <p><strong>{t('hall')}:</strong> {selectedHall?.name || 'Not selected'}</p>
            <p><strong>{t('table_category')}:</strong> {selectedTableCategory?.name || 'Not selected'}</p>
            <p><strong>{t('guest_count')}:</strong> {guestCount}</p>
          </div>
        </section>

        {/* Selected Menu Items */}
        <section style={{ padding: 20, border: '1px solid #ddd', borderRadius: 8, backgroundColor: '#fafafa' }}>
          <h2>{t('selected_dishes')}</h2>
          {selectedMenuItems.length === 0 ? (
            <p>{t('selection_summary')}</p>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0 }}>
              {selectedMenuItems.map((item) => (
                <li key={item.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #eee' }}>
                  <span>{item.name} (x{selectedItems[item.id]})</span>
                  <span>${((item.priceCents * selectedItems[item.id]) / 100).toFixed(2)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Pricing */}
        <section style={{ padding: 20, border: '1px solid #ddd', borderRadius: 8, backgroundColor: '#fafafa' }}>
          <h2>{t('pricing')}</h2>
          <div style={{ display: 'grid', gap: 8 }}>
            <p>{t('subtotal')}: ${(pricing.subtotalCents / 100).toFixed(2)}</p>
            <p>{t('service_fee')}: ${(pricing.serviceFeeCents / 100).toFixed(2)}</p>
            <p>{t('tax')}: ${(pricing.taxCents / 100).toFixed(2)}</p>
            <p><strong>{t('total')}: ${(pricing.totalCents / 100).toFixed(2)}</strong></p>
            {guestCount > 1 && (
              <p>{t('price_per_person')}: ${(pricing.perGuestCents / 100).toFixed(2)}</p>
            )}
          </div>
        </section>

        {/* Buttons */}
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={() => navigate('/tablet')}
            style={{ padding: '12px 24px', backgroundColor: '#2196F3', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}
          >
            {t('edit_selection')}
          </button>
          <button
            onClick={() => confirmMutation.mutate()}
            disabled={confirmMutation.isPending || !customerName || !customerPhone}
            style={{ padding: '12px 24px', backgroundColor: '#4CAF50', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', opacity: confirmMutation.isPending || !customerName || !customerPhone ? 0.5 : 1 }}
          >
            {confirmMutation.isPending ? t('confirm') + '...' : t('confirm')}
          </button>
          <button
            onClick={downloadPdf}
            style={{ padding: '12px 24px', backgroundColor: '#FF9800', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}
          >
            {t('download_pdf')}
          </button>
          <button
            onClick={downloadExcel}
            style={{ padding: '12px 24px', backgroundColor: '#9C27B0', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}
          >
            {t('download_excel')}
          </button>
        </div>
      </div>
    </main>
  );
};