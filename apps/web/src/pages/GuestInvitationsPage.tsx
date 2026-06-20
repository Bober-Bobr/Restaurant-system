import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Navigate, useNavigate } from 'react-router-dom';
import { guestInvitationService, type GuestInvitation } from '../services/guestInvitation.service';
import { useAuthStore } from '../store/auth.store';
import { useAdminStore } from '../store/admin.store';
import { translate } from '../utils/translate';
import { buildSubdomainBase } from '../utils/subdomain';
import { ManagerNav, ManagerTabs } from './ManagerPortalPage';

const QUERY_KEY = ['manager-guest-invitations'];

const publicUrlFor = (slug: string) => buildSubdomainBase(`${slug}.invitation`, '/');

export const GuestInvitationsPage = () => {
  const accessToken = useAuthStore((s) => s.accessToken);
  const role = useAuthStore((s) => s.role);
  const { locale } = useAdminStore();
  const t = (k: Parameters<typeof translate>[0]) => translate(k, locale);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: invitations = [], isLoading } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => guestInvitationService.listMine(),
    enabled: !!accessToken,
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => guestInvitationService.remove(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });

  if (!accessToken) return <Navigate to="/login" replace />;
  if (role !== 'MANAGER' && role !== 'CHIEF_ADMIN') return <Navigate to="/login" replace />;

  return (
    <div className="adm-bg">
      <ManagerNav pageTitle={t('invitations')} locale={locale} />
      <main className="tablet-fade-in" style={{ maxWidth: 1180, margin: '0 auto', padding: '28px 20px', position: 'relative', zIndex: 1 }}>
        <ManagerTabs active="invitations" locale={locale} />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
          <h1 className="adm-title" style={{ margin: 0 }}>{t('invitations')}</h1>
          <button type="button" className="adm-btn-primary" onClick={() => navigate('/invitations/new')}>
            + {t('new_invitation')}
          </button>
        </div>

        {isLoading && <p style={{ color: 'rgba(226,232,240,0.5)' }}>...</p>}
        {!isLoading && invitations.length === 0 && (
          <p style={{ color: 'rgba(226,232,240,0.5)' }}>{t('no_invitations_yet')}</p>
        )}

        <div style={{ display: 'grid', gap: 10 }}>
          {invitations.map((inv) => (
            <InvitationRow
              key={inv.id}
              inv={inv}
              onEdit={() => navigate(`/invitations/${inv.id}`)}
              onDelete={() => { if (window.confirm('Delete this invitation?')) removeMutation.mutate(inv.id); }}
              responsesLabel={t('responses')}
            />
          ))}
        </div>
      </main>
    </div>
  );
};

function InvitationRow({ inv, onEdit, onDelete, responsesLabel }: {
  inv: GuestInvitation;
  onEdit: () => void;
  onDelete: () => void;
  responsesLabel: string;
}) {
  const title = inv.coupleNames?.trim() || inv.slug;
  const url = publicUrlFor(inv.slug);
  return (
    <div className="adm-card" style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
      <div style={{ flex: 1, minWidth: 200 }}>
        <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#f8fafc' }}>{title}</p>
        <p style={{ margin: '4px 0 0', fontSize: 12, color: 'rgba(226,232,240,0.55)' }}>
          /{inv.slug}
          {inv.eventDate ? ` · ${new Date(inv.eventDate).toLocaleDateString()}` : ''}
        </p>
      </div>
      <span className="adm-badge" style={{ background: 'rgba(139,92,246,0.15)', color: '#c4b5fd', border: '1px solid rgba(139,92,246,0.3)' }}>
        {responsesLabel}: {inv._count?.rsvps ?? 0}
      </span>
      {!inv.isPublished && (
        <span className="adm-badge" style={{ background: 'rgba(148,163,184,0.15)', color: '#cbd5e1', border: '1px solid rgba(148,163,184,0.3)' }}>
          Draft
        </span>
      )}
      <a href={url} target="_blank" rel="noreferrer" className="adm-btn-ghost" style={{ fontSize: 13, textDecoration: 'none' }}>
        Open ↗
      </a>
      <button type="button" className="adm-btn-ghost" style={{ fontSize: 13 }} onClick={onEdit}>Edit</button>
      <button type="button" className="adm-btn-danger" style={{ fontSize: 13 }} onClick={onDelete}>Delete</button>
    </div>
  );
}
