import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { performerService, type PerformerProfile } from '../services/performer.service';
import { useAdminStore } from '../store/admin.store';
import { translate } from '../utils/translate';
import { getPhotoUrl } from '../utils/photoUrl';

// A performer's or host's own profile: the avatar, gallery and showreel that
// guests see in the matching Additional Services block. Identical for both
// roles — the block they land in is decided by the role, not by the profile.
export const PerformerProfilePage = () => {
  const { locale } = useAdminStore();
  const t = (k: Parameters<typeof translate>[0]) => translate(k, locale);
  const queryClient = useQueryClient();

  const profileQuery = useQuery({ queryKey: ['pf-profile'], queryFn: () => performerService.getProfile() });

  const [draft, setDraft] = useState<PerformerProfile | null>(null);
  const [uploading, setUploading] = useState<null | 'avatar' | 'photos' | 'videos'>(null);
  const [saved, setSaved] = useState(false);

  // Seed the form once the profile arrives; later saves keep the local draft so
  // typing is never interrupted by a refetch.
  useEffect(() => {
    if (profileQuery.data && !draft) setDraft(profileQuery.data);
  }, [profileQuery.data, draft]);

  const save = useMutation({
    mutationFn: () => performerService.updateProfile({
      displayName: draft!.displayName,
      bio: draft!.bio,
      phone: draft!.phone,
      avatarUrl: draft!.avatarUrl,
      photos: draft!.photos,
      videos: draft!.videos,
      isVisible: draft!.isVisible,
    }),
    onSuccess: (updated) => {
      setDraft(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      queryClient.invalidateQueries({ queryKey: ['pf-profile'] });
    },
  });

  const upload = async (kind: 'avatar' | 'photos' | 'videos', files: FileList | null) => {
    const list = Array.from(files ?? []);
    if (list.length === 0 || !draft) return;
    setUploading(kind);
    try {
      const urls = await performerService.uploadMedia(kind === 'avatar' ? [list[0]] : list);
      if (kind === 'avatar') setDraft({ ...draft, avatarUrl: urls[0] ?? draft.avatarUrl });
      else if (kind === 'photos') setDraft({ ...draft, photos: [...draft.photos, ...urls] });
      else setDraft({ ...draft, videos: [...draft.videos, ...urls] });
    } finally {
      setUploading(null);
    }
  };

  if (!draft) {
    return <main style={{ padding: '28px 20px', color: 'rgba(226,232,240,0.6)' }}>…</main>;
  }

  const inputStyle: React.CSSProperties = {
    background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10,
    color: '#e2e8f0', padding: '0.6rem 0.9rem', width: '100%', fontSize: 14,
    fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
  };
  const labelText: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: 'rgba(226,232,240,0.75)' };

  return (
    <main className="tablet-fade-in" style={{ maxWidth: 780, margin: '0 auto', padding: '28px 20px', position: 'relative', zIndex: 1 }}>
      <h1 className="adm-title" style={{ marginBottom: 24 }}>{t('pf_profile')}</h1>

      <section className="adm-card adm-section" style={{ display: 'grid', gap: 16, marginBottom: 20 }}>
        {/* Avatar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          {draft.avatarUrl ? (
            <img src={getPhotoUrl(draft.avatarUrl)} alt="" style={{ width: 84, height: 84, borderRadius: '50%', objectFit: 'cover' }} />
          ) : (
            <div style={{ width: 84, height: 84, borderRadius: '50%', background: 'rgba(201,164,44,0.15)', border: '1px solid rgba(201,164,44,0.35)' }} />
          )}
          <label style={{ display: 'grid', gap: 4 }}>
            <span style={labelText}>{t('pf_avatar')}</span>
            <input type="file" accept="image/*" disabled={uploading !== null}
              onChange={(e) => { void upload('avatar', e.target.files); e.target.value = ''; }} />
          </label>
          {uploading === 'avatar' && <span style={{ fontSize: 13, color: 'rgba(226,232,240,0.6)' }}>{t('pf_uploading')}</span>}
        </div>

        <label style={{ display: 'grid', gap: 4 }}>
          <span style={labelText}>{t('pf_display_name')}</span>
          <input style={inputStyle} value={draft.displayName} onChange={(e) => setDraft({ ...draft, displayName: e.target.value })} />
        </label>

        <label style={{ display: 'grid', gap: 4 }}>
          <span style={labelText}>{t('pf_phone')}</span>
          <input style={inputStyle} value={draft.phone ?? ''} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} />
        </label>

        <label style={{ display: 'grid', gap: 4 }}>
          <span style={labelText}>{t('pf_bio')}</span>
          <textarea style={{ ...inputStyle, minHeight: 96, resize: 'vertical' }} value={draft.bio ?? ''} onChange={(e) => setDraft({ ...draft, bio: e.target.value })} />
        </label>

        <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer' }}>
          <input type="checkbox" checked={draft.isVisible} onChange={(e) => setDraft({ ...draft, isVisible: e.target.checked })} style={{ marginTop: 3 }} />
          <span>
            <span style={{ ...labelText, display: 'block' }}>{t('pf_visible')}</span>
            <span style={{ fontSize: 12, color: 'rgba(226,232,240,0.5)' }}>{t('pf_visible_hint')}</span>
          </span>
        </label>
      </section>

      {/* Gallery */}
      <MediaSection
        title={t('pf_photos')} items={draft.photos} kind="photos" t={t}
        uploading={uploading === 'photos'} accept="image/*"
        onUpload={(files) => void upload('photos', files)}
        onRemove={(url) => setDraft({ ...draft, photos: draft.photos.filter((p) => p !== url) })}
      />
      <MediaSection
        title={t('pf_videos')} items={draft.videos} kind="videos" t={t}
        uploading={uploading === 'videos'} accept="video/*"
        onUpload={(files) => void upload('videos', files)}
        onRemove={(url) => setDraft({ ...draft, videos: draft.videos.filter((v) => v !== url) })}
      />

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 20 }}>
        <button className="adm-btn-primary" onClick={() => save.mutate()} disabled={save.isPending || uploading !== null || !draft.displayName.trim()}>
          {save.isPending ? t('saving') : t('save')}
        </button>
        {saved && <span style={{ color: '#4ade80', fontSize: 13 }}>{t('pf_saved')}</span>}
      </div>
    </main>
  );
};

