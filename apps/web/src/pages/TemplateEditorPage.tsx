import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import { useAuthStore } from '../store/auth.store';
import { useAdminStore } from '../store/admin.store';
import { translate } from '../utils/translate';
import { designTemplateService, type DesignTheme } from '../services/designTemplate.service';
import { BlockEditor } from '../blocks/BlockEditor';
import type { Block } from '../blocks/types';
import { useDesignSave } from './designerShared';
import networkingLogoSrc from '../assets/networking-logo.png';

// ── /templates/:templateId — edit a saved design template in place ──────────
// The changes affect the TEMPLATE only; flyers/invitations already created from
// it are untouched.
export const TemplateEditorPage = () => {
  const { templateId = '' } = useParams();
  const accessToken = useAuthStore((s) => s.accessToken);
  const role = useAuthStore((s) => s.role);
  const { locale } = useAdminStore();
  const t = (k: Parameters<typeof translate>[0], p?: Record<string, string | number>) => translate(k, locale, p);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const tplQuery = useQuery({
    queryKey: ['design-template', templateId],
    queryFn: () => designTemplateService.get(templateId),
    enabled: !!accessToken && !!templateId,
  });

  const [blocks, setBlocks] = useState<Block[]>([]);
  const [theme, setTheme] = useState<DesignTheme>({});
  const [name, setName] = useState('');
  const [initialized, setInitialized] = useState(false);
  const { flash, error, setError, savedFlash } = useDesignSave();

  const tpl = tplQuery.data;

  useEffect(() => {
    if (tpl && !initialized) {
      setBlocks(structuredClone(tpl.blocks ?? []));
      setTheme({ ...(tpl.theme ?? {}) });
      setName(tpl.name);
      setInitialized(true);
    }
  }, [tpl, initialized]);

  const saveMutation = useMutation({
    mutationFn: () => designTemplateService.update(templateId, { name: name.trim() || tpl?.name || 'Template', blocks, theme }),
    onSuccess: (updated) => {
      setError(null); flash();
      queryClient.setQueryData(['design-template', templateId], updated);
      queryClient.invalidateQueries({ queryKey: ['design-templates'] });
    },
    onError: (e) => {
      if (axios.isAxiosError(e)) setError((e.response?.data as { message?: string })?.message ?? e.message);
      else if (e instanceof Error) setError(e.message); else setError('Save failed');
    },
  });

  if (!accessToken) return <Navigate to="/login" replace />;
  if (role !== 'MANAGER' && role !== 'CHIEF_ADMIN') return <Navigate to="/login" replace />;

  // The manager portal no longer has an invitations section — always back to /.
  const backLink = '/';

  return (
    <div className="adm-bg">
      <nav style={{ position: 'sticky', top: 0, zIndex: 45, background: 'rgba(var(--adm-bg-rgb),0.85)', backdropFilter: 'blur(18px)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto', padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          <Link to={backLink} style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
            <img src={networkingLogoSrc} alt="" style={{ height: 34, width: 'auto' }} />
            <div>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#f8fafc' }}>{t('edit_template')}</p>
              <p style={{ margin: '2px 0 0', fontSize: 11, color: 'rgba(226,232,240,0.5)' }}>{tpl?.kind === 'invitation' ? t('invitations') : t('flyers')}</p>
            </div>
          </Link>

          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('template_name')}
            style={{ marginLeft: 12, background: 'rgba(var(--adm-bg-rgb),0.6)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#e2e8f0', padding: '7px 12px', fontSize: 13, width: 220, outline: 'none' }}
          />

          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
            <button type="button" className="adm-btn-primary" style={{ fontSize: 13 }} disabled={saveMutation.isPending || !tpl} onClick={() => saveMutation.mutate()}>
              {saveMutation.isPending ? '...' : t('save_changes')}
            </button>
            <button type="button" className="adm-btn-ghost" style={{ fontSize: 12 }} onClick={() => navigate(backLink)}>{t('back')}</button>
          </div>
        </div>
      </nav>

      {error && <div style={{ maxWidth: 1180, margin: '12px auto 0', padding: 12, borderRadius: 10, background: 'rgba(220,38,38,0.15)', border: '1px solid rgba(220,38,38,0.35)', color: '#fca5a5', fontSize: 13 }}>{error}</div>}
      {savedFlash && <div style={{ maxWidth: 1180, margin: '12px auto 0', padding: 12, borderRadius: 10, background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.35)', color: '#4ade80', fontSize: 13, fontWeight: 600 }}>✓ {t('save')}</div>}

      {tpl ? (
        <BlockEditor
          kind={tpl.kind}
          blocks={blocks} theme={theme}
          onBlocksChange={setBlocks} onThemeChange={setTheme}
          t={t} restaurantId=""
          showTrail={tpl.kind === 'invitation'}
        />
      ) : (
        <p style={{ textAlign: 'center', color: 'rgba(226,232,240,0.5)', padding: 60 }}>{tplQuery.isLoading ? '...' : 'Not found'}</p>
      )}
    </div>
  );
};
