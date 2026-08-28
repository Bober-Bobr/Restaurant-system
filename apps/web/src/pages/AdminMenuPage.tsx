import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import { parseSumToTiyin } from '../utils/currency';
import type { MenuItem, TableCategory, Subcategory, DishI18n } from '../types/domain';
import { menuService } from '../services/menu.service';
import { tableCategoryService } from '../services/tableCategory.service';
import { subcategoryService } from '../services/subcategory.service';
import { useAdminStore } from '../store/admin.store';
import { useAuthStore } from '../store/auth.store';
import { translate } from '../utils/translate';
import { cleanI18n } from '../utils/menuI18n';
import { Input } from '../components/ui/input';
import { DishTranslations } from '../components/menu/DishTranslations';
import { Select } from '../components/ui/select';
import { Button } from '../components/ui/button';
import { PhotoSelector } from '../components/ui/photo-selector';
import { getPhotoUrl } from '../utils/photoUrl';
import { useExcludedEverywhere, useHideSubcategories } from '../hooks/useExcludedCategories';
import { StickyHScroll } from '../components/ui/StickyHScroll';
import { draftOf, patchOf, mayAcceptServerValue, type DishDraft } from './adminMenuDraft';

type MenuCategory = MenuItem['category'];

const CATEGORY_ORDER: Record<MenuCategory, number> = {
  SOUPS: 0,
  PIZZA: 1,
  COLD_APPETIZERS: 2,
  GRILL: 3,
  PASTRY: 4,
  HOT_APPETIZERS: 5,
  BEER_SNACKS: 6,
  DESSERT: 7,
  LAMB_DISHES: 8,
  BEEF_DISHES: 9,
  CHICKEN_DISHES: 10,
  SIDE_DISHES: 11,
  PASTA: 12,
  SOFT_DRINKS: 13,
  STEAKS: 14,
  ENERGY_DRINKS: 15,
  SALADS_OIL: 16,
  SALADS_MAYO: 17,
  COFFEE: 18,
  SUSHI_ROLLS: 19,
  DRIED_FRUITS: 20,
  CANDIES: 21,
  FIRST_COURSE: 22,
  SECOND_COURSE: 23,
  THIRD_COURSE: 24,
  SWEETS: 26,
  FRUITS: 27,
  ALCOHOL: 28,
  LEMONADES: 29,
  NON_ALCOHOLIC_COCKTAILS: 30,
  ALCOHOLIC_COCKTAILS: 31,
  MILKSHAKES: 32,
  TEA_MENU: 33,
  FRESH_JUICES: 34,
  LIQUEURS: 35,
};

const ALL_CATEGORIES: MenuCategory[] = [
  'SOUPS', 'PIZZA', 'COLD_APPETIZERS', 'GRILL', 'PASTRY', 'HOT_APPETIZERS',
  'BEER_SNACKS', 'DESSERT', 'LAMB_DISHES', 'BEEF_DISHES', 'CHICKEN_DISHES',
  'SIDE_DISHES', 'PASTA', 'SOFT_DRINKS', 'STEAKS', 'ENERGY_DRINKS',
  'SALADS_OIL', 'SALADS_MAYO', 'COFFEE', 'SUSHI_ROLLS', 'DRIED_FRUITS', 'CANDIES',
  'FIRST_COURSE', 'SECOND_COURSE', 'THIRD_COURSE', 'SWEETS', 'FRUITS',
  'ALCOHOL', 'LEMONADES', 'NON_ALCOHOLIC_COCKTAILS', 'ALCOHOLIC_COCKTAILS',
  'MILKSHAKES', 'TEA_MENU', 'FRESH_JUICES', 'LIQUEURS',
];

function quickSort(items: MenuItem[]): MenuItem[] {
  if (items.length <= 1) return items;
  const pivot = items[Math.floor(items.length / 2)];
  const left: MenuItem[] = [], equal: MenuItem[] = [], right: MenuItem[] = [];
  for (const item of items) {
    const cmp =
      (CATEGORY_ORDER[item.category] ?? 99) - (CATEGORY_ORDER[pivot.category] ?? 99) ||
      item.name.localeCompare(pivot.name);
    if (cmp < 0) left.push(item);
    else if (cmp > 0) right.push(item);
    else equal.push(item);
  }
  return [...quickSort(left), ...equal, ...quickSort(right)];
}

