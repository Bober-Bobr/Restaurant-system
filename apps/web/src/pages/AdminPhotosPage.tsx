import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { photoService, type PhotoCategory } from '../services/photo.service';
import { useAdminStore } from '../store/admin.store';
import { translate } from '../utils/translate';
import { getPhotoUrl } from '../utils/photoUrl';
import { Button } from '../components/ui/button';
import { Select } from '../components/ui/select';
import { Lightbox } from '../components/ui/lightbox';

type DishCategory =
  | 'cold_appetizers' | 'hot_appetizers' | 'salads'
  | 'first_course' | 'second_course' | 'drinks' | 'sweets' | 'fruits';

const DISH_CATEGORIES: DishCategory[] = [
  'cold_appetizers', 'hot_appetizers', 'salads',
  'first_course', 'second_course', 'drinks', 'sweets', 'fruits',
];

const DISH_CATEGORY_LABEL_KEY: Record<DishCategory, Parameters<typeof translate>[0]> = {
  cold_appetizers: 'cold_appetizers',
  hot_appetizers:  'hot_appetizers',
  salads:          'salads',
  first_course:    'first_course',
  second_course:   'second_course',
  drinks:          'drinks',
  sweets:          'sweets',
  fruits:          'fruits',
};

export const AdminPhotosPage = () => {
  const queryClient = useQueryClient();
  const { locale } = useAdminStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [category, setCategory] = useState<PhotoCategory>('menu');
  const [dishCategory, setDishCategory] = useState<DishCategory | ''>('');
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  const t = (key: Parameters<typeof translate>[0]) => translate(key, locale);

  const effectiveDishCategory = category === 'menu' && dishCategory ? dishCategory : undefined;

  const { data: photos = [], isLoading, isError } = useQuery({
    queryKey: ['photos', category, effectiveDishCategory ?? ''],
    queryFn: () => photoService.listPhotos(category, effectiveDishCategory)
  });

  const uploadMutation = useMutation({
    mutationFn: (files: File[]) => photoService.uploadPhotos(category, files, effectiveDishCategory),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['photos', category] });
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (photoUrl: string) => {
      const parts = photoUrl.split('/');
      // /uploads/{rid}/menu/hot_appetizers/photo.jpg → 6 parts (with dish category)
      // /uploads/{rid}/menu/photo.jpg → 5 parts
      const filename = parts[parts.length - 1];
      const dishCat = parts.length === 6 ? parts[4] : undefined;
      return photoService.deletePhoto(category, filename, dishCat);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['photos', category] });
    }
  });

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;
    try {
      await uploadMutation.mutateAsync(files);
    } catch (error) {
      console.error('Failed to upload photos:', error);
    }
  };

  const handleDelete = async (photoUrl: string) => {
    if (confirm(t('confirm_delete_photo'))) {
      try {
        await deleteMutation.mutateAsync(photoUrl);
      } catch (error) {
        console.error('Failed to delete photo:', error);
      }
    }
  };

  const getCategoryLabel = (cat: PhotoCategory) => {
    switch (cat) {
      case 'menu':  return t('menu_photos');
      case 'hall':  return t('hall_photos');
      case 'table': return t('table_photos');
    }
  };

  return (
    <>
    {lightboxSrc && <Lightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />}
    <main className="tablet-fade-in" style={{ maxWidth: 1280, margin: '0 auto', padding: '28px 20px', position: 'relative', zIndex: 1 }}>
      <div style={{ display: 'grid', gap: 18 }}>
        <h1 className="adm-title">{t('photo_management')}</h1>

        {/* Upload controls */}
        <section className="adm-card tablet-fade-up adm-section">
          <p className="adm-heading" style={{ marginBottom: 16 }}>{t('upload_photos')}</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: 14 }}>
            <div style={{ display: 'grid', gap: 6 }}>
              <label className="adm-label">{t('photo_category')}</label>
              <Select
                value={category}
                onChange={(e) => { setCategory(e.target.value as PhotoCategory); setDishCategory(''); }}
                className="w-48"
              >
                <option value="menu">{t('menu_photos')}</option>
                <option value="hall">{t('hall_photos')}</option>
                <option value="table">{t('table_photos')}</option>
              </Select>
            </div>

            {category === 'menu' && (
              <div style={{ display: 'grid', gap: 6 }}>
                <label className="adm-label">{t('dish_category')}</label>
                <Select
                  value={dishCategory}
                  onChange={(e) => setDishCategory(e.target.value as DishCategory | '')}
                  className="w-52"
                >
                  <option value="">{t('filter_all')}</option>
                  {DISH_CATEGORIES.map((dc) => (
                    <option key={dc} value={dc}>
                      {t(DISH_CATEGORY_LABEL_KEY[dc])}
                    </option>
                  ))}
                </Select>
              </div>
            )}

            <Button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadMutation.isPending}
            >
              {uploadMutation.isPending ? t('uploading') : t('select_upload_files')}
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*"
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>
          <p style={{ marginTop: 12, fontSize: 13, color: 'rgba(226,232,240,0.55)' }}>{t('upload_photos_help')}</p>
        </section>

        {/* Photo grid */}
        <section className="adm-card tablet-fade-up adm-section" style={{ animationDelay: '80ms' }}>
          <p className="adm-heading" style={{ marginBottom: 14 }}>
            {getCategoryLabel(category)}
            {category === 'menu' && dishCategory && (
              <span style={{ marginLeft: 8, fontSize: 13, fontWeight: 500, color: 'rgba(226,232,240,0.55)', textTransform: 'none', letterSpacing: 0 }}>
                — {t(DISH_CATEGORY_LABEL_KEY[dishCategory])}
              </span>
            )}
            <span style={{ marginLeft: 8, fontSize: 13, fontWeight: 500, color: 'rgba(226,232,240,0.55)', textTransform: 'none', letterSpacing: 0 }}>({photos.length})</span>
          </p>

          {isLoading ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 14 }}>
              {Array.from({ length: 10 }).map((_, i) => (
                <div key={i} className="rg-shimmer" style={{ aspectRatio: '1 / 1', borderRadius: 16 }} />
              ))}
            </div>
          ) : isError ? (
            <p style={{ fontSize: 14, color: '#fca5a5' }}>{t('failed_load_photos')}</p>
          ) : photos.length === 0 ? (
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              padding: '60px 16px', color: 'rgba(226,232,240,0.45)',
              border: '2px dashed rgba(255,255,255,0.08)', borderRadius: 16,
            }}>
              <svg width="40" height="40" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ marginBottom: 12 }}>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <p style={{ fontSize: 14 }}>{t('no_photos_uploaded')}</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 14 }}>
              {photos.map((photoUrl) => {
                const filename = photoUrl.split('/').pop() ?? '';
                const isDeleting = deleteMutation.isPending && deleteMutation.variables === photoUrl;
                // Show dish category badge when in "All" view
                const parts = photoUrl.split('/');
                const photoDishCat = parts.length === 6 ? parts[4] : null;
                return (
                  <div
                    key={photoUrl}
                    className="adm-card adm-card-hover tablet-fade-up"
                    style={{ overflow: 'hidden', position: 'relative' }}
                  >
                    <button
                      type="button"
                      onClick={() => setLightboxSrc(getPhotoUrl(photoUrl) ?? null)}
                      style={{ display: 'block', width: '100%', aspectRatio: '1 / 1', overflow: 'hidden', background: 'rgba(15,23,42,0.5)', border: 'none', padding: 0, cursor: 'pointer' }}
                    >
                      <img
                        src={getPhotoUrl(photoUrl)}
                        alt={filename}
                        style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.2s' }}
                      />
                    </button>
                    <div style={{ padding: 12 }}>
                      {photoDishCat && !dishCategory && (
                        <p className="adm-label" style={{ marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {photoDishCat.replace(/_/g, ' ')}
                        </p>
                      )}
                      <p style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12, color: 'rgba(226,232,240,0.6)' }} title={filename}>
                        {filename}
                      </p>
                      <button
                        type="button"
                        onClick={() => handleDelete(photoUrl)}
                        disabled={isDeleting || deleteMutation.isPending}
                        className="adm-btn-danger"
                        style={{ marginTop: 10, width: '100%', fontSize: 12 }}
                      >
                        {isDeleting ? t('deleting') : t('delete')}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
    </>
  );
};
