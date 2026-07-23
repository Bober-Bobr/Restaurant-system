import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { vinviteService } from './api';
import { useViT, type ViKey } from './i18n';
import { useVInviteStore } from './store';
import { RICH_TEMPLATES, TEMPLATE_CATEGORIES } from './templates';
import { RichRenderer } from './templates/RichRenderer';
import { resolveAssetUrls } from './templates/utils';
import { LOCALES, type TemplateDefinition } from './templates/types';

// Admin-saved design override for a template, falling back to its shipped
// default. All cards/previews/new invitations use the effective config.
export function useTemplateOverrides() {
  const query = useQuery({
    queryKey: ['vi-tpl-overrides'],
    queryFn: () => vinviteService.listTemplateOverrides(),
    staleTime: 60_000,
  });
  const map = useMemo(() => {
    const m = new Map<string, Record<string, unknown>>();
    for (const o of query.data ?? []) m.set(o.templateId, o.config);
    return m;
  }, [query.data]);
  return { effectiveConfig: (tpl: TemplateDefinition) => map.get(tpl.id) ?? tpl.defaultConfig };
}

// ── Templates: gallery of ready-made animated designs ────────────────────────
// Users browse first-party templates (no custom-template building anymore),
// filter by the event they were designed for, preview them full-screen with
// language switching + full animations, and pick one to start an invitation.
export const ViTemplatesPage = () => {
  const t = useViT();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [category, setCategory] = useState<string>('all');
  const [preview, setPreview] = useState<TemplateDefinition | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const isSystemAdmin = useVInviteStore((s) => s.user?.role === 'SYSTEM_ADMIN');
  const { effectiveConfig } = useTemplateOverrides();

  // Only show category chips that actually have templates.
  const categories = useMemo(
    () => TEMPLATE_CATEGORIES.filter((c) => RICH_TEMPLATES.some((tpl) => tpl.category === c.key)),
    [],
  );
  const templates = category === 'all' ? RICH_TEMPLATES : RICH_TEMPLATES.filter((tpl) => tpl.category === category);

  const createProjectMutation = useMutation({
    mutationFn: (tpl: TemplateDefinition) =>
      vinviteService.createProject({
        name: t(tpl.nameKey as ViKey),
        blocks: [],
        theme: {
          templateId: tpl.id,
          languages: [...LOCALES],
          config: structuredClone(effectiveConfig(tpl)),
        } as unknown as Parameters<typeof vinviteService.createProject>[0]['theme'],
      }),
    onSuccess: (project) => {
      queryClient.invalidateQueries({ queryKey: ['vi-projects'] });
      navigate(`/projects/${project.id}`);
    },
    onSettled: () => setBusyId(null),
  });

  const use = (tpl: TemplateDefinition) => {
    if (busyId) return;
    setBusyId(tpl.id);
    createProjectMutation.mutate(tpl);
  };

  return (
    <section className="vi-fade-up">
      <div style={{ marginBottom: 18 }}>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, letterSpacing: '-0.02em' }}>{t('templates')}</h1>
        <p style={{ margin: '6px 0 0', fontSize: 14, color: 'var(--vi-muted)' }}>{t('templates_subtitle')}</p>
      </div>

      {/* Category filter */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 22 }}>
        <FilterChip label={t('all_categories')} active={category === 'all'} onClick={() => setCategory('all')} />
        {categories.map((c) => (
          <FilterChip key={c.key} label={`${c.icon} ${t(c.labelKey as ViKey)}`} active={category === c.key} onClick={() => setCategory(c.key)} />
        ))}
      </div>

      {templates.length === 0 ? (
        <div className="vi-card" style={{ padding: '56px 24px', textAlign: 'center', color: 'var(--vi-muted)', fontSize: 15 }}>
          <div style={{ fontSize: 44, marginBottom: 12 }}>🎨</div>
          {t('no_templates')}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 20 }}>
          {templates.map((tpl, i) => (
            <TemplateCard
              key={tpl.id}
              tpl={tpl}
              config={effectiveConfig(tpl)}
              delayMs={i * 70}
              busy={busyId === tpl.id}
              onPreview={() => setPreview(tpl)}
              onUse={() => use(tpl)}
              onEdit={isSystemAdmin ? () => navigate(`/template-designer/${tpl.id}`) : undefined}
            />
          ))}
        </div>
      )}

      {preview && (
        <TemplatePreviewModal
          tpl={preview}
          config={effectiveConfig(preview)}
          busy={busyId === preview.id}
          onUse={() => use(preview)}
          onClose={() => setPreview(null)}
        />
      )}
    </section>
  );
};

function FilterChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`vi-tab${active ? ' active' : ''}`}
      style={{ cursor: 'pointer', border: '1px solid', borderColor: active ? 'var(--vi-ring)' : 'var(--vi-border)' }}
    >
      {label}
    </button>
  );
}

