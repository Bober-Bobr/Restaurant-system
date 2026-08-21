import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { photoService, type PhotoCategory } from '../../services/photo.service';
import { useAdminStore } from '../../store/admin.store';
import { translate } from '../../utils/translate';
import { getPhotoUrl } from '../../utils/photoUrl';
import { IMAGE_ACCEPT } from '../../utils/uploadFormats';
import { Lightbox } from './lightbox';

type PhotoSelectorProps = {
  category: PhotoCategory;
  dishCategory?: string;
  selectedPhotoUrl?: string;
  onPhotoSelect: (url: string | undefined) => void;
  placeholder?: string;
};

export const PhotoSelector = ({
  category,
  dishCategory,
  selectedPhotoUrl,
  onPhotoSelect,
  placeholder
}: PhotoSelectorProps) => {
  const queryClient = useQueryClient();
  const { locale } = useAdminStore();
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: photos = [], isLoading } = useQuery({
    queryKey: ['photos', category, dishCategory ?? ''],
    queryFn: () => photoService.listPhotos(category, dishCategory)
  });

  // ── Upload from the device, into the library this picker is browsing ───────
  // The same call the Photos page makes, with the same category and dish
  // category — so the file lands in the same folder and shows up there without
  // anything having to be copied or registered a second time. Before this, a
  // photo could only be added on the Photos page and then hunted for here.
  const uploadMutation = useMutation({
    mutationFn: (files: File[]) => photoService.uploadPhotos(category, files, dishCategory),
    onSuccess: (urls) => {
      // Every list keyed on this category, whichever dish category it filters.
      queryClient.invalidateQueries({ queryKey: ['photos', category] });
      // Uploading from inside a picker is a way of choosing: pick what arrived.
      if (urls[0]) onPhotoSelect(urls[0]);
      if (fileInputRef.current) fileInputRef.current.value = '';
    },
  });

  const handleUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;
    uploadMutation.mutate(files);
  };

  const deleteMutation = useMutation({
    mutationFn: ({ filename, dishCat }: { filename: string; dishCat?: string }) =>
      photoService.deletePhoto(category, filename, dishCat),
    onSuccess: (_, { filename }) => {
      queryClient.invalidateQueries({ queryKey: ['photos', category] });
      if (selectedPhotoUrl?.includes(filename)) onPhotoSelect(undefined);
    }
  });

  const handlePhotoClick = (photoUrl: string) => {
    onPhotoSelect(selectedPhotoUrl === photoUrl ? undefined : photoUrl);
  };

  const handleDeletePhoto = async (photoUrl: string, event: React.MouseEvent) => {
    event.stopPropagation();
    const parts = photoUrl.split('/');
    const filename = parts[parts.length - 1];
    const dishCat = parts.length === 5 ? parts[3] : undefined;
    if (filename && confirm(translate('confirm_delete_photo', locale))) {
      try {
        await deleteMutation.mutateAsync({ filename, dishCat });
      } catch (error) {
        console.error('Failed to delete photo:', error);
      }
    }
  };

  return (
    <>
      {previewUrl && (
        <Lightbox src={previewUrl} onClose={() => setPreviewUrl(null)} />
      )}

      <div style={{ display: 'grid', gap: 12 }}>
        {placeholder && !selectedPhotoUrl && (
          <p style={{ fontSize: 13, color: 'rgba(226,232,240,0.55)' }}>{placeholder}</p>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadMutation.isPending}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 7,
              padding: '7px 14px', borderRadius: 8,
              border: '1px dashed rgba(var(--adm-accent-rgb),0.45)',
              background: 'rgba(var(--adm-accent-rgb),0.07)',
              color: 'var(--adm-accent)', fontSize: 13, fontWeight: 600,
              cursor: uploadMutation.isPending ? 'wait' : 'pointer',
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            {uploadMutation.isPending ? translate('uploading', locale) : translate('upload_from_device', locale)}
          </button>
          <span style={{ fontSize: 11, color: 'rgba(226,232,240,0.4)' }}>
            {translate('upload_adds_to_photos', locale)}
          </span>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={IMAGE_ACCEPT}
            onChange={handleUpload}
            style={{ display: 'none' }}
          />
        </div>
        {uploadMutation.isError && (
          <p style={{ margin: 0, fontSize: 12, color: '#fca5a5' }}>
            {uploadMutation.error instanceof Error ? uploadMutation.error.message : translate('failed_load_photos', locale)}
          </p>
        )}

        {selectedPhotoUrl && (
          <div style={{
            border: '1px solid rgba(var(--adm-accent-rgb),0.4)',
            borderRadius: 10, padding: 10,
            background: 'rgba(var(--adm-accent-rgb),0.08)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button
                type="button"
                onClick={() => setPreviewUrl(getPhotoUrl(selectedPhotoUrl) ?? null)}
                style={{ flexShrink: 0, padding: 0, background: 'transparent', border: 'none', cursor: 'pointer' }}
              >
                <img
                  src={getPhotoUrl(selectedPhotoUrl)}
                  alt="Selected"
                  style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 6 }}
                />
              </button>
              <div style={{ flex: 1 }}>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--adm-accent)' }}>
                  {translate('selected_photo', locale)}
                </p>
                <button
                  type="button"
                  onClick={() => onPhotoSelect(undefined)}
                  style={{ background: 'transparent', border: 'none', color: 'rgba(226,232,240,0.7)', fontSize: 12, cursor: 'pointer', textDecoration: 'underline', padding: 0, marginTop: 2 }}
                >
                  {translate('clear_selection', locale)}
                </button>
              </div>
            </div>
          </div>
        )}

        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fill, 88px)', gap: 8,
          justifyContent: 'space-between',
          maxHeight: 188, overflowY: 'auto',
          border: '1px solid rgba(255,255,255,0.08)',
          background: 'rgba(var(--adm-bg-rgb),0.4)',
          borderRadius: 10, padding: 8,
        }}>
          {isLoading ? (
            <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: 16, color: 'rgba(226,232,240,0.55)' }}>
              {translate('loading_photos', locale)}
            </div>
          ) : photos.length === 0 ? (
            <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: 16, color: 'rgba(226,232,240,0.45)' }}>
              {translate('no_photos_uploaded', locale)}
            </div>
          ) : (
            photos.map((photoUrl) => {
              const isSelected = selectedPhotoUrl === photoUrl;
              return (
                <div
                  key={photoUrl}
                  className="group"
                  style={{
                    position: 'relative', cursor: 'pointer',
                    border: `2px solid ${isSelected ? 'var(--adm-accent)' : 'rgba(255,255,255,0.08)'}`,
                    borderRadius: 8, overflow: 'hidden',
                    transition: 'all 0.15s',
                    boxShadow: isSelected ? '0 0 0 2px rgba(var(--adm-accent-rgb),0.25)' : 'none',
                  }}
                  onClick={() => handlePhotoClick(photoUrl)}
                >
                  <img
                    src={getPhotoUrl(photoUrl)}
                    alt=""
                    style={{ width: '100%', height: 80, objectFit: 'cover', display: 'block' }}
                  />

                  <button
                    type="button"
                    className="opacity-0 group-hover:opacity-100"
                    style={{
                      position: 'absolute', top: 4, right: 4,
                      background: '#dc2626', color: '#fff', border: 'none',
                      borderRadius: '50%', width: 20, height: 20,
                      fontSize: 12, fontWeight: 700, lineHeight: 1, cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      transition: 'opacity 0.15s',
                    }}
                    onClick={(e) => handleDeletePhoto(photoUrl, e)}
                    disabled={deleteMutation.isPending}
                  >
                    ×
                  </button>

                  <button
                    type="button"
                    className="opacity-0 group-hover:opacity-100"
                    style={{
                      position: 'absolute', bottom: 4, right: 4,
                      background: 'rgba(0,0,0,0.55)', color: '#fff', border: 'none',
                      borderRadius: '50%', width: 20, height: 20, cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      transition: 'opacity 0.15s',
                    }}
                    onClick={(e) => { e.stopPropagation(); setPreviewUrl(getPhotoUrl(photoUrl) ?? null); }}
                  >
                    <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5v-4m0 4h-4m4 0l-5-5" />
                    </svg>
                  </button>

                  {isSelected && (
                    <div style={{
                      position: 'absolute', inset: 0,
                      background: 'rgba(var(--adm-accent-rgb),0.18)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <div style={{
                        background: 'var(--adm-accent)', color: 'var(--adm-bg)',
                        borderRadius: '50%', width: 26, height: 26,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 14, fontWeight: 800,
                      }}>
                        ✓
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </>
  );
};
