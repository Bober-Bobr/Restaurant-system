import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { photoService, type PhotoCategory } from '../../services/photo.service';
import { useAdminStore } from '../../store/admin.store';
import { translate } from '../../utils/translate';
import { getPhotoUrl } from '../../utils/photoUrl';
import { IMAGE_ACCEPT } from '../../utils/uploadFormats';
import { Lightbox } from './lightbox';
import { appendUploaded, movePhoto, normalizeSelection, togglePhoto } from './photoSelection';

/**
 * ── ONE PICKER, TWO MODES ──────────────────────────────────────────────────
 * Most places attach a single photo to a thing (a dish, a table package). A
 * hall has a GALLERY, so the same picker has to be able to return several — and
 * in an order, since the first photo is the one every single-photo screen shows
 * (see utils/hallPhotos.ts).
 *
 * The two modes are a DISCRIMINATED UNION, not two optional callbacks, so a
 * caller cannot half-configure it — `multiple` with no `onPhotosChange` would
 * otherwise compile into a gallery that silently discards every choice. The
 * library browser, the upload button and the delete-from-library path below are
 * shared; a second component would have been a second copy of all three.
 */
/**
 * The reorder arrows on a chosen photo.
 *
 * `flex: 1` rather than a fixed width, so the two of them divide the whole
 * bottom band of the tile between them — measured, that is 46px each at the
 * narrowest track and 66px at a desktop width. These pages are worked on a
 * tablet, and a 26px glyph is a target that has to be aimed at.
 */
const arrowStyle: React.CSSProperties = {
  flex: 1, height: 28, padding: 0,
  background: 'transparent', border: 'none', color: '#fff',
  fontSize: 18, lineHeight: 1, cursor: 'pointer',
};

type PhotoSelectorBase = {
  category: PhotoCategory;
  dishCategory?: string;
  placeholder?: string;
};

type PhotoSelectorProps = PhotoSelectorBase &
  (
    | {
        multiple?: false;
        selectedPhotoUrl?: string;
        onPhotoSelect: (url: string | undefined) => void;
      }
    | {
        multiple: true;
        selectedPhotoUrls: string[];
        onPhotosChange: (urls: string[]) => void;
        /** Required in gallery mode: the API's own cap, so the picker refuses
         *  the photo that would have cost the whole save. */
        max: number;
      }
  );

