import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { performerService, type PerformerProfile } from '../services/performer.service';
import { useAdminStore } from '../store/admin.store';
import { translate } from '../utils/translate';
import { getPhotoUrl } from '../utils/photoUrl';
import { FilePickButton } from '../components/ui/FilePickButton';

// A performer's or host's own profile: the avatar, gallery and showreel that
// guests see in the matching Additional Services block. Identical for both
// roles — the block they land in is decided by the role, not by the profile.
//
// Laid out as a profile rather than as a form, because that is what it is: the
// page is a preview of what a guest will see, and the fields are the parts of
// it. A cover, the avatar over it, name and bio inline, then the counts, then
// the grids. Editing happens in place — there is no separate "edit mode",
// which is what keeps it one screen instead of two.
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
    return <main style={{ padding: '28px 20px', color: 'rgba(var(--adm-text-rgb),0.6)' }}>…</main>;
  }

  const dirty = !!profileQuery.data && (
    draft.displayName !== profileQuery.data.displayName
    || (draft.bio ?? '') !== (profileQuery.data.bio ?? '')
    || (draft.phone ?? '') !== (profileQuery.data.phone ?? '')
    || draft.avatarUrl !== profileQuery.data.avatarUrl
    || draft.isVisible !== profileQuery.data.isVisible
    || draft.photos.join() !== profileQuery.data.photos.join()
    || draft.videos.join() !== profileQuery.data.videos.join()
  );

  const canSave = dirty && !save.isPending && uploading === null && !!draft.displayName.trim();

  return (
    <main className="tablet-fade-in" style={{ maxWidth: 940, margin: '0 auto', padding: '24px 20px 48px', position: 'relative', zIndex: 1 }}>

      {/* ── Profile header: cover, avatar, identity ── */}
      <section className="adm-card" style={{ overflow: 'hidden', marginBottom: 20 }}>
        {/* Cover band. Decorative only — a performer has no cover image to
            upload, and asking for a second one would be one more thing to get
            wrong before the profile looks finished. */}
        <div aria-hidden style={{
          height: 132,
          background: `
            radial-gradient(120% 160% at 15% 0%, rgba(var(--adm-accent-rgb),0.30) 0%, transparent 60%),
            radial-gradient(100% 140% at 85% 100%, rgba(var(--adm-cool),0.28) 0%, transparent 60%),
            linear-gradient(120deg, rgba(var(--adm-surface-rgb),0.9), rgba(var(--adm-bg-rgb),0.9))`,
        }} />

        <div style={{ padding: '0 clamp(16px, 3vw, 28px) clamp(18px, 3vw, 24px)' }}>
          {/* The avatar overlaps the cover, the way a profile does. */}
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 18, flexWrap: 'wrap', marginTop: -46 }}>
            <div style={{ position: 'relative', flex: 'none' }}>
              {draft.avatarUrl ? (
                <img
                  src={getPhotoUrl(draft.avatarUrl)}
                  alt=""
                  style={{
                    width: 112, height: 112, borderRadius: '50%', objectFit: 'cover', display: 'block',
                    border: '3px solid var(--adm-bg)',
                    boxShadow: '0 10px 30px rgba(0,0,0,0.45)',
                  }}
                />
              ) : (
                <div style={{
                  width: 112, height: 112, borderRadius: '50%',
                  border: '3px solid var(--adm-bg)',
                  background: 'rgba(var(--adm-accent-rgb),0.14)',
                  boxShadow: 'inset 0 0 0 1px rgba(var(--adm-accent-rgb),0.35), 0 10px 30px rgba(0,0,0,0.45)',
                  display: 'grid', placeItems: 'center',
                  color: 'var(--adm-accent)', fontSize: 38, fontWeight: 700,
                  fontFamily: "'Playfair Display', Georgia, serif",
                }}>
                  {draft.displayName.trim().charAt(0).toUpperCase() || '·'}
                </div>
              )}
              <FilePickButton
                accept="image/*"
                disabled={uploading !== null}
                onPick={(files) => void upload('avatar', files)}
                className="adm-filepick"
                style={{
                  position: 'absolute', right: -6, bottom: 2,
                  padding: 0, width: 34, height: 34, borderRadius: '50%',
                  justifyContent: 'center', background: 'var(--adm-surface-solid)',
                }}
              >
                <span aria-label={t('pf_avatar')} title={t('pf_avatar')} style={{ fontSize: 15, lineHeight: 1 }}>✎</span>
              </FilePickButton>
            </div>

            <div style={{ flex: '1 1 260px', minWidth: 0, paddingBottom: 4 }}>
              {/* Reads as the profile's heading; `adm-inline-edit` reveals the
                  field on hover and focus, so it is still obviously editable. */}
              <input
                className="adm-input adm-inline-edit"
                value={draft.displayName}
                onChange={(e) => setDraft({ ...draft, displayName: e.target.value })}
                aria-label={t('pf_display_name')}
                placeholder={t('pf_display_name')}
                style={{
                  fontFamily: "'Playfair Display', Georgia, serif",
                  fontSize: 'clamp(20px, 1.4rem + 0.6vw, 27px)',
                  fontWeight: 600, height: 'auto', padding: '4px 10px',
                  color: 'var(--adm-title)',
                  marginLeft: -10,
                }}
              />
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2, flexWrap: 'wrap' }}>
                <span
                  className="adm-badge"
                  style={draft.isVisible
                    ? { background: 'rgba(34,197,94,0.16)', color: '#86efac', borderColor: 'rgba(34,197,94,0.35)' }
                    : { background: 'rgba(255,255,255,0.06)', color: 'rgba(var(--adm-text-rgb),0.55)' }}
                >
                  {draft.isVisible ? t('pf_visible') : t('pf_hidden')}
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingBottom: 6 }}>
              {saved && <span style={{ color: '#4ade80', fontSize: 13 }}>{t('pf_saved')}</span>}
              <button className="adm-btn-primary" onClick={() => save.mutate()} disabled={!canSave}>
                {save.isPending ? t('saving') : t('save')}
              </button>
            </div>
          </div>

          {/* Counts, the way a profile shows followers. Live from the draft, so
              they move the moment something is added or removed. */}
          <div style={{ display: 'flex', gap: 26, margin: '18px 0 4px', flexWrap: 'wrap' }}>
            <Stat value={draft.photos.length} label={t('pf_photos')} />
            <Stat value={draft.videos.length} label={t('pf_videos')} />
          </div>

          <hr className="adm-divider" />

          <div style={{ display: 'grid', gap: 14 }}>
            <label style={{ display: 'grid', gap: 6 }}>
              <span className="adm-label">{t('pf_bio')}</span>
              <textarea
                className="adm-input"
                style={{ minHeight: 92, resize: 'vertical', lineHeight: 1.55 }}
                value={draft.bio ?? ''}
                onChange={(e) => setDraft({ ...draft, bio: e.target.value })}
              />
            </label>

            <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fit, minmax(min(240px, 100%), 1fr))' }}>
              <label style={{ display: 'grid', gap: 6 }}>
                <span className="adm-label">{t('pf_phone')}</span>
                <input
                  className="adm-input"
                  type="tel"
                  value={draft.phone ?? ''}
                  onChange={(e) => setDraft({ ...draft, phone: e.target.value })}
                />
              </label>

              <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', alignSelf: 'end', paddingBottom: 8 }}>
                <input
                  type="checkbox"
                  checked={draft.isVisible}
                  onChange={(e) => setDraft({ ...draft, isVisible: e.target.checked })}
                  style={{ marginTop: 2, width: 16, height: 16, accentColor: 'var(--adm-accent)', cursor: 'pointer' }}
                />
                <span>
                  <span style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'rgba(var(--adm-text-rgb),0.85)' }}>{t('pf_visible')}</span>
                  <span style={{ fontSize: 12, color: 'rgba(var(--adm-text-rgb),0.5)' }}>{t('pf_visible_hint')}</span>
                </span>
              </label>
            </div>
          </div>
        </div>
      </section>

      {/* ── Gallery ── */}
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
    </main>
  );
};

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div>
      <span style={{ fontSize: 21, fontWeight: 700, color: 'var(--adm-title)', fontVariantNumeric: 'tabular-nums' }}>{value}</span>
      <span className="adm-label" style={{ display: 'block', marginTop: 2 }}>{label}</span>
    </div>
  );
}

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
    <section className="adm-card adm-section" style={{ display: 'grid', gap: 14, marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <h2 className="adm-heading" style={{ margin: 0 }}>{title} ({items.length})</h2>
        <FilePickButton accept={accept} multiple disabled={uploading} onPick={onUpload}>
          <span aria-hidden style={{ fontSize: 14, lineHeight: 1 }}>＋</span>
          {uploading ? t('pf_uploading') : t('pf_add')}
        </FilePickButton>
      </div>

      {items.length === 0 ? (
        <p className="adm-empty" style={{ margin: 0, padding: '2rem 1rem' }}>{t('pf_gallery_empty')}</p>
      ) : (
        // A square grid rather than a wrapped row of fixed-width tiles: the
        // gallery is the point of the page, so it fills the width it is given
        // and reflows instead of leaving a ragged edge.
        <div style={{
          display: 'grid',
          gap: 10,
          gridTemplateColumns: kind === 'photos'
            ? 'repeat(auto-fill, minmax(min(132px, 100%), 1fr))'
            : 'repeat(auto-fill, minmax(min(260px, 100%), 1fr))',
        }}>
          {items.map((url) => (
            <div key={url} style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', background: 'rgba(0,0,0,0.35)' }}>
              {kind === 'photos'
                ? <img src={getPhotoUrl(url)} alt="" style={{ width: '100%', aspectRatio: '1 / 1', objectFit: 'cover', display: 'block' }} />
                : <video src={getPhotoUrl(url)} controls preload="metadata" style={{ width: '100%', aspectRatio: '16 / 9', display: 'block', background: '#000' }} />}
              <button
                type="button"
                onClick={() => onRemove(url)}
                aria-label={t('pf_remove')}
                style={{
                  position: 'absolute', top: 6, right: 6, width: 26, height: 26, borderRadius: '50%',
                  background: 'rgba(0,0,0,0.72)', color: '#fff', border: '1px solid rgba(255,255,255,0.28)',
                  fontSize: 14, lineHeight: 1, cursor: 'pointer',
                  display: 'grid', placeItems: 'center',
                  backdropFilter: 'blur(4px)',
                }}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
