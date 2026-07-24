import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { menuService } from '../services/menu.service';
import { tableCategoryService } from '../services/tableCategory.service';
import { useAdminStore } from '../store/admin.store';
import { translate } from '../utils/translate';
import { getPhotoUrl } from '../utils/photoUrl';
import { formatSum } from '../utils/currency';
import { Lightbox } from '../components/ui/lightbox';
import type { MenuItem, TabletStatus } from '../types/domain';

type MenuCategory = MenuItem['category'];

// An item created before this feature has no tabletStatus; fall back to the old
// showOnTablet boolean (shown → PAID, hidden → NONE).
function effectiveStatus(item: MenuItem): TabletStatus {
  if (item.tabletStatus) return item.tabletStatus;
  return item.showOnTablet === false ? 'NONE' : 'PAID';
}

// Card accents: PAID dishes are highlighted green (they show as paid extras on
// the tablet); everything else is free to select, shown in a neutral card.
const PAID_ACCENT = { solid: '#22c55e', solidText: '#0f172a', bg: 'rgba(34,197,94,0.08)', border: 'rgba(34,197,94,0.3)' };
const FREE_ACCENT = { bg: 'rgba(15,23,42,0.5)', border: 'rgba(255,255,255,0.08)' };

// The "Additional" section on the tablet shows these categories.
const ADDITIONAL_CATEGORIES: MenuCategory[] = [
  'SOUPS', 'PIZZA', 'COLD_APPETIZERS', 'GRILL', 'PASTRY', 'HOT_APPETIZERS',
  'BEER_SNACKS', 'DESSERT', 'LAMB_DISHES', 'BEEF_DISHES', 'CHICKEN_DISHES',
  'SIDE_DISHES', 'PASTA', 'SOFT_DRINKS', 'STEAKS', 'ENERGY_DRINKS',
  'SALADS_OIL', 'SALADS_MAYO', 'COFFEE', 'SUSHI_ROLLS', 'DRIED_FRUITS', 'CANDIES',
  'FIRST_COURSE', 'SECOND_COURSE', 'THIRD_COURSE', 'SWEETS', 'FRUITS',
  'ALCOHOL', 'LEMONADES', 'NON_ALCOHOLIC_COCKTAILS', 'ALCOHOLIC_COCKTAILS',
  'MILKSHAKES', 'TEA_MENU', 'FRESH_JUICES', 'LIQUEURS',
];

const CATEGORY_LABEL_KEY: Record<MenuCategory, Parameters<typeof translate>[0]> = {
  SOUPS: 'soups',
  PIZZA: 'pizza',
  COLD_APPETIZERS: 'cold_appetizers',
  GRILL: 'grill',
  PASTRY: 'pastry',
  HOT_APPETIZERS: 'hot_appetizers',
  BEER_SNACKS: 'beer_snacks',
  DESSERT: 'dessert',
  LAMB_DISHES: 'lamb_dishes',
  BEEF_DISHES: 'beef_dishes',
  CHICKEN_DISHES: 'chicken_dishes',
  SIDE_DISHES: 'side_dishes',
  PASTA: 'pasta',
  SOFT_DRINKS: 'soft_drinks',
  STEAKS: 'steaks',
  ENERGY_DRINKS: 'energy_drinks',
  SALADS_OIL: 'salads_oil',
  SALADS_MAYO: 'salads_mayo',
  COFFEE: 'coffee',
  SUSHI_ROLLS: 'sushi_rolls',
  DRIED_FRUITS: 'dried_fruits',
  CANDIES: 'candies',
  FIRST_COURSE: 'first_course',
  SECOND_COURSE: 'second_course',
  THIRD_COURSE: 'third_course',
  SWEETS: 'sweets',
  FRUITS: 'fruits',
  ALCOHOL: 'alcohol',
  LEMONADES: 'lemonades',
  NON_ALCOHOLIC_COCKTAILS: 'non_alcoholic_cocktails',
  ALCOHOLIC_COCKTAILS: 'alcoholic_cocktails',
  MILKSHAKES: 'milkshakes',
  TEA_MENU: 'tea_menu',
  FRESH_JUICES: 'fresh_juices',
  LIQUEURS: 'liqueurs',
};

