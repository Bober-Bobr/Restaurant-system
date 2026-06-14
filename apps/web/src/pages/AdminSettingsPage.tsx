import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { menuService } from '../services/menu.service';
import { useAdminStore } from '../store/admin.store';
import { translate } from '../utils/translate';
import { EXCLUDED_CATEGORIES_KEY } from '../hooks/useExcludedCategories';
import type { MenuItem } from '../types/domain';

type MenuCategory = MenuItem['category'];

// Full set of dish categories, in the same display order used elsewhere.
const ALL_CATEGORIES: { value: MenuCategory; key: Parameters<typeof translate>[0] }[] = [
  { value: 'SOUPS', key: 'soups' },
  { value: 'PIZZA', key: 'pizza' },
  { value: 'COLD_APPETIZERS', key: 'cold_appetizers' },
  { value: 'GRILL', key: 'grill' },
  { value: 'PASTRY', key: 'pastry' },
  { value: 'HOT_APPETIZERS', key: 'hot_appetizers' },
  { value: 'BEER_SNACKS', key: 'beer_snacks' },
  { value: 'DESSERT', key: 'dessert' },
  { value: 'LAMB_DISHES', key: 'lamb_dishes' },
  { value: 'BEEF_DISHES', key: 'beef_dishes' },
  { value: 'CHICKEN_DISHES', key: 'chicken_dishes' },
  { value: 'SIDE_DISHES', key: 'side_dishes' },
  { value: 'PASTA', key: 'pasta' },
  { value: 'SOFT_DRINKS', key: 'soft_drinks' },
  { value: 'STEAKS', key: 'steaks' },
  { value: 'ENERGY_DRINKS', key: 'energy_drinks' },
  { value: 'SALADS_OIL', key: 'salads_oil' },
  { value: 'SALADS_MAYO', key: 'salads_mayo' },
  { value: 'COFFEE', key: 'coffee' },
  { value: 'SUSHI_ROLLS', key: 'sushi_rolls' },
  { value: 'DRIED_FRUITS', key: 'dried_fruits' },
  { value: 'CANDIES', key: 'candies' },
  { value: 'FIRST_COURSE', key: 'first_course' },
  { value: 'SECOND_COURSE', key: 'second_course' },
  { value: 'THIRD_COURSE', key: 'third_course' },
  { value: 'SWEETS', key: 'sweets' },
  { value: 'FRUITS', key: 'fruits' },
  { value: 'ALCOHOL', key: 'alcohol' },
  { value: 'LEMONADES', key: 'lemonades' },
  { value: 'NON_ALCOHOLIC_COCKTAILS', key: 'non_alcoholic_cocktails' },
  { value: 'ALCOHOLIC_COCKTAILS', key: 'alcoholic_cocktails' },
  { value: 'MILKSHAKES', key: 'milkshakes' },
  { value: 'TEA_MENU', key: 'tea_menu' },
  { value: 'FRESH_JUICES', key: 'fresh_juices' },
  { value: 'LIQUEURS', key: 'liqueurs' },
];

export const AdminSettingsPage = () => {
  const queryClient = useQueryClient();
  const { locale } = useAdminStore();
  const t = (key: Parameters<typeof translate>[0], params?: Record<string, string | number>) =>
    translate(key, locale, params);

  const settingsQuery = useQuery({
    queryKey: EXCLUDED_CATEGORIES_KEY,
    queryFn: () => menuService.getSettings(),
  });

  // Local working copy of the excluded set; checked = excluded (hidden).
  const [excluded, setExcluded] = useState<Set<MenuCategory>>(new Set());

  useEffect(() => {
    if (settingsQuery.data) setExcluded(new Set(settingsQuery.data.excludedCategories));
  }, [settingsQuery.data]);

  const toggle = (cat: MenuCategory) =>
    setExcluded((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });

  const saveMutation = useMutation({
    mutationFn: () => menuService.saveSettings([...excluded]),
    onSuccess: () => {
      // Refresh everything that depends on the visible category set.
      queryClient.invalidateQueries();
    },
  });

  const saved = settingsQuery.data?.excludedCategories ?? [];
  const isDirty = useMemo(() => {
    if (saved.length !== excluded.size) return true;
    return saved.some((c) => !excluded.has(c));
  }, [saved, excluded]);

  return (
    <main className="tablet-fade-in" style={{ maxWidth: 900, margin: '0 auto', padding: '28px 20px', position: 'relative', zIndex: 1 }}>
      <h1 className="adm-title" style={{ marginBottom: 6 }}>{t('settings')}</h1>
      <p style={{ color: 'rgba(226,232,240,0.55)', fontSize: 13, marginBottom: 4, marginTop: 0 }}>
        {t('excluded_categories')}
      </p>
      <p style={{ color: 'rgba(226,232,240,0.5)', fontSize: 12, marginBottom: 20, marginTop: 0, maxWidth: 620 }}>
        {t('excluded_categories_help')}
      </p>

      {settingsQuery.isLoading && <p style={{ color: 'rgba(226,232,240,0.55)' }}>{t('loading_menu')}</p>}

      <div className="adm-card" style={{ padding: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
          <span style={{ fontSize: 13, color: 'rgba(226,232,240,0.7)' }}>
            {excluded.size > 0 ? t('excluded_count', { count: excluded.size }) : t('nothing_excluded')}
          </span>
          <button
            type="button"
            onClick={() => saveMutation.mutate()}
            disabled={!isDirty || saveMutation.isPending}
            className="adm-btn-primary"
            style={{ fontSize: 13 }}
          >
            {saveMutation.isPending ? t('saving') : t('save_settings')}
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 8 }}>
          {ALL_CATEGORIES.map(({ value, key }) => {
            const isExcluded = excluded.has(value);
            return (
              <label
                key={value}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 8,
                  cursor: 'pointer', userSelect: 'none',
                  background: isExcluded ? 'rgba(220,38,38,0.1)' : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${isExcluded ? 'rgba(220,38,38,0.3)' : 'rgba(255,255,255,0.08)'}`,
                }}
              >
                <input
                  type="checkbox"
                  checked={isExcluded}
                  onChange={() => toggle(value)}
                  style={{ accentColor: '#dc2626', width: 16, height: 16 }}
                />
                <span style={{ fontSize: 13, color: isExcluded ? '#fca5a5' : '#e2e8f0', fontWeight: isExcluded ? 600 : 500 }}>
                  {t(key)}
                </span>
              </label>
            );
          })}
        </div>
      </div>

      {saveMutation.isSuccess && !isDirty && (
        <p style={{ color: '#4ade80', fontSize: 13, marginTop: 14 }}>{t('settings_saved')}</p>
      )}
      {saveMutation.isError && (
        <p style={{ color: '#fca5a5', fontSize: 13, marginTop: 14 }}>{t('settings_save_failed')}</p>
      )}
    </main>
  );
};
