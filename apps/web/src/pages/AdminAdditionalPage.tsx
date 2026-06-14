import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { menuService } from '../services/menu.service';
import { useAdminStore } from '../store/admin.store';
import { translate } from '../utils/translate';
import { getPhotoUrl } from '../utils/photoUrl';
import { formatSum } from '../utils/currency';
import type { MenuItem, TabletStatus } from '../types/domain';

type MenuCategory = MenuItem['category'];

// An item created before this feature has no tabletStatus; fall back to the old
// showOnTablet boolean (shown → PAID, hidden → NONE).
function effectiveStatus(item: MenuItem): TabletStatus {
  if (item.tabletStatus) return item.tabletStatus;
  return item.showOnTablet === false ? 'NONE' : 'PAID';
}

const STATUS_OPTIONS: {
  value: TabletStatus;
  labelKey: Parameters<typeof translate>[0];
  solid: string; solidText: string; bg: string; border: string;
}[] = [
  { value: 'NONE', labelKey: 'status_dont_show', solid: 'rgba(148,163,184,0.9)', solidText: '#0f172a', bg: 'rgba(15,23,42,0.5)', border: 'rgba(255,255,255,0.08)' },
  { value: 'FREE', labelKey: 'status_free', solid: '#3b82f6', solidText: '#fff', bg: 'rgba(59,130,246,0.08)', border: 'rgba(59,130,246,0.3)' },
  { value: 'PAID', labelKey: 'status_paid', solid: '#22c55e', solidText: '#0f172a', bg: 'rgba(34,197,94,0.08)', border: 'rgba(34,197,94,0.3)' },
];

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

  const statusMutation = useMutation({
    mutationFn: ({ id, tabletStatus }: { id: string; tabletStatus: TabletStatus }) =>
      // Keep showOnTablet in sync for any legacy reader (true only when PAID).
      menuService.update(id, { tabletStatus, showOnTablet: tabletStatus === 'PAID' }),
    // Optimistic update
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

  const grouped = useMemo(() => {
    const items = (data ?? []).filter((it) => ADDITIONAL_CATEGORIES.includes(it.category));
    const map = new Map<MenuCategory, MenuItem[]>();
    for (const cat of ADDITIONAL_CATEGORIES) {
      const list = items.filter((it) => it.category === cat).sort((a, b) => a.name.localeCompare(b.name));
      if (list.length > 0) map.set(cat, list);
    }
    return map;
  }, [data]);

  return (
    <main className="tablet-fade-in" style={{ maxWidth: 1080, margin: '0 auto', padding: '28px 20px', position: 'relative', zIndex: 1 }}>
      <h1 className="adm-title" style={{ marginBottom: 6 }}>{t('additional_management')}</h1>
      <p style={{ margin: '0 0 22px', color: 'rgba(226,232,240,0.55)', fontSize: 14 }}>{t('additional_help')}</p>

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
                const status = effectiveStatus(item);
                const photo = item.photoUrl ? getPhotoUrl(item.photoUrl) : null;
                const accent = STATUS_OPTIONS.find((o) => o.value === status)!;
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
                    <div style={{ display: 'flex', gap: 4, padding: 3, borderRadius: 9, background: 'rgba(0,0,0,0.25)' }}>
                      {STATUS_OPTIONS.map((opt) => {
                        const active = status === opt.value;
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => { if (!active) statusMutation.mutate({ id: item.id, tabletStatus: opt.value }); }}
                            style={{
                              flex: 1,
                              padding: '6px 8px',
                              borderRadius: 7,
                              border: 'none',
                              cursor: active ? 'default' : 'pointer',
                              fontSize: 12,
                              fontWeight: 700,
                              letterSpacing: '0.01em',
                              background: active ? opt.solid : 'transparent',
                              color: active ? opt.solidText : 'rgba(226,232,240,0.6)',
                              transition: 'background 0.15s, color 0.15s',
                            }}
                          >
                            {t(opt.labelKey)}
                          </button>
                        );
                      })}
                    </div>
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
