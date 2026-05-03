import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { tableCategoryService } from '../services/tableCategory.service';
import { menuService } from '../services/menu.service';
import { useAdminStore } from '../store/admin.store';
import { translate } from '../utils/translate';
import { getPhotoUrl } from '../utils/photoUrl';
import type { MenuItem, TableCategory } from '../types/domain';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { PhotoSelector } from '../components/ui/photo-selector';
import { Lightbox } from '../components/ui/lightbox';
import { formatSum, formatSumInput, parseSumToTiyin } from '../utils/currency';

type FoodCategory = MenuItem['category'];

const FOOD_PACKAGE_CATEGORIES: FoodCategory[] = [
  'COLD_APPETIZERS',
  'SALADS',
  'DRINKS',
  'SWEETS',
  'FRUITS',
];

const CATEGORY_LABEL_KEY: Record<FoodCategory, Parameters<typeof translate>[0]> = {
  COLD_APPETIZERS: 'cold_appetizers',
  HOT_APPETIZERS: 'hot_appetizers',
  SALADS: 'salads',
  FIRST_COURSE: 'first_course',
  SECOND_COURSE: 'second_course',
  DRINKS: 'drinks',
  SWEETS: 'sweets',
  FRUITS: 'fruits',
};

const parseCats = (raw: string): FoodCategory[] =>
  raw
    .split(',')
    .map((s) => s.trim() as FoodCategory)
    .filter((s) => FOOD_PACKAGE_CATEGORIES.includes(s));

const serializeCats = (cats: FoodCategory[]): string => cats.join(',');