const parsePriceToCents = parseSumToTiyin;

// Glowing star marking a bestseller dish.
function BestsellerStar({ on, size = 18 }: { on: boolean; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={on ? '#f59e0b' : 'none'}
      stroke={on ? '#f59e0b' : 'rgba(255,255,255,0.35)'}
      strokeWidth={1.8}
      strokeLinejoin="round"
      style={{ filter: on ? 'drop-shadow(0 0 4px rgba(245,158,11,0.85))' : 'none', transition: 'all 0.15s', flexShrink: 0 }}
    >
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );
}

export const AdminMenuPage = () => {
  const queryClient = useQueryClient();
  const { locale } = useAdminStore();
  const role = useAuthStore((s) => s.role);
  // The food-admin (catering) dashboard doesn't deal with banquet table
  // categories, so the per-dish "Tables" column is hidden there.
  const showTableCategories = role !== 'CATERING_ADMIN';
  const excluded = useExcludedEverywhere();
  // Master switch (Subcategories page): when on, hide the Subcategory column entirely.
  const showSubcategories = !useHideSubcategories();
  const [activeCategory, setActiveCategory] = useState<MenuCategory | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['menu-items', 'admin', 'all'],
    queryFn: () => menuService.listAllForAdmin()
  });

  const { data: tableCategories = [] } = useQuery({
    queryKey: ['tableCategories'],
    queryFn: () => tableCategoryService.list()
  });

  const { data: subcategories = [] } = useQuery({
    queryKey: ['subcategories'],
    queryFn: () => subcategoryService.list()
  });

  // Map menuItemId → TableCategory[]
  const itemTableCategoryMap = useMemo(() => {
    const map = new Map<string, TableCategory[]>();
    for (const tc of tableCategories) {
      for (const pi of tc.packageItems ?? []) {
        const id = pi.menuItem.id;
        if (!map.has(id)) map.set(id, []);
        map.get(id)!.push(tc);
      }
    }
    return map;
  }, [tableCategories]);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [nameI18n, setNameI18n] = useState<DishI18n>({});
  const [descriptionI18n, setDescriptionI18n] = useState<DishI18n>({});
  const [category, setCategory] = useState<MenuItem['category']>('HOT_APPETIZERS');
  const [price, setPrice] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [isBestseller, setIsBestseller] = useState(false);
  // The create panel is hidden by default (like the Events page) — this reveals it.
  const [showCreate, setShowCreate] = useState(false);

  const createMutation = useMutation({
    mutationFn: async () => {
      const priceCents = parsePriceToCents(price);
      if (priceCents === null) {
        throw new Error('Invalid price');
      }

      return menuService.create({
        name: name.trim(),
        description: description.trim() ? description.trim() : undefined,
        nameI18n: cleanI18n(nameI18n),
        descriptionI18n: cleanI18n(descriptionI18n),
        category,
        priceCents,
        photoUrl: photoUrl.trim() ? photoUrl.trim() : undefined,
        isBestseller
      });
    },
    onSuccess: async () => {
      setName('');
      setDescription('');
      setNameI18n({});
      setDescriptionI18n({});
      setCategory('HOT_APPETIZERS');
      setPrice('');
      setPhotoUrl('');
      setIsBestseller(false);
      await queryClient.invalidateQueries({ queryKey: ['menu-items', 'admin', 'all'] });
    }
  });

  const updateMutation = useMutation({
    mutationFn: async (args: { menuItemId: string; patch: Partial<MenuItem> & { isActive?: boolean } }) => {
      return menuService.update(args.menuItemId, args.patch);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['menu-items', 'admin', 'all'] });
      await queryClient.invalidateQueries({ queryKey: ['menu-items'] });
    }
  });

  const deleteMutation = useMutation<void, Error, string>({
    mutationFn: (menuItemId) => menuService.remove(menuItemId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['menu-items', 'admin', 'all'] });
      await queryClient.invalidateQueries({ queryKey: ['menu-items', 'public'] });
    }
  });

  const canCreate = useMemo(() => {
    if (name.trim().length < 2) return false;
    if (parsePriceToCents(price) === null) return false;
    return true;
  }, [name, price]);

  // Excluded categories can't be chosen for new dishes.
  const availableCategoryOptions = useMemo(
    () => CATEGORY_OPTIONS.filter((o) => !excluded.has(o.value)),
    [excluded]
  );
  useEffect(() => {
    if (excluded.has(category) && availableCategoryOptions.length > 0) {
      setCategory(availableCategoryOptions[0].value);
    }
  }, [excluded, category, availableCategoryOptions]);

  return (
    <main className="tablet-fade-in" style={{ maxWidth: 1280, margin: '0 auto', padding: '28px 20px', position: 'relative', zIndex: 1 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <div style={{ display: 'grid', gap: 4 }}>
          <h1 className="adm-title" style={{ margin: 0 }}>{translate('menu_management', locale)}</h1>
          {/* There is no Save button on the dish rows; say so once, up here. */}
          <span style={{ fontSize: 12, color: 'rgba(226,232,240,0.45)' }}>
            {translate('changes_saved_automatically', locale)}
          </span>
        </div>
        {/* The create panel is hidden by default; this button reveals it. */}
        <Button type="button" onClick={() => setShowCreate((v) => !v)}>
          {showCreate ? translate('hide_form', locale) : `+ ${translate('create_menu_item', locale)}`}
        </Button>
      </div>

      {showCreate && (
      <section className="adm-card tablet-fade-up adm-section">
        <h3 className="adm-heading" style={{ marginTop: 0, marginBottom: 16 }}>{translate('create_menu_item', locale)}</h3>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (!canCreate || createMutation.isPending) return;
            createMutation.mutate();
          }}
          className="form-grid-3" style={{ alignItems: 'end' }}
        >
          <label style={{ display: 'grid', gap: 6 }}>
            {translate('name', locale)}
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label style={{ display: 'grid', gap: 6 }}>
            {translate('category', locale)}
            <Select value={category} onChange={(e) => setCategory(e.target.value as MenuItem['category'])}>
              {availableCategoryOptions.map((o) => (
                <option key={o.value} value={o.value}>{translate(o.key, locale)}</option>
              ))}
            </Select>
          </label>
          <label style={{ display: 'grid', gap: 6 }}>
            {translate('price', locale)} (e.g. 6.50)
            <Input value={price} onChange={(e) => setPrice(e.target.value)} />
          </label>
          <div style={{ gridColumn: '1 / -1', display: 'grid', gap: 6 }}>
            <PhotoSelector
              category="menu"
              dishCategory={category.toLowerCase()}
              selectedPhotoUrl={photoUrl || undefined}
              onPhotoSelect={(url: string | undefined) => setPhotoUrl(url || '')}
              placeholder={translate('select_menu_photo', locale)}
            />
          </div>
          <label style={{ gridColumn: '1 / -1', display: 'grid', gap: 6 }}>
            {translate('description', locale)}
            <Input value={description} onChange={(e) => setDescription(e.target.value)} />
          </label>

          <DishTranslations
            locale={locale}
            nameI18n={nameI18n}
            descriptionI18n={descriptionI18n}
            onChange={({ nameI18n: n, descriptionI18n: d }) => { setNameI18n(n); setDescriptionI18n(d); }}
          />

          <label style={{ gridColumn: '1 / -1', display: 'flex', gap: 8, alignItems: 'center', cursor: 'pointer' }}>
            <input type="checkbox" checked={isBestseller} onChange={(e) => setIsBestseller(e.target.checked)}
              style={{ width: 16, height: 16, accentColor: '#f59e0b', cursor: 'pointer' }} />
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <BestsellerStar on={isBestseller} size={16} />
              {translate('bestseller', locale)}
            </span>
          </label>

          <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 12, alignItems: 'center' }}>
            <Button type="submit" disabled={!canCreate || createMutation.isPending}>
              {createMutation.isPending ? translate('creating', locale) : translate('create', locale)}
            </Button>
            {createMutation.isError ? <span style={{ color: '#b00020' }}>Failed to create item.</span> : null}
          </div>
        </form>
      </section>
      )}

      {isLoading ? <p>{translate('loading_menu', locale)}</p> : null}
      {isError ? <p>{translate('failed_load_menu', locale)}</p> : null}

      {(data ?? []).length > 0 && (() => {
        const sorted = quickSort(data ?? []);
        const filtered = activeCategory ? sorted.filter((item) => item.category === activeCategory) : sorted;
        const presentCategories = ALL_CATEGORIES.filter((cat) => (data ?? []).some((item) => item.category === cat));
        return (
          <>
            <div className="tablet-fade-up" style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
              <button
                onClick={() => setActiveCategory(null)}
                style={{
                  padding: '6px 16px', borderRadius: 999, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                  background: activeCategory === null ? 'rgba(var(--adm-accent-rgb),0.18)' : 'rgba(255,255,255,0.04)',
                  color: activeCategory === null ? 'var(--adm-accent)' : 'rgba(226,232,240,0.7)',
                  border: `1px solid ${activeCategory === null ? 'rgba(var(--adm-accent-rgb),0.4)' : 'rgba(255,255,255,0.08)'}`,
                  transition: 'all 0.15s',
                }}
              >
                {translate('filter_all', locale)}
              </button>
              {presentCategories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  style={{
                    padding: '6px 16px', borderRadius: 999, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                    background: activeCategory === cat ? 'rgba(var(--adm-accent-rgb),0.18)' : 'rgba(255,255,255,0.04)',
                    color: activeCategory === cat ? 'var(--adm-accent)' : 'rgba(226,232,240,0.7)',
                    border: `1px solid ${activeCategory === cat ? 'rgba(var(--adm-accent-rgb),0.4)' : 'rgba(255,255,255,0.08)'}`,
                    transition: 'all 0.15s',
                  }}
                >
                  {translate(cat.toLowerCase() as Parameters<typeof translate>[0], locale)}
                </button>
              ))}
            </div>

            {/* Mobile cards */}
            <div className="flex flex-col gap-3 sm:hidden">
              {filtered.map((item) => (
                <MenuItemMobileCard
                  key={item.id}
                  item={item}
                  locale={locale}
                  assignedTableCategories={itemTableCategoryMap.get(item.id) ?? []}
                  subcategories={subcategories}
                  showTableCategories={showTableCategories}
                  showSubcategories={showSubcategories}
                  onPatch={(patch) => updateMutation.mutate({ menuItemId: item.id, patch })}
                  onDelete={() => deleteMutation.mutate(item.id)}
                  isDeleting={deleteMutation.isPending && deleteMutation.variables === item.id}
                />
              ))}
            </div>

            {/* Desktop table */}
            <div className="adm-card tablet-fade-up hidden sm:block">
              {/* The dish table is wider than the screen and the page is long, so
                  its scrollbar rides the bottom of the viewport rather than
                  sitting hundreds of rows below the columns it scrolls. */}
              <StickyHScroll>
              <table className="adm-table" style={{ width: '100%', minWidth: 880 }}>
                <thead>
                  <tr>
                    <th style={{ width: 56 }}></th>
                    <th>{translate('name', locale)}</th>
                    <th>{translate('category', locale)}</th>
                    {showSubcategories && <th>{translate('subcategory', locale)}</th>}
                    <th>{translate('description', locale)}</th>
                    <th>{translate('price', locale)}</th>
                    <th style={{ textAlign: 'center' }}>{translate('bestseller', locale)}</th>
                    <th style={{ textAlign: 'center' }}>{translate('out_of_stock', locale)}</th>
                    {showTableCategories && <th>{translate('tables', locale)}</th>}
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((item) => (
                    <MenuItemRow
                      key={item.id}
                      item={item}
                      locale={locale}
                      assignedTableCategories={itemTableCategoryMap.get(item.id) ?? []}
                      subcategories={subcategories}
                      showTableCategories={showTableCategories}
                      showSubcategories={showSubcategories}
                      onPatch={(patch) => updateMutation.mutate({ menuItemId: item.id, patch })}
                          onDelete={() => deleteMutation.mutate(item.id)}
                      isDeleting={deleteMutation.isPending && deleteMutation.variables === item.id}
                    />
                  ))}
                </tbody>
              </table>
              </StickyHScroll>
            </div>
          </>
        );
      })()}
    </main>
  );
};

