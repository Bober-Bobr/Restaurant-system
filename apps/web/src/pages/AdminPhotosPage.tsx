import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { memo, useEffect, useRef, useState } from 'react';
import { photoService, type PhotoCategory } from '../services/photo.service';
import { useAdminStore } from '../store/admin.store';
import { translate } from '../utils/translate';
import { getPhotoUrl } from '../utils/photoUrl';
import { IMAGE_ACCEPT } from '../utils/uploadFormats';
import { Button } from '../components/ui/button';
import { Select } from '../components/ui/select';
import { Lightbox } from '../components/ui/lightbox';
import { useOwnExcludedCategories, type MenuCategory } from '../hooks/useExcludedCategories';

type DishCategory =
  | 'soups' | 'pizza' | 'cold_appetizers' | 'grill' | 'pastry' | 'hot_appetizers'
  | 'beer_snacks' | 'dessert' | 'lamb_dishes' | 'beef_dishes' | 'chicken_dishes'
  | 'side_dishes' | 'pasta' | 'soft_drinks' | 'steaks' | 'energy_drinks'
  | 'salads_oil' | 'salads_mayo' | 'coffee' | 'sushi_rolls'
  | 'dried_fruits' | 'candies'
  | 'first_course' | 'second_course' | 'third_course' | 'sweets' | 'fruits'
  | 'alcohol' | 'lemonades' | 'non_alcoholic_cocktails' | 'alcoholic_cocktails'
  | 'milkshakes' | 'tea_menu' | 'fresh_juices' | 'liqueurs';

const DISH_CATEGORIES: DishCategory[] = [
  'soups', 'pizza', 'cold_appetizers', 'grill', 'pastry', 'hot_appetizers',
  'beer_snacks', 'dessert', 'lamb_dishes', 'beef_dishes', 'chicken_dishes',
  'side_dishes', 'pasta', 'soft_drinks', 'steaks', 'energy_drinks',
  'salads_oil', 'salads_mayo', 'coffee', 'sushi_rolls', 'dried_fruits', 'candies',
  'first_course', 'second_course', 'third_course', 'sweets', 'fruits',
  'alcohol', 'lemonades', 'non_alcoholic_cocktails', 'alcoholic_cocktails',
  'milkshakes', 'tea_menu', 'fresh_juices', 'liqueurs',
];

const DISH_CATEGORY_LABEL_KEY: Record<DishCategory, Parameters<typeof translate>[0]> = {
  soups:           'soups',
  pizza:           'pizza',
  cold_appetizers: 'cold_appetizers',
  grill:           'grill',
  pastry:          'pastry',
  hot_appetizers:  'hot_appetizers',
  beer_snacks:     'beer_snacks',
  dessert:         'dessert',
  lamb_dishes:     'lamb_dishes',
  beef_dishes:     'beef_dishes',
  chicken_dishes:  'chicken_dishes',
  side_dishes:     'side_dishes',
  pasta:           'pasta',
  soft_drinks:     'soft_drinks',
  steaks:          'steaks',
  energy_drinks:   'energy_drinks',
  salads_oil:      'salads_oil',
  salads_mayo:     'salads_mayo',
  coffee:          'coffee',
  sushi_rolls:     'sushi_rolls',
  dried_fruits:    'dried_fruits',
  candies:         'candies',
  first_course:    'first_course',
  second_course:   'second_course',
  third_course:    'third_course',
  sweets:                   'sweets',
  fruits:                   'fruits',
  alcohol:                  'alcohol',
  lemonades:                'lemonades',
  non_alcoholic_cocktails:  'non_alcoholic_cocktails',
  alcoholic_cocktails:      'alcoholic_cocktails',
  milkshakes:               'milkshakes',
  tea_menu:                 'tea_menu',
  fresh_juices:             'fresh_juices',
  liqueurs:                 'liqueurs',
};

/**
 * How many tiles are drawn at once. The page lists EVERY photo a restaurant
 * owns — several hundred is normal — and drawing them all meant hundreds of
 * full-size camera photos fetched and decoded on the main thread at once,
 * which is what froze the page. The rest come in by "Show more", and every
 * image is lazy, so only what is near the screen is ever fetched.
 */
const PAGE = 48;

type TileProps = {
  photoUrl: string;
  showDishCategory: boolean;
  deleting: boolean;
  busy: boolean;
  deleteLabel: string;
  deletingLabel: string;
  onOpen: (url: string) => void;
  onDelete: (url: string) => void;
};

