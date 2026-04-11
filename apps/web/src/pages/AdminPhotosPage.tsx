import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { photoService, type PhotoCategory } from '../services/photo.service';
import { useAdminStore } from '../store/admin.store';
import { translate } from '../utils/translate';
import { Button } from '../components/ui/button';
import { Select } from '../components/ui/select';

export const AdminPhotosPage = () => {
  const queryClient = useQueryClient();
  const { locale } = useAdminStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [category, setCategory] = useState<PhotoCategory>('menu');
  const [isUploading, setIsUploading] = useState(false);

  const t = (key: Parameters<typeof translate>[0]) => translate(key, locale);

  const { data: photos = [], isLoading, isError } = useQuery({
    queryKey: ['photos', category],
    queryFn: () => photoService.listPhotos(category)
  });

  const uploadMutation = useMutation({
    mutationFn: (files: File[]) => photoService.uploadPhotos(category, files),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['photos', category] });
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    },
    onError: () => {
      setIsUploading(false);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (filename: string) => photoService.deletePhoto(category, filename),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['photos', category] });
    }
  });

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    setIsUploading(true);
    try {
      await uploadMutation.mutateAsync(files);
    } catch (error) {
      console.error('Failed to upload photos:', error);
    }
  };

  const handleDeletePhoto = async (photoUrl: string) => {
    const filename = photoUrl.split('/').pop();
    if (filename && confirm(t('confirm_delete_photo'))) {
      try {
        await deleteMutation.mutateAsync(filename);
      } catch (error) {
        console.error('Failed to delete photo:', error);
      }
    }
  };

  const getCategoryLabel = (cat: PhotoCategory) => {
    switch (cat) {
      case 'menu': return t('menu_photos');
      case 'hall': return t('hall_photos');
      case 'table': return t('table_photos');
    }
  };

  return (
    <main style={{ padding: 20 }}>
      <h1>{t('photo_management')}</h1>

      <section style={{ border: '1px solid #ddd', borderRadius: 8, padding: 12, marginBottom: 16 }}>
        <h3>{t('upload_photos')}</h3>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 12, alignItems: 'end' }}>
          <label style={{ display: 'grid', gap: 6 }}>
            {t('photo_category')}
            <Select value={category} onChange={(e) => setCategory(e.target.value as PhotoCategory)}>
              <option value="menu">{t('menu_photos')}</option>
              <option value="hall">{t('hall_photos')}</option>
              <option value="table">{t('table_photos')}</option>
            </Select>
          </label>

          <Button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
          >
            {isUploading ? t('uploading') : t('select_upload_files')}
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

        <p style={{ marginTop: 8, fontSize: '0.875rem', color: '#666' }}>
          {t('upload_photos_help')}
        </p>
      </section>

      <section style={{ border: '1px solid #ddd', borderRadius: 8, padding: 12 }}>
        <h3>
          {getCategoryLabel(category)} ({photos.length})
        </h3>

        {isLoading ? (
          <p>{t('loading_photos')}</p>
        ) : isError ? (
          <p style={{ color: '#b00020' }}>{t('failed_load_photos')}</p>
        ) : photos.length === 0 ? (
          <p style={{ color: '#666' }}>{t('no_photos_uploaded')}</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12 }}>
            {photos.map((photoUrl) => {
              const filename = photoUrl.split('/').pop() || '';
              return (
                <div
                  key={photoUrl}
                  style={{
                    border: '1px solid #eee',
                    borderRadius: 8,
                    overflow: 'hidden',
                    backgroundColor: '#fafafa'
                  }}
                >
                  <img
                    src={photoUrl}
                    alt={filename}
                    style={{
                      width: '100%',
                      height: 150,
                      objectFit: 'cover'
                    }}
                  />
                  <div style={{ padding: 8 }}>
                    <p style={{ fontSize: '0.75rem', color: '#666', margin: 0, marginBottom: 8, wordBreak: 'break-all', maxHeight: 40, overflow: 'hidden' }}>
                      {filename}
                    </p>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeletePhoto(photoUrl)}
                      disabled={deleteMutation.isPending}
                      style={{ width: '100%' }}
                    >
                      {deleteMutation.isPending ? t('deleting') : t('delete')}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
};