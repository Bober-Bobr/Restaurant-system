import { useQuery } from '@tanstack/react-query';
import { Link, Navigate, useParams } from 'react-router-dom';
import { useAuthStore } from '../store/auth.store';
import { useAdminStore } from '../store/admin.store';
import { translate } from '../utils/translate';
import { invitationService, type InvitationRequest } from '../services/invitation.service';

// ── Flyer requests: /flyers/:flyerId/requests ───────────────────────────────
// A full-page table of every form submission captured by a flyer.
export const FlyerRequestsPage = () => {
  const { flyerId = '' } = useParams();
  const accessToken = useAuthStore((s) => s.accessToken);
  const role = useAuthStore((s) => s.role);
  const { locale } = useAdminStore();
  const t = (k: Parameters<typeof translate>[0]) => translate(k, locale);

  const flyerQuery = useQuery({ queryKey: ['flyer', flyerId], queryFn: () => invitationService.get(flyerId), enabled: !!accessToken && !!flyerId });
  const requestsQuery = useQuery({ queryKey: ['invitation-requests', flyerId], queryFn: () => invitationService.listRequests(flyerId), enabled: !!accessToken && !!flyerId });

  if (!accessToken) return <Navigate to="/login" replace />;
  if (role !== 'MANAGER' && role !== 'CHIEF_ADMIN') return <Navigate to="/login" replace />;

  const requests = requestsQuery.data ?? [];
  const th: React.CSSProperties = { textAlign: 'left', padding: '12px 14px', fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(226,232,240,0.55)', fontWeight: 600, whiteSpace: 'nowrap', borderBottom: '1px solid rgba(255,255,255,0.1)' };
  const td: React.CSSProperties = { padding: '12px 14px', fontSize: 14, color: '#e2e8f0', verticalAlign: 'top', borderBottom: '1px solid rgba(255,255,255,0.06)' };

  return (
    <div className="adm-bg" style={{ minHeight: '100vh' }}>
      <div style={{ maxWidth: 960, margin: '0 auto', padding: '24px 16px 80px' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <Link to={`/flyers/${flyerId}`} className="adm-btn-ghost" style={{ fontSize: 13, textDecoration: 'none' }}>← {t('back')}</Link>
          <div style={{ flex: 1 }}>
            <h1 style={{ margin: 0, color: '#f8fafc', fontSize: 20 }}>{t('flyer_requests')}</h1>
            {flyerQuery.data && <p style={{ margin: '2px 0 0', color: 'rgba(226,232,240,0.5)', fontSize: 13 }}>{flyerQuery.data.slug} · {requests.length}</p>}
          </div>
        </div>

        {requestsQuery.isLoading ? (
          <p style={{ color: 'rgba(226,232,240,0.6)', fontSize: 14 }}>…</p>
        ) : requests.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', borderRadius: 16, background: 'rgba(var(--adm-bg-rgb),0.6)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(226,232,240,0.6)', fontSize: 14 }}>{t('no_requests')}</div>
        ) : (
          <div style={{ overflowX: 'auto', borderRadius: 16, background: 'rgba(var(--adm-bg-rgb),0.6)', border: '1px solid rgba(255,255,255,0.1)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 560 }}>
              <thead>
                <tr>
                  <th style={th}>{t('req_name')}</th>
                  <th style={th}>{t('req_phone')}</th>
                  <th style={th}>{t('req_message')}</th>
                  <th style={th}>{t('req_date')}</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((r: InvitationRequest) => (
                  <tr key={r.id}>
                    <td style={{ ...td, fontWeight: 600, color: '#f8fafc' }}>{r.name}</td>
                    <td style={td}><a href={`tel:${r.phone}`} style={{ color: 'var(--adm-accent)', textDecoration: 'none', whiteSpace: 'nowrap' }}>{r.phone}</a></td>
                    <td style={{ ...td, color: 'rgba(226,232,240,0.8)', minWidth: 200 }}>{r.message || '—'}</td>
                    <td style={{ ...td, color: 'rgba(226,232,240,0.5)', fontSize: 12, whiteSpace: 'nowrap' }}>{new Date(r.createdAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
