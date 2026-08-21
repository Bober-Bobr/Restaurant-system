import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { extraServiceService } from '../services/extraService.service';
import { photoService } from '../services/photo.service';
import { useAdminStore } from '../store/admin.store';
import { translate } from '../utils/translate';
import { getPhotoUrl } from '../utils/photoUrl';
import { formatSum, parseSumToTiyin } from '../utils/currency';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import type { ExtraService } from '../types/domain';

const isVideo = (url: string) => /\.(mp4|webm|ogg|mov|m4v)$/i.test(url);

// ── Media picker: uploads photos/videos and lists what's attached ────────────

function MediaField({
  media, onChange, t,
}: {
  media: string[];
  onChange: (next: string[]) => void;
  t: (key: Parameters<typeof translate>[0]) => string;
}) {
  const photoInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const upload = async (files: FileList | null, kind: 'photo' | 'video') => {
    if (!files || files.length === 0) return;
    setUploading(true);
    setError(null);
    try {
      const list = Array.from(files);
      const urls = kind === 'photo'
        ? await photoService.uploadPhotos('hall', list)
        // The video endpoint takes one file at a time.
        : (await Promise.all(list.map((f) => photoService.uploadVideo([f])))).flat();
      onChange([...media, ...urls]);
    } catch {
      setError(t('upload_failed'));
    } finally {
      setUploading(false);
      if (photoInputRef.current) photoInputRef.current.value = '';
      if (videoInputRef.current) videoInputRef.current.value = '';
    }
  };

  return (
    <div style={{ display: 'grid', gap: 10 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <Button type="button" variant="secondary" disabled={uploading} onClick={() => photoInputRef.current?.click()}>
          {uploading ? t('uploading') : t('add_photos')}
        </Button>
        <Button type="button" variant="secondary" disabled={uploading} onClick={() => videoInputRef.current?.click()}>
          {uploading ? t('uploading') : t('add_video')}
        </Button>
        {error && <span style={{ color: '#fca5a5', fontSize: 12 }}>{error}</span>}
        <input ref={photoInputRef} type="file" accept="image/*" multiple hidden
          onChange={(e) => upload(e.target.files, 'photo')} />
        <input ref={videoInputRef} type="file" accept="video/*" multiple hidden
          onChange={(e) => upload(e.target.files, 'video')} />
      </div>

      {media.length > 0 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {media.map((url) => (
            <div key={url} style={{ position: 'relative' }}>
              {isVideo(url) ? (
                <video src={getPhotoUrl(url)} muted
                  style={{ width: 110, height: 78, objectFit: 'cover', borderRadius: 8, border: '1px solid rgba(255,255,255,0.12)' }} />
              ) : (
                <img src={getPhotoUrl(url)} alt=""
                  style={{ width: 110, height: 78, objectFit: 'cover', borderRadius: 8, border: '1px solid rgba(255,255,255,0.12)' }} />
              )}
              <button
                type="button"
                onClick={() => onChange(media.filter((m) => m !== url))}
                aria-label={t('delete')}
                style={{
                  position: 'absolute', top: -6, right: -6,
                  width: 22, height: 22, borderRadius: '50%',
                  background: '#dc2626', color: '#fff', border: 'none',
                  cursor: 'pointer', fontSize: 13, lineHeight: '22px', padding: 0,
                }}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Page ────────────────────────────────────────────────────────────────────

export const AdminExtraServicesPage = () => {
  const queryClient = useQueryClient();
  const { locale } = useAdminStore();
  const t = (key: Parameters<typeof translate>[0], params?: Record<string, string | number>) => translate(key, locale, params);

  const { data: services, isLoading, isError } = useQuery({
    queryKey: ['extra-services'],
    queryFn: () => extraServiceService.list(),
  });

  // Create form
  const [name, setName] = useState('');
  const [priceText, setPriceText] = useState('');
  const [description, setDescription] = useState('');
  const [media, setMedia] = useState<string[]>([]);

  // Edit form
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editPriceText, setEditPriceText] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editMedia, setEditMedia] = useState<string[]>([]);
  const [editIsActive, setEditIsActive] = useState(true);

  const createMutation = useMutation({
    mutationFn: () => extraServiceService.create({
      name: name.trim(),
      description: description.trim() || null,
      priceCents: parseSumToTiyin(priceText) ?? 0,
      media,
      isActive: true,
    }),
    onSuccess: async () => {
      setName(''); setPriceText(''); setDescription(''); setMedia([]);
      await queryClient.invalidateQueries({ queryKey: ['extra-services'] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof extraServiceService.update>[1] }) =>
      extraServiceService.update(id, data),
    onSuccess: async () => {
      setEditingId(null);
      await queryClient.invalidateQueries({ queryKey: ['extra-services'] });
    },
  });

  const deleteMutation = useMutation<void, Error, string>({
    mutationFn: (id) => extraServiceService.remove(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['extra-services'] });
    },
  });

  const startEditing = (service: ExtraService) => {
    setEditingId(service.id);
    setEditName(service.name);
    setEditPriceText(String(Math.round(service.priceCents / 100)));
    setEditDescription(service.description ?? '');
    setEditMedia(service.media ?? []);
    setEditIsActive(service.isActive);
  };

  const saveEdit = () => {
    if (!editingId || !editName.trim()) return;
    updateMutation.mutate({
      id: editingId,
      data: {
        name: editName.trim(),
        description: editDescription.trim() || null,
        priceCents: parseSumToTiyin(editPriceText) ?? 0,
        media: editMedia,
        isActive: editIsActive,
      },
    });
  };

  const canSubmit = name.trim().length > 0 && !createMutation.isPending;

  return (
    <main className="tablet-fade-in" style={{ maxWidth: 1280, margin: '0 auto', padding: '28px 20px', position: 'relative', zIndex: 1 }}>
      <h1 className="adm-title" style={{ marginBottom: 6 }}>{t('extra_services')}</h1>
      <p style={{ margin: '0 0 20px', fontSize: 13, color: 'rgba(226,232,240,0.55)' }}>
        {t('extra_services_hint')}
      </p>

      <section className="adm-card tablet-fade-up adm-section">
        <h3 className="adm-heading" style={{ marginTop: 0, marginBottom: 16 }}>{t('create_extra_service')}</h3>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (!canSubmit) return;
            createMutation.mutate();
          }}
          className="form-grid-2" style={{ alignItems: 'end' }}
        >
          <label style={{ display: 'grid', gap: 6 }}>
            {t('service_name')}
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('service_name_placeholder')} />
          </label>
          <label style={{ display: 'grid', gap: 6 }}>
            {t('service_price')}
            <Input type="number" min={0} inputMode="numeric" value={priceText}
              onChange={(e) => setPriceText(e.target.value)} placeholder="0" />
          </label>
          <label style={{ display: 'grid', gap: 6, gridColumn: '1 / -1' }}>
            {t('description_optional')}
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('service_description_placeholder')}
              style={{
                width: '100%', padding: '9px 12px', borderRadius: 8, resize: 'vertical',
                background: 'rgba(255,255,255,0.05)', color: '#f8fafc',
                border: '1px solid rgba(255,255,255,0.12)', fontSize: 14, fontFamily: 'inherit',
              }}
            />
          </label>
          <div style={{ gridColumn: '1 / -1' }}>
            <p style={{ margin: '0 0 8px', fontSize: 13, color: 'rgba(226,232,240,0.7)' }}>{t('service_media')}</p>
            <MediaField media={media} onChange={setMedia} t={t} />
          </div>
          <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 12, alignItems: 'center' }}>
            <Button type="submit" disabled={!canSubmit}>
              {createMutation.isPending ? t('creating') : t('create_extra_service')}
            </Button>
            {createMutation.isError && (
              <span style={{ color: '#b00020' }}>{t('failed_to_create_service')}</span>
            )}
          </div>
        </form>
      </section>

      {isLoading && <p>{t('loading')}</p>}
      {isError && <p>{t('failed_to_load_services')}</p>}

      {services && (
        <section className="adm-card tablet-fade-up adm-section" style={{ animationDelay: '80ms' }}>
          <h3 className="adm-heading" style={{ marginTop: 0, marginBottom: 16 }}>{t('all_extra_services')}</h3>
          {services.length === 0 ? (
            <p className="adm-empty">{t('no_extra_services_yet')}</p>
          ) : (
            <div style={{ display: 'grid', gap: 10 }}>
              {services.map((service, idx) => (
                <div
                  key={service.id}
                  className="adm-card adm-card-hover tablet-fade-up"
                  style={{ padding: 14, animationDelay: `${idx * 50}ms` }}
                >
                  {editingId === service.id ? (
                    <div>
                      <div className="form-grid-2" style={{ alignItems: 'end', marginBottom: 12 }}>
                        <label style={{ display: 'grid', gap: 4 }}>
                          {t('service_name')}
                          <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
                        </label>
                        <label style={{ display: 'grid', gap: 4 }}>
                          {t('service_price')}
                          <Input type="number" min={0} value={editPriceText}
                            onChange={(e) => setEditPriceText(e.target.value)} />
                        </label>
                        <label style={{ display: 'grid', gap: 4, gridColumn: '1 / -1' }}>
                          {t('description_optional')}
                          <textarea
                            rows={3}
                            value={editDescription}
                            onChange={(e) => setEditDescription(e.target.value)}
                            style={{
                              width: '100%', padding: '9px 12px', borderRadius: 8, resize: 'vertical',
                              background: 'rgba(255,255,255,0.05)', color: '#f8fafc',
                              border: '1px solid rgba(255,255,255,0.12)', fontSize: 14, fontFamily: 'inherit',
                            }}
                          />
                        </label>
                        <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          <input type="checkbox" checked={editIsActive}
                            onChange={(e) => setEditIsActive(e.target.checked)} />
                          {t('active')}
                        </label>
                      </div>
                      <div style={{ marginBottom: 12 }}>
                        <MediaField media={editMedia} onChange={setEditMedia} t={t} />
                      </div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <Button onClick={saveEdit} disabled={updateMutation.isPending || !editName.trim()}>
                          {updateMutation.isPending ? t('saving') : t('save')}
                        </Button>
                        <Button variant="secondary" onClick={() => setEditingId(null)}>{t('cancel')}</Button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', minWidth: 0 }}>
                        {(service.media ?? []).slice(0, 1).map((url) => (
                          isVideo(url) ? (
                            <video key={url} src={getPhotoUrl(url)} muted
                              style={{ width: 88, height: 66, objectFit: 'cover', borderRadius: 6, border: '1px solid rgba(255,255,255,0.08)' }} />
                          ) : (
                            <img key={url} src={getPhotoUrl(url)} alt={service.name}
                              style={{ width: 88, height: 66, objectFit: 'cover', borderRadius: 6, border: '1px solid rgba(255,255,255,0.08)' }} />
                          )
                        ))}
                        <div style={{ minWidth: 0 }}>
                          <strong style={{ color: '#f8fafc', fontSize: 15 }}>{service.name}</strong>
                          <p style={{ margin: '4px 0 0', fontSize: 12, color: 'rgba(226,232,240,0.6)' }}>
                            <span style={{ color: 'var(--adm-accent)', fontWeight: 600 }}>{formatSum(service.priceCents)}</span>
                            {(service.media?.length ?? 0) > 0 && (
                              <span style={{ color: 'rgba(226,232,240,0.45)' }}> · {t('service_media')}: {service.media!.length}</span>
                            )}
                            {!service.isActive && <span style={{ color: '#fca5a5' }}> ({t('inactive')})</span>}
                          </p>
                          {service.description && (
                            <p style={{ margin: '6px 0 0', fontSize: 12, color: 'rgba(226,232,240,0.5)', whiteSpace: 'pre-wrap' }}>
                              {service.description}
                            </p>
                          )}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button
                          onClick={() => startEditing(service)}
                          className="adm-btn-ghost"
                          style={{ fontSize: 12, padding: '5px 12px', color: 'var(--adm-accent)', borderColor: 'rgba(var(--adm-accent-rgb),0.35)', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                          </svg>
                          {t('edit')}
                        </button>
                        <button
                          onClick={() => deleteMutation.mutate(service.id)}
                          disabled={deleteMutation.isPending}
                          className="adm-btn-danger"
                          style={{ fontSize: 12, padding: '5px 12px', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                            <path d="M10 11v6M14 11v6" />
                          </svg>
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
