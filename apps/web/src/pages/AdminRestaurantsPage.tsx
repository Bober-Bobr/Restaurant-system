import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { useState } from 'react';
import type { Restaurant } from '../services/restaurant.service';
import { restaurantService } from '../services/restaurant.service';
import { useAdminStore } from '../store/admin.store';
import { translate } from '../utils/translate';
import { getPhotoUrl } from '../utils/photoUrl';

const formatError = (error: unknown): string => {
  if (axios.isAxiosError(error)) {
    const body = error.response?.data as { message?: unknown } | undefined;
    if (typeof body?.message === 'string') return body.message;
  }
  if (error instanceof Error) return error.message;
  return 'Something went wrong';
};

const DEFAULT_LOGO = 'https://placehold.co/80x80?text=🍽️';

type EditState = { id: string; name: string; address: string; logoUrl: string } | null;

export const AdminRestaurantsPage = () => {
  const { locale } = useAdminStore();
  const t = (key: Parameters<typeof translate>[0]) => translate(key, locale);
  const queryClient = useQueryClient();

  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const [editing, setEditing] = useState<EditState>(null);
  const [editError, setEditError] = useState<string | null>(null);

  const { data: restaurants = [], isLoading, isError } = useQuery({
    queryKey: ['restaurants'],
    queryFn: () => restaurantService.list()
  });

  const createMutation = useMutation({
    mutationFn: () => restaurantService.create({
      name: name.trim(),
      address: address.trim() || undefined,
      logoUrl: logoUrl.trim() || undefined
    }),
    onSuccess: () => {
      setName('');
      setAddress('');
      setLogoUrl('');
      setFormError(null);
      queryClient.invalidateQueries({ queryKey: ['restaurants'] });
    },
    onError: (e) => setFormError(formatError(e))
  });

  const updateMutation = useMutation({
    mutationFn: () => restaurantService.update(editing!.id, {
      name: editing!.name.trim(),
      address: editing!.address.trim() || undefined,
      logoUrl: editing!.logoUrl.trim() || undefined
    }),
    onSuccess: () => {
      setEditing(null);
      setEditError(null);
      queryClient.invalidateQueries({ queryKey: ['restaurants'] });
    },
    onError: (e) => setEditError(formatError(e))
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => restaurantService.remove(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['restaurants'] })
  });

  const inputStyle: React.CSSProperties = {
    padding: '8px 10px',
    border: '1px solid #d1d5db',
    borderRadius: 6,
    fontSize: 14,
    fontFamily: 'inherit',
    width: '100%',
    boxSizing: 'border-box'
  };

  const labelStyle: React.CSSProperties = { display: 'grid', gap: 4 };
  const labelTextStyle: React.CSSProperties = { fontSize: 12, fontWeight: 500, color: '#374151' };

  return (
    <main style={{ maxWidth: 860, margin: '0 auto', padding: '24px 16px' }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 24 }}>{t('restaurants_management')}</h1>

      {/* Create form */}
      <section style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, padding: 20, marginBottom: 32 }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>{t('create_restaurant')}</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <label style={labelStyle}>
            <span style={labelTextStyle}>{t('restaurant_name')} *</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('restaurant_name_placeholder')}
              style={inputStyle}
            />
          </label>
          <label style={labelStyle}>
            <span style={labelTextStyle}>{t('restaurant_address')}</span>
            <input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder={t('restaurant_address_placeholder')}
              style={inputStyle}
            />
          </label>
          <label style={{ ...labelStyle, gridColumn: '1 / -1' }}>
            <span style={labelTextStyle}>{t('restaurant_logo_url')}</span>
            <input
              value={logoUrl}
              onChange={(e) => setLogoUrl(e.target.value)}
              placeholder="https://example.com/logo.png"
              style={inputStyle}
            />
          </label>
        </div>
        <div style={{ marginTop: 12, display: 'flex', gap: 12, alignItems: 'center' }}>
          <button
            onClick={() => { setFormError(null); createMutation.mutate(); }}
            disabled={createMutation.isPending || !name.trim()}
            style={{
              padding: '8px 20px',
              background: createMutation.isPending || !name.trim() ? '#9ca3af' : '#2563eb',
              color: '#fff',
              border: 'none',
              borderRadius: 6,
              fontSize: 14,
              fontWeight: 600,
              cursor: createMutation.isPending || !name.trim() ? 'not-allowed' : 'pointer'
            }}
          >
            {createMutation.isPending ? t('creating') : t('create')}
          </button>
          {formError && (
            <span style={{ color: '#dc2626', fontSize: 13 }}>{formError}</span>
          )}
        </div>
      </section>

      {/* List */}
      {isLoading && <p style={{ color: '#6b7280' }}>{t('loading_restaurants')}</p>}
      {isError && <p style={{ color: '#dc2626' }}>{t('failed_load_restaurants')}</p>}

      {!isLoading && restaurants.length === 0 && (
        <p style={{ color: '#6b7280', fontStyle: 'italic' }}>{t('no_restaurants_yet')}</p>
      )}

      <div style={{ display: 'grid', gap: 16 }}>
        {restaurants.map((r: Restaurant) => (
          <div key={r.id} style={{ border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden' }}>
            {editing?.id === r.id ? (
              /* Inline edit form */
              <div style={{ padding: 20 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <label style={labelStyle}>
                    <span style={labelTextStyle}>{t('restaurant_name')} *</span>
                    <input
                      value={editing.name}
                      onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                      style={inputStyle}
                    />
                  </label>
                  <label style={labelStyle}>
                    <span style={labelTextStyle}>{t('restaurant_address')}</span>
                    <input
                      value={editing.address}
                      onChange={(e) => setEditing({ ...editing, address: e.target.value })}
                      style={inputStyle}
                    />
                  </label>
                  <label style={{ ...labelStyle, gridColumn: '1 / -1' }}>
                    <span style={labelTextStyle}>{t('restaurant_logo_url')}</span>
                    <input
                      value={editing.logoUrl}
                      onChange={(e) => setEditing({ ...editing, logoUrl: e.target.value })}
                      style={inputStyle}
                    />
                  </label>
                </div>
                <div style={{ marginTop: 12, display: 'flex', gap: 8, alignItems: 'center' }}>
                  <button
                    onClick={() => { setEditError(null); updateMutation.mutate(); }}
                    disabled={updateMutation.isPending || !editing.name.trim()}
                    style={{ padding: '6px 16px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                  >
                    {updateMutation.isPending ? t('saving') : t('save')}
                  </button>
                  <button
                    onClick={() => { setEditing(null); setEditError(null); }}
                    style={{ padding: '6px 16px', background: '#f3f4f6', color: '#374151', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13, cursor: 'pointer' }}
                  >
                    {t('cancel')}
                  </button>
                  {editError && <span style={{ color: '#dc2626', fontSize: 13 }}>{editError}</span>}
                </div>
              </div>
            ) : (
              /* Card view */
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: 16 }}>
                <img
                  src={getPhotoUrl(r.logoUrl) || DEFAULT_LOGO}
                  alt={r.name}
                  style={{ width: 72, height: 72, borderRadius: 8, objectFit: 'cover', flexShrink: 0, background: '#f3f4f6' }}
                  onError={(e) => { (e.currentTarget as HTMLImageElement).src = DEFAULT_LOGO; }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontWeight: 700, fontSize: 16, margin: 0 }}>{r.name}</p>
                  {r.address && (
                    <p style={{ color: '#6b7280', fontSize: 13, margin: '2px 0 0' }}>{r.address}</p>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                  <button
                    onClick={() => setEditing({ id: r.id, name: r.name, address: r.address ?? '', logoUrl: r.logoUrl ?? '' })}
                    style={{ padding: '6px 14px', background: '#f3f4f6', color: '#374151', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13, cursor: 'pointer' }}
                  >
                    {t('edit')}
                  </button>
                  <button
                    onClick={() => {
                      if (window.confirm(t('confirm_delete_restaurant'))) {
                        deleteMutation.mutate(r.id);
                      }
                    }}
                    disabled={deleteMutation.isPending}
                    style={{ padding: '6px 14px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: 6, fontSize: 13, cursor: 'pointer' }}
                  >
                    {t('delete')}
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </main>
  );
};
