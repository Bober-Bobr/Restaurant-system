import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { tableCategoryService } from '../services/tableCategory.service';
import { useAdminStore } from '../store/admin.store';
import { translate } from '../utils/translate';
import { getPhotoUrl } from '../utils/photoUrl';
import type { TableCategory } from '../types/domain';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { PhotoSelector } from '../components/ui/photo-selector';

type FoodCategory = 'COLD_APPETIZERS' | 'SALADS' | 'DRINKS' | 'SWEETS' | 'FRUITS';

const FOOD_PACKAGE_OPTIONS: FoodCategory[] = [
  'COLD_APPETIZERS',
  'SALADS',
  'DRINKS',
  'SWEETS',
  'FRUITS',
];

const parseCats = (raw: string): FoodCategory[] =>
  raw
    .split(',')
    .map((s) => s.trim())
    .filter((s): s is FoodCategory => FOOD_PACKAGE_OPTIONS.includes(s as FoodCategory));

const serializeCats = (cats: FoodCategory[]): string => cats.join(',');

function FoodPackageCheckboxes({
  selected,
  onChange,
  locale,
}: {
  selected: FoodCategory[];
  onChange: (cats: FoodCategory[]) => void;
  locale: 'en' | 'ru' | 'uz';
}) {
  const t = (key: Parameters<typeof translate>[0]) => translate(key, locale);
  const toggle = (cat: FoodCategory) => {
    if (selected.includes(cat)) {
      onChange(selected.filter((c) => c !== cat));
    } else {
      onChange([...selected, cat]);
    }
  };

  const labels: Record<FoodCategory, Parameters<typeof translate>[0]> = {
    COLD_APPETIZERS: 'cold_appetizers',
    SALADS: 'salads',
    DRINKS: 'drinks',
    SWEETS: 'sweets',
    FRUITS: 'fruits',
  };

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
      {FOOD_PACKAGE_OPTIONS.map((cat) => (
        <label key={cat} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: '0.9em' }}>
          <input
            type="checkbox"
            checked={selected.includes(cat)}
            onChange={() => toggle(cat)}
          />
          {t(labels[cat])}
        </label>
      ))}
    </div>
  );
}

