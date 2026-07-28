import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { platformContactService } from '../services/platformContact.service';
import { useAdminStore } from '../store/admin.store';
import { translate } from '../utils/translate';

// ── V-connect contact block (v-menu, CHIEF_ADMIN) ────────────────────────────
// Shown under the "website developed by V-CONNECT" credit on every published
// flyer. An individual flyer can still override it with its own vccontact
// block; this is the default every other flyer inherits.
export const VConnectContactCard = () => {
  const { locale } = useAdminStore();
  const t = (key: Parameters<typeof translate>[0]) => translate(key, locale);
  const queryClient = useQueryClient();

  const { data } = useQuery({
    queryKey: ['vconnect-contact'],
    queryFn: () => platformContactService.get(),
  });

  const [phone, setPhone] = useState('');
  const [telegram, setTelegram] = useState('');
  const [instagram, setInstagram] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!data) return;
    setPhone(data.phone ?? '');
    setTelegram(data.telegram ?? '');
    setInstagram(data.instagram ?? '');
  }, [data]);

  const save = useMutation({
    mutationFn: () => platformContactService.save({ phone: phone.trim(), telegram: telegram.trim(), instagram: instagram.trim() }),
    onSuccess: async () => {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      await queryClient.invalidateQueries({ queryKey: ['vconnect-contact'] });
      await queryClient.invalidateQueries({ queryKey: ['platform-contacts'] });
    },
  });

  return (
    <section style={{ background: 'rgba(30,41,59,0.4)', padding: 20, borderRadius: 8, marginBottom: 24 }}>
      <h2 style={{ fontSize: 16, marginBottom: 4 }}>{t('pc_title_vconnect')}</h2>
      <p style={{ margin: '0 0 14px', fontSize: 12.5, color: 'rgba(226,232,240,0.55)' }}>
        {t('pc_hint_vconnect')}
      </p>
      <form
        onSubmit={(e) => { e.preventDefault(); if (!save.isPending) save.mutate(); }}
        style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', alignItems: 'end' }}
      >
        <label style={{ display: 'grid', gap: 6, fontSize: 12.5, color: 'rgba(226,232,240,0.7)' }}>
          {t('pc_phone')}
          <input className="adm-input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+998 90 123 45 67" />
        </label>
        <label style={{ display: 'grid', gap: 6, fontSize: 12.5, color: 'rgba(226,232,240,0.7)' }}>
          {t('pc_telegram')}
          <input className="adm-input" value={telegram} onChange={(e) => setTelegram(e.target.value)} placeholder="@username" />
        </label>
        <label style={{ display: 'grid', gap: 6, fontSize: 12.5, color: 'rgba(226,232,240,0.7)' }}>
          {t('pc_instagram')}
          <input className="adm-input" value={instagram} onChange={(e) => setInstagram(e.target.value)} placeholder="@username" />
        </label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button type="submit" className="adm-btn-primary" disabled={save.isPending}>
            {save.isPending ? t('saving') : t('save')}
          </button>
          {saved && <span style={{ fontSize: 12.5, color: '#c9a42c' }}>{t('saved')}</span>}
          {save.isError && <span style={{ fontSize: 12.5, color: '#fca5a5' }}>{t('pc_save_failed')}</span>}
        </div>
      </form>
    </section>
  );
};