// ── One template card: live cover preview + name + preview/use actions ────────
function TemplateCard({ tpl, config, delayMs, busy, onPreview, onUse, onEdit }: {
  tpl: TemplateDefinition; config: Record<string, unknown>; delayMs: number; busy: boolean;
  onPreview: () => void; onUse: () => void; onEdit?: () => void;
}) {
  const t = useViT();
  const cat = TEMPLATE_CATEGORIES.find((c) => c.key === tpl.category);
  const coverConfig = useMemo(() => resolveAssetUrls(tpl, config), [tpl, config]);

  return (
    <div className="vi-card vi-fade-up" style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column', animationDelay: `${delayMs}ms` }}>
      {/* Live cover thumbnail (non-interactive) */}
      <button
        type="button"
        onClick={onPreview}
        title={t('preview')}
        style={{ position: 'relative', display: 'block', height: 320, border: 'none', padding: 0, cursor: 'pointer', background: '#f6f0e4', overflow: 'hidden' }}
      >
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
          <RichRenderer html={tpl.html} config={coverConfig} languages={[...LOCALES]} interactive />
        </div>
        {/* Hover veil + preview cue */}
        <span className="vi-tpl-cover-veil" style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(10,12,20,0.28)', color: '#fff', fontWeight: 700, fontSize: 14, opacity: 0, transition: 'opacity 0.2s ease' }}>
          👁 {t('preview')}
        </span>
        {cat && (
          <span style={{ position: 'absolute', top: 12, left: 12, fontSize: 11.5, fontWeight: 700, letterSpacing: '0.03em', padding: '5px 11px', borderRadius: 999, background: 'rgba(10,12,20,0.55)', color: '#fff', backdropFilter: 'blur(6px)' }}>
            {cat.icon} {t(cat.labelKey as ViKey)}
          </span>
        )}
      </button>

      {/* Footer */}
      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <span style={{ width: 12, height: 12, borderRadius: '50%', background: tpl.accent, boxShadow: `0 0 0 3px ${tpl.accent}33` }} />
          <span style={{ fontSize: 16, fontWeight: 700 }}>{t(tpl.nameKey as ViKey)}</span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" className="vi-btn vi-btn-ghost" style={{ flex: 1, fontSize: 13 }} onClick={onPreview}>👁 {t('preview')}</button>
          <button type="button" className="vi-btn vi-btn-primary" style={{ flex: 1, fontSize: 13 }} disabled={busy} onClick={onUse}>
            {busy ? '…' : `✨ ${t('use_template')}`}
          </button>
        </div>
        {onEdit && (
          <button
            type="button"
            onClick={onEdit}
            className="vi-btn vi-btn-ghost"
            style={{ fontSize: 13, color: '#a78bfa', borderColor: 'rgba(167,139,250,0.4)', background: 'rgba(124,58,237,0.08)' }}
          >🛠 {t('adm_edit_template')}</button>
        )}
      </div>
    </div>
  );
}

// ── Full-screen preview: real animations + guest language switcher ────────────
function TemplatePreviewModal({ tpl, config: rawConfig, busy, onUse, onClose }: {
  tpl: TemplateDefinition; config: Record<string, unknown>; busy: boolean; onUse: () => void; onClose: () => void;
}) {
  const t = useViT();
  const config = useMemo(() => resolveAssetUrls(tpl, rawConfig), [tpl, rawConfig]);

  return createPortal(
    <div style={{ position: 'fixed', inset: 0, zIndex: 90, background: 'rgba(6,8,14,0.92)', backdropFilter: 'blur(4px)', display: 'flex', flexDirection: 'column', animation: 'viFadeIn 0.2s ease both' }}>
      {/* Top bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', color: '#fff', flexWrap: 'wrap' }}>
        <span style={{ fontWeight: 700, fontSize: 15 }}>{t(tpl.nameKey as ViKey)}</span>
        <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>{t('preview_hint')}</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <button type="button" className="vi-btn vi-btn-primary" style={{ fontSize: 13 }} disabled={busy} onClick={onUse}>
            {busy ? '…' : `✨ ${t('use_template')}`}
          </button>
          <button type="button" className="vi-btn vi-btn-ghost" style={{ fontSize: 13, color: '#fff', borderColor: 'rgba(255,255,255,0.3)' }} onClick={onClose}>✕ {t('cancel')}</button>
        </div>
      </div>
      {/* Phone-framed live preview */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', justifyContent: 'center', padding: '0 12px 16px' }}>
        <div style={{ width: '100%', maxWidth: 440, height: '100%', borderRadius: 22, overflow: 'hidden', border: '10px solid #0b1120', boxShadow: '0 30px 80px rgba(0,0,0,0.6)', background: '#000' }}>
          <RichRenderer html={tpl.html} config={config} languages={[...LOCALES]} interactive />
        </div>
      </div>
    </div>,
    document.body,
  );
}
