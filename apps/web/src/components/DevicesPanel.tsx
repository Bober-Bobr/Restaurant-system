import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { authService, type DeviceSession } from '../services/auth.service';
import { translate, type Locale } from '../utils/translate';

// Best-effort human label from a User-Agent string.
function describeDevice(ua: string | null): { name: string; os: string } {
  if (!ua) return { name: 'unknown', os: '' };
  let os = '';
  if (/windows/i.test(ua)) os = 'Windows';
  else if (/android/i.test(ua)) os = 'Android';
  else if (/iphone|ipad|ipod/i.test(ua)) os = 'iOS';
  else if (/mac os x|macintosh/i.test(ua)) os = 'macOS';
  else if (/linux/i.test(ua)) os = 'Linux';

  let name = '';
  if (/edg/i.test(ua)) name = 'Edge';
  else if (/yabrowser/i.test(ua)) name = 'Yandex';
  else if (/chrome|crios/i.test(ua)) name = 'Chrome';
  else if (/firefox|fxios/i.test(ua)) name = 'Firefox';
  else if (/safari/i.test(ua)) name = 'Safari';
  else name = 'Browser';

  return { name, os };
}

function timeAgo(iso: string, locale: Locale): string {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return locale === 'ru' ? 'только что' : locale === 'uz' ? 'hozir' : 'just now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return d.toLocaleDateString();
}

export const DevicesPanel = ({ locale }: { locale: Locale }) => {
  const t = (key: Parameters<typeof translate>[0]) => translate(key, locale);
  const queryClient = useQueryClient();

  const { data: sessions = [], isLoading } = useQuery({
    queryKey: ['auth-sessions'],
    queryFn: () => authService.listSessions(),
  });

  const revoke = useMutation({
    mutationFn: (id: string) => authService.revokeSession(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['auth-sessions'] }),
  });

  return (
    <section className="adm-card tablet-fade-up" style={{ padding: 18 }}>
      <h2 className="adm-heading" style={{ margin: '0 0 6px' }}>{t('devices_management')}</h2>
      <p style={{ margin: '0 0 16px', fontSize: 13, color: 'rgba(226,232,240,0.55)' }}>{t('devices_help')}</p>

      {isLoading && <p style={{ color: 'rgba(226,232,240,0.5)', fontSize: 13 }}>...</p>}
      {!isLoading && sessions.length === 0 && (
        <p style={{ color: 'rgba(226,232,240,0.5)', fontSize: 13 }}>{t('no_devices')}</p>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {sessions.map((s: DeviceSession) => {
          const { name, os } = describeDevice(s.userAgent);
          const label = s.userAgent ? `${name}${os ? ` · ${os}` : ''}` : t('unknown_device');
          return (
            <div key={s.id} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '12px 14px', borderRadius: 12,
              background: s.isCurrent ? 'rgba(34,197,94,0.08)' : 'rgba(var(--adm-bg-rgb),0.5)',
              border: `1px solid ${s.isCurrent ? 'rgba(34,197,94,0.3)' : 'rgba(255,255,255,0.08)'}`,
            }}>
              <div style={{
                width: 40, height: 40, borderRadius: 10, flexShrink: 0,
                background: 'rgba(var(--adm-accent-rgb),0.12)', color: 'var(--adm-accent)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="3" width="20" height="14" rx="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" />
                </svg>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: 8 }}>
                  {label}
                  {s.isCurrent && (
                    <span className="adm-badge" style={{ background: 'rgba(34,197,94,0.15)', color: '#4ade80', border: '1px solid rgba(34,197,94,0.3)' }}>
                      {t('this_device')}
                    </span>
                  )}
                </p>
                <p style={{ margin: '3px 0 0', fontSize: 12, color: 'rgba(226,232,240,0.5)' }}>
                  {s.ipAddress ? `${s.ipAddress} · ` : ''}{t('last_active')}: {timeAgo(s.lastSeenAt, locale)}
                </p>
              </div>
              {!s.isCurrent && (
                <button
                  type="button"
                  className="adm-btn-danger"
                  disabled={revoke.isPending}
                  onClick={() => { if (window.confirm(t('confirm_disconnect_device'))) revoke.mutate(s.id); }}
                  style={{ fontSize: 12, flexShrink: 0 }}
                >
                  {t('disconnect')}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
};