export const AdminTableCategoriesPage = () => {
  const queryClient = useQueryClient();
  const { locale } = useAdminStore();
  const t = (key: Parameters<typeof translate>[0]) => translate(key, locale);

  const { data: categories, isLoading, isError } = useQuery({
    queryKey: ['tableCategories'],
    queryFn: () => tableCategoryService.list(),
  });

  // Create form state
  const [name, setName] = useState('');
  const [selectedCats, setSelectedCats] = useState<FoodCategory[]>([]);
  const [ratePerPersonText, setRatePerPersonText] = useState('0');
  const [description, setDescription] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editSelectedCats, setEditSelectedCats] = useState<FoodCategory[]>([]);
  const [editRatePerPersonText, setEditRatePerPersonText] = useState('0');
  const [editDescription, setEditDescription] = useState('');
  const [editPhotoUrl, setEditPhotoUrl] = useState('');
  const [editIsActive, setEditIsActive] = useState(true);

  const validation = useMemo(() => {
    const errors: string[] = [];
    if (name.trim().length < 1) errors.push('Name is required.');
    if (name.trim().length > 100) errors.push('Name must be 100 characters or less.');
    const ratePerPerson = Number(ratePerPersonText);
    if (!Number.isFinite(ratePerPerson) || ratePerPerson < 0) errors.push('Rate per person must be a non-negative number.');
    return { errors };
  }, [name, ratePerPersonText]);

  const editValidation = useMemo(() => {
    const errors: string[] = [];
    if (editName.trim().length < 1) errors.push('Name is required.');
    if (editName.trim().length > 100) errors.push('Name must be 100 characters or less.');
    const ratePerPerson = Number(editRatePerPersonText);
    if (!Number.isFinite(ratePerPerson) || ratePerPerson < 0) errors.push('Rate per person must be a non-negative number.');
    return { errors };
  }, [editName, editRatePerPersonText]);

  const createMutation = useMutation({
    mutationFn: () => {
      if (validation.errors.length > 0) throw new Error(validation.errors[0]);
      return tableCategoryService.create({
        name: name.trim(),
        includedCategories: serializeCats(selectedCats),
        ratePerPerson: Math.round(Number(ratePerPersonText) * 100),
        description: description.trim() || undefined,
        photoUrl: photoUrl.trim() || undefined,
        isActive: true,
      });
    },
    onSuccess: async () => {
      setName('');
      setSelectedCats([]);
      setRatePerPersonText('0');
      setDescription('');
      setPhotoUrl('');
      await queryClient.invalidateQueries({ queryKey: ['tableCategories'] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<TableCategory> }) =>
      tableCategoryService.update(id, data),
    onSuccess: async () => {
      setEditingId(null);
      await queryClient.invalidateQueries({ queryKey: ['tableCategories'] });
    },
  });

  const deleteMutation = useMutation<void, Error, string>({
    mutationFn: (id) => tableCategoryService.remove(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['tableCategories'] });
    },
  });

  const startEditing = (category: TableCategory) => {
    setEditingId(category.id);
    setEditName(category.name);
    setEditSelectedCats(parseCats(category.includedCategories));
    setEditRatePerPersonText((category.ratePerPerson / 100).toFixed(2));
    setEditDescription(category.description || '');
    setEditPhotoUrl(category.photoUrl || '');
    setEditIsActive(category.isActive);
  };

  const saveEdit = () => {
    if (!editingId || editValidation.errors.length > 0) return;
    updateMutation.mutate({
      id: editingId,
      data: {
        name: editName.trim(),
        includedCategories: serializeCats(editSelectedCats),
        ratePerPerson: Math.round(Number(editRatePerPersonText) * 100),
        description: editDescription.trim() || undefined,
        photoUrl: editPhotoUrl.trim() || undefined,
        isActive: editIsActive,
      },
    });
  };

  const canSubmit = validation.errors.length === 0 && !createMutation.isPending;
  const canSaveEdit = editValidation.errors.length === 0 && !updateMutation.isPending;

  return (
    <main style={{ padding: 20 }}>
      <h1>{t('table_categories_management')}</h1>

      {/* Create form */}
      <section style={{ border: '1px solid #ddd', borderRadius: 8, padding: 12, marginBottom: 16 }}>
        <h3>{t('create_table_category')}</h3>
        <form
          onSubmit={(e) => { e.preventDefault(); if (!canSubmit) return; createMutation.mutate(); }}
          style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, alignItems: 'end' }}
        >
          <label style={{ display: 'grid', gap: 6 }}>
            {t('name')}
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('table_category_name_placeholder')} />
          </label>
          <label style={{ display: 'grid', gap: 6 }}>
            {t('rate_per_person')}
            <Input value={ratePerPersonText} onChange={(e) => setRatePerPersonText(e.target.value)} />
          </label>

          <div style={{ gridColumn: '1 / -1', display: 'grid', gap: 6 }}>
            <span style={{ fontSize: '0.9em', fontWeight: 500 }}>{t('food_package')}</span>
            <FoodPackageCheckboxes selected={selectedCats} onChange={setSelectedCats} locale={locale} />
          </div>

          <div style={{ display: 'grid', gap: 6, gridColumn: '1 / -1' }}>
            <PhotoSelector
              category="table"
              selectedPhotoUrl={photoUrl || undefined}
              onPhotoSelect={(url) => setPhotoUrl(url || '')}
              placeholder={t('select_table_photo')}
            />
          </div>
          <label style={{ display: 'grid', gap: 6, gridColumn: '1 / -1' }}>
            {t('description_optional')}
            <Input value={description} onChange={(e) => setDescription(e.target.value)} />
          </label>
          <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 12, alignItems: 'center' }}>
            <Button type="submit" disabled={!canSubmit}>
              {createMutation.isPending ? t('creating') : t('create_category')}
            </Button>
            {validation.errors.length > 0 && (
              <span style={{ color: '#b00020' }}>{validation.errors[0]}</span>
            )}
            {createMutation.isError && (
              <span style={{ color: '#b00020' }}>
                {createMutation.error instanceof Error ? createMutation.error.message : t('failed_to_create_category')}
              </span>
            )}
          </div>
        </form>
      </section>

      {isLoading && <p>{t('loading_table_categories')}</p>}
      {isError && <p>{t('failed_to_load_table_categories')}</p>}

      {categories && (
        <section style={{ border: '1px solid #ddd', borderRadius: 8, padding: 12 }}>
          <h3>{t('all_categories')}</h3>
          {categories.length === 0 ? (
            <p>{t('no_table_categories_yet')}</p>
          ) : (
            <div style={{ display: 'grid', gap: 12 }}>
              {categories.map((category) => (
                <div
                  key={category.id}
                  style={{ border: '1px solid #eee', padding: 12, borderRadius: 4 }}
                >
                  {editingId === category.id ? (
                    <div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, alignItems: 'end', marginBottom: 12 }}>
                        <label style={{ display: 'grid', gap: 4 }}>
                          {t('name')}
                          <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
                        </label>
                        <label style={{ display: 'grid', gap: 4 }}>
                          {t('rate_dollar')}
                          <Input value={editRatePerPersonText} onChange={(e) => setEditRatePerPersonText(e.target.value)} />
                        </label>
                      </div>

                      <div style={{ marginBottom: 12, display: 'grid', gap: 6 }}>
                        <span style={{ fontSize: '0.9em', fontWeight: 500 }}>{t('food_package')}</span>
                        <FoodPackageCheckboxes selected={editSelectedCats} onChange={setEditSelectedCats} locale={locale} />
                      </div>

                      <div style={{ marginBottom: 12 }}>
                        <label style={{ display: 'grid', gap: 4 }}>
                          {t('description')}
                          <Input value={editDescription} onChange={(e) => setEditDescription(e.target.value)} />
                        </label>
                      </div>
                      <div style={{ marginBottom: 12 }}>
                        <PhotoSelector
                          category="table"
                          selectedPhotoUrl={editPhotoUrl || undefined}
                          onPhotoSelect={(url) => setEditPhotoUrl(url || '')}
                          placeholder={t('select_table_photo')}
                        />
                      </div>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, fontSize: '0.9em' }}>
                        <input
                          type="checkbox"
                          checked={editIsActive}
                          onChange={(e) => setEditIsActive(e.target.checked)}
                        />
                        {t('active')}
                      </label>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <Button onClick={saveEdit} disabled={!canSaveEdit}>
                          {updateMutation.isPending ? t('saving') : t('save')}
                        </Button>
                        <Button variant="secondary" onClick={() => setEditingId(null)}>
                          {t('cancel')}
                        </Button>
                      </div>
                      {editValidation.errors.length > 0 && (
                        <div style={{ color: '#b00020', fontSize: '0.9em', marginTop: 6 }}>
                          {editValidation.errors[0]}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        {category.photoUrl && (
                          <img
                            src={getPhotoUrl(category.photoUrl)}
                            alt={category.name}
                            style={{ width: 80, height: 60, objectFit: 'cover', borderRadius: 4 }}
                          />
                        )}
                        <div>
                          <strong>{category.name}</strong>
                          <p style={{ margin: '4px 0 0', fontSize: '0.9em', color: '#666' }}>
                            {t('rate')}: ${(category.ratePerPerson / 100).toFixed(2)}
                            {category.includedCategories
                              ? ` • ${parseCats(category.includedCategories)
                                  .map((c) => translate(c.toLowerCase() as Parameters<typeof translate>[0], locale))
                                  .join(', ')}`
                              : ''}
                            {category.description ? ` — ${category.description}` : ''}
                            {!category.isActive && ` (${t('inactive')})`}
                          </p>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button
                          onClick={() => startEditing(category)}
                          style={{ background: '#28a745', color: 'white', padding: '4px 8px', border: 'none', borderRadius: 4 }}
                        >
                          {t('edit')}
                        </button>
                        <button
                          onClick={() => deleteMutation.mutate(category.id)}
                          disabled={deleteMutation.isPending}
                          style={{ background: '#b00020', color: 'white', padding: '4px 8px', border: 'none', borderRadius: 4 }}
                        >
                          {t('delete')}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </main>
  );
};
