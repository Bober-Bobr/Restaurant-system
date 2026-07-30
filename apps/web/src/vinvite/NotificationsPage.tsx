import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { vinviteService, type InviteRequest } from './api';
import { useViT } from './i18n';
import { getPhotoUrl } from '../utils/photoUrl';
import { translate } from '../utils/translate';
import { useVInviteStore } from './store';

// ── Notifications ────────────────────────────────────────────────────────────
// Invitation orders placed by restaurant guests on the Additional Services page
// (banquet.v-menu.uz/<slug> or the tablet's booking-confirmed screen). The
// studio works from this list; nothing here is automated yet.
//
// SYSTEM_ADMIN only — the tab is hidden for everyone else and every endpoint
// re-checks the role server-side.

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  if (value === null || value === undefined || value === '') return null;
  return (
    <div style={{ display: 'grid', gap: 2, minWidth: 0 }}>
      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--vi-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</span>
      <span style={{ fontSize: 14, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{value}</span>
    </div>
  );
}

function RequestCard({ request, onToggleRead, onDelete, busy }: {
  request: InviteRequest;
  onToggleRead: () => void;
  onDelete: () => void;
  busy: boolean;
}) {
  const t = useViT();
  const locale = useVInviteStore((s) => s.locale);
  // Event-type labels live in the main dictionary, shared with the banquet side.
  const typeLabel = translate(`event_type_${request.eventType.toLowerCase()}` as Parameters<typeof translate>[0], locale);

  const when = `${new Date(request.eventDate).toLocaleDateString()} · ${request.eventTime}`;

  return (
    <div
      className="vi-card vi-fade-up"
      style={{
        padding: 18,
        display: 'grid',
        gap: 14,
        borderColor: request.isRead ? undefined : 'var(--vi-accent)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        {!request.isRead && <span className="vi-badge vi-badge-live">{t('nt_new')}</span>}
        <strong style={{ fontSize: 16 }}>{request.names.join(' & ') || '—'}</strong>
        <span style={{ fontSize: 13, color: 'var(--vi-muted)' }}>
          {/* Falls back to the raw value if a future type has no label yet. */}
          {typeLabel.startsWith('event_type_') ? request.eventType : typeLabel}
        </span>
        <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--vi-muted)' }}>
          {new Date(request.createdAt).toLocaleString()}
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 12 }}>
        <Field label={t('nt_phone')} value={<a href={`tel:${request.phone}`} style={{ color: 'var(--vi-accent)' }}>{request.phone}</a>} />
        <Field label={t('nt_restaurant')} value={request.restaurantName} />
        <Field label={t('nt_when')} value={when} />
        <Field label={t('nt_card')} value={request.cardNumber} />
        <Field label={t('nt_dress_code')} value={request.dressCode} />
        {request.eventNumber != null && <Field label={t('nt_event_no')} value={`#${request.eventNumber}`} />}
      </div>

      <Field label={t('nt_menu')} value={request.menu} />

      {request.photoUrl && (
        <div style={{ display: 'grid', gap: 4 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--vi-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{t('nt_photo')}</span>
          <a href={getPhotoUrl(request.photoUrl)} target="_blank" rel="noreferrer">
            <img src={getPhotoUrl(request.photoUrl)} alt="" style={{ maxWidth: 160, borderRadius: 10, display: 'block' }} />
          </a>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button className="vi-btn" disabled={busy} onClick={onToggleRead}>
          {request.isRead ? t('nt_mark_unread') : t('nt_mark_read')}
        </button>
        <button
          className="vi-btn"
          disabled={busy}
          onClick={() => { if (confirm(t('nt_delete_confirm'))) onDelete(); }}
          style={{ color: 'var(--vi-danger)' }}
        >
          {t('nt_delete')}
        </button>
      </div>
    </div>
  );
}

export const ViNotificationsPage = () => {
  const t = useViT();
  const queryClient = useQueryClient();
  const [unreadOnly, setUnreadOnly] = useState(false);

  const requestsQuery = useQuery({
    queryKey: ['vi-invite-requests'],
    queryFn: () => vinviteService.listInviteRequests(),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['vi-invite-requests'] });
    queryClient.invalidateQueries({ queryKey: ['vi-invite-requests-unread'] });
  };

  const toggleRead = useMutation({
    mutationFn: ({ id, isRead }: { id: string; isRead: boolean }) => vinviteService.setInviteRequestRead(id, isRead),
    onSuccess: invalidate,
  });
  const remove = useMutation({
    mutationFn: (id: string) => vinviteService.removeInviteRequest(id),
    onSuccess: invalidate,
  });

  const all = requestsQuery.data ?? [];
  const requests = unreadOnly ? all.filter((r) => !r.isRead) : all;
  const busy = toggleRead.isPending || remove.isPending;

  return (
    <section className="vi-fade-up">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', margin: '0 0 22px' }}>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, letterSpacing: '-0.02em' }}>{t('notifications')}</h1>
        <div style={{ display: 'flex', gap: 6, marginLeft: 'auto' }}>
          {([false, true] as const).map((v) => (
            <button
              key={String(v)}
              className={`vi-tab${unreadOnly === v ? ' active' : ''}`}
              onClick={() => setUnreadOnly(v)}
            >
              {v ? t('nt_filter_unread') : t('nt_filter_all')}
            </button>
          ))}
        </div>
      </div>

      {requestsQuery.isLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><span className="vi-spinner" /></div>
      ) : requests.length === 0 ? (
        <div className="vi-card" style={{ padding: '56px 24px', textAlign: 'center', color: 'var(--vi-muted)', fontSize: 15 }}>
          {t('nt_empty')}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 760 }}>
          {requests.map((r) => (
            <RequestCard
              key={r.id}
              request={r}
              busy={busy}
              onToggleRead={() => toggleRead.mutate({ id: r.id, isRead: !r.isRead })}
              onDelete={() => remove.mutate(r.id)}
            />
          ))}
        </div>
      )}
    </section>
  );
};