export const AdminAdditionalPage = () => {
  const { locale } = useAdminStore();
  const t = (key: Parameters<typeof translate>[0]) => translate(key, locale);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['menu-items', 'admin', 'all'],
    queryFn: () => menuService.listAllForAdmin(),
  });

  const { data: tableCategories } = useQuery({
    queryKey: ['tableCategories'],
    queryFn: () => tableCategoryService.list(),
  });

  const cats = tableCategories ?? [];
  const [selectedCatId, setSelectedCatId] = useState<string>('');
  const selectedCat = cats.find((c) => c.id === selectedCatId) ?? cats[0];
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  // Filters the Extras list below to a single category (independent of the
  // table-category selector above, which controls what's hidden as "included").
  const [categoryFilter, setCategoryFilter] = useState<MenuCategory | null>(null);

  // Dishes already included in the selected table's set menu — hidden from the
  // Extras list, since they're served complimentary there and are managed on the
  // Table Categories page rather than here.
  const includedInSelected = useMemo(
    () => new Set((selectedCat?.packageItems ?? []).map((pi) => pi.menuItem.id)),
    [selectedCat]
  );

  // Paid ⇄ free toggle. Non-paid dishes are FREE (guests can pick them at no
  // charge), so turning "Paid" off sets FREE rather than the retired NONE state.
  const statusMutation = useMutation({
    mutationFn: ({ id, tabletStatus }: { id: string; tabletStatus: TabletStatus }) =>
      // Keep showOnTablet in sync for any legacy reader (true only when PAID).
      menuService.update(id, { tabletStatus, showOnTablet: tabletStatus === 'PAID' }),
    onMutate: async ({ id, tabletStatus }) => {
      await queryClient.cancelQueries({ queryKey: ['menu-items', 'admin', 'all'] });
      const prev = queryClient.getQueryData<MenuItem[]>(['menu-items', 'admin', 'all']);
      queryClient.setQueryData<MenuItem[]>(['menu-items', 'admin', 'all'], (old) =>
        (old ?? []).map((it) => (it.id === id ? { ...it, tabletStatus, showOnTablet: tabletStatus === 'PAID' } : it))
      );
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(['menu-items', 'admin', 'all'], ctx.prev);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['menu-items', 'admin', 'all'] });
      queryClient.invalidateQueries({ queryKey: ['menu-items'] });
    },
  });

  const extrasItems = useMemo(
    () => (data ?? []).filter((it) => ADDITIONAL_CATEGORIES.includes(it.category) && !includedInSelected.has(it.id)),
    [data, includedInSelected]
  );

  // Categories present in the (unfiltered) Extras list, for the filter pills.
  const presentCategories = useMemo(
    () => ADDITIONAL_CATEGORIES.filter((cat) => extrasItems.some((it) => it.category === cat)),
    [extrasItems]
  );

  const grouped = useMemo(() => {
    const items = categoryFilter ? extrasItems.filter((it) => it.category === categoryFilter) : extrasItems;
    const map = new Map<MenuCategory, MenuItem[]>();
    for (const cat of ADDITIONAL_CATEGORIES) {
      const list = items.filter((it) => it.category === cat).sort((a, b) => a.name.localeCompare(b.name));
      if (list.length > 0) map.set(cat, list);
    }
    return map;
  }, [extrasItems, categoryFilter]);

  // Reset an out-of-range filter if the underlying data changes (e.g. the
  // filtered category no longer has any dishes).
  useEffect(() => {
    if (categoryFilter && !presentCategories.includes(categoryFilter)) setCategoryFilter(null);
  }, [categoryFilter, presentCategories]);

  return (
    <main className="tablet-fade-in" style={{ maxWidth: 1080, margin: '0 auto', padding: '28px 20px', position: 'relative', zIndex: 1 }}>
      <h1 className="adm-title" style={{ marginBottom: 6 }}>{t('additional_management')}</h1>
      <p style={{ margin: '0 0 18px', color: 'rgba(226,232,240,0.55)', fontSize: 14 }}>{t('additional_help')}</p>

      {lightboxSrc && <Lightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />}

      {/* Table-category selector — controls which dishes are hidden below as "included" */}
      <div className="adm-card" style={{ padding: 14, marginBottom: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: 'rgba(226,232,240,0.75)' }}>{t('select_table_category')}</label>
          {cats.length === 0 ? (
            <span style={{ fontSize: 13, color: 'rgba(226,232,240,0.5)' }}>{t('no_table_categories')}</span>
          ) : (
            <select
              value={selectedCat?.id ?? ''}
              onChange={(e) => setSelectedCatId(e.target.value)}
              style={{
                padding: '8px 12px', borderRadius: 9, minWidth: 220,
                background: 'rgba(15,23,42,0.6)', color: '#f8fafc',
                border: '1px solid rgba(255,255,255,0.12)', fontSize: 14, fontWeight: 600, cursor: 'pointer',
              }}
            >
              {cats.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          )}
        </div>

        {/* Dishes already included in this set — for reference only (managed on
            the Table Categories page); each thumbnail opens a full-screen photo. */}
        {selectedCat && (selectedCat.packageItems ?? []).length > 0 && (
          <div>
            <p style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'rgba(226,232,240,0.45)' }}>
              {t('included_with_table')}
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {(selectedCat.packageItems ?? []).map((pi) => {
                const photo = pi.menuItem.photoUrl ? getPhotoUrl(pi.menuItem.photoUrl) : null;
                return (
                  <div key={pi.id} style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '3px 10px 3px 3px', borderRadius: 999,
                    background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                  }}>
                    {photo ? (
                      <button type="button" title={t('view_photo')}
                        onClick={() => setLightboxSrc(photo)}
                        style={{ width: 26, height: 26, borderRadius: '50%', padding: 0, overflow: 'hidden', border: 'none', cursor: 'zoom-in', flexShrink: 0 }}>
                        <img src={photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                      </button>
                    ) : (
                      <div style={{ width: 26, height: 26, borderRadius: '50%', background: 'rgba(255,255,255,0.08)', flexShrink: 0 }} />
                    )}
                    <span style={{ fontSize: 12.5, fontWeight: 600, color: 'rgba(226,232,240,0.85)' }}>{pi.menuItem.name}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Category filter for the Extras list below */}
      {presentCategories.length > 0 && (
        <div className="tablet-fade-up" style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
          <button
            onClick={() => setCategoryFilter(null)}
            style={{
              padding: '6px 16px', borderRadius: 999, fontSize: 13, fontWeight: 600, cursor: 'pointer',
              background: categoryFilter === null ? 'rgba(201,164,44,0.18)' : 'rgba(255,255,255,0.04)',
              color: categoryFilter === null ? '#c9a42c' : 'rgba(226,232,240,0.7)',
              border: `1px solid ${categoryFilter === null ? 'rgba(201,164,44,0.4)' : 'rgba(255,255,255,0.08)'}`,
              transition: 'all 0.15s',
            }}
          >
            {t('filter_all')}
          </button>
          {presentCategories.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              style={{
                padding: '6px 16px', borderRadius: 999, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                background: categoryFilter === cat ? 'rgba(201,164,44,0.18)' : 'rgba(255,255,255,0.04)',
                color: categoryFilter === cat ? '#c9a42c' : 'rgba(226,232,240,0.7)',
                border: `1px solid ${categoryFilter === cat ? 'rgba(201,164,44,0.4)' : 'rgba(255,255,255,0.08)'}`,
                transition: 'all 0.15s',
              }}
            >
              {t(CATEGORY_LABEL_KEY[cat])}
            </button>
          ))}
        </div>
      )}

      {isLoading && <p style={{ color: 'rgba(226,232,240,0.5)' }}>{t('loading_menu')}</p>}
      {!isLoading && grouped.size === 0 && (
        <p style={{ color: 'rgba(226,232,240,0.5)' }}>{t('no_additional_dishes')}</p>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        {[...grouped.entries()].map(([cat, items]) => (
          <section key={cat} className="adm-card tablet-fade-up" style={{ padding: 16 }}>
            <h2 className="adm-heading" style={{ margin: '0 0 12px' }}>{t(CATEGORY_LABEL_KEY[cat])}</h2>
            <div style={{ display: 'grid', gap: 8, gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
              {items.map((item) => {
                const isPaid = effectiveStatus(item) === 'PAID';
                const photo = item.photoUrl ? getPhotoUrl(item.photoUrl) : null;
                const accent = isPaid ? PAID_ACCENT : FREE_ACCENT;
                return (
                  <div key={item.id} style={{
                    display: 'flex', flexDirection: 'column', gap: 10,
                    padding: '10px 12px', borderRadius: 12,
                    background: accent.bg,
                    border: `1px solid ${accent.border}`,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      {photo
                        ? <img src={photo ?? undefined} alt="" style={{ width: 44, height: 44, borderRadius: 9, objectFit: 'cover', flexShrink: 0 }} />
                        : <div style={{ width: 44, height: 44, borderRadius: 9, background: 'rgba(255,255,255,0.06)', flexShrink: 0 }} />
                      }
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#f8fafc', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</p>
                        <p style={{ margin: '2px 0 0', fontSize: 12, color: '#c9a42c', fontWeight: 600 }}>{formatSum(item.priceCents)}</p>
                      </div>
                    </div>

                    {/* Single "Paid" toggle: on → paid extra, off → free to select. */}
                    <button
                      type="button"
                      onClick={() => statusMutation.mutate({ id: item.id, tabletStatus: isPaid ? 'FREE' : 'PAID' })}
                      aria-pressed={isPaid}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                        padding: '8px 10px', borderRadius: 8, cursor: 'pointer',
                        fontSize: 12, fontWeight: 700, letterSpacing: '0.01em',
                        background: isPaid ? PAID_ACCENT.solid : 'transparent',
                        color: isPaid ? PAID_ACCENT.solidText : 'rgba(226,232,240,0.7)',
                        border: `1px solid ${isPaid ? PAID_ACCENT.solid : 'rgba(255,255,255,0.14)'}`,
                        transition: 'background 0.15s, color 0.15s',
                      }}
                    >
                      {isPaid && (
                        <svg width="13" height="13" viewBox="0 0 12 12" fill="none">
                          <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                      {t('status_paid')}
                    </button>
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </main>
  );
};