/**
 * One photo. Memoised, and deliberately NOT an .adm-card: that class carries a
 * stacked gradient and three shadows, plus a hover lift and an entrance
 * animation, which multiplied by a few hundred tiles is a page that repaints
 * itself to death while scrolling. `content-visibility` lets the browser skip
 * laying out and painting tiles that are off screen.
 */
const PhotoTile = memo(({ photoUrl, showDishCategory, deleting, busy, deleteLabel, deletingLabel, onOpen, onDelete }: TileProps) => {
  const filename = photoUrl.split('/').pop() ?? '';
  const parts = photoUrl.split('/');
  const photoDishCat = parts.length === 6 ? parts[4] : null;
  return (
    <div className="ph-tile">
      <button type="button" className="ph-thumb" onClick={() => onOpen(photoUrl)}>
        <img src={getPhotoUrl(photoUrl)} alt={filename} loading="lazy" decoding="async" width={180} height={180} />
      </button>
      <div style={{ padding: 10 }}>
        {photoDishCat && showDishCategory && (
          <p className="adm-label" style={{ marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {photoDishCat.replace(/_/g, ' ')}
          </p>
        )}
        <p style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12, color: 'rgba(226,232,240,0.6)', margin: 0 }} title={filename}>
          {filename}
        </p>
        <button type="button" onClick={() => onDelete(photoUrl)} disabled={deleting || busy}
          className="adm-btn-danger" style={{ marginTop: 8, width: '100%', fontSize: 12 }}>
          {deleting ? deletingLabel : deleteLabel}
        </button>
      </div>
    </div>
  );
});

const PHOTOS_CSS = `
  .ph-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); gap: 12px; }
  .ph-tile {
    position: relative; overflow: hidden; border-radius: 10px;
    border: 1px solid var(--adm-line); background: rgba(var(--adm-text-rgb), 0.03);
    content-visibility: auto; contain-intrinsic-size: 170px 260px;
  }
  .ph-thumb { display: block; width: 100%; aspect-ratio: 1 / 1; overflow: hidden; border: none; padding: 0; cursor: zoom-in; background: rgba(var(--adm-bg-rgb), 0.5); }
  .ph-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .ph-more { display: flex; justify-content: center; margin-top: 16px; }
`;

export const AdminPhotosPage = () => {
  const queryClient = useQueryClient();
  const { locale } = useAdminStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [category, setCategory] = useState<PhotoCategory>('menu');
  const [dishCategory, setDishCategory] = useState<DishCategory | ''>('');
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  const t = (key: Parameters<typeof translate>[0], params?: Record<string, string | number>) => translate(key, locale, params);
  const [shown, setShown] = useState(PAGE);

  // Hide excluded dish categories from the photo browser/uploader.
  const excluded = useOwnExcludedCategories();
  const dishCategories = DISH_CATEGORIES.filter((dc) => !excluded.has(dc.toUpperCase() as MenuCategory));

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

  // A different folder is a different list: start from its first page.
  useEffect(() => { setShown(PAGE); }, [category, effectiveDishCategory]);

  const openPhoto = useRef((url: string) => setLightboxSrc(getPhotoUrl(url) ?? null)).current;

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

  // Stable across renders so the memoised tiles do not all redraw on every
  // keystroke or query tick; the latest handler is read through the ref.
  const deleteRef = useRef(handleDelete);
  deleteRef.current = handleDelete;
  const deletePhoto = useRef((url: string) => { void deleteRef.current(url); }).current;

  return (
    <>
    {lightboxSrc && <Lightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />}
    <style>{PHOTOS_CSS}</style>
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
                  {dishCategories.map((dc) => (
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
              accept={IMAGE_ACCEPT}
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
            <>
              <div className="ph-grid">
                {photos.slice(0, shown).map((photoUrl) => (
                  <PhotoTile key={photoUrl} photoUrl={photoUrl}
                    showDishCategory={!dishCategory}
                    deleting={deleteMutation.isPending && deleteMutation.variables === photoUrl}
                    busy={deleteMutation.isPending}
                    deleteLabel={t('delete')} deletingLabel={t('deleting')}
                    onOpen={openPhoto} onDelete={deletePhoto} />
                ))}
              </div>
              {photos.length > shown && (
                <div className="ph-more">
                  <button type="button" className="adm-btn-ghost" onClick={() => setShown((n) => n + PAGE)}>
                    {t('photos_show_more', { shown, total: photos.length })}
                  </button>
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </main>
    </>
  );
};
