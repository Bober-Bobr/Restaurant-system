import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { vinviteService } from './api';
import { useViT } from './i18n';

// ── Studio contact block (v-invite) ──────────────────────────────────────────
// These details appear under the "developed with love by V-INVITE" credit on
// every published invitation. They belong to the studio, not to any honoree, so
// only a SYSTEM_ADMIN may change them — the server enforces that too.
export const PlatformContactCard = () => {
  const t = useViT();
  const queryClient = useQueryClient();
  const { data } = useQuery({
    queryKey: ['vi-platform-contact'],
    queryFn: () => vinviteService.getPlatformContact(),
  });

  const [phone, setPhone] = useState('');
  const [telegram, setTelegram] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!data) return;
    setPhone(data.phone ?? '');
    setTelegram(data.telegram ?? '');
  }, [data]);

  const save = useMutation({
    mutationFn: () => vinviteService.savePlatformContact({ phone: phone.trim(), telegram: telegram.trim() }),
    onSuccess: async () => {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      await queryClient.invalidateQueries({ queryKey: ['vi-platform-contact'] });
      // Published pages read this through the public endpoint.
      await queryClient.invalidateQueries({ queryKey: ['platform-contacts'] });
    },
  });

  return (
    <form
      className="vi-card"
      style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}
      onSubmit={(e) => { e.preventDefault(); if (!save.isPending) save.mutate(); }}
    >
      <div>
        <h2 style={{ margin: 0, fontSize: 15, fontWeight: 800 }}>🛠 {t('pc_title')}</h2>
        <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--vi-muted)' }}>{t('pc_hint')}</p>
      </div>

      <div>
        <label className="vi-label">{t('pc_phone')}</label>
        <input className="vi-input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+998 90 123 45 67" />
      </div>
      <div>
        <label className="vi-label">{t('pc_telegram')}</label>
        <input className="vi-input" value={telegram} onChange={(e) => setTelegram(e.target.value)} placeholder="@username" />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button type="submit" className="vi-btn vi-btn-primary" disabled={save.isPending}>
          {save.isPending ? t('saving') : t('save')}
        </button>
        {saved && <span style={{ fontSize: 13, color: 'var(--vi-accent)' }}>{t('saved')}</span>}
        {save.isError && <span style={{ fontSize: 13, color: 'var(--vi-danger)' }}>{t('pc_save_failed')}</span>}
      </div>
    </form>
  );
};