type MenuItemRowProps = {
  item: MenuItem;
  locale: 'en' | 'ru' | 'uz';
  assignedTableCategories: TableCategory[];
  subcategories: Subcategory[];
  showTableCategories: boolean;
  showSubcategories: boolean;
  onPatch: (patch: Partial<MenuItem>) => void;
  onDelete: () => void;
  isDeleting: boolean;
};

// ── Autosave ────────────────────────────────────────────────────────────────
// There is no Save button on this page: an edit to a dish is committed on its
// own. Typing is debounced and a picked value (category, photo) commits at
// once, because that click is already the decision.
//
// Two things make an autosaving row harder than it looks, and both are handled
// in `useDishDraft`:
//
//  · The list refetches after every save, so the row is continuously handed a
//    fresh `item`. Copying that into the fields unconditionally would overwrite
//    whatever was typed while the request was in the air — so the copy is
//    skipped while the row holds unsaved edits.
//  · A debounce that is still counting when the row goes away (filtering by
//    category, leaving the page, closing the tab) would drop the edit silently.
//    Every exit flushes.

const AUTOSAVE_MS = 800;

type SaveStatus = 'idle' | 'saving' | 'saved';

function useDishDraft(item: MenuItem, onPatch: (patch: Partial<MenuItem>) => void) {
  const [draft, setDraft] = useState<DishDraft>(() => draftOf(item));
  const [status, setStatus] = useState<SaveStatus>('idle');

  // `draft` also lives in a ref so a fired timer saves what is on screen now,
  // not what was there when the timer was set.
  const latest = useRef(draft);
  latest.current = draft;
  const itemRef = useRef(item);
  itemRef.current = item;
  const dirty = useRef(false);
  const timer = useRef(0);
  const settle = useRef(0);

  const flush = useRef(() => {});
  flush.current = () => {
    window.clearTimeout(timer.current);
    if (!dirty.current) return;
    dirty.current = false;
    onPatch(patchOf(latest.current, itemRef.current));
    setStatus('saved');
    window.clearTimeout(settle.current);
    settle.current = window.setTimeout(() => setStatus('idle'), 1600);
  };

  // Server → fields, but never over an edit that has not been saved yet.
  useEffect(() => {
    if (!mayAcceptServerValue(dirty.current)) return;
    setDraft(draftOf(item));
  }, [item.name, item.category, item.description, item.priceCents, item.photoUrl, item.nameI18n, item.descriptionI18n]);

  // Unmount is an exit like any other: filtering the list by category, or
  // navigating away, must not throw away what is still on the debounce.
  useEffect(() => () => { flush.current(); window.clearTimeout(settle.current); }, []);

  // Closing the tab mid-edit. Best-effort — the browser may cut the request
  // short, but not trying at all guarantees the edit is lost.
  useEffect(() => {
    const onHide = () => { if (document.visibilityState === 'hidden') flush.current(); };
    document.addEventListener('visibilitychange', onHide);
    return () => document.removeEventListener('visibilitychange', onHide);
  }, []);

  const edit = (patch: Partial<DishDraft>, immediate = false) => {
    const next = { ...latest.current, ...patch };
    latest.current = next;
    setDraft(next);
    dirty.current = true;
    setStatus('saving');
    window.clearTimeout(timer.current);
    if (immediate) flush.current();
    else timer.current = window.setTimeout(() => flush.current(), AUTOSAVE_MS);
  };

  return { draft, status, edit, flush: () => flush.current() };
}

