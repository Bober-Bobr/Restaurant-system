import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import type { MenuItem, TableCategory } from '../types/domain';
import { menuService } from '../services/menu.service';
import { tableCategoryService } from '../services/tableCategory.service';
import { useAdminStore } from '../store/admin.store';
import { translate } from '../utils/translate';
import { Input } from '../components/ui/input';
import { Select } from '../components/ui/select';
import { Button } from '../components/ui/button';
import { PhotoSelector } from '../components/ui/photo-selector';
import { getPhotoUrl } from '../utils/photoUrl';

type MenuCategory = MenuItem['category'];

const CATEGORY_ORDER: Record<MenuCategory, number> = {
  COLD_APPETIZERS: 0,
  HOT_APPETIZERS: 1,
  SALADS: 2,
  FIRST_COURSE: 3,
  SECOND_COURSE: 4,
  DRINKS: 5,
  SWEETS: 6,
  FRUITS: 7,
};

const ALL_CATEGORIES: MenuCategory[] = [
  'COLD_APPETIZERS',
  'HOT_APPETIZERS',
  'SALADS',
  'FIRST_COURSE',
  'SECOND_COURSE',
  'DRINKS',
  'SWEETS',
  'FRUITS',
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

const parsePriceToCents = (value: string): number | null => {
  const normalized = value.replace(',', '.').trim();
  if (!normalized) return null;
  const amount = Number(normalized);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return Math.round(amount * 100);
};

const formatCents = (cents: number): string => (cents / 100).toFixed(2);

export const AdminMenuPage = () => {
  const queryClient = useQueryClient();
  const { locale } = useAdminStore();
  const [activeCategory, setActiveCategory] = useState<MenuCategory | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['menu-items', 'admin', 'all'],
    queryFn: () => menuService.listAllForAdmin()
  });

  const { data: tableCategories = [] } = useQuery({
    queryKey: ['tableCategories'],
    queryFn: () => tableCategoryService.list()
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
  const [category, setCategory] = useState<MenuItem['category']>('HOT_APPETIZERS');
  const [price, setPrice] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');

  const createMutation = useMutation({
    mutationFn: async () => {
      const priceCents = parsePriceToCents(price);
      if (priceCents === null) {
        throw new Error('Invalid price');
      }

      return menuService.create({
        name: name.trim(),
        description: description.trim() ? description.trim() : undefined,
        category,
        priceCents,
        photoUrl: photoUrl.trim() ? photoUrl.trim() : undefined
      });
    },
    onSuccess: async () => {
      setName('');
      setDescription('');
      setCategory('HOT_APPETIZERS');
      setPrice('');
      setPhotoUrl('');
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

  return (
    <main style={{ padding: 20 }}>
      <h1>{translate('menu_management', locale)}</h1>

      <section style={{ border: '1px solid #ddd', borderRadius: 8, padding: 12, marginBottom: 16 }}>
        <h3>{translate('create_menu_item', locale)}</h3>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (!canCreate || createMutation.isPending) return;
            createMutation.mutate();
          }}
          style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, alignItems: 'end' }}
        >
          <label style={{ display: 'grid', gap: 6 }}>
            {translate('name', locale)}
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label style={{ display: 'grid', gap: 6 }}>
            {translate('category', locale)}
            <Select value={category} onChange={(e) => setCategory(e.target.value as MenuItem['category'])}>
              <option value="COLD_APPETIZERS">{translate('cold_appetizers', locale)}</option>
              <option value="HOT_APPETIZERS">{translate('hot_appetizers', locale)}</option>
              <option value="SALADS">{translate('salads', locale)}</option>
              <option value="FIRST_COURSE">{translate('first_course', locale)}</option>
              <option value="SECOND_COURSE">{translate('second_course', locale)}</option>
              <option value="DRINKS">{translate('drinks', locale)}</option>
              <option value="SWEETS">{translate('sweets', locale)}</option>
              <option value="FRUITS">{translate('fruits', locale)}</option>
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

          <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 12, alignItems: 'center' }}>
            <Button type="submit" disabled={!canCreate || createMutation.isPending}>
              {createMutation.isPending ? translate('creating', locale) : translate('create', locale)}
            </Button>
            {createMutation.isError ? <span style={{ color: '#b00020' }}>Failed to create item.</span> : null}
          </div>
        </form>
      </section>

      {isLoading ? <p>{translate('loading_menu', locale)}</p> : null}
      {isError ? <p>{translate('failed_load_menu', locale)}</p> : null}

      {(data ?? []).length > 0 && (() => {
        const sorted = quickSort(data ?? []);
        const filtered = activeCategory ? sorted.filter((item) => item.category === activeCategory) : sorted;
        const presentCategories = ALL_CATEGORIES.filter((cat) => (data ?? []).some((item) => item.category === cat));
        return (
          <>
            <div className="mb-4 flex flex-wrap gap-2">
              <button
                onClick={() => setActiveCategory(null)}
                className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${activeCategory === null ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
              >
                {translate('filter_all', locale)}
              </button>
              {presentCategories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${activeCategory === cat ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                >
                  {translate(cat.toLowerCase() as Parameters<typeof translate>[0], locale)}
                </button>
              ))}
            </div>

            <div className="overflow-x-auto rounded-2xl border border-slate-200">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                    <th className="w-14 px-3 py-3"></th>
                    <th className="px-4 py-3">{translate('name', locale)}</th>
                    <th className="px-4 py-3">{translate('category', locale)}</th>
                    <th className="px-4 py-3">{translate('description', locale)}</th>
                    <th className="px-4 py-3">{translate('price', locale)}</th>
                    <th className="px-4 py-3">{translate('tables', locale)}</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.map((item) => (
                    <MenuItemRow
                      key={item.id}
                      item={item}
                      locale={locale}
                      assignedTableCategories={itemTableCategoryMap.get(item.id) ?? []}
                      onPatch={(patch) => updateMutation.mutate({ menuItemId: item.id, patch })}
                      isSaving={updateMutation.isPending}
                      onDelete={() => deleteMutation.mutate(item.id)}
                      isDeleting={deleteMutation.isPending && deleteMutation.variables === item.id}
                    />
                  ))}
                </tbody>
              </table>
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
  onPatch: (patch: Partial<MenuItem>) => void;
  isSaving: boolean;
  onDelete: () => void;
  isDeleting: boolean;
};

const MenuItemRow = ({ item, locale, assignedTableCategories, onPatch, isSaving, onDelete, isDeleting }: MenuItemRowProps) => {
  const [localName, setLocalName] = useState(item.name);
  const [localCategory, setLocalCategory] = useState<MenuItem['category']>(item.category);
  const [localDescription, setLocalDescription] = useState(item.description ?? '');
  const [localPrice, setLocalPrice] = useState(formatCents(item.priceCents));
  const [localPhotoUrl, setLocalPhotoUrl] = useState(item.photoUrl ?? '');
  const [showPhotoSelector, setShowPhotoSelector] = useState(false);

  useEffect(() => {
    setLocalName(item.name);
    setLocalCategory(item.category);
    setLocalDescription(item.description ?? '');
    setLocalPrice(formatCents(item.priceCents));
    setLocalPhotoUrl(item.photoUrl ?? '');
  }, [item.category, item.description, item.name, item.priceCents, item.photoUrl]);

  const handleSave = () => {
    const priceCents = parsePriceToCents(localPrice);
    onPatch({
      name: localName.trim(),
      category: localCategory,
      description: localDescription.trim() || undefined,
      photoUrl: localPhotoUrl.trim() || undefined,
      ...(priceCents !== null ? { priceCents } : {})
    });
  };

  const photoSrc = getPhotoUrl(localPhotoUrl) ?? null;

  return (
    <>
      <tr className="transition-colors hover:bg-slate-50">
        {/* Photo thumbnail */}
        <td className="w-14 px-3 py-2">
          <button
            type="button"
            onClick={() => setShowPhotoSelector((v) => !v)}
            className="group relative block h-12 w-12 overflow-hidden rounded-xl ring-1 ring-slate-200 transition-all hover:ring-slate-400"
            title={translate('select_menu_photo', locale)}
          >
            {photoSrc ? (
              <img src={photoSrc} alt={item.name} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-slate-100 text-slate-400">
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
          <Input value={localName} onChange={(e) => setLocalName(e.target.value)} className="h-8 min-w-[140px] text-sm" />
        </td>

        {/* Category */}
        <td className="px-4 py-2.5">
          <Select value={localCategory} onChange={(e) => setLocalCategory(e.target.value as MenuItem['category'])} className="h-8 text-sm">
            <option value="COLD_APPETIZERS">{translate('cold_appetizers', locale)}</option>
            <option value="HOT_APPETIZERS">{translate('hot_appetizers', locale)}</option>
            <option value="SALADS">{translate('salads', locale)}</option>
            <option value="FIRST_COURSE">{translate('first_course', locale)}</option>
            <option value="SECOND_COURSE">{translate('second_course', locale)}</option>
            <option value="DRINKS">{translate('drinks', locale)}</option>
            <option value="SWEETS">{translate('sweets', locale)}</option>
            <option value="FRUITS">{translate('fruits', locale)}</option>
          </Select>
        </td>

        {/* Description */}
        <td className="px-4 py-2.5">
          <Input value={localDescription} onChange={(e) => setLocalDescription(e.target.value)} className="h-8 min-w-[160px] text-sm" placeholder="—" />
        </td>

        {/* Price */}
        <td className="px-4 py-2.5">
          <Input value={localPrice} onChange={(e) => setLocalPrice(e.target.value)} className="h-8 w-24 text-sm" />
        </td>

        {/* Table categories */}
        <td className="px-4 py-2.5">
          {assignedTableCategories.length === 0 ? (
            <span className="text-xs text-slate-400">—</span>
          ) : (
            <div className="flex flex-wrap gap-1">
              {assignedTableCategories.map((tc) => (
                <span
                  key={tc.id}
                  className="inline-flex items-center rounded-full bg-violet-50 px-2 py-0.5 text-xs font-medium text-violet-700 ring-1 ring-inset ring-violet-200"
                >
                  {tc.name}
                </span>
              ))}
            </div>
          )}
        </td>

        {/* Actions */}
        <td className="whitespace-nowrap px-4 py-2.5">
          <div className="flex gap-2">
          <Button size="sm" variant="outline" disabled={isSaving} onClick={handleSave}>
            {translate('save', locale)}
          </Button>
          <Button
            size="sm"
            variant="destructive"
            disabled={isSaving || isDeleting}
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
        <td colSpan={7} className="border-t-0 bg-slate-50 px-4 pb-3 pt-2">
          <PhotoSelector
            category="menu"
            dishCategory={localCategory.toLowerCase()}
            selectedPhotoUrl={localPhotoUrl || undefined}
            onPhotoSelect={(url: string | undefined) => {
              setLocalPhotoUrl(url || '');
              setShowPhotoSelector(false);
            }}
          />
        </td>
      </tr>
    )}
  </>
  );
};
