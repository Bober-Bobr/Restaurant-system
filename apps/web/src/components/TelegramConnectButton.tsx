import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import QRCode from 'qrcode';
import type { TelegramStatus } from '../services/invitation.service';
import type { translate } from '../utils/translate';

// ── Telegram connect button + modal ──────────────────────────────────────────
// Shared between flyers (form submissions) and guest invitations (RSVPs): shows
// the page's activation code / deep link / QR, the connected chats, and a
// rotate-code action. The caller supplies the API trio so both products reuse
// the same UI against their own endpoints.

export type TelegramApi = {
  status: (id: string) => Promise<TelegramStatus>;
  rotate: (id: string) => Promise<TelegramStatus>;
  removeLink: (id: string, linkId: string) => Promise<void>;
};

type TKey = Parameters<typeof translate>[0];

export function TelegramConnectButton({ id, t, api, queryKey, howtoKey = 'tg_howto' }: {
  id: string;
  t: (k: TKey) => string;
  api: TelegramApi;
  // Distinct react-query cache key per product, e.g. 'flyer-telegram'.
  queryKey: string;
  // Explanation line inside the modal ('tg_howto' for flyers, 'tg_howto_invite' for invitations).
  howtoKey?: TKey;
}) {
  const [open, setOpen] = useState(false);
  const [qr, setQr] = useState<string>('');
  const qc = useQueryClient();
  const statusQuery = useQuery({
    queryKey: [queryKey, id],
    queryFn: () => api.status(id),
    enabled: open,
  });
  const status: TelegramStatus | undefined = statusQuery.data;

  useEffect(() => {
    if (status?.link) QRCode.toDataURL(status.link, { margin: 1, width: 220 }).then(setQr).catch(() => setQr(''));
    else setQr('');
  }, [status?.link]);

  const rotateMutation = useMutation({
    mutationFn: () => api.rotate(id),
    onSuccess: (data) => qc.setQueryData([queryKey, id], data),
  });
  const removeMutation = useMutation({
    mutationFn: (linkId: string) => api.removeLink(id, linkId),
    onSuccess: () => qc.invalidateQueries({ queryKey: [queryKey, id] }),
  });

  const panel: React.CSSProperties = { padding: 12, borderRadius: 10, background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(255,255,255,0.08)' };
  return (
    <>
      <button type="button" className="adm-btn-ghost" style={{ fontSize: 12 }} onClick={() => setOpen(true)}>
        ✈ {t('tg_connect')}
      </button>
      {open && createPortal(
        <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 70, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div onClick={(e) => e.stopPropagation()} className="scale-in" style={{ width: '100%', maxWidth: 480, maxHeight: 'calc(100vh - 32px)', overflowY: 'auto', borderRadius: 18, background: 'rgba(15,23,42,0.98)', border: '1px solid rgba(255,255,255,0.12)', padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <h3 style={{ margin: 0, color: '#f8fafc', fontSize: 16 }}>✈ {t('tg_connect')}</h3>
              <button type="button" onClick={() => setOpen(false)} style={{ width: 30, height: 30, borderRadius: 8, border: '1px solid rgba(255,255,255,0.12)', background: 'transparent', color: '#e2e8f0', cursor: 'pointer' }}>×</button>
            </div>

            {statusQuery.isLoading && <p style={{ color: 'rgba(226,232,240,0.6)', fontSize: 13 }}>…</p>}
            {status && status.enabled === false && (
              <p style={{ margin: 0, color: 'rgba(226,232,240,0.7)', fontSize: 13, lineHeight: 1.6 }}>{t('tg_disabled')}</p>
            )}
            {status && status.enabled && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <p style={{ margin: 0, color: 'rgba(226,232,240,0.7)', fontSize: 13, lineHeight: 1.6 }}>{t(howtoKey)}</p>

                <div style={{ ...panel, textAlign: 'center' }}>
                  <div style={{ fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(226,232,240,0.5)', marginBottom: 8 }}>{t('tg_your_code')}</div>
                  <div
                    onClick={() => status.code && navigator.clipboard?.writeText(status.code)}
                    title={t('copy_link')}
                    style={{ fontSize: 30, fontWeight: 800, letterSpacing: '0.3em', color: '#c9a42c', fontFamily: 'ui-monospace, monospace', cursor: 'pointer' }}
                  >{status.code}</div>
                  {qr && (
                    <img src={qr} alt="" style={{ width: 180, height: 180, margin: '12px auto 0', borderRadius: 10, background: '#fff', padding: 6 }} />
                  )}
                  {status.link && (
                    <div style={{ marginTop: 10 }}>
                      <a href={status.link} target="_blank" rel="noopener noreferrer" className="adm-btn-primary" style={{ display: 'inline-block', fontSize: 13, textDecoration: 'none' }}>{t('tg_open_bot')}</a>
                    </div>
                  )}
                </div>

                <div>
                  <div style={{ fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(226,232,240,0.5)', marginBottom: 8 }}>{t('tg_connected')} · {status.links?.length ?? 0}</div>
                  {(status.links?.length ?? 0) === 0 ? (
                    <p style={{ margin: 0, color: 'rgba(226,232,240,0.5)', fontSize: 13 }}>{t('tg_none')}</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {status.links!.map((l) => (
                        <div key={l.id} style={{ ...panel, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                          <span style={{ color: '#f8fafc', fontSize: 13 }}>{l.firstName || (l.username ? '@' + l.username : l.chatId)}{l.username && l.firstName ? ' · @' + l.username : ''}</span>
                          <button type="button" onClick={() => removeMutation.mutate(l.id)} className="adm-btn-ghost" style={{ fontSize: 12, padding: '4px 10px' }}>{t('delete')}</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => { if (confirm(t('tg_rotate_confirm'))) rotateMutation.mutate(); }}
                  className="adm-btn-ghost"
                  style={{ fontSize: 12, alignSelf: 'flex-start' }}
                  disabled={rotateMutation.isPending}
                >↻ {t('tg_rotate')}</button>
              </div>
            )}
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
