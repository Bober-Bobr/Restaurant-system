import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { menuService } from '../services/menu.service';
import { useAdminStore } from '../store/admin.store';
import { translate } from '../utils/translate';
import { getPhotoUrl } from '../utils/photoUrl';
import { formatSum } from '../utils/currency';
import type { MenuItem } from '../types/domain';

type MenuCategory = MenuItem['category'];

// The "Additional" section on the tablet shows these categories.
const ADDITIONAL_CATEGORIES: MenuCategory[] = [
  'COLD_APPETIZERS', 'HOT_APPETIZERS', 'SALADS', 'DRINKS', 'SWEETS', 'FRUITS',
];

const CATEGORY_LABEL_KEY: Record<MenuCategory, Parameters<typeof translate>[0]> = {
  COLD_APPETIZERS: 'cold_appetizers',
  HOT_APPETIZERS: 'hot_appetizers',
  SALADS: 'salads',
  FIRST_COURSE: 'first_course',
  SECOND_COURSE: 'second_course',
  DRINKS: 'drinks',
  SWEETS: 'sweets',
  FRUITS: 'fruits',
};

export const AdminAdditionalPage = () => {
  const { locale } = useAdminStore();
  const t = (key: Parameters<typeof translate>[0]) => translate(key, locale);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['menu-items', 'admin', 'all'],
    queryFn: () => menuService.listAllForAdmin(),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, showOnTablet }: { id: string; showOnTablet: boolean }) =>
      menuService.update(id, { showOnTablet }),
    // Optimistic toggle
    onMutate: async ({ id, showOnTablet }) => {
      await queryClient.cancelQueries({ queryKey: ['menu-items', 'admin', 'all'] });
      const prev = queryClient.getQueryData<MenuItem[]>(['menu-items', 'admin', 'all']);
      queryClient.setQueryData<MenuItem[]>(['menu-items', 'admin', 'all'], (old) =>
        (old ?? []).map((it) => (it.id === id ? { ...it, showOnTablet } : it))
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
                const shown = item.showOnTablet !== false;
                const photo = item.photoUrl ? getPhotoUrl(item.photoUrl) : null;
                return (
                  <div key={item.id} style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '10px 12px', borderRadius: 12,
                    background: shown ? 'rgba(34,197,94,0.08)' : 'rgba(15,23,42,0.5)',
                    border: `1px solid ${shown ? 'rgba(34,197,94,0.3)' : 'rgba(255,255,255,0.08)'}`,
                  }}>
                    {photo
                      ? <img src={photo ?? undefined} alt="" style={{ width: 44, height: 44, borderRadius: 9, objectFit: 'cover', flexShrink: 0 }} />
                      : <div style={{ width: 44, height: 44, borderRadius: 9, background: 'rgba(255,255,255,0.06)', flexShrink: 0 }} />
                    }
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#f8fafc', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</p>
                      <p style={{ margin: '2px 0 0', fontSize: 12, color: '#c9a42c', fontWeight: 600 }}>{formatSum(item.priceCents)}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleMutation.mutate({ id: item.id, showOnTablet: !shown })}
                      title={shown ? t('shown') : t('hidden')}
                      style={{
                        flexShrink: 0,
                        width: 50, height: 28, borderRadius: 999,
                        border: 'none', cursor: 'pointer', position: 'relative',
                        background: shown ? '#22c55e' : 'rgba(255,255,255,0.15)',
                        transition: 'background 0.18s',
                      }}
                    >
                      <span style={{
                        position: 'absolute', top: 3, left: shown ? 25 : 3,
                        width: 22, height: 22, borderRadius: '50%', background: '#fff',
                        transition: 'left 0.18s',
                      }} />
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
