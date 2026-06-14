import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { menuService } from '../services/menu.service';
import { tableCategoryService } from '../services/tableCategory.service';
import { restaurantService } from '../services/restaurant.service';
import { useAdminStore } from '../store/admin.store';
import { translate } from '../utils/translate';
import { getPhotoUrl } from '../utils/photoUrl';
import type { MenuItem, TableCategory } from '../types/domain';

type MenuCategory = MenuItem['category'];

const CATEGORY_LABEL_KEY: Record<MenuCategory, Parameters<typeof translate>[0]> = {
  SOUPS: 'soups', PIZZA: 'pizza', COLD_APPETIZERS: 'cold_appetizers', GRILL: 'grill',
  PASTRY: 'pastry', HOT_APPETIZERS: 'hot_appetizers', BEER_SNACKS: 'beer_snacks', DESSERT: 'dessert',
  LAMB_DISHES: 'lamb_dishes', BEEF_DISHES: 'beef_dishes', CHICKEN_DISHES: 'chicken_dishes',
  SIDE_DISHES: 'side_dishes', PASTA: 'pasta', SOFT_DRINKS: 'soft_drinks', STEAKS: 'steaks',
  ENERGY_DRINKS: 'energy_drinks', SALADS_OIL: 'salads_oil', SALADS_MAYO: 'salads_mayo',
  COFFEE: 'coffee', SUSHI_ROLLS: 'sushi_rolls', DRIED_FRUITS: 'dried_fruits', CANDIES: 'candies',
  FIRST_COURSE: 'first_course', SECOND_COURSE: 'second_course', THIRD_COURSE: 'third_course',
  SWEETS: 'sweets', FRUITS: 'fruits', ALCOHOL: 'alcohol', LEMONADES: 'lemonades',
  NON_ALCOHOLIC_COCKTAILS: 'non_alcoholic_cocktails', ALCOHOLIC_COCKTAILS: 'alcoholic_cocktails',
  MILKSHAKES: 'milkshakes', TEA_MENU: 'tea_menu', FRESH_JUICES: 'fresh_juices', LIQUEURS: 'liqueurs',
};

type CatGroup = { cat: MenuCategory; dishes: MenuItem[] };

function move<T>(arr: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= arr.length || to >= arr.length) return arr;
  const copy = [...arr];
  const [item] = copy.splice(from, 1);
  copy.splice(to, 0, item);
  return copy;
}

function parseSavedOrder(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((c): c is string => typeof c === 'string') : [];
  } catch { return []; }
}

const DragHandle = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0, cursor: 'grab', opacity: 0.5 }}>
    <line x1="4" y1="9" x2="20" y2="9" /><line x1="4" y1="15" x2="20" y2="15" />
  </svg>
);

const Arrow = ({ dir }: { dir: 'up' | 'down' }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
    {dir === 'up' ? <polyline points="18 15 12 9 6 15" /> : <polyline points="6 9 12 15 18 9" />}
  </svg>
);

const iconBtn = (disabled: boolean): React.CSSProperties => ({
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  width: 28, height: 28, borderRadius: 7, color: '#fff',
  background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)',
  cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.3 : 1,
});

// ─── Menu Dishes Section ─────────────────────────────────────────────────────

function MenuArrangementSection({ t }: { t: (k: Parameters<typeof translate>[0]) => string }) {
  const queryClient = useQueryClient();

  const menuQuery = useQuery({ queryKey: ['menu'], queryFn: () => menuService.list() });
  const restaurantQuery = useQuery({ queryKey: ['restaurants'], queryFn: () => restaurantService.list() });

  const savedOrder = restaurantQuery.data?.[0]?.categoryOrder
    ? parseSavedOrder(restaurantQuery.data[0].categoryOrder)
    : [];

  const [groups, setGroups] = useState<CatGroup[]>([]);
  const [dirty, setDirty] = useState(false);
  const [toast, setToast] = useState<{ kind: 'ok' | 'err'; msg: string } | null>(null);

  useEffect(() => {
    const items = menuQuery.data;
    if (!items) return;
    const byCat = new Map<MenuCategory, MenuItem[]>();
    for (const item of items) {
      if (!item.isActive) continue;
      if (!byCat.has(item.category)) byCat.set(item.category, []);
      byCat.get(item.category)!.push(item);
    }
    const present = [...byCat.keys()];
    const ordered = [
      ...savedOrder.filter((c): c is MenuCategory => byCat.has(c as MenuCategory)),
      ...present.filter((c) => !savedOrder.includes(c)),
    ];
    setGroups(ordered.map((cat) => ({ cat, dishes: byCat.get(cat)! })));
    setDirty(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [menuQuery.data, restaurantQuery.data]);

  const saveMutation = useMutation({
    mutationFn: () => menuService.saveArrangement({
      categoryOrder: groups.map((g) => g.cat),
      dishOrder: groups.flatMap((g) => g.dishes.map((d, i) => ({ id: d.id, sortOrder: i }))),
    }),
    onSuccess: () => {
      setDirty(false);
      setToast({ kind: 'ok', msg: t('arrangement_saved') });
      queryClient.invalidateQueries({ queryKey: ['menu'] });
      queryClient.invalidateQueries({ queryKey: ['restaurants'] });
      setTimeout(() => setToast(null), 2500);
    },
    onError: () => {
      setToast({ kind: 'err', msg: t('arrangement_save_failed') });
      setTimeout(() => setToast(null), 3000);
    },
  });

  const dragCat = useRef<number | null>(null);
  const dragDish = useRef<{ cat: number; dish: number } | null>(null);

  const reorderCats = (from: number, to: number) => { setGroups((g) => move(g, from, to)); setDirty(true); };
  const reorderDishes = (ci: number, from: number, to: number) => {
    setGroups((g) => g.map((grp, i) => (i === ci ? { ...grp, dishes: move(grp.dishes, from, to) } : grp)));
    setDirty(true);
  };

  return (
    <section>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 14 }}>
        <div>
          <h2 className="adm-heading" style={{ margin: 0 }}>{t('arrangement_categories')}</h2>
          <p style={{ margin: '6px 0 0', color: 'rgba(255,255,255,0.55)', fontSize: 13, maxWidth: 520, lineHeight: 1.5 }}>
            {t('arrangement_help')}
          </p>
        </div>
        <button
          type="button" className="adm-btn-primary"
          disabled={!dirty || saveMutation.isPending}
          onClick={() => saveMutation.mutate()}
          style={{ opacity: !dirty || saveMutation.isPending ? 0.5 : 1, whiteSpace: 'nowrap' }}
        >
          {saveMutation.isPending ? t('saving') : t('save_arrangement')}
        </button>
      </div>

      {menuQuery.isLoading && <p style={{ color: 'rgba(255,255,255,0.45)' }}>{t('loading_menu')}</p>}
      {groups.length === 0 && !menuQuery.isLoading && (
        <p style={{ color: 'rgba(255,255,255,0.45)' }}>{t('no_dishes')}</p>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {groups.map((grp, ci) => (
          <div
            key={grp.cat}
            className="adm-card"
            style={{ padding: 0, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.12)' }}
            onDragOver={(e) => { if (dragCat.current !== null) e.preventDefault(); }}
            onDrop={() => { if (dragCat.current !== null) { reorderCats(dragCat.current, ci); dragCat.current = null; } }}
          >
            <div
              draggable
              onDragStart={() => { dragCat.current = ci; }}
              onDragEnd={() => { dragCat.current = null; }}
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px', background: 'rgba(255,255,255,0.06)', borderBottom: '1px solid rgba(255,255,255,0.1)', cursor: 'grab' }}
            >
              <DragHandle />
              <span style={{ fontSize: 14, fontWeight: 800, color: '#fff', flex: 1 }}>
                {t(CATEGORY_LABEL_KEY[grp.cat])}
              </span>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)' }}>{grp.dishes.length}</span>
              <div style={{ display: 'flex', gap: 4 }}>
                <button type="button" disabled={ci === 0} onClick={() => reorderCats(ci, ci - 1)} style={iconBtn(ci === 0)}><Arrow dir="up" /></button>
                <button type="button" disabled={ci === groups.length - 1} onClick={() => reorderCats(ci, ci + 1)} style={iconBtn(ci === groups.length - 1)}><Arrow dir="down" /></button>
              </div>
            </div>

            <div style={{ padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 6 }}>
              {grp.dishes.map((dish, di) => {
                const src = dish.photoUrl ? getPhotoUrl(dish.photoUrl) : null;
                return (
                  <div
                    key={dish.id}
                    draggable
                    onDragStart={(e) => { e.stopPropagation(); dragDish.current = { cat: ci, dish: di }; }}
                    onDragEnd={(e) => { e.stopPropagation(); dragDish.current = null; }}
                    onDragOver={(e) => { if (dragDish.current?.cat === ci) { e.preventDefault(); e.stopPropagation(); } }}
                    onDrop={(e) => {
                      if (dragDish.current?.cat === ci) {
                        e.stopPropagation();
                        reorderDishes(ci, dragDish.current.dish, di);
                        dragDish.current = null;
                      }
                    }}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 8px', borderRadius: 10, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', cursor: 'grab' }}
                  >
                    <DragHandle />
                    {src
                      ? <img src={src} alt="" style={{ width: 38, height: 38, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} />
                      : <div style={{ width: 38, height: 38, borderRadius: 8, background: 'rgba(255,255,255,0.08)', flexShrink: 0 }} />}
                    <span style={{ flex: 1, fontSize: 13, color: '#fff', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{dish.name}</span>
                    {dish.isBestseller && (
                      <span style={{ fontSize: 10, fontWeight: 700, color: '#000', background: '#fff', borderRadius: 999, padding: '2px 7px', flexShrink: 0 }}>★ {t('bestseller')}</span>
                    )}
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button type="button" disabled={di === 0} onClick={() => reorderDishes(ci, di, di - 1)} style={iconBtn(di === 0)}><Arrow dir="up" /></button>
                      <button type="button" disabled={di === grp.dishes.length - 1} onClick={() => reorderDishes(ci, di, di + 1)} style={iconBtn(di === grp.dishes.length - 1)}><Arrow dir="down" /></button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {toast && (
        <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 50, padding: '12px 20px', borderRadius: 12, fontSize: 14, fontWeight: 600, color: '#fff', background: toast.kind === 'ok' ? 'rgba(22,163,74,0.95)' : 'rgba(220,38,38,0.95)', boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}>
          {toast.msg}
        </div>
      )}
    </section>
  );
}

// ─── Table Categories Section ─────────────────────────────────────────────────

function TableCategoryArrangementSection({ t }: { t: (k: Parameters<typeof translate>[0]) => string }) {
  const queryClient = useQueryClient();

  const tcQuery = useQuery({
    queryKey: ['tableCategories', 'all'],
    queryFn: () => tableCategoryService.listAll(),
  });

  const [items, setItems] = useState<TableCategory[]>([]);
  const [dirty, setDirty] = useState(false);
  const [toast, setToast] = useState<{ kind: 'ok' | 'err'; msg: string } | null>(null);

  useEffect(() => {
    if (tcQuery.data) { setItems([...tcQuery.data]); setDirty(false); }
  }, [tcQuery.data]);

  const saveMutation = useMutation({
    mutationFn: () => tableCategoryService.saveArrangement(items.map((tc, i) => ({ id: tc.id, sortOrder: i }))),
    onSuccess: () => {
      setDirty(false);
      setToast({ kind: 'ok', msg: t('arrangement_saved') });
      queryClient.invalidateQueries({ queryKey: ['tableCategories'] });
      setTimeout(() => setToast(null), 2500);
    },
    onError: () => {
      setToast({ kind: 'err', msg: t('arrangement_save_failed') });
      setTimeout(() => setToast(null), 3000);
    },
  });

  const reorder = (from: number, to: number) => { setItems((arr) => move(arr, from, to)); setDirty(true); };
  const dragIdx = useRef<number | null>(null);

  return (
    <section>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 14 }}>
        <div>
          <h2 className="adm-heading" style={{ margin: 0 }}>{t('table_categories')}</h2>
          <p style={{ margin: '6px 0 0', color: 'rgba(255,255,255,0.55)', fontSize: 13, maxWidth: 520, lineHeight: 1.5 }}>
            {t('arrangement_tc_help')}
          </p>
        </div>
        <button
          type="button" className="adm-btn-primary"
          disabled={!dirty || saveMutation.isPending}
          onClick={() => saveMutation.mutate()}
          style={{ opacity: !dirty || saveMutation.isPending ? 0.5 : 1, whiteSpace: 'nowrap' }}
        >
          {saveMutation.isPending ? t('saving') : t('save_arrangement')}
        </button>
      </div>

      {tcQuery.isLoading && <p style={{ color: 'rgba(255,255,255,0.45)' }}>{t('loading_table_categories')}</p>}
      {!tcQuery.isLoading && items.length === 0 && (
        <p style={{ color: 'rgba(255,255,255,0.45)' }}>{t('no_table_categories_yet')}</p>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {items.map((tc, idx) => {
          const src = tc.photoUrl ? getPhotoUrl(tc.photoUrl) : (Array.isArray(tc.photos) && tc.photos.length > 0 ? getPhotoUrl(tc.photos[0]) : null);
          return (
            <div
              key={tc.id}
              draggable
              onDragStart={() => { dragIdx.current = idx; }}
              onDragEnd={() => { dragIdx.current = null; }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => { if (dragIdx.current !== null) { reorder(dragIdx.current, idx); dragIdx.current = null; } }}
              className="adm-card"
              style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'grab', border: '1px solid rgba(255,255,255,0.1)' }}
            >
              <DragHandle />
              {src
                ? <img src={src} alt="" style={{ width: 44, height: 44, borderRadius: 9, objectFit: 'cover', flexShrink: 0 }} />
                : <div style={{ width: 44, height: 44, borderRadius: 9, background: 'rgba(255,255,255,0.08)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5"><rect x="3" y="4" width="18" height="14" rx="2" /><line x1="8" y1="20" x2="16" y2="20" /><line x1="12" y1="18" x2="12" y2="20" /></svg>
                  </div>}
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#f8fafc', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tc.name}</p>
                <p style={{ margin: '2px 0 0', fontSize: 12, color: tc.isActive ? '#4ade80' : 'rgba(226,232,240,0.4)' }}>
                  {tc.isActive ? t('active') : t('inactive')}
                </p>
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                <button type="button" disabled={idx === 0} onClick={() => reorder(idx, idx - 1)} style={iconBtn(idx === 0)}><Arrow dir="up" /></button>
                <button type="button" disabled={idx === items.length - 1} onClick={() => reorder(idx, idx + 1)} style={iconBtn(idx === items.length - 1)}><Arrow dir="down" /></button>
              </div>
            </div>
          );
        })}
      </div>

      {toast && (
        <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 50, padding: '12px 20px', borderRadius: 12, fontSize: 14, fontWeight: 600, color: '#fff', background: toast.kind === 'ok' ? 'rgba(22,163,74,0.95)' : 'rgba(220,38,38,0.95)', boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}>
          {toast.msg}
        </div>
      )}
    </section>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export const AdminArrangementAdminPage = () => {
  const { locale } = useAdminStore();
  const t = (k: Parameters<typeof translate>[0]) => translate(k, locale);

  return (
    <main className="tablet-fade-in" style={{ maxWidth: 900, margin: '0 auto', padding: '28px 20px', position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', gap: 36 }}>
      <div>
        <h1 className="adm-title" style={{ margin: 0 }}>{t('arrangement')}</h1>
        <p style={{ margin: '8px 0 0', color: 'rgba(255,255,255,0.55)', fontSize: 13, lineHeight: 1.5 }}>
          {t('arrangement_admin_help')}
        </p>
      </div>

      <MenuArrangementSection t={t} />
      <hr style={{ border: 'none', borderTop: '1px solid rgba(255,255,255,0.08)', margin: 0 }} />
      <TableCategoryArrangementSection t={t} />
    </main>
  );
};
