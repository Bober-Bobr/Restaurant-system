import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { designTemplateService, type DesignTemplate, type DesignKind } from '../services/designTemplate.service';
import type { translate } from '../utils/translate';

type T = (k: Parameters<typeof translate>[0], p?: Record<string, string | number>) => string;

// Small flash/error helper shared by both builders.
export function useDesignSave() {
  const [savedFlash, setSavedFlash] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const flash = () => { setSavedFlash(true); setTimeout(() => setSavedFlash(false), 1500); };
  return { flash, error, setError, savedFlash };
}

// Full-screen "start from blank or a saved template" chooser for new projects.
export function TemplateChooser({ kind, t, onPick, backLink }: {
  kind: DesignKind;
  t: T;
  onPick: (tpl: DesignTemplate | null) => void;
  backLink: string;
}) {
  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['design-templates', kind],
    queryFn: () => designTemplateService.listMine(kind),
  });

  return (
    <div className="adm-bg" style={{ minHeight: '100vh' }}>
      <main className="tablet-fade-in" style={{ maxWidth: 900, margin: '0 auto', padding: '40px 20px', position: 'relative', zIndex: 1 }}>
        <Link to={backLink} style={{ fontSize: 12, color: 'rgba(226,232,240,0.6)', textDecoration: 'none' }}>← {t('back')}</Link>
        <h1 className="adm-title" style={{ margin: '10px 0 24px' }}>{t('start_blank')} / {t('my_templates')}</h1>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 14 }}>
          <button type="button" onClick={() => onPick(null)} className="adm-card adm-card-hover"
            style={{ padding: 24, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, cursor: 'pointer', color: '#e2e8f0', minHeight: 150, justifyContent: 'center' }}>
            <span style={{ fontSize: 34 }}>＋</span>
            <span style={{ fontSize: 14, fontWeight: 700 }}>{t('blank')}</span>
          </button>

          {templates.map((tpl) => (
            <button key={tpl.id} type="button" onClick={() => onPick(tpl)} className="adm-card adm-card-hover"
              style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 8, cursor: 'pointer', color: '#e2e8f0', textAlign: 'left', minHeight: 150 }}>
              <span style={{ fontSize: 26 }}>🗂</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: '#f8fafc' }}>{tpl.name}</span>
              <span style={{ fontSize: 11, color: 'rgba(226,232,240,0.5)' }}>{tpl.blocks?.length ?? 0} blocks</span>
            </button>
          ))}
        </div>

        {isLoading && <p style={{ color: 'rgba(226,232,240,0.5)', marginTop: 16 }}>...</p>}
        {!isLoading && templates.length === 0 && <p style={{ color: 'rgba(226,232,240,0.5)', marginTop: 16, fontSize: 13 }}>{t('no_templates')}</p>}
      </main>
    </div>
  );
}
