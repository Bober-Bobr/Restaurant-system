import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import type { MenuItem } from '../types/domain';
import { menuService } from '../services/menu.service';
import { useAdminStore } from '../store/admin.store';
import { translate, type TranslationKey } from '../utils/translate';

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

  const { data, isLoading, isError } = useQuery({
    queryKey: ['menu-items', 'admin', 'all'],
    queryFn: () => menuService.listAllForAdmin()
  });

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
            <input value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label style={{ display: 'grid', gap: 6 }}>
            {translate('category', locale)}
            <select value={category} onChange={(e) => setCategory(e.target.value as MenuItem['category'])}>
              <option value="HOT_APPETIZERS">{translate('hot_appetizers', locale)}</option>
              <option value="FIRST_COURSE">{translate('first_course', locale)}</option>
              <option value="SECOND_COURSE">{translate('second_course', locale)}</option>
            </select>
          </label>
          <label style={{ display: 'grid', gap: 6 }}>
            {translate('price', locale)} (e.g. 6.50)
            <input value={price} onChange={(e) => setPrice(e.target.value)} />
          </label>
          <label style={{ display: 'grid', gap: 6 }}>
            {translate('photo_url', locale)} (optional)
            <input value={photoUrl} onChange={(e) => setPhotoUrl(e.target.value)} placeholder="https://example.com/image.jpg" />
          </label>
          <label style={{ gridColumn: '1 / -1', display: 'grid', gap: 6 }}>
            {translate('description', locale)}
            <input value={description} onChange={(e) => setDescription(e.target.value)} />
          </label>

          <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 12, alignItems: 'center' }}>
            <button type="submit" disabled={!canCreate || createMutation.isPending}>
              {createMutation.isPending ? translate('creating', locale) : translate('create', locale)}
            </button>
            {createMutation.isError ? <span style={{ color: '#b00020' }}>Failed to create item.</span> : null}
          </div>
        </form>
      </section>

      {isLoading ? <p>{translate('loading_menu', locale)}</p> : null}
      {isError ? <p>{translate('failed_load_menu', locale)}</p> : null}

      <section style={{ display: 'grid', gap: 8 }}>
        {(data ?? []).map((item) => (
          <MenuItemRow
            key={item.id}
            item={item}
            locale={locale}
            onPatch={(patch) => updateMutation.mutate({ menuItemId: item.id, patch })}
            isSaving={updateMutation.isPending}
            onDelete={() => deleteMutation.mutate(item.id)}
            isDeleting={deleteMutation.isPending && deleteMutation.variables === item.id}
          />
        ))}
      </section>
    </main>
  );
};

type MenuItemRowProps = {
  item: MenuItem;
  locale: 'en' | 'ru' | 'uz';
  onPatch: (patch: Partial<MenuItem>) => void;
  isSaving: boolean;
  onDelete: () => void;
  isDeleting: boolean;
};

const MenuItemRow = ({ item, locale, onPatch, isSaving, onDelete, isDeleting }: MenuItemRowProps) => {
  const [localName, setLocalName] = useState(item.name);
  const [localCategory, setLocalCategory] = useState<MenuItem['category']>(item.category);
  const [localDescription, setLocalDescription] = useState(item.description ?? '');
  const [localPrice, setLocalPrice] = useState(formatCents(item.priceCents));
  const [localPhotoUrl, setLocalPhotoUrl] = useState(item.photoUrl ?? '');

  useEffect(() => {
    setLocalName(item.name);
    setLocalCategory(item.category);
    setLocalDescription(item.description ?? '');
    setLocalPrice(formatCents(item.priceCents));
    setLocalPhotoUrl(item.photoUrl ?? '');
  }, [item.category, item.description, item.name, item.priceCents, item.photoUrl]);

  return (
    <article style={{ border: '1px solid #eee', borderRadius: 8, padding: 12 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 2fr 100px', gap: 12, alignItems: 'end' }}>
        <label style={{ display: 'grid', gap: 6 }}>
          {translate('name', locale)}
          <input value={localName} onChange={(e) => setLocalName(e.target.value)} />
        </label>
        <label style={{ display: 'grid', gap: 6 }}>
          {translate('category', locale)}
          <select value={localCategory} onChange={(e) => setLocalCategory(e.target.value as MenuItem['category'])}>
            <option value="HOT_APPETIZERS">{translate('hot_appetizers', locale)}</option>
            <option value="FIRST_COURSE">{translate('first_course', locale)}</option>
            <option value="SECOND_COURSE">{translate('second_course', locale)}</option>
          </select>
        </label>
        <label style={{ display: 'grid', gap: 6 }}>
          {translate('price', locale)}
          <input value={localPrice} onChange={(e) => setLocalPrice(e.target.value)} />
        </label>
        <label style={{ display: 'grid', gap: 6 }}>
          {translate('photo_url', locale)}
          <input value={localPhotoUrl} onChange={(e) => setLocalPhotoUrl(e.target.value)} placeholder="https://example.com/image.jpg" />
        </label>
      </div>
      <label style={{ display: 'grid', gap: 6, marginTop: 10 }}>
        {translate('description', locale)}
        <input value={localDescription} onChange={(e) => setLocalDescription(e.target.value)} />
      </label>

      <div style={{ marginTop: 10, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <button
          type="button"
          disabled={isSaving}
          onClick={() => {
            const priceCents = parsePriceToCents(localPrice);
            onPatch({
              name: localName.trim(),
              category: localCategory,
              description: localDescription.trim() ? localDescription.trim() : undefined,
              photoUrl: localPhotoUrl.trim() ? localPhotoUrl.trim() : undefined,
              ...(priceCents !== null ? { priceCents } : {})
            });
          }}
        >
          {translate('update', locale)}
        </button>
        <button
          type="button"
          disabled={isSaving || isDeleting}
          onClick={() => {
            if (window.confirm(`Delete dish "${item.name}"? This removes it from all events.`)) {
              onDelete();
            }
          }}
        >
          {isDeleting ? translate('deleting', locale) : translate('delete', locale)}
        </button>
        <span style={{ color: '#666' }}>Current: ${formatCents(item.priceCents)}</span>
      </div>
    </article>
  );
};
