import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../store/auth.store';
import { useAdminStore } from '../store/admin.store';
import { reviewService, type Review } from '../services/review.service';
import { translate } from '../utils/translate';

function Stars({ rating }: { rating: number }) {
  return (
    <span style={{ color: '#c9a42c', letterSpacing: 1 }}>
      {'★'.repeat(rating)}<span style={{ color: 'rgba(255,255,255,0.2)' }}>{'★'.repeat(5 - rating)}</span>
    </span>
  );
}

export const AdminReviewsPage = () => {
  const restaurantId = useAuthStore((s) => s.restaurantId);
  const { locale } = useAdminStore();
  const t = (k: Parameters<typeof translate>[0]) => translate(k, locale);
  const queryClient = useQueryClient();

  const { data: reviews = [], isLoading } = useQuery({
    queryKey: ['admin-reviews', restaurantId],
    queryFn: () => reviewService.listAll(restaurantId!),
    enabled: !!restaurantId,
  });

  const approve = useMutation({
    mutationFn: ({ id, isApproved }: { id: string; isApproved: boolean }) =>
      reviewService.setApproved(id, isApproved),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-reviews', restaurantId] }),
  });

  const remove = useMutation({
    mutationFn: (id: string) => reviewService.remove(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-reviews', restaurantId] }),
  });

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '28px 20px' }}>
      <h1 className="adm-title" style={{ marginBottom: 6 }}>{t('moderate_reviews')}</h1>
      <p className="adm-sub" style={{ marginBottom: 24 }}>
        {reviews.length} {t('reviews').toLowerCase()}
      </p>

      {isLoading && <p style={{ color: 'rgba(226,232,240,0.5)' }}>...</p>}
      {!isLoading && reviews.length === 0 && (
        <p style={{ color: 'rgba(226,232,240,0.4)' }}>{t('no_reviews_to_moderate')}</p>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {reviews.map((rev: Review) => (
          <div key={rev.id} className="adm-card" style={{
            padding: '14px 16px',
            background: rev.isApproved ? 'rgba(34,197,94,0.07)' : 'rgba(15,23,42,0.5)',
            border: `1px solid ${rev.isApproved ? 'rgba(34,197,94,0.28)' : 'rgba(255,255,255,0.08)'}`,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span style={{ fontWeight: 700, color: '#f8fafc', fontSize: 15 }}>{rev.authorName}</span>
              <Stars rating={rev.rating} />
              <span className="adm-badge" style={{
                background: rev.isApproved ? 'rgba(34,197,94,0.15)' : 'rgba(201,164,44,0.15)',
                color: rev.isApproved ? '#4ade80' : '#c9a42c',
                border: `1px solid ${rev.isApproved ? 'rgba(34,197,94,0.3)' : 'rgba(201,164,44,0.3)'}`,
              }}>
                {rev.isApproved ? t('approved') : t('pending_moderation')}
              </span>
              <span style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                <button
                  type="button"
                  disabled={approve.isPending}
                  onClick={() => approve.mutate({ id: rev.id, isApproved: !rev.isApproved })}
                  style={{
                    fontSize: 12, fontWeight: 600, padding: '5px 12px', borderRadius: 8, cursor: 'pointer',
                    border: '1px solid rgba(201,164,44,0.35)',
                    background: 'rgba(201,164,44,0.1)', color: '#c9a42c',
                  }}
                >
                  {rev.isApproved ? t('unapprove') : t('approve')}
                </button>
                <button
                  type="button"
                  className="adm-btn-danger"
                  disabled={remove.isPending}
                  onClick={() => { if (confirm(`${t('delete')}?`)) remove.mutate(rev.id); }}
                  style={{ fontSize: 12 }}
                >
                  {t('delete')}
                </button>
              </span>
            </div>
            {rev.text && (
              <p style={{ margin: '8px 0 0', fontSize: 13, color: 'rgba(226,232,240,0.75)', lineHeight: 1.55 }}>
                {rev.text}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