export const PhotoSelector = (props: PhotoSelectorProps) => {
  const { category, dishCategory, placeholder } = props;
  const queryClient = useQueryClient();
  const { locale } = useAdminStore();
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // The selection is held as an ordered LIST in both modes, so everything below
  // this line works the same way either way; the two adapters are here and
  // nowhere else.
  const multiple = props.multiple === true;
  const selection = props.multiple
    ? props.selectedPhotoUrls
    : props.selectedPhotoUrl
      ? [props.selectedPhotoUrl]
      : [];
  const max = props.multiple ? props.max : 1;
  const selectedPhotoUrl = multiple ? undefined : selection[0];
  const commit = (next: string[]) => {
    if (props.multiple) props.onPhotosChange(normalizeSelection(next, props.max));
    else props.onPhotoSelect(next[0]);
  };
  const atLimit = multiple && selection.length >= max;
  const move = (from: number, to: number) => commit(movePhoto(selection, from, to));

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
      // In gallery mode that means ALL of it, appended in the order the files
      // were given — the file dialog has always been `multiple`, so taking only
      // the first threw away nine photos out of ten of a phone's worth.
      commit(appendUploaded(selection, urls, { multiple, max }));

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
      // A photo deleted from the library cannot stay in the selection — the file
      // is gone, so it would be saved as a URL that 404s.
      const orphaned = selection.filter((photo) => photo.includes(filename));
      if (orphaned.length > 0) commit(selection.filter((photo) => !orphaned.includes(photo)));
    }
  });

  const handlePhotoClick = (photoUrl: string) => {
    // Single mode replaces; gallery mode toggles, appending at the end and
    // refusing past the cap rather than evicting a photo already arranged.
    if (!multiple) commit(selection[0] === photoUrl ? [] : [photoUrl]);
    else commit(togglePhoto(selection, photoUrl, max));
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
        {placeholder && selection.length === 0 && (
          <p style={{ fontSize: 13, color: 'rgba(226,232,240,0.55)' }}>{placeholder}</p>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadMutation.isPending || atLimit}
            style={{
              opacity: atLimit ? 0.45 : 1,
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

        {atLimit && (
          <p style={{ margin: 0, fontSize: 12, color: 'rgba(226,232,240,0.55)' }}>
            {translate('photo_limit_reached', locale, { max })}
          </p>
        )}

        {/* ── The chosen gallery, in order ────────────────────────────────────
            A separate strip rather than relying on ticks in the library below,
            for two reasons: the library is sorted by filename and holds every
            photo the restaurant owns, so a selection of eight scattered through
            it cannot be read at a glance — and the ORDER matters here, since
            the first photo is the cover every single-photo screen shows. An
            order that cannot be seen cannot be arranged. */}
        {multiple && selection.length > 0 && (
          <div style={{
            border: '1px solid rgba(var(--adm-accent-rgb),0.4)',
            borderRadius: 10, padding: 10,
            background: 'rgba(var(--adm-accent-rgb),0.08)',
            display: 'grid', gap: 8,
          }}>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--adm-accent)' }}>
              {translate('photos_chosen', locale, { count: selection.length, max })}
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(96px, 1fr))', gap: 8 }}>
              {selection.map((photoUrl, index) => (
                <div
                  key={photoUrl}
                  style={{
                    position: 'relative', borderRadius: 8, overflow: 'hidden', height: 76,
                    border: index === 0
                      ? '2px solid var(--adm-accent)'
                      : '1px solid rgba(255,255,255,0.12)',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setPreviewUrl(getPhotoUrl(photoUrl) ?? null)}
                    style={{ display: 'block', width: '100%', height: '100%', padding: 0, border: 'none', background: 'transparent', cursor: 'zoom-in' }}
                  >
                    <img
                      src={getPhotoUrl(photoUrl)}
                      alt=""
                      style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                    />
                  </button>

                  {/* The cover is NAMED, not merely first. Which photo the
                      kiosk and the booking form will show is the one thing
                      about this list somebody needs to know, and a position in
                      a wrapping grid does not say it. */}
                  {index === 0 ? (
                    <span style={{
                      position: 'absolute', top: 4, left: 4,
                      padding: '1px 6px', borderRadius: 999,
                      background: 'var(--adm-accent)', color: 'var(--adm-bg)',
                      fontSize: 10, fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase',
                    }}>
                      {translate('cover_photo', locale)}
                    </span>
                  ) : (
                    <span style={{
                      position: 'absolute', top: 4, left: 4,
                      minWidth: 18, height: 18, borderRadius: '50%',
                      background: 'rgba(0,0,0,0.6)', color: '#fff',
                      fontSize: 11, fontWeight: 700,
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {index + 1}
                    </span>
                  )}

                  <button
                    type="button"
                    onClick={() => commit(selection.filter((photo) => photo !== photoUrl))}
                    title={translate('photo_remove', locale)}
                    aria-label={translate('photo_remove', locale)}
                    style={{
                      position: 'absolute', top: 4, right: 4,
                      width: 20, height: 20, borderRadius: '50%',
                      background: 'rgba(220,38,38,0.92)', color: '#fff', border: 'none',
                      fontSize: 12, fontWeight: 700, lineHeight: 1, cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    ×
                  </button>

                  <div style={{
                    position: 'absolute', bottom: 0, left: 0, right: 0,
                    display: 'flex', justifyContent: 'space-between',
                    background: 'linear-gradient(to top, rgba(0,0,0,0.6), rgba(0,0,0,0))',
                  }}>
                    <button
                      type="button"
                      onClick={() => move(index, index - 1)}
                      disabled={index === 0}
                      title={translate('photo_move_back', locale)}
                      aria-label={translate('photo_move_back', locale)}
                      style={{ ...arrowStyle, opacity: index === 0 ? 0.3 : 1 }}
                    >
                      ‹
                    </button>
                    <button
                      type="button"
                      onClick={() => move(index, index + 1)}
                      disabled={index === selection.length - 1}
                      title={translate('photo_move_forward', locale)}
                      aria-label={translate('photo_move_forward', locale)}
                      style={{ ...arrowStyle, opacity: index === selection.length - 1 ? 0.3 : 1 }}
                    >
                      ›
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
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
                  onClick={() => commit([])}
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
              const position = selection.indexOf(photoUrl);
              const isSelected = position >= 0;
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
                        {/* Its PLACE in the gallery, not a tick: ticking eight
                            photos identically leaves no way to tell which one
                            is the cover from the library grid. */}
                        {multiple ? position + 1 : '✓'}
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