// "Saving…" / "Saved", where the Save button used to be. Without it an
// autosaving form gives no sign that anything was committed.
function SaveStatusNote({ status, locale }: { status: SaveStatus; locale: 'en' | 'ru' | 'uz' }) {
  if (status === 'idle') return null;
  const saved = status === 'saved';
  return (
    <span style={{
      fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap',
      color: saved ? '#4ade80' : 'rgba(226,232,240,0.55)',
      transition: 'color 0.2s',
    }}>
      {saved ? `✓ ${translate('saved', locale)}` : translate('saving', locale)}
    </span>
  );
}

const CATEGORY_OPTIONS: { value: MenuCategory; key: Parameters<typeof translate>[0] }[] = [
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

const MenuItemMobileCard = ({ item, locale, assignedTableCategories, subcategories, showTableCategories, showSubcategories, onPatch, onDelete, isDeleting }: MenuItemRowProps) => {
  const catSubs = subcategories.filter((s) => s.category === item.category);
  const { draft, status, edit, flush } = useDishDraft(item, onPatch);
  const [showPhotoSelector, setShowPhotoSelector] = useState(false);

  const photoSrc = getPhotoUrl(draft.photoUrl) ?? null;

  return (
    <div className="adm-card p-4 space-y-3">
      <div className="flex items-center gap-3">
        <button type="button" onClick={() => setShowPhotoSelector((v) => !v)}
          className="shrink-0 h-14 w-14 overflow-hidden rounded-xl"
          style={{ border: '1px solid rgba(255,255,255,0.1)' }}>
          {photoSrc
            ? <img src={photoSrc} alt={item.name} className="h-full w-full object-cover" />
            : <div className="flex h-full w-full items-center justify-center" style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.3)' }}>
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
          }
        </button>
        <Input value={draft.name} onChange={(e) => edit({ name: e.target.value })} onBlur={flush}
          className="flex-1 text-sm" placeholder={translate('name', locale)} />
      </div>

      {showPhotoSelector && (
        <PhotoSelector
          category="menu"
          dishCategory={draft.category.toLowerCase()}
          selectedPhotoUrl={draft.photoUrl || undefined}
          onPhotoSelect={(url) => { edit({ photoUrl: url || '' }, true); setShowPhotoSelector(false); }}
        />
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <p className="adm-label text-xs">{translate('category', locale)}</p>
          <Select value={draft.category} onChange={(e) => edit({ category: e.target.value as MenuCategory }, true)}>
            {CATEGORY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{translate(o.key, locale)}</option>
            ))}
          </Select>
        </div>
        <div className="space-y-1">
          <p className="adm-label text-xs">{translate('price', locale)}</p>
          <Input value={draft.price} onChange={(e) => edit({ price: e.target.value })} onBlur={flush} className="text-sm" />
        </div>
      </div>

      {showSubcategories && catSubs.length > 0 && (
        <div className="space-y-1">
          <p className="adm-label text-xs">{translate('subcategory', locale)}</p>
          <Select value={item.subcategoryId ?? ''}
            onChange={(e) => onPatch({ subcategoryId: e.target.value || null })}>
            <option value="">{translate('no_subcategory', locale)}</option>
            {catSubs.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </Select>
        </div>
      )}

      <div className="space-y-1">
        <p className="adm-label text-xs">{translate('description', locale)}</p>
        <Input value={draft.description} onChange={(e) => edit({ description: e.target.value })} onBlur={flush}
          className="text-sm" placeholder="—" />
      </div>

      <DishTranslations
        locale={locale}
        nameI18n={draft.nameI18n}
        descriptionI18n={draft.descriptionI18n}
        onChange={({ nameI18n: n, descriptionI18n: d }) => edit({ nameI18n: n, descriptionI18n: d })}
      />

      {showTableCategories && assignedTableCategories.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {assignedTableCategories.map((tc) => (
            <span key={tc.id} className="rounded-full px-2 py-0.5 text-xs font-medium"
              style={{ background: 'rgba(139,92,246,0.15)', color: '#a78bfa', border: '1px solid rgba(139,92,246,0.3)' }}>
              {tc.name}
            </span>
          ))}
        </div>
      )}

      <div className="flex gap-2 flex-wrap">
        {/* Toggles commit on click — they are not part of the draft, so they
            stay live even while a debounced text edit is still counting. */}
        <button
          type="button"
          onClick={() => onPatch({ isBestseller: !item.isBestseller })}
          aria-pressed={!!item.isBestseller}
          className="flex items-center gap-2 self-start rounded-lg px-2.5 py-1.5 text-sm font-medium"
          style={{
            background: item.isBestseller ? 'rgba(245,158,11,0.12)' : 'rgba(255,255,255,0.04)',
            border: `1px solid ${item.isBestseller ? 'rgba(245,158,11,0.4)' : 'rgba(255,255,255,0.1)'}`,
            color: item.isBestseller ? '#f59e0b' : 'rgba(226,232,240,0.7)',
            cursor: 'pointer',
          }}
        >
          <BestsellerStar on={!!item.isBestseller} size={16} />
          {translate('bestseller', locale)}
        </button>
        <button
          type="button"
          onClick={() => onPatch({ isOutOfStock: !item.isOutOfStock })}
          aria-pressed={!!item.isOutOfStock}
          className="flex items-center gap-2 self-start rounded-lg px-2.5 py-1.5 text-sm font-medium"
          style={{
            background: item.isOutOfStock ? 'rgba(239,68,68,0.12)' : 'rgba(255,255,255,0.04)',
            border: `1px solid ${item.isOutOfStock ? 'rgba(239,68,68,0.4)' : 'rgba(255,255,255,0.1)'}`,
            color: item.isOutOfStock ? '#f87171' : 'rgba(226,232,240,0.7)',
            cursor: 'pointer',
          }}
        >
          🚫 {translate('out_of_stock', locale)}
        </button>
      </div>

      <div className="flex gap-2 pt-1 items-center">
        <SaveStatusNote status={status} locale={locale} />
        <Button size="sm" variant="destructive" disabled={isDeleting} className="ml-auto"
          onClick={() => { if (window.confirm(`Delete "${item.name}"?`)) onDelete(); }}>
          {isDeleting ? translate('deleting', locale) : translate('delete', locale)}
        </Button>
      </div>
    </div>
  );
};

