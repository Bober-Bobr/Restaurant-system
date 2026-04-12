import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { photoService, type PhotoCategory } from '../services/photo.service';
import { useAdminStore } from '../store/admin.store';
import { translate } from '../utils/translate';
import { getPhotoUrl } from '../utils/photoUrl';
import { Button } from '../components/ui/button';
import { Select } from '../components/ui/select';

export const AdminPhotosPage = () => {
  const queryClient = useQueryClient();
  const { locale } = useAdminStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [category, setCategory] = useState<PhotoCategory>('menu');

  const t = (key: Parameters<typeof translate>[0]) => translate(key, locale);

  const { data: photos = [], isLoading, isError } = useQuery({
    queryKey: ['photos', category],
    queryFn: () => photoService.listPhotos(category)
  });

  const uploadMutation = useMutation({
    mutationFn: (files: File[]) => photoService.uploadPhotos(category, files),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['photos', category] });
      if (fileInputRef.current) fileInputRef.current.value = '';
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
    try {
      await uploadMutation.mutateAsync(files);
    } catch (error) {
      console.error('Failed to upload photos:', error);
    }
  };

  const handleDelete = async (photoUrl: string) => {
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
    <main className="px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <h1 className="page-heading">{t('photo_management')}</h1>

        {/* Upload controls */}
        <section className="card p-6">
          <p className="section-heading mb-4">{t('upload_photos')}</p>
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">{t('photo_category')}</label>
              <Select
                value={category}
                onChange={(e) => setCategory(e.target.value as PhotoCategory)}
                className="w-48"
              >
                <option value="menu">{t('menu_photos')}</option>
                <option value="hall">{t('hall_photos')}</option>
                <option value="table">{t('table_photos')}</option>
              </Select>
            </div>
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
          <p className="mt-3 text-sm text-slate-500">{t('upload_photos_help')}</p>
        </section>

        {/* Photo grid */}
        <section className="card p-6">
          <p className="section-heading mb-4">
            {getCategoryLabel(category)}
            <span className="ml-2 text-base font-normal text-slate-500">({photos.length})</span>
          </p>

          {isLoading ? (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {Array.from({ length: 10 }).map((_, i) => (
                <div key={i} className="aspect-square animate-pulse rounded-2xl bg-slate-100" />
              ))}
            </div>
          ) : isError ? (
            <p className="text-sm text-red-600">{t('failed_load_photos')}</p>
          ) : photos.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 py-16 text-slate-400">
              <svg className="mb-3 h-10 w-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <p className="text-sm">{t('no_photos_uploaded')}</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {photos.map((photoUrl) => {
                const filename = photoUrl.split('/').pop() ?? '';
                const isDeleting = deleteMutation.isPending && deleteMutation.variables === filename;
                return (
                  <div
                    key={photoUrl}
                    className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 shadow-sm transition-shadow hover:shadow-md"
                  >
                    <div className="aspect-square">
                      <img
                        src={getPhotoUrl(photoUrl)}
                        alt={filename}
                        className="h-full w-full object-cover"
                      />
                    </div>
                    <div className="p-3">
                      <p className="truncate text-xs text-slate-500" title={filename}>
                        {filename}
                      </p>
                      <button
                        type="button"
                        onClick={() => handleDelete(photoUrl)}
                        disabled={isDeleting || deleteMutation.isPending}
                        className="mt-2 w-full rounded-xl border border-red-200 bg-white py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50"
                      >
                        {isDeleting ? t('deleting') : t('delete')}
                      </button>
                    </div>
                    {/* Hover overlay */}
                    <div className="pointer-events-none absolute inset-0 rounded-2xl ring-2 ring-transparent transition-all group-hover:ring-slate-300" />
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
};
