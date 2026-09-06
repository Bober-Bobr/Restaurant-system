import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { subcategoryService } from '../services/subcategory.service';
import { menuService } from '../services/menu.service';
import { useAdminStore } from '../store/admin.store';
import { translate } from '../utils/translate';
import { useExcludedEverywhere, EXCLUDED_CATEGORIES_KEY } from '../hooks/useExcludedCategories';
import type { MenuItem, Subcategory } from '../types/domain';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { AutosaveStatus } from '../components/ui/AutosaveStatus';
import { useAutosave } from '../hooks/useAutosave';

type FoodCategory = MenuItem['category'];

const FOOD_CATEGORIES: FoodCategory[] = [
  'SOUPS', 'PIZZA', 'COLD_APPETIZERS', 'GRILL', 'PASTRY', 'HOT_APPETIZERS',
  'BEER_SNACKS', 'DESSERT', 'LAMB_DISHES', 'BEEF_DISHES', 'CHICKEN_DISHES',
  'SIDE_DISHES', 'PASTA', 'SOFT_DRINKS', 'STEAKS', 'ENERGY_DRINKS',
  'SALADS_OIL', 'SALADS_MAYO', 'COFFEE', 'SUSHI_ROLLS', 'DRIED_FRUITS', 'CANDIES',
  'FIRST_COURSE', 'SECOND_COURSE', 'THIRD_COURSE', 'SWEETS', 'FRUITS',
  'ALCOHOL', 'LEMONADES', 'NON_ALCOHOLIC_COCKTAILS', 'ALCOHOLIC_COCKTAILS',
  'MILKSHAKES', 'TEA_MENU', 'FRESH_JUICES', 'LIQUEURS',
];

