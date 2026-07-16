import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { vinviteService } from './api';
import { useViT } from './i18n';

function deviceLabel(userAgent: string | null): { icon: string; label: string } {
  const ua = userAgent ?? '';
  const mobile = /Mobile|Android|iPhone|iPad/i.test(ua);
  let browser = 'Browser';
  if (/Edg\//.test(ua)) browser = 'Edge';
  else if (/OPR\//.test(ua)) browser = 'Opera';
  else if (/Chrome\//.test(ua)) browser = 'Chrome';
  else if (/Firefox\//.test(ua)) browser = 'Firefox';
  else if (/Safari\//.test(ua)) browser = 'Safari';
  let os = '';
  if (/Windows/.test(ua)) os = 'Windows';
  else if (/Android/.test(ua)) os = 'Android';
  else if (/iPhone|iPad|iOS/.test(ua)) os = 'iOS';
  else if (/Mac OS/.test(ua)) os = 'macOS';
  else if (/Linux/.test(ua)) os = 'Linux';
  return { icon: mobile ? '📱' : '💻', label: os ? `${browser} · ${os}` : browser };
}

// ── Devices linked to the account (active sessions) ──────────────────────────
export const ViDevicesPage = () => {
  const t = useViT();
  const queryClient = useQueryClient();

  const sessionsQuery = useQuery({ queryKey: ['vi-sessions'], queryFn: () => vinviteService.listSessions() });
  const revokeMutation = useMutation({
    mutationFn: (id: string) => vinviteService.revokeSession(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['vi-sessions'] }),
  });

  const sessions = sessionsQuery.data ?? [];

  return (
    <section className="vi-fade-up">
      <h1 style={{ margin: '0 0 22px', fontSize: 24, fontWeight: 800, letterSpacing: '-0.02em' }}>{t('devices')}</h1>

      {sessionsQuery.isLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><span className="vi-spinner" /></div>
      ) : sessions.length === 0 ? (
        <div className="vi-card" style={{ padding: '56px 24px', textAlign: 'center', color: 'var(--vi-muted)', fontSize: 15 }}>{t('no_devices')}</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 640 }}>
          {sessions.map((s, i) => {
            const d = deviceLabel(s.userAgent);
            return (
              <div key={s.id} className="vi-card vi-fade-up" style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 14, animationDelay: `${i * 60}ms` }}>
                <span style={{ fontSize: 26 }}>{d.icon}</span>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <p style={{ margin: 0, fontSize: 14.5, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    {d.label}
                    {s.isCurrent && <span className="vi-badge vi-badge-live">● {t('this_device')}</span>}
                  </p>
                  <p style={{ margin: '3px 0 0', fontSize: 12, color: 'var(--vi-muted)' }}>
                    {t('last_active')}: {new Date(s.lastUsedAt).toLocaleString()}{s.ipAddress ? ` · ${s.ipAddress}` : ''}
                  </p>
                </div>
                {!s.isCurrent && (
                  <button type="button" className="vi-btn vi-btn-danger" style={{ fontSize: 12.5, padding: '8px 12px' }} onClick={() => revokeMutation.mutate(s.id)}>
                    {t('revoke')}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};
