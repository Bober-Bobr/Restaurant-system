import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { nfcPlaqueService, type NfcPlaque } from '../services/nfcPlaque.service';
import { useAdminStore } from '../store/admin.store';
import { translate } from '../utils/translate';
import { buildPlaqueUrl } from '../utils/subdomain';

// ── nfc.v-connect.uz/ — the maker's plaques ──────────────────────────────────
export const NfcPlaquesPage = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { locale } = useAdminStore();
  const t = (key: Parameters<typeof translate>[0]) => translate(key, locale);

  const { data: plaques = [], isLoading, isError } = useQuery({
    queryKey: ['nfc-plaques'],
    queryFn: () => nfcPlaqueService.listMine(),
  });

  const [confirmId, setConfirmId] = useState<string | null>(null);
  const deleteMutation = useMutation({
    mutationFn: (id: string) => nfcPlaqueService.remove(id),
    onSuccess: async () => {
      setConfirmId(null);
      await queryClient.invalidateQueries({ queryKey: ['nfc-plaques'] });
    },
  });

  return (
    <section className="vc-fade-up">
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap', marginBottom: 8 }}>
        <div>
          <p className="vc-eyebrow">{t('vc_nfc_plaques')}</p>
          <h1 className="vc-title" style={{ marginTop: 8 }}>{t('vc_my_plaques')}</h1>
        </div>
        <button
          type="button"
          className="vc-btn vc-btn-primary"
          style={{ marginLeft: 'auto' }}
          onClick={() => navigate('/plaques/new')}
        >
          ＋ {t('vc_new_plaque')}
        </button>
      </div>
      <hr className="vc-rule" style={{ margin: '18px 0 24px' }} />

      {isLoading && <p className="vc-muted" style={{ fontSize: 14 }}>{t('loading')}</p>}
      {isError && <p style={{ color: 'var(--vc-danger)', fontSize: 14 }}>{t('vc_load_failed')}</p>}

      {!isLoading && !isError && plaques.length === 0 && (
        <div className="vc-card" style={{ padding: '54px 26px', textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 14, opacity: 0.75 }}>📇</div>
          <p className="vc-muted" style={{ margin: '0 0 20px', fontSize: 14.5 }}>{t('vc_no_plaques')}</p>
          <button type="button" className="vc-btn vc-btn-primary" onClick={() => navigate('/plaques/new')}>
            ＋ {t('vc_new_plaque')}
          </button>
        </div>
      )}

      <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
        {plaques.map((p, i) => (
          <PlaqueCard
            key={p.id}
            plaque={p}
            delayMs={i * 60}
            t={t}
            onOpen={() => navigate(`/plaques/${p.id}`)}
            onDelete={() => setConfirmId(p.id)}
          />
        ))}
      </div>

      {confirmId && (
        <div
          onClick={() => setConfirmId(null)}
          style={{
            position: 'fixed', inset: 0, zIndex: 60, padding: 16,
            background: 'rgba(0,0,0,0.66)', backdropFilter: 'blur(6px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <div className="vc-card vc-fade-up" onClick={(e) => e.stopPropagation()} style={{ padding: 26, maxWidth: 380, width: '100%' }}>
            <p style={{ margin: '0 0 6px', fontSize: 16 }}>{t('vc_delete_plaque')}</p>
            <p className="vc-muted" style={{ margin: '0 0 22px', fontSize: 13.5 }}>{t('vc_delete_plaque_hint')}</p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="button" className="vc-btn vc-btn-ghost" style={{ flex: 1 }} onClick={() => setConfirmId(null)}>
                {t('cancel')}
              </button>
              <button
                type="button"
                className="vc-btn vc-btn-danger"
                style={{ flex: 1 }}
                disabled={deleteMutation.isPending}
                onClick={() => deleteMutation.mutate(confirmId)}
              >
                {deleteMutation.isPending ? '…' : t('delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

function PlaqueCard({ plaque, delayMs, t, onOpen, onDelete }: {
  plaque: NfcPlaque;
  delayMs: number;
  t: (key: Parameters<typeof translate>[0]) => string;
  onOpen: () => void;
  onDelete: () => void;
}) {
  const accent = plaque.accentColor || '#c8a97a';
  return (
    <div className="vc-card vc-fade-up" style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 12, animationDelay: `${delayMs}ms` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ width: 10, height: 10, borderRadius: '50%', background: accent, boxShadow: `0 0 0 3px ${accent}33`, flexShrink: 0 }} />
        <span style={{ fontSize: 15.5, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {plaque.businessName}
        </span>
        <span className={`vc-badge${plaque.isPublished ? ' live' : ''}`} style={{ marginLeft: 'auto', flexShrink: 0 }}>
          {plaque.isPublished ? <><i />{t('vc_live')}</> : t('vc_draft')}
        </span>
      </div>

      <p className="vc-muted" style={{ margin: 0, fontSize: 12.5, wordBreak: 'break-all' }}>
        {buildPlaqueUrl(plaque.slug).replace(/^https:\/\//, '')}
      </p>

      <div style={{ display: 'flex', gap: 8, marginTop: 'auto', paddingTop: 6 }}>
        <button type="button" className="vc-btn vc-btn-primary" style={{ flex: 1, fontSize: 12.5 }} onClick={onOpen}>
          {t('vc_open_builder')}
        </button>
        <button type="button" className="vc-btn vc-btn-danger" style={{ fontSize: 12.5, padding: '11px 13px' }} onClick={onDelete} aria-label={t('delete')}>
          ✕
        </button>
      </div>
    </div>
  );
}
