import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import { designTemplateService, type DesignTheme } from '../services/designTemplate.service';
import { useAdminStore } from '../store/admin.store';
import { translate } from '../utils/translate';
import { BlockEditor } from '../blocks/BlockEditor';
import type { Block } from '../blocks/types';
import { VC_LOGO } from './branding';

type TFn = (k: Parameters<typeof translate>[0], p?: Record<string, string | number>) => string;

function errText(e: unknown): string {
  if (axios.isAxiosError(e)) {
    const body = e.response?.data as { message?: unknown } | undefined;
    if (typeof body?.message === 'string') return body.message;
  }
  return e instanceof Error ? e.message : 'Error';
}

// ── nfc.v-connect.uz/templates/:templateId ───────────────────────────────────
// Edits a saved plaque template in place. Plaques already built from it are
// untouched — a template is a starting point, not a live link.
export const NfcTemplateEditorPage = () => {
  const { templateId = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { locale } = useAdminStore();
  const t: TFn = (k, p) => translate(k, locale, p);

  const tplQuery = useQuery({
    queryKey: ['design-template', templateId],
    queryFn: () => designTemplateService.get(templateId),
    enabled: !!templateId,
  });
  const tpl = tplQuery.data;

  const [name, setName] = useState('');
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [theme, setTheme] = useState<DesignTheme>({});
  const [initialized, setInitialized] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!tpl || initialized) return;
    setName(tpl.name);
    setBlocks(structuredClone(tpl.blocks ?? []));
    setTheme({ ...(tpl.theme ?? {}) });
    setInitialized(true);
  }, [tpl, initialized]);

  const saveMutation = useMutation({
    mutationFn: () => designTemplateService.update(templateId, { name: name.trim() || tpl?.name || 'Template', blocks, theme }),
    onSuccess: (updated) => {
      setError(null);
      setSaved(true);
      setTimeout(() => setSaved(false), 1800);
      queryClient.setQueryData(['design-template', templateId], updated);
      void queryClient.invalidateQueries({ queryKey: ['design-templates', 'plaque'] });
    },
    onError: (e) => setError(errText(e)),
  });

  if (tplQuery.isLoading) {
    return (
      <div className="vc-root" style={{ display: 'grid', placeItems: 'center', minHeight: '100vh' }}>
        <span className="vc-muted">{t('loading')}</span>
      </div>
    );
  }

  return (
    <div className="vc-root" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header style={{
        position: 'sticky', top: 0, zIndex: 40,
        background: 'rgba(11,11,10,0.9)',
        backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)',
        borderBottom: '1px solid var(--vc-line)',
      }}>
        <div style={{ maxWidth: 1180, margin: '0 auto', padding: '11px 18px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <button type="button" className="vc-btn vc-btn-ghost" style={{ fontSize: 12.5, padding: '8px 13px' }} onClick={() => navigate('/templates')}>
            ← {t('back')}
          </button>
          <img src={VC_LOGO} alt="" style={{ height: 26, width: 'auto', objectFit: 'contain', opacity: 0.9 }} />
          <span className="vc-badge">{t('edit_template')}</span>

          <input
            className="vc-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('template_name')}
            style={{ width: 220 }}
          />

          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
            {saved && <span style={{ fontSize: 12, color: 'var(--vc-accent)' }}>{t('saved')}</span>}
            <button
              type="button"
              className="vc-btn vc-btn-primary"
              style={{ fontSize: 12.5 }}
              disabled={!tpl || saveMutation.isPending}
              onClick={() => saveMutation.mutate()}
            >
              {saveMutation.isPending ? '…' : t('save_changes')}
            </button>
          </div>
        </div>

        {error && (
          <div style={{ maxWidth: 1180, margin: '0 auto', padding: '0 18px 12px' }}>
            <p style={{ margin: 0, fontSize: 12.5, color: 'var(--vc-danger)' }}>{error}</p>
          </div>
        )}
      </header>

      {tpl ? (
        <div style={{ flex: 1 }}>
          <BlockEditor
            kind="plaque"
            blocks={blocks}
            theme={theme}
            onBlocksChange={setBlocks}
            onThemeChange={setTheme}
            t={t}
            showTrail
          />
        </div>
      ) : (
        <p className="vc-muted" style={{ textAlign: 'center', padding: 60 }}>{t('vc_load_failed')}</p>
      )}
    </div>
  );
};