// ── Food package section ───────────────────────────────────────────────────
function FoodPackageSection({
  selectedCats,
  onCatsChange,
  selectedItemIds,
  onItemIdsChange,
  allMenuItems,
  locale,
}: {
  selectedCats: FoodCategory[];
  onCatsChange: (cats: FoodCategory[]) => void;
  selectedItemIds: string[];
  onItemIdsChange: (ids: string[]) => void;
  allMenuItems: MenuItem[];
  locale: 'en' | 'ru' | 'uz';
}) {
  const t = (key: Parameters<typeof translate>[0]) => translate(key, locale);

  const grouped = FOOD_PACKAGE_CATEGORIES.reduce<Record<FoodCategory, MenuItem[]>>(
    (acc, cat) => {
      acc[cat] = allMenuItems.filter((item) => item.isActive && item.category === cat);
      return acc;
    },
    {} as Record<FoodCategory, MenuItem[]>
  );

  const toggleCat = (cat: FoodCategory) => {
    const catItemIds = grouped[cat].map((item) => item.id);
    if (selectedCats.includes(cat)) {
      onCatsChange(selectedCats.filter((c) => c !== cat));
      onItemIdsChange(selectedItemIds.filter((id) => !catItemIds.includes(id)));
    } else {
      onCatsChange([...selectedCats, cat]);
      const toAdd = catItemIds.filter((id) => !selectedItemIds.includes(id));
      onItemIdsChange([...selectedItemIds, ...toAdd]);
    }
  };

  const toggleItem = (id: string, cat: FoodCategory) => {
    if (selectedItemIds.includes(id)) {
      const next = selectedItemIds.filter((i) => i !== id);
      onItemIdsChange(next);
      const remainsInCat = grouped[cat].some((item) => next.includes(item.id));
      if (!remainsInCat) {
        onCatsChange(selectedCats.filter((c) => c !== cat));
      }
    } else {
      onItemIdsChange([...selectedItemIds, id]);
      if (!selectedCats.includes(cat)) {
        onCatsChange([...selectedCats, cat]);
      }
    }
  };

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <span style={{ fontSize: '0.9em', fontWeight: 600 }}>{t('food_package')}</span>

      {FOOD_PACKAGE_CATEGORIES.map((cat) => (
        <div
          key={cat}
          style={{ border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden' }}
        >
          <label
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '8px 12px',
              background: selectedCats.includes(cat) ? '#f0fdf4' : '#f8fafc',
              cursor: 'pointer', fontWeight: 500, fontSize: '0.9em',
              borderBottom: grouped[cat].length > 0 ? '1px solid #e2e8f0' : 'none',
            }}
          >
            <input
              type="checkbox"
              checked={selectedCats.includes(cat)}
              onChange={() => toggleCat(cat)}
            />
            {t(CATEGORY_LABEL_KEY[cat])}
            <span style={{ marginLeft: 'auto', fontSize: '0.8em', color: '#94a3b8', fontWeight: 400 }}>
              {grouped[cat].length} {grouped[cat].length === 1 ? 'dish' : 'dishes'}
            </span>
          </label>

          {grouped[cat].length > 0 && (
            <div style={{ padding: '8px 12px', display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {grouped[cat].map((item) => (
                <label
                  key={item.id}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '4px 10px', borderRadius: 20,
                    border: `1px solid ${selectedItemIds.includes(item.id) ? '#22c55e' : '#cbd5e1'}`,
                    background: selectedItemIds.includes(item.id) ? '#f0fdf4' : 'white',
                    cursor: 'pointer', fontSize: '0.85em', userSelect: 'none',
                    transition: 'all 0.15s',
                  }}
                >
                  <input
                    type="checkbox"
                    style={{ display: 'none' }}
                    checked={selectedItemIds.includes(item.id)}
                    onChange={() => toggleItem(item.id, cat)}
                  />
                  {item.name}
                  <span style={{ color: '#94a3b8' }}>{formatSum(item.priceCents)}</span>
                </label>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Multi-photo field ──────────────────────────────────────────────────────
function PhotosField({ photoUrls, onChange }: { photoUrls: string[]; onChange: (urls: string[]) => void }) {
  const [adding, setAdding] = useState(false);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  return (
    <>
      {lightboxSrc && <Lightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />}
      <div style={{ display: 'grid', gap: 8 }}>
        <span style={{ fontSize: '0.9em', fontWeight: 600 }}>Photos</span>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
          {photoUrls.map((url, i) => (
            <div key={i} style={{ position: 'relative' }}>
              <button
                type="button"
                onClick={() => setLightboxSrc(getPhotoUrl(url) ?? null)}
                style={{ display: 'block', borderRadius: 8, overflow: 'hidden', border: '1px solid #e2e8f0', cursor: 'pointer' }}
              >
                <img
                  src={getPhotoUrl(url)}
                  alt=""
                  style={{ width: 72, height: 60, objectFit: 'cover', display: 'block' }}
                />
              </button>
              <button
                type="button"
                onClick={() => onChange(photoUrls.filter((_, j) => j !== i))}
                style={{
                  position: 'absolute', top: -6, right: -6,
                  width: 18, height: 18, borderRadius: '50%',
                  background: '#b00020', color: 'white', border: 'none',
                  cursor: 'pointer', fontSize: 11,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                ×
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => setAdding((v) => !v)}
            style={{
              width: 72, height: 60, borderRadius: 8,
              border: '2px dashed #cbd5e1', background: adding ? '#f8fafc' : 'white',
              cursor: 'pointer', fontSize: 22, color: '#94a3b8',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
            title="Add photo"
          >
            +
          </button>
        </div>
        {adding && (
          <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: 8 }}>
            <PhotoSelector
              category="table"
              selectedPhotoUrl={undefined}
              onPhotoSelect={(url: string | undefined) => {
                if (url && !photoUrls.includes(url)) onChange([...photoUrls, url]);
                setAdding(false);
              }}
            />
          </div>
        )}
      </div>
    </>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────
export const AdminTableCategoriesPage = () => {
  const queryClient = useQueryClient();
  const { locale } = useAdminStore();
  const t = (key: Parameters<typeof translate>[0]) => translate(key, locale);

  const { data: categories, isLoading, isError } = useQuery({
    queryKey: ['tableCategories'],
    queryFn: () => tableCategoryService.list(),
  });

  const { data: allMenuItems = [] } = useQuery({
    queryKey: ['menu-items', 'admin', 'all'],
    queryFn: () => menuService.listAllForAdmin(),
  });

  // ── Create form state ──────────────────────────────────────────────────
  const [name, setName] = useState('');
  const [selectedCats, setSelectedCats] = useState<FoodCategory[]>([]);
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [ratePerPersonText, setRatePerPersonText] = useState('0');
  const [description, setDescription] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);

  // ── Edit state ─────────────────────────────────────────────────────────
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editSelectedCats, setEditSelectedCats] = useState<FoodCategory[]>([]);
  const [editSelectedItemIds, setEditSelectedItemIds] = useState<string[]>([]);
  const [editRatePerPersonText, setEditRatePerPersonText] = useState('0');
  const [editDescription, setEditDescription] = useState('');
  const [editPhotos, setEditPhotos] = useState<string[]>([]);
  const [editIsActive, setEditIsActive] = useState(true);

  const validation = useMemo(() => {
    const errors: string[] = [];
    if (name.trim().length < 1) errors.push('Name is required.');
    if (name.trim().length > 100) errors.push('Name must be 100 characters or less.');
    const rate = Number(ratePerPersonText);
    if (!Number.isFinite(rate) || rate < 0) errors.push('Rate per person must be a non-negative number.');
    return { errors };
  }, [name, ratePerPersonText]);

  const editValidation = useMemo(() => {
    const errors: string[] = [];
    if (editName.trim().length < 1) errors.push('Name is required.');
    if (editName.trim().length > 100) errors.push('Name must be 100 characters or less.');
    const rate = Number(editRatePerPersonText);
    if (!Number.isFinite(rate) || rate < 0) errors.push('Rate per person must be a non-negative number.');
    return { errors };
  }, [editName, editRatePerPersonText]);

  const createMutation = useMutation({
    mutationFn: () => {
      if (validation.errors.length > 0) throw new Error(validation.errors[0]);
      return tableCategoryService.create({
        name: name.trim(),
        includedCategories: serializeCats(selectedCats),
        menuItemIds: selectedItemIds,
        ratePerPerson: parseSumToTiyin(ratePerPersonText) ?? 0,
        description: description.trim() || undefined,
        photos,
        isActive: true,
      });
    },
    onSuccess: async () => {
      setName('');
      setSelectedCats([]);
      setSelectedItemIds([]);
      setRatePerPersonText('0');
      setDescription('');
      setPhotos([]);
      await queryClient.invalidateQueries({ queryKey: ['tableCategories'] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<TableCategory> & { menuItemIds?: string[] } }) =>
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
    setEditSelectedItemIds((category.packageItems ?? []).map((pi) => pi.menuItem.id));
    setEditRatePerPersonText(formatSumInput(category.ratePerPerson));
    setEditDescription(category.description || '');
    setEditPhotos(category.photos ?? []);
    setEditIsActive(category.isActive);
  };

  const saveEdit = () => {
    if (!editingId || editValidation.errors.length > 0) return;
    updateMutation.mutate({
      id: editingId,
      data: {
        name: editName.trim(),
        includedCategories: serializeCats(editSelectedCats),
        menuItemIds: editSelectedItemIds,
        ratePerPerson: parseSumToTiyin(editRatePerPersonText) ?? 0,
        description: editDescription.trim() || undefined,
        photos: editPhotos,
        isActive: editIsActive,
      },
    });
  };

  const canSubmit = validation.errors.length === 0 && !createMutation.isPending;
  const canSaveEdit = editValidation.errors.length === 0 && !updateMutation.isPending;

  return (
    <main style={{ padding: 20 }}>
      <h1>{t('table_categories_management')}</h1>

      {/* ── Create form ── */}
      <section style={{ border: '1px solid #ddd', borderRadius: 8, padding: 16, marginBottom: 16 }}>
        <h3 style={{ marginTop: 0 }}>{t('create_table_category')}</h3>
        <form
          onSubmit={(e) => { e.preventDefault(); if (!canSubmit) return; createMutation.mutate(); }}
          style={{ display: 'grid', gap: 14 }}
        >
          <div className="form-grid-2">
            <label style={{ display: 'grid', gap: 6 }}>
              {t('name')}
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('table_category_name_placeholder')} />
            </label>
            <label style={{ display: 'grid', gap: 6 }}>
              {t('rate_per_person')}
              <Input value={ratePerPersonText} onChange={(e) => setRatePerPersonText(e.target.value)} />
            </label>
          </div>

          <FoodPackageSection
            selectedCats={selectedCats}
            onCatsChange={setSelectedCats}
            selectedItemIds={selectedItemIds}
            onItemIdsChange={setSelectedItemIds}
            allMenuItems={allMenuItems}
            locale={locale}
          />

          <PhotosField photoUrls={photos} onChange={setPhotos} />

          <label style={{ display: 'grid', gap: 6 }}>
            {t('description_optional')}
            <Input value={description} onChange={(e) => setDescription(e.target.value)} />
          </label>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <Button type="submit" disabled={!canSubmit}>
              {createMutation.isPending ? t('creating') : t('create_category')}
            </Button>
            {validation.errors.length > 0 && <span style={{ color: '#b00020' }}>{validation.errors[0]}</span>}
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

      {/* ── List ── */}
      {categories && (
        <section style={{ border: '1px solid #ddd', borderRadius: 8, padding: 12 }}>
          <h3 style={{ marginTop: 0 }}>{t('all_categories')}</h3>
          {categories.length === 0 ? (
            <p>{t('no_table_categories_yet')}</p>
          ) : (
            <div style={{ display: 'grid', gap: 12 }}>
              {categories.map((category) => (
                <div key={category.id} style={{ border: '1px solid #eee', padding: 12, borderRadius: 6 }}>
                  {editingId === category.id ? (
                    // ── Edit form ──
                    <div style={{ display: 'grid', gap: 14 }}>
                      <div className="form-grid-2" style={{ gap: 8 }}>
                        <label style={{ display: 'grid', gap: 4 }}>
                          {t('name')}
                          <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
                        </label>
                        <label style={{ display: 'grid', gap: 4 }}>
                          {t('rate_dollar')}
                          <Input value={editRatePerPersonText} onChange={(e) => setEditRatePerPersonText(e.target.value)} />
                        </label>
                      </div>

                      <FoodPackageSection
                        selectedCats={editSelectedCats}
                        onCatsChange={setEditSelectedCats}
                        selectedItemIds={editSelectedItemIds}
                        onItemIdsChange={setEditSelectedItemIds}
                        allMenuItems={allMenuItems}
                        locale={locale}
                      />

                      <label style={{ display: 'grid', gap: 4 }}>
                        {t('description')}
                        <Input value={editDescription} onChange={(e) => setEditDescription(e.target.value)} />
                      </label>

                      <PhotosField photoUrls={editPhotos} onChange={setEditPhotos} />

                      <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.9em' }}>
                        <input type="checkbox" checked={editIsActive} onChange={(e) => setEditIsActive(e.target.checked)} />
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
                        <div style={{ color: '#b00020', fontSize: '0.9em' }}>{editValidation.errors[0]}</div>
                      )}
                    </div>
                  ) : (
                    // ── Read view ──
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                        {/* Photos strip */}
                        {(category.photos ?? []).length > 0 && (
                          <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                            {(category.photos ?? []).slice(0, 4).map((url, i) => (
                              <img
                                key={i}
                                src={getPhotoUrl(url)}
                                alt=""
                                style={{ width: 56, height: 44, objectFit: 'cover', borderRadius: 4 }}
                              />
                            ))}
                            {(category.photos ?? []).length > 4 && (
                              <div style={{
                                width: 56, height: 44, borderRadius: 4,
                                background: '#f1f5f9', display: 'flex',
                                alignItems: 'center', justifyContent: 'center',
                                fontSize: '0.8em', color: '#64748b', fontWeight: 600,
                              }}>
                                +{(category.photos ?? []).length - 4}
                              </div>
                            )}
                          </div>
                        )}
                        <div>
                          <strong>{category.name}</strong>
                          <p style={{ margin: '3px 0 0', fontSize: '0.85em', color: '#64748b' }}>
                            {t('rate')}: {formatSum(category.ratePerPerson)}
                            {!category.isActive && ` • ${t('inactive')}`}
                          </p>
                          {parseCats(category.includedCategories).length > 0 && (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 5 }}>
                              {parseCats(category.includedCategories).map((cat) => (
                                <span key={cat} style={{ fontSize: '0.75em', padding: '2px 8px', borderRadius: 12, background: '#dbeafe', color: '#1e40af' }}>
                                  {t(CATEGORY_LABEL_KEY[cat])}
                                </span>
                              ))}
                            </div>
                          )}
                          {(category.packageItems ?? []).length > 0 && (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 5 }}>
                              {(category.packageItems ?? []).map((pi) => (
                                <span key={pi.id} style={{ fontSize: '0.75em', padding: '2px 8px', borderRadius: 12, background: '#dcfce7', color: '#166534' }}>
                                  {pi.menuItem.name}
                                </span>
                              ))}
                            </div>
                          )}
                          {category.description && (
                            <p style={{ margin: '4px 0 0', fontSize: '0.82em', color: '#94a3b8' }}>{category.description}</p>
                          )}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                        <button
                          onClick={() => startEditing(category)}
                          style={{ background: '#28a745', color: 'white', padding: '4px 8px', border: 'none', borderRadius: 4, cursor: 'pointer' }}
                        >
                          {t('edit')}
                        </button>
                        <button
                          onClick={() => deleteMutation.mutate(category.id)}
                          disabled={deleteMutation.isPending}
                          style={{ background: '#b00020', color: 'white', padding: '4px 8px', border: 'none', borderRadius: 4, cursor: 'pointer' }}
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
