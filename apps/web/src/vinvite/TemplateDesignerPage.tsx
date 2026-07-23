import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, Navigate, useParams } from 'react-router-dom';
import { vinviteService } from './api';
import { useViT, type ViKey } from './i18n';
import { useVInviteStore } from './store';
import { getTemplate } from './templates';
import { RichDesignEditor } from './RichEditorPage';
import { LOCALES, type RichDesignData } from './templates/types';

// ── Template designer: /template-designer/:templateId (system admins) ────────
// Edits a BUILT-IN rich template's design: the saved config becomes the
// template's new default for cards, previews and every newly created
// invitation. Reuses the full rich editor (fields + Design+ drag & drop).
export const ViTemplateDesignerPage = () => {
  const { templateId = '' } = useParams();
  const t = useViT();
  const queryClient = useQueryClient();
  const isSystemAdmin = useVInviteStore((s) => s.user?.role === 'SYSTEM_ADMIN');
  const template = getTemplate(templateId);

  const overridesQuery = useQuery({
    queryKey: ['vi-tpl-overrides'],
    queryFn: () => vinviteService.listTemplateOverrides(),
  });

  const [design, setDesign] = useState<RichDesignData | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);

  useEffect(() => {
    if (!template || !overridesQuery.data || design) return;
    const override = overridesQuery.data.find((o) => o.templateId === template.id);
    setDesign({
      templateId: template.id,
      languages: [...LOCALES],
      config: structuredClone(override?.config ?? template.defaultConfig) as Record<string, unknown>,
    });
  }, [template, overridesQuery.data, design]);

  const saveMutation = useMutation({
    mutationFn: () => vinviteService.saveTemplateOverride(templateId, design!.config),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vi-tpl-overrides'] });
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 1800);
    },
  });

  if (!isSystemAdmin || !template) return <Navigate to="/templates" replace />;

  return (
    <div className="vi-root-page" style={{ minHeight: '100vh' }}>
      {/* Top bar */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 40, display: 'flex', alignItems: 'center', gap: 12,
        padding: '10px 16px', background: 'rgba(10,12,20,0.85)', backdropFilter: 'blur(14px)',
        borderBottom: '1px solid rgba(255,255,255,0.08)', flexWrap: 'wrap',
      }}>
        <Link to="/templates" className="vi-btn vi-btn-ghost" style={{ fontSize: 13, textDecoration: 'none' }}>← {t('back')}</Link>
        <span style={{ fontWeight: 800, fontSize: 15, color: '#f1f5f9' }}>🛠 {t('adm_edit_template')} · {t(template.nameKey as ViKey)}</span>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
          {savedFlash && <span style={{ fontSize: 13, color: '#4ade80', fontWeight: 700 }}>✓ {t('saved')}</span>}
          <button
            type="button"
            className="vi-btn vi-btn-primary"
            style={{ fontSize: 13 }}
            disabled={!design || saveMutation.isPending}
            onClick={() => saveMutation.mutate()}
          >
            {saveMutation.isPending ? t('saving') : t('save')}
          </button>
        </div>
      </nav>

      {design ? (
        <RichDesignEditor design={design} onChange={setDesign} />
      ) : (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}><span className="vi-spinner" /></div>
      )}
    </div>
  );
};