const MenuItemRow = ({ item, locale, assignedTableCategories, subcategories, showTableCategories, showSubcategories, onPatch, onDelete, isDeleting }: MenuItemRowProps) => {
  const catSubs = subcategories.filter((s) => s.category === item.category);
  const { draft, status, edit, flush } = useDishDraft(item, onPatch);
  const [showPhotoSelector, setShowPhotoSelector] = useState(false);
  const [showTranslations, setShowTranslations] = useState(false);

  const photoSrc = getPhotoUrl(draft.photoUrl) ?? null;

  return (
    <>
      <tr style={item.isBestseller ? { background: 'rgba(245,158,11,0.06)' } : undefined}>
        {/* Photo thumbnail */}
        <td className="w-14 px-3 py-2">
          <button
            type="button"
            onClick={() => setShowPhotoSelector((v) => !v)}
            className="group relative block h-12 w-12 overflow-hidden rounded-xl transition-all"
            style={{ border: '1px solid rgba(255,255,255,0.1)' }}
            title={translate('select_menu_photo', locale)}
          >
            {photoSrc ? (
              <img src={photoSrc} alt={item.name} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center" style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.3)' }}>
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
            )}
            <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/20">
              <svg className="h-3.5 w-3.5 text-white opacity-0 transition-opacity group-hover:opacity-100" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
            </div>
          </button>
        </td>

        {/* Name */}
        <td className="px-4 py-2.5">
          <Input value={draft.name} onChange={(e) => edit({ name: e.target.value })} onBlur={flush} className="h-8 min-w-[140px] text-sm" />
        </td>

        {/* Category */}
        <td className="px-4 py-2.5">
          <Select value={draft.category} onChange={(e) => edit({ category: e.target.value as MenuItem['category'] }, true)} className="h-8 min-w-[170px] text-sm" style={{ paddingTop: 0, paddingBottom: 0 }}>
            {CATEGORY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{translate(o.key, locale)}</option>
            ))}
          </Select>
        </td>

        {/* Subcategory */}
        {showSubcategories && (
          <td className="px-4 py-2.5">
            {catSubs.length > 0 ? (
              <Select value={item.subcategoryId ?? ''}
                onChange={(e) => onPatch({ subcategoryId: e.target.value || null })}
                className="h-8 text-sm" style={{ paddingTop: 0, paddingBottom: 0 }}>
                <option value="">{translate('no_subcategory', locale)}</option>
                {catSubs.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </Select>
            ) : (
              <span style={{ color: 'rgba(226,232,240,0.3)', fontSize: 12 }}>—</span>
            )}
          </td>
        )}

        {/* Description */}
        <td className="px-4 py-2.5">
          <Input value={draft.description} onChange={(e) => edit({ description: e.target.value })} onBlur={flush} className="h-8 min-w-[160px] text-sm" placeholder="—" />
        </td>

        {/* Price */}
        <td className="px-4 py-2.5">
          <Input value={draft.price} onChange={(e) => edit({ price: e.target.value })} onBlur={flush} className="h-8 w-36 min-w-[130px] text-sm" />
        </td>

        {/* Bestseller toggle — commits on click, independent of the draft. */}
        <td className="px-4 py-2.5 text-center">
          <button
            type="button"
            onClick={() => onPatch({ isBestseller: !item.isBestseller })}
            title={translate('bestseller', locale)}
            aria-pressed={!!item.isBestseller}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, lineHeight: 0 }}
          >
            <BestsellerStar on={!!item.isBestseller} size={20} />
          </button>
        </td>

        {/* Out of stock toggle */}
        <td className="px-4 py-2.5 text-center">
          <button
            type="button"
            onClick={() => onPatch({ isOutOfStock: !item.isOutOfStock })}
            title={translate('out_of_stock', locale)}
            aria-pressed={!!item.isOutOfStock}
            style={{
              background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px',
              fontSize: 18, lineHeight: 1, opacity: item.isOutOfStock ? 1 : 0.25,
              filter: item.isOutOfStock ? 'none' : undefined,
            }}
          >
            🚫
          </button>
        </td>

        {/* Table categories */}
        {showTableCategories && (
          <td className="px-4 py-2.5">
            {assignedTableCategories.length === 0 ? (
              <span className="text-xs text-slate-400">—</span>
            ) : (
              <div className="flex flex-wrap gap-1">
                {assignedTableCategories.map((tc) => (
                  <span
                    key={tc.id}
                    className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
                    style={{ background: 'rgba(139,92,246,0.15)', color: '#a78bfa', border: '1px solid rgba(139,92,246,0.3)' }}
                  >
                    {tc.name}
                  </span>
                ))}
              </div>
            )}
          </td>
        )}

        {/* Actions */}
        <td className="whitespace-nowrap px-4 py-2.5">
          <div className="flex gap-2 items-center">
          <Button size="sm" variant="outline" onClick={() => setShowTranslations((v) => !v)} title={translate('translations', locale)}>
            🌐
          </Button>
          {/* Where the Save button was. */}
          <SaveStatusNote status={status} locale={locale} />
          <Button
            size="sm"
            variant="destructive"
            disabled={isDeleting}
            onClick={() => {
              if (window.confirm(`Delete "${item.name}"?`)) onDelete();
            }}
          >
            {isDeleting ? translate('deleting', locale) : translate('delete', locale)}
          </Button>
        </div>
      </td>
    </tr>

    {showPhotoSelector && (
      <tr>
        <td colSpan={8 + (showSubcategories ? 1 : 0) + (showTableCategories ? 1 : 0)} className="border-t-0 px-4 pb-3 pt-2" style={{ background: 'rgba(var(--adm-bg-rgb),0.4)' }}>
          <PhotoSelector
            category="menu"
            dishCategory={draft.category.toLowerCase()}
            selectedPhotoUrl={draft.photoUrl || undefined}
            onPhotoSelect={(url: string | undefined) => {
              edit({ photoUrl: url || '' }, true);
              setShowPhotoSelector(false);
            }}
          />
        </td>
      </tr>
    )}

    {showTranslations && (
      <tr>
        <td colSpan={8 + (showSubcategories ? 1 : 0) + (showTableCategories ? 1 : 0)} className="border-t-0 px-4 pb-3 pt-2" style={{ background: 'rgba(var(--adm-bg-rgb),0.4)' }}>
          <DishTranslations
            locale={locale}
            nameI18n={draft.nameI18n}
            descriptionI18n={draft.descriptionI18n}
            onChange={({ nameI18n: n, descriptionI18n: d }) => edit({ nameI18n: n, descriptionI18n: d })}
            defaultOpen
            hideToggle
          />
        </td>
      </tr>
    )}
  </>
  );
};
