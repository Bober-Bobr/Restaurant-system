import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { tableCategoryService } from '../services/tableCategory.service';
import { useAdminStore } from '../store/admin.store';
import { translate } from '../utils/translate';
import { getPhotoUrl } from '../utils/photoUrl';
import type { TableCategory } from '../types/domain';
import { Input } from '../components/ui/input';
import { Select } from '../components/ui/select';
import { Button } from '../components/ui/button';
import { PhotoSelector } from '../components/ui/photo-selector';

const parsePositiveInt = (value: string): number | null => {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  if (!Number.isInteger(parsed) || parsed <= 0) return null;
  return parsed;
};

export const AdminTableCategoriesPage = () => {
  const queryClient = useQueryClient();
  const { locale } = useAdminStore();
  const t = (key: Parameters<typeof translate>[0], params?: Record<string, string | number>) => translate(key, locale, params);
  const { data: categories, isLoading, isError } = useQuery({
    queryKey: ['tableCategories'],
    queryFn: () => tableCategoryService.list()
  });

  const [name, setName] = useState('');
  const [seatingCapacityText, setSeatingCapacityText] = useState('2');
  const [mealPackage, setMealPackage] = useState('');
  const [ratePerPersonText, setRatePerPersonText] = useState('0');
  const [description, setDescription] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editSeatingCapacityText, setEditSeatingCapacityText] = useState('2');
  const [editMealPackage, setEditMealPackage] = useState('');
  const [editRatePerPersonText, setEditRatePerPersonText] = useState('0');
  const [editDescription, setEditDescription] = useState('');
  const [editPhotoUrl, setEditPhotoUrl] = useState('');
  const [editIsActive, setEditIsActive] = useState(true);

  const validation = useMemo(() => {
    const errors: string[] = [];

    if (name.trim().length < 1) errors.push('Name is required.');
    if (name.trim().length > 100) errors.push('Name must be 100 characters or less.');

    const seatingCapacity = parsePositiveInt(seatingCapacityText);
    if (seatingCapacity === null) errors.push('Seating capacity must be a positive integer.');
    if (seatingCapacity !== null && seatingCapacity > 1000) errors.push('Seating capacity must be 1000 or less.');

    if (mealPackage.trim().length < 2) errors.push('Meal package must be at least 2 characters.');

    const ratePerPerson = Number(ratePerPersonText);
    if (!Number.isFinite(ratePerPerson) || ratePerPerson < 0) errors.push('Rate per person must be a non-negative number.');

    return { errors, seatingCapacity };
  }, [name, seatingCapacityText, mealPackage, ratePerPersonText]);

  const editValidation = useMemo(() => {
    const errors: string[] = [];

    if (editName.trim().length < 1) errors.push('Name is required.');
    if (editName.trim().length > 100) errors.push('Name must be 100 characters or less.');

    const seatingCapacity = parsePositiveInt(editSeatingCapacityText);
    if (seatingCapacity === null) errors.push('Seating capacity must be a positive integer.');
    if (seatingCapacity !== null && seatingCapacity > 1000) errors.push('Seating capacity must be 1000 or less.');

    if (editMealPackage.trim().length < 2) errors.push('Meal package must be at least 2 characters.');

    const ratePerPerson = Number(editRatePerPersonText);
    if (!Number.isFinite(ratePerPerson) || ratePerPerson < 0) errors.push('Rate per person must be a non-negative number.');

    return { errors, seatingCapacity };
  }, [editName, editSeatingCapacityText, editMealPackage, editRatePerPersonText]);

  const createMutation = useMutation({
    mutationFn: () => {
      if (validation.errors.length > 0 || validation.seatingCapacity === null) {
        throw new Error(validation.errors[0] ?? 'Invalid form');
      }

      return tableCategoryService.create({
        name: name.trim(),
        seatingCapacity: validation.seatingCapacity,
        mealPackage: mealPackage.trim(),
        ratePerPerson: Math.round(Number(ratePerPersonText) * 100),
        description: description.trim() ? description.trim() : undefined,
        photoUrl: photoUrl.trim() ? photoUrl.trim() : undefined,
        isActive: true
      });
    },
    onSuccess: async () => {
      setName('');
      setSeatingCapacityText('2');      setMealPackage('');
      setRatePerPersonText('0');      setDescription('');
      await queryClient.invalidateQueries({ queryKey: ['tableCategories'] });
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<TableCategory> }) => tableCategoryService.update(id, data),
    onSuccess: async () => {
      setEditingId(null);
      await queryClient.invalidateQueries({ queryKey: ['tableCategories'] });
    }
  });

  const deleteMutation = useMutation<void, Error, string>({
    mutationFn: (id) => tableCategoryService.remove(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['tableCategories'] });
    }
  });

  const startEditing = (category: TableCategory) => {
    setEditingId(category.id);
    setEditName(category.name);
    setEditSeatingCapacityText(category.seatingCapacity.toString());
    setEditMealPackage(category.mealPackage);
    setEditRatePerPersonText((category.ratePerPerson / 100).toFixed(2));
    setEditDescription(category.description || '');
    setEditPhotoUrl(category.photoUrl || '');
    setEditIsActive(category.isActive);
  };

  const saveEdit = () => {
    if (!editingId || editValidation.errors.length > 0 || editValidation.seatingCapacity === null) return;

    updateMutation.mutate({
      id: editingId,
      data: {
        name: editName.trim(),
        seatingCapacity: editValidation.seatingCapacity,
        mealPackage: editMealPackage.trim(),
        ratePerPerson: Math.round(Number(editRatePerPersonText) * 100),
        description: editDescription.trim() || undefined,
        photoUrl: editPhotoUrl.trim() ? editPhotoUrl.trim() : undefined,
        isActive: editIsActive
      }
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const canSubmit = validation.errors.length === 0 && !createMutation.isPending;
  const canSaveEdit = editValidation.errors.length === 0 && !updateMutation.isPending;

  return (
    <main style={{ padding: 20 }}>
      <h1>{t('table_categories_management')}</h1>

      <section style={{ border: '1px solid #ddd', borderRadius: 8, padding: 12, marginBottom: 16 }}>
        <h3>{t('create_table_category')}</h3>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (!canSubmit || createMutation.isPending) return;
            createMutation.mutate();
          }}
          style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, alignItems: 'end' }}
        >
          <label style={{ display: 'grid', gap: 6 }}>
            {t('name')}
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('table_category_name_placeholder')} />
          </label>
          <label style={{ display: 'grid', gap: 6 }}>
            {t('seating_capacity')}
            <Input
              type="number"
              min={1}
              max={1000}
              inputMode="numeric"
              value={seatingCapacityText}
              onChange={(e) => setSeatingCapacityText(e.target.value)}
            />
          </label>
          <label style={{ display: 'grid', gap: 6 }}>
            {t('meal_package')}
            <Input value={mealPackage} onChange={(e) => setMealPackage(e.target.value)} />
          </label>
          <label style={{ display: 'grid', gap: 6 }}>
            {t('rate_per_person')}
            <Input value={ratePerPersonText} onChange={(e) => setRatePerPersonText(e.target.value)} />
          </label>
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
            {validation.errors.length > 0 ? (
              <span style={{ color: '#b00020' }}>{validation.errors[0]}</span>
            ) : null}
            {createMutation.isError ? (
              <span style={{ color: '#b00020' }}>
                {createMutation.error instanceof Error ? createMutation.error.message : t('failed_to_create_category')}
              </span>
            ) : null}
          </div>
        </form>
      </section>

      {isLoading ? <p>{t('loading_table_categories')}</p> : null}
      {isError ? <p>{t('failed_to_load_table_categories')}</p> : null}
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
                  style={{
                    border: '1px solid #eee',
                    padding: 12,
                    borderRadius: 4,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}
                >
                  {editingId === category.id ? (
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: 8, alignItems: 'end', marginBottom: 12 }}>
                        <label style={{ display: 'grid', gap: 4 }}>
                          {t('name')}
                          <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
                        </label>
                        <label style={{ display: 'grid', gap: 4 }}>
                          {t('capacity')}
                          <Input
                            type="number"
                            min={1}
                            max={1000}
                            value={editSeatingCapacityText}
                            onChange={(e) => setEditSeatingCapacityText(e.target.value)}
                          />
                        </label>
                        <label style={{ display: 'grid', gap: 4 }}>
                          {t('meal_package')}
                          <Input value={editMealPackage} onChange={(e) => setEditMealPackage(e.target.value)} />
                        </label>
                        <label style={{ display: 'grid', gap: 4 }}>
                          {t('rate_dollar')}
                          <Input value={editRatePerPersonText} onChange={(e) => setEditRatePerPersonText(e.target.value)} />
                        </label>
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
                      <label style={{ display: 'grid', gap: 4 }}>
                        {t('active')}
                        <input
                          type="checkbox"
                          checked={editIsActive}
                          onChange={(e) => setEditIsActive(e.target.checked)}
                        />
                      </label>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <Button
                          onClick={saveEdit}
                          disabled={!canSaveEdit}
                        >
                          {updateMutation.isPending ? t('saving') : t('save')}
                        </Button>
                        <Button
                          variant="secondary"
                          onClick={cancelEdit}
                        >
                          {t('cancel')}
                        </Button>
                      </div>
                      {editValidation.errors.length > 0 && (
                        <div style={{ gridColumn: '1 / -1', color: '#b00020', fontSize: '0.9em' }}>
                          {editValidation.errors[0]}
                        </div>
                      )}
                    </div>
                  ) : (
                    <>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        {category.photoUrl ? (
                          <img
                            src={getPhotoUrl(category.photoUrl)}
                            alt={category.name}
                            style={{ width: 80, height: 60, objectFit: 'cover', borderRadius: 4 }}
                          />
                        ) : null}
                        <div>
                          <strong>{category.name}</strong>
                          <p style={{ margin: '4px 0 0', fontSize: '0.9em', color: '#666' }}>
                            {t('capacity')}: {category.seatingCapacity}, {t('meal')}: {category.mealPackage}, {t('rate')}: ${(category.ratePerPerson / 100).toFixed(2)}
                            {category.description ? ` - ${category.description}` : ''}
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
                    </>
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