const CATEGORY_LABEL_KEY: Record<FoodCategory, Parameters<typeof translate>[0]> = {
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

export const AdminSubcategoriesPage = () => {
  const queryClient = useQueryClient();
  const { locale } = useAdminStore();
  const t = (key: Parameters<typeof translate>[0]) => translate(key, locale);
  // Both a banquet ADMIN and a Food Admin manage subcategories, and they are one
  // shared table like the dishes themselves — so this hides only what BOTH
  // products dropped, exactly as the Menu and Photos pages do. Filtering by one
  // product's list would show a Food Admin a category the banquet side had
  // switched off, and vice versa.
  const excluded = useExcludedEverywhere();

  const { data: subcategories = [], isLoading } = useQuery({
    queryKey: ['subcategories'],
    queryFn: () => subcategoryService.list(),
  });

  // Master switch — disables subcategories everywhere (menu column + catering site).
  const settingsQuery = useQuery({
    queryKey: EXCLUDED_CATEGORIES_KEY,
    queryFn: () => menuService.getSettings(),
  });
  const hideSubcategories = settingsQuery.data?.hideSubcategories ?? false;

  const toggleMasterMutation = useMutation({
    mutationFn: (next: boolean) =>
      // Only the master switch: sending no `excludedCategories` leaves both
      // products' lists exactly as they are.
      menuService.saveSettings({ hideSubcategories: next }),
    onSuccess: () => queryClient.invalidateQueries(),
  });

  const availableCategories = FOOD_CATEGORIES.filter((c) => !excluded.has(c));

  const [newCategory, setNewCategory] = useState<FoodCategory>('SOUPS');
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['subcategories'] });

  const createMutation = useMutation({
    mutationFn: () => {
      const count = subcategories.filter((s) => s.category === newCategory).length;
      return subcategoryService.create({ name: newName.trim(), category: newCategory, sortOrder: count });
    },
    onSuccess: async () => { setNewName(''); await invalidate(); },
  });

  // Autosaved, so the write no longer closes the editor: renaming and being
  // finished with the row are separate events now.
  const updateMutation = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => subcategoryService.update(id, { name }),
    onSuccess: async () => { await invalidate(); },
  });

  // Null while the name is empty — clearing the field to retype it must not
  // write the empty string, and autosave sees that keystroke where a Save button
  // never did. A subcategory with no name is unreachable in every picker.
  const editPayload = useMemo(
    () => (editingId && editName.trim() ? { id: editingId, name: editName.trim() } : null),
    [editingId, editName],
  );
  const autosave = useAutosave({
    value: editPayload,
    enabled: editPayload !== null,
    save: (payload) => (payload ? updateMutation.mutateAsync(payload) : Promise.resolve()),
  });

  const toggleHiddenMutation = useMutation({
    mutationFn: ({ id, hidden }: { id: string; hidden: boolean }) => subcategoryService.update(id, { hidden }),
    onSuccess: async () => { await invalidate(); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => subcategoryService.remove(id),
    onSuccess: async () => { await invalidate(); },
  });

  const reorderMutation = useMutation({
    mutationFn: (order: { id: string; sortOrder: number }[]) => subcategoryService.saveArrangement(order),
    onSuccess: async () => { await invalidate(); },
  });

  // Group subcategories by category, preserving the server order (sortOrder).
  const grouped = useMemo(() => {
    const map = new Map<FoodCategory, Subcategory[]>();
    for (const sc of subcategories) {
      const arr = map.get(sc.category) ?? [];
      arr.push(sc);
      map.set(sc.category, arr);
    }
    return map;
  }, [subcategories]);

  const move = (cat: FoodCategory, index: number, dir: -1 | 1) => {
    const list = [...(grouped.get(cat) ?? [])];
    const target = index + dir;
    if (target < 0 || target >= list.length) return;
    [list[index], list[target]] = [list[target]!, list[index]!];
    reorderMutation.mutate(list.map((s, i) => ({ id: s.id, sortOrder: i })));
  };

  const canCreate = newName.trim().length > 0 && !createMutation.isPending;

  return (
    <main className="tablet-fade-in" style={{ maxWidth: 1000, margin: '0 auto', padding: '28px 20px', position: 'relative', zIndex: 1 }}>
      <h1 className="adm-title" style={{ marginBottom: 8 }}>{t('subcategories')}</h1>
      <p style={{ margin: '0 0 16px', color: 'rgba(226,232,240,0.6)', fontSize: 14 }}>{t('subcategories_help')}</p>

      {/* Master switch: turn subcategories off everywhere at once. */}
      <section className="adm-card tablet-fade-up" style={{ padding: 16, marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ minWidth: 0 }}>
          <p style={{ margin: 0, fontWeight: 700, color: '#f8fafc', fontSize: 14 }}>{t('disable_subcategories')}</p>
          <p style={{ margin: '4px 0 0', color: 'rgba(226,232,240,0.55)', fontSize: 12, maxWidth: 560 }}>{t('disable_subcategories_help')}</p>
        </div>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 10, cursor: 'pointer', userSelect: 'none', flexShrink: 0 }}>
          <input
            type="checkbox"
            checked={hideSubcategories}
            disabled={settingsQuery.isLoading || toggleMasterMutation.isPending}
            onChange={(e) => toggleMasterMutation.mutate(e.target.checked)}
            style={{ width: 18, height: 18, accentColor: 'var(--adm-accent)', cursor: 'pointer' }}
          />
          <span style={{ fontSize: 13, fontWeight: 600, color: hideSubcategories ? 'var(--adm-accent)' : 'rgba(226,232,240,0.7)' }}>
            {hideSubcategories ? t('subcategories_disabled') : t('subcategories_enabled')}
          </span>
        </label>
      </section>

      {/* Create */}
      <section className="adm-card tablet-fade-up adm-section">
        <h3 className="adm-heading" style={{ marginTop: 0, marginBottom: 16 }}>{t('create_subcategory')}</h3>
        <form
          onSubmit={(e) => { e.preventDefault(); if (canCreate) createMutation.mutate(); }}
          style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}
        >
          <label style={{ display: 'grid', gap: 6, minWidth: 200 }}>
            {t('category')}
            <select className="adm-input" value={newCategory} onChange={(e) => setNewCategory(e.target.value as FoodCategory)}>
              {availableCategories.map((c) => (
                <option key={c} value={c}>{t(CATEGORY_LABEL_KEY[c])}</option>
              ))}
            </select>
          </label>
          <label style={{ display: 'grid', gap: 6, flex: 1, minWidth: 220 }}>
            {t('subcategory_name')}
            <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder={t('subcategory_name')} />
          </label>
          <Button type="submit" disabled={!canCreate}>
            {createMutation.isPending ? t('creating') : t('add_subcategory')}
          </Button>
        </form>
        {createMutation.isError && (
          <p style={{ color: '#fca5a5', marginTop: 10, fontSize: 13 }}>
            {createMutation.error instanceof Error ? createMutation.error.message : t('failed_to_create_category')}
          </p>
        )}
      </section>

      {/* List grouped by category */}
      {isLoading ? (
        <p style={{ color: 'rgba(226,232,240,0.5)' }}>…</p>
      ) : subcategories.length === 0 ? (
        <p style={{ color: 'rgba(226,232,240,0.5)' }}>{t('no_subcategories_yet')}</p>
      ) : (
        <div style={{ display: 'grid', gap: 16 }}>
          {[...grouped.entries()].map(([cat, list]) => (
            <section key={cat} className="adm-card tablet-fade-up" style={{ padding: 16 }}>
              <h3 className="adm-heading" style={{ margin: '0 0 12px', fontSize: 15 }}>
                {t(CATEGORY_LABEL_KEY[cat])}
                <span style={{ marginLeft: 8, fontSize: 12, color: 'rgba(226,232,240,0.45)', fontWeight: 500 }}>
                  · {list.length}
                </span>
              </h3>
              <div style={{ display: 'grid', gap: 8 }}>
                {list.map((sc, i) => (
                  <div key={sc.id} style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 10, padding: '8px 10px',
                  }}>
                    {/* Reorder */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <button type="button" onClick={() => move(cat, i, -1)} disabled={i === 0}
                        style={arrowStyle(i === 0)} aria-label="Move up">▲</button>
                      <button type="button" onClick={() => move(cat, i, 1)} disabled={i === list.length - 1}
                        style={arrowStyle(i === list.length - 1)} aria-label="Move down">▼</button>
                    </div>

                    {editingId === sc.id ? (
                      <>
                        <Input value={editName} onChange={(e) => setEditName(e.target.value)}
                          style={{ flex: 1 }} autoFocus />
                        <AutosaveStatus state={autosave.state} onRetry={autosave.retry} t={t} />
                        <button type="button" className="adm-btn-ghost" onClick={() => setEditingId(null)}>
                          {t('done')}
                        </button>
                      </>
                    ) : (
                      <>
                        <span style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, color: sc.hidden ? 'rgba(226,232,240,0.5)' : '#f8fafc', fontWeight: 600, fontSize: 14 }}>
                          {sc.name}
                          {sc.hidden && (
                            <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', padding: '2px 7px', borderRadius: 999, background: 'rgba(148,163,184,0.18)', color: '#94a3b8' }}>
                              {t('hidden_label')}
                            </span>
                          )}
                        </span>
                        <button type="button" className="adm-btn-ghost"
                          title={sc.hidden ? t('show_subcategory') : t('do_not_show')}
                          onClick={() => toggleHiddenMutation.mutate({ id: sc.id, hidden: !sc.hidden })}
                          disabled={toggleHiddenMutation.isPending}>
                          {sc.hidden ? t('show_subcategory') : t('do_not_show')}
                        </button>
                        <button type="button" className="adm-btn-ghost"
                          onClick={() => { setEditingId(sc.id); setEditName(sc.name); }}>
                          {t('edit')}
                        </button>
                        <button type="button" className="adm-btn-danger"
                          onClick={() => { if (confirm(t('delete_subcategory_confirm'))) deleteMutation.mutate(sc.id); }}>
                          {t('delete')}
                        </button>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </main>
  );
};

const arrowStyle = (disabled: boolean): React.CSSProperties => ({
  width: 22, height: 16, lineHeight: '14px', fontSize: 9,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  background: 'transparent', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 4,
  color: disabled ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.7)',
  cursor: disabled ? 'not-allowed' : 'pointer',
});
