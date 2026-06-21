import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { designTemplateService, type DesignKind } from '../services/designTemplate.service';
import { builtinTemplates, type PickedDesign } from '../blocks/builtinTemplates';
import type { translate } from '../utils/translate';

type T = (k: Parameters<typeof translate>[0], p?: Record<string, string | number>) => string;

// Small flash/error helper shared by both builders.
export function useDesignSave() {
  const [savedFlash, setSavedFlash] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const flash = () => { setSavedFlash(true); setTimeout(() => setSavedFlash(false), 1500); };
  return { flash, error, setError, savedFlash };
}

// Full-screen "start from blank / ready-made / a saved template" chooser.
export function TemplateChooser({ kind, t, onPick, backLink }: {
  kind: DesignKind;
  t: T;
  onPick: (picked: PickedDesign | null) => void;
  backLink: string;
}) {
  const queryClient = useQueryClient();
  const queryKey = ['design-templates', kind];
  const { data: templates = [], isLoading } = useQuery({
    queryKey,
    queryFn: () => designTemplateService.listMine(kind),
  });
  const removeMutation = useMutation({
    mutationFn: (id: string) => designTemplateService.remove(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const builtins = builtinTemplates(kind);

  return (
    <div className="adm-bg" style={{ minHeight: '100vh' }}>
      <main className="tablet-fade-in" style={{ maxWidth: 900, margin: '0 auto', padding: '40px 20px', position: 'relative', zIndex: 1 }}>
        <Link to={backLink} style={{ fontSize: 12, color: 'rgba(226,232,240,0.6)', textDecoration: 'none' }}>← {t('back')}</Link>
        <h1 className="adm-title" style={{ margin: '10px 0 24px' }}>{t('start_blank')} / {t('my_templates')}</h1>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 14 }}>
          {/* Blank */}
          <button type="button" onClick={() => onPick(null)} className="adm-card adm-card-hover"
            style={{ padding: 24, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, cursor: 'pointer', color: '#e2e8f0', minHeight: 150, justifyContent: 'center' }}>
            <span style={{ fontSize: 34 }}>＋</span>
            <span style={{ fontSize: 14, fontWeight: 700 }}>{t('blank')}</span>
          </button>

          {/* Ready-made built-in templates */}
          {builtins.map((tpl) => (
            <button key={tpl.id} type="button" onClick={() => onPick({ blocks: tpl.blocks, theme: tpl.theme })} className="adm-card adm-card-hover"
              style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 8, cursor: 'pointer', color: '#e2e8f0', textAlign: 'left', minHeight: 150, position: 'relative', border: '1px solid rgba(201,164,44,0.35)' }}>
              <span className="adm-badge" style={{ position: 'absolute', top: 10, right: 10, background: 'rgba(201,164,44,0.18)', color: '#c9a42c', border: '1px solid rgba(201,164,44,0.35)' }}>{t('ready_made')}</span>
              <span style={{ fontSize: 26 }}>💍</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: '#f8fafc' }}>{tpl.name}</span>
              <span style={{ fontSize: 11, color: 'rgba(226,232,240,0.5)' }}>{tpl.blocks.length} blocks</span>
            </button>
          ))}

          {/* Saved (private) templates — deletable */}
          {templates.map((tpl) => (
            <div key={tpl.id} className="adm-card adm-card-hover"
              style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 8, color: '#e2e8f0', textAlign: 'left', minHeight: 150, position: 'relative' }}>
              <button type="button" title={t('delete_block')}
                onClick={(e) => { e.stopPropagation(); if (window.confirm(`${t('delete_block')}: ${tpl.name}?`)) removeMutation.mutate(tpl.id); }}
                style={{ position: 'absolute', top: 8, right: 8, width: 26, height: 26, borderRadius: '50%', background: 'rgba(220,38,38,0.85)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 14, lineHeight: 1 }}>×</button>
              <button type="button" onClick={() => onPick({ blocks: tpl.blocks, theme: tpl.theme })}
                style={{ background: 'transparent', border: 'none', padding: 0, textAlign: 'left', cursor: 'pointer', color: 'inherit', display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
                <span style={{ fontSize: 26 }}>🗂</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: '#f8fafc' }}>{tpl.name}</span>
                <span style={{ fontSize: 11, color: 'rgba(226,232,240,0.5)' }}>{tpl.blocks?.length ?? 0} blocks</span>
              </button>
            </div>
          ))}
        </div>

        {isLoading && <p style={{ color: 'rgba(226,232,240,0.5)', marginTop: 16 }}>...</p>}
        {!isLoading && templates.length === 0 && <p style={{ color: 'rgba(226,232,240,0.5)', marginTop: 16, fontSize: 13 }}>{t('no_templates')}</p>}
      </main>
    </div>
  );
}