function MediaSection({ title, items, kind, accept, uploading, onUpload, onRemove, t }: {
  title: string;
  items: string[];
  kind: 'photos' | 'videos';
  accept: string;
  uploading: boolean;
  onUpload: (files: FileList | null) => void;
  onRemove: (url: string) => void;
  t: (k: Parameters<typeof translate>[0]) => string;
}) {
  return (
    <section className="adm-card adm-section" style={{ display: 'grid', gap: 12, marginBottom: 20 }}>
      <h2 className="adm-heading" style={{ margin: 0 }}>{title} ({items.length})</h2>
      {items.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          {items.map((url) => (
            <div key={url} style={{ position: 'relative' }}>
              {kind === 'photos'
                ? <img src={getPhotoUrl(url)} alt="" style={{ width: 104, height: 104, objectFit: 'cover', borderRadius: 10, display: 'block' }} />
                : <video src={getPhotoUrl(url)} controls preload="metadata" style={{ width: 190, height: 110, borderRadius: 10, display: 'block', background: '#000' }} />}
              <button
                type="button"
                onClick={() => onRemove(url)}
                aria-label={t('pf_remove')}
                style={{
                  position: 'absolute', top: -6, right: -6, width: 22, height: 22, borderRadius: '50%',
                  background: 'rgba(0,0,0,0.8)', color: '#fff', border: '1px solid rgba(255,255,255,0.3)',
                  fontSize: 13, lineHeight: 1, cursor: 'pointer',
                }}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
      <input type="file" accept={accept} multiple disabled={uploading}
        onChange={(e) => { onUpload(e.target.files); e.target.value = ''; }} />
      {uploading && <span style={{ fontSize: 13, color: 'rgba(226,232,240,0.6)' }}>{t('pf_uploading')}</span>}
    </section>
  );
}
