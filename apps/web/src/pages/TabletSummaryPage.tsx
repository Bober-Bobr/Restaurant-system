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

export const TabletSummaryPage = () => {
  const navigate = useNavigate();
  const { selectedItems, selectedHallId, selectedTableCategoryId, guestCount } = useTabletStore();

  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');

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
        pricing
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
        pricing
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
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <img
          src={logo}
          alt="Restaurant logo"
          style={{ width: 96, height: 'auto', margin: '0 auto 16px', borderRadius: 16, objectFit: 'contain' }}
        />
        <h1>Selection Summary</h1>
      </div>

      <div style={{ display: 'grid', gap: 24 }}>
        {/* Customer Details */}
        <section style={{ padding: 20, border: '1px solid #ddd', borderRadius: 8, backgroundColor: '#fafafa' }}>
          <h2>Customer Details</h2>
          <div style={{ display: 'grid', gap: 12 }}>
            <label>
              <span style={{ display: 'block', marginBottom: 4, fontWeight: 'bold' }}>Name:</span>
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Enter your name"
                style={{ width: '100%', padding: 8, borderRadius: 4, border: '1px solid #ccc' }}
              />
            </label>
            <label>
              <span style={{ display: 'block', marginBottom: 4, fontWeight: 'bold' }}>Phone:</span>
              <input
                type="tel"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="Enter your phone number"
                style={{ width: '100%', padding: 8, borderRadius: 4, border: '1px solid #ccc' }}
              />
            </label>
          </div>
        </section>

        {/* Event Details */}
        <section style={{ padding: 20, border: '1px solid #ddd', borderRadius: 8, backgroundColor: '#fafafa' }}>
          <h2>Event Details</h2>
          <div style={{ display: 'grid', gap: 8 }}>
            <p><strong>Hall:</strong> {selectedHall?.name || 'Not selected'}</p>
            <p><strong>Table Category:</strong> {selectedTableCategory?.name || 'Not selected'}</p>
            <p><strong>Guest Count:</strong> {guestCount}</p>
          </div>
        </section>

        {/* Selected Menu Items */}
        <section style={{ padding: 20, border: '1px solid #ddd', borderRadius: 8, backgroundColor: '#fafafa' }}>
          <h2>Selected Dishes</h2>
          {selectedMenuItems.length === 0 ? (
            <p>No items selected.</p>
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
          <h2>Pricing</h2>
          <div style={{ display: 'grid', gap: 8 }}>
            <p>Subtotal: ${(pricing.subtotalCents / 100).toFixed(2)}</p>
            <p>Service Fee: ${(pricing.serviceFeeCents / 100).toFixed(2)}</p>
            <p>Tax: ${(pricing.taxCents / 100).toFixed(2)}</p>
            <p><strong>Total: ${(pricing.totalCents / 100).toFixed(2)}</strong></p>
            {guestCount > 1 && (
              <p>Price per Person: ${(pricing.perGuestCents / 100).toFixed(2)}</p>
            )}
          </div>
        </section>

        {/* Buttons */}
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={() => navigate('/tablet')}
            style={{ padding: '12px 24px', backgroundColor: '#2196F3', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}
          >
            Edit Selection
          </button>
          <button
            onClick={() => confirmMutation.mutate()}
            disabled={confirmMutation.isPending || !customerName || !customerPhone}
            style={{ padding: '12px 24px', backgroundColor: '#4CAF50', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', opacity: confirmMutation.isPending || !customerName || !customerPhone ? 0.5 : 1 }}
          >
            {confirmMutation.isPending ? 'Confirming...' : 'Confirm'}
          </button>
          <button
            onClick={downloadPdf}
            style={{ padding: '12px 24px', backgroundColor: '#FF9800', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}
          >
            Download PDF
          </button>
          <button
            onClick={downloadExcel}
            style={{ padding: '12px 24px', backgroundColor: '#9C27B0', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}
          >
            Download Excel
          </button>
        </div>
      </div>
    </main>
  );
};