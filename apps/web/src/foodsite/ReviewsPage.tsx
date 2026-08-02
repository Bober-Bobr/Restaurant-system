import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { reviewService } from '../services/review.service';
import { getPhotoUrl } from '../utils/photoUrl';
import { IMAGE_ACCEPT } from '../utils/uploadFormats';
import { SectionHeading, useT } from './ui';

function StarRow({ rating }: { rating: number }) {
  return (
    <span style={{ letterSpacing: 1, fontSize: 15, color: 'var(--fs-accent)', whiteSpace: 'nowrap' }}>
      {'★'.repeat(rating)}
      <span style={{ color: 'var(--fs-faint)' }}>{'★'.repeat(Math.max(0, 5 - rating))}</span>
    </span>
  );
}

export function ReviewsPage({ restaurantId }: { restaurantId: string }) {
  const { t } = useT();
  const { data: reviews = [], isLoading } = useQuery({
    queryKey: ['fs-reviews', restaurantId],
    queryFn: () => reviewService.listApproved(restaurantId),
  });

  return (
    <div style={{ paddingTop: 30 }}>
      <SectionHeading title={t('reviews')} meta={reviews.length ? String(reviews.length) : undefined} />
      {isLoading && <div className="fs-skeleton" style={{ height: 180 }} />}
      {!isLoading && reviews.length === 0 && (
        <p className="fs-muted" style={{ marginTop: 0 }}>{t('no_reviews_yet')}</p>
      )}

      <div style={{
        display: 'grid', gap: 14, marginBottom: 34,
        gridTemplateColumns: 'repeat(auto-fill, minmax(282px, 1fr))',
      }}>
        {reviews.map((review) => {
          const photo = review.photoUrl ? getPhotoUrl(review.photoUrl) : null;
          return (
            <div key={review.id} className="fs-card reveal" style={{ overflow: 'hidden' }}>
              {photo && (
                <img src={photo} alt="" loading="lazy"
                  style={{ width: '100%', aspectRatio: '16 / 10', objectFit: 'cover', display: 'block' }} />
              )}
              <div style={{ padding: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontWeight: 750, fontSize: 15 }}>{review.authorName}</span>
                  <StarRow rating={review.rating} />
                </div>
                {review.text && (
                  <p className="fs-muted" style={{ margin: '8px 0 0', fontSize: 14, lineHeight: 1.6 }}>{review.text}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <ReviewForm restaurantId={restaurantId} />
    </div>
  );
}

function ReviewForm({ restaurantId }: { restaurantId: string }) {
  const { t } = useT();
  const [name, setName] = useState('');
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [text, setText] = useState('');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const onPhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setPhotoFile(file);
    setPhotoPreview(file ? URL.createObjectURL(file) : null);
  };

  const submit = useMutation({
    mutationFn: async () => {
      let photoUrl: string | undefined;
      if (photoFile) {
        setUploading(true);
        try { photoUrl = await reviewService.uploadPhoto(photoFile); }
        finally { setUploading(false); }
      }
      await reviewService.submit({
        restaurantId, authorName: name.trim(), rating,
        text: text.trim() || undefined, photoUrl,
      });
    },
  });

  const busy = submit.isPending || uploading;
  const canSubmit = name.trim().length > 0 && rating >= 1 && rating <= 5 && !busy;

  if (submit.isSuccess) {
    return (
      <div className="fs-card reveal" style={{ padding: 28, textAlign: 'center' }}>
        <div style={{ fontSize: 38, color: 'var(--fs-accent)' }}>✓</div>
        <p style={{ margin: '8px 0 0', fontSize: 15 }}>{t('review_thanks')}</p>
      </div>
    );
  }

  return (
    <div className="fs-card reveal" style={{ padding: 24 }}>
      <h2 style={{ margin: '0 0 16px', fontSize: 18, fontWeight: 750 }}>{t('leave_a_review')}</h2>
      <div style={{ display: 'grid', gap: 14 }}>
        <label>
          <span className="fs-label">{t('your_name')}</span>
          <input className="fs-input" value={name} onChange={(e) => setName(e.target.value)} />
        </label>

        <div>
          <span className="fs-label">{t('your_rating')}</span>
          <div style={{ display: 'flex', gap: 4 }}>
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} type="button" aria-label={`${n}`}
                onClick={() => setRating(n)}
                onMouseEnter={() => setHover(n)}
                onMouseLeave={() => setHover(0)}
                style={{
                  background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                  fontSize: 31, lineHeight: 1,
                  color: n <= (hover || rating) ? 'var(--fs-accent)' : 'var(--fs-faint)',
                  transform: n <= (hover || rating) ? 'scale(1.08)' : 'scale(1)',
                  transition: 'color .12s, transform .12s',
                }}>★</button>
            ))}
          </div>
        </div>

        <label>
          <span className="fs-label">{t('your_review')}</span>
          <textarea className="fs-textarea" value={text} onChange={(e) => setText(e.target.value)} />
        </label>

        <div>
          <span className="fs-label">{t('attach_photo')}</span>
          {photoPreview ? (
            <div style={{ position: 'relative', borderRadius: 12, overflow: 'hidden' }}>
              <img src={photoPreview} alt="" style={{ width: '100%', maxHeight: 210, objectFit: 'cover', display: 'block' }} />
              <button type="button" aria-label={t('fs_remove')}
                onClick={() => { setPhotoFile(null); setPhotoPreview(null); }}
                className="fs-btn fs-btn-icon fs-glass"
                style={{ position: 'absolute', top: 8, right: 8, width: 32, height: 32 }}>✕</button>
            </div>
          ) : (
            <label style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              padding: 13, borderRadius: 12, cursor: 'pointer', fontSize: 14,
              border: '1px dashed var(--fs-line)', background: 'rgba(255,255,255,0.02)',
              color: 'var(--fs-dim)',
            }}>
              <span>📷</span>
              <span>{t('attach_photo')}</span>
              <input type="file" accept={IMAGE_ACCEPT} style={{ display: 'none' }} onChange={onPhotoChange} />
            </label>
          )}
        </div>

        <button type="button" className="fs-btn fs-btn-primary" disabled={!canSubmit}
          onClick={() => submit.mutate()}>
          {busy ? <span className="fs-spinner" /> : t('submit_review')}
        </button>
      </div>
    </div>
  );
}
