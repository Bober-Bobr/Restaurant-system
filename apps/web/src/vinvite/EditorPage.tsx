import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import { BlockEditor } from '../blocks/BlockEditor';
import type { Block } from '../blocks/types';
import type { DesignTheme } from '../services/designTemplate.service';
import { invitationTheme } from '../blocks/seed';
import { translate } from '../utils/translate';
import { buildInviteSiteUrl, inviteDomain } from '../utils/subdomain';
import { vinviteService } from './api';
import { useVInviteStore } from './store';
import { useViT } from './i18n';
import { LinkQrButton } from '../components/LinkQrButton';
import { readRichDesign } from './templates';
import { RichDesignEditor } from './RichEditorPage';

type TFn = (k: Parameters<typeof translate>[0], p?: Record<string, string | number>) => string;
type SaveState = 'idle' | 'saving' | 'saved';

function slugify(s: string): string {
  return s.toLowerCase().replace(/[\s_]+/g, '-').replace(/[^a-z0-9-]/g, '').replace(/^-+|-+$/g, '').slice(0, 63);
}

function sig(name: string, slug: string, isPublished: boolean, blocks: Block[], theme: DesignTheme): string {
  return JSON.stringify({ name, slug, isPublished, blocks, theme });
}

function errMessage(e: unknown): string {
  if (axios.isAxiosError(e)) return (e.response?.data as { message?: string })?.message ?? e.message;
  if (e instanceof Error) return e.message;
  return 'Error';
}

// ── Invitation project editor: /projects/:id ─────────────────────────────────
export const ViEditorPage = () => {
  const { id = '' } = useParams();
  const t = useViT();
  const locale = useVInviteStore((s) => s.locale);
  const bt: TFn = (k, p) => translate(k, locale, p);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const projectQuery = useQuery({ queryKey: ['vi-project', id], queryFn: () => vinviteService.getProject(id), enabled: !!id });

  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [isPublished, setIsPublished] = useState(false);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [theme, setTheme] = useState<DesignTheme>({});
  const [initialized, setInitialized] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [slugFree, setSlugFree] = useState<boolean | null>(null);
  const [copied, setCopied] = useState(false);

  const savedSigRef = useRef('');
  const pendingSigRef = useRef('');

  const project = projectQuery.data;

  useEffect(() => { setInitialized(false); }, [id]);

  useEffect(() => {
    if (project && !initialized) {
      const loadedTheme = Object.keys(project.theme ?? {}).length ? project.theme : invitationTheme({});
      setName(project.name);
      setSlug(project.slug ?? '');
      setIsPublished(project.isPublished);
      setBlocks(project.blocks ?? []);
      setTheme(loadedTheme);
      savedSigRef.current = sig(project.name, project.slug ?? '', project.isPublished, project.blocks ?? [], loadedTheme);
      setInitialized(true);
    }
  }, [project, initialized]);

  // Debounced slug availability check.
  useEffect(() => {
    if (!initialized) return;
    const s = slugify(slug);
    if (!s || s.length < 3) { setSlugFree(null); return; }
    if (s === project?.slug) { setSlugFree(true); return; }
    const h = window.setTimeout(async () => {
      try { setSlugFree(await vinviteService.slugCheck(s, id)); } catch { setSlugFree(null); }
    }, 450);
    return () => window.clearTimeout(h);
  }, [slug, initialized, id, project?.slug]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const finalSlug = slugify(slug);
      pendingSigRef.current = sig(name, finalSlug, isPublished, blocks, theme);
      return vinviteService.updateProject(id, {
        name: name.trim() || t('new_invitation'),
        slug: finalSlug || null,
        isPublished: isPublished && !!finalSlug,
        blocks,
        theme,
      });
    },
    onSuccess: (updated) => {
      setError(null);
      savedSigRef.current = pendingSigRef.current;
      setSaveState('saved');
      queryClient.setQueryData(['vi-project', updated.id], updated);
      queryClient.invalidateQueries({ queryKey: ['vi-projects'] });
    },
    onError: (e) => {
      setSaveState('idle');
      setError(errMessage(e));
    },
  });

  // Auto-save (debounced).
  const currentSig = sig(name, slugify(slug), isPublished, blocks, theme);
  useEffect(() => {
    if (!initialized) return;
    if (currentSig === savedSigRef.current) { setSaveState((s) => (s === 'saving' ? 'saved' : s)); return; }
    setSaveState('saving');
    const h = window.setTimeout(() => saveMutation.mutate(), 900);
    return () => window.clearTimeout(h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSig, initialized]);

  const saveTemplate = async () => {
    const tplName = window.prompt(t('template_name'), name);
    if (!tplName?.trim()) return;
    await vinviteService.createTemplate({ name: tplName.trim(), blocks, theme });
    queryClient.invalidateQueries({ queryKey: ['vi-templates'] });
  };

  const remove = async () => {
    if (!window.confirm(t('confirm_delete'))) return;
    await vinviteService.removeProject(id);
    queryClient.invalidateQueries({ queryKey: ['vi-projects'] });
    navigate('/');
  };

  if (projectQuery.isLoading || !initialized) {
    return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span className="vi-spinner" /></div>;
  }

  const finalSlug = slugify(slug);
  const publicUrl = finalSlug ? buildInviteSiteUrl(finalSlug) : '';
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* clipboard unavailable */ }
  };

  return (
    <div className="adm-bg" style={{ minHeight: '100vh' }}>
      {/* Editor top bar */}
      <nav style={{ position: 'sticky', top: 0, zIndex: 45, background: 'rgba(15,23,42,0.88)', backdropFilter: 'blur(16px)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto', padding: '10px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <Link to="/" className="vi-btn vi-btn-ghost" style={{ fontSize: 13, padding: '7px 12px', color: '#e2e8f0', borderColor: 'rgba(255,255,255,0.16)' }}>← {t('back')}</Link>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={{ background: 'transparent', border: 'none', outline: 'none', color: '#f8fafc', fontSize: 15, fontWeight: 700, minWidth: 120, flex: '0 1 260px' }}
            />
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontSize: 12, color: saveState === 'saved' ? '#4ade80' : 'rgba(226,232,240,0.55)', minWidth: 88, textAlign: 'right' }}>
                {saveState === 'saving' ? `⟳ ${t('saving')}` : saveState === 'saved' ? `✓ ${t('saved')}` : ''}
              </span>
              <button type="button" className="adm-btn-ghost" style={{ fontSize: 12 }} onClick={saveTemplate}>{t('save_as_template')}</button>
              <button type="button" className="adm-btn-danger" style={{ fontSize: 12 }} onClick={remove}>{t('delete')}</button>
            </div>
          </div>

          {/* Public link + publish */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 260, display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(15,23,42,0.7)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '8px 12px' }}>
              <span style={{ fontSize: 13, color: 'rgba(226,232,240,0.55)', whiteSpace: 'nowrap' }}>{t('my_link')}:</span>
              <span style={{ fontSize: 13, color: '#60a5fa', whiteSpace: 'nowrap' }}>https://{inviteDomain()}/</span>
              <input
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="my-invite"
                style={{ flex: '0 1 auto', width: Math.max(70, slug.length * 8 + 16), minWidth: 70, background: 'rgba(96,165,250,0.1)', border: `1px solid ${slugFree === false ? 'rgba(248,113,113,0.6)' : 'rgba(96,165,250,0.35)'}`, borderRadius: 6, color: '#93c5fd', padding: '3px 8px', fontSize: 13, fontWeight: 600, outline: 'none' }}
              />
              {slugFree !== null && finalSlug && (
                <span style={{ fontSize: 11.5, fontWeight: 700, color: slugFree ? '#4ade80' : '#f87171', whiteSpace: 'nowrap' }}>
                  {slugFree ? `✓ ${t('link_free')}` : `✕ ${t('link_taken')}`}
                </span>
              )}
              <span style={{ flex: 1 }} />
              <button type="button" className="adm-btn-ghost" style={{ fontSize: 11, padding: '5px 10px' }} onClick={copy} disabled={!publicUrl}>
                {copied ? `✓ ${t('copied')}` : t('copy_link')}
              </button>
              {publicUrl && <LinkQrButton url={publicUrl} filename={finalSlug || 'invite'} t={bt} />}
              {publicUrl && isPublished && (
                <a href={publicUrl} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: '#60a5fa', textDecoration: 'none', padding: '5px 10px', borderRadius: 8, background: 'rgba(96,165,250,0.1)', border: '1px solid rgba(96,165,250,0.35)' }}>↗</a>
              )}
            </div>
            <button
              type="button"
              onClick={() => setIsPublished((v) => !v)}
              disabled={!finalSlug || slugFree === false}
              className={isPublished ? 'adm-btn-ghost' : 'adm-btn-primary'}
              style={{ fontSize: 13, ...(isPublished ? { color: '#4ade80', borderColor: 'rgba(34,197,94,0.4)' } : {}) }}
            >
              {isPublished ? `✓ ${t('published')}` : t('publish')}
            </button>
          </div>
        </div>
      </nav>

      {error && <div style={{ maxWidth: 1180, margin: '12px auto 0', padding: 12, borderRadius: 10, background: 'rgba(220,38,38,0.15)', border: '1px solid rgba(220,38,38,0.35)', color: '#fca5a5', fontSize: 13 }}>{error}</div>}

      {(() => {
        // Rich (first-party template) designs store { templateId, languages,
        // config } in `theme` and use the form editor; block designs use the
        // shared WYSIWYG block editor.
        const rich = readRichDesign(theme);
        return rich ? (
          <RichDesignEditor design={rich} projectId={id} onChange={(next) => setTheme(next as unknown as DesignTheme)} />
        ) : (
          <BlockEditor kind="invitation" blocks={blocks} theme={theme} onBlocksChange={setBlocks} onThemeChange={setTheme} t={bt} restaurantId="" showTrail />
        );
      })()}
    </div>
  );
};

// ── Template editor: /templates/:id/edit ─────────────────────────────────────
export const ViTemplateEditorPage = () => {
  const { id = '' } = useParams();
  const t = useViT();
  const locale = useVInviteStore((s) => s.locale);
  const bt: TFn = (k, p) => translate(k, locale, p);
  const queryClient = useQueryClient();

  const tplQuery = useQuery({ queryKey: ['vi-template', id], queryFn: () => vinviteService.getTemplate(id), enabled: !!id });

  const [name, setName] = useState('');
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [theme, setTheme] = useState<DesignTheme>({});
  const [initialized, setInitialized] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const savedSigRef = useRef('');
  const pendingSigRef = useRef('');

  const tpl = tplQuery.data;

  useEffect(() => { setInitialized(false); }, [id]);

  useEffect(() => {
    if (tpl && !initialized) {
      const loadedTheme = Object.keys(tpl.theme ?? {}).length ? tpl.theme : invitationTheme({});
      setName(tpl.name);
      setBlocks(tpl.blocks ?? []);
      setTheme(loadedTheme);
      savedSigRef.current = JSON.stringify({ name: tpl.name, blocks: tpl.blocks ?? [], theme: loadedTheme });
      setInitialized(true);
    }
  }, [tpl, initialized]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      pendingSigRef.current = JSON.stringify({ name, blocks, theme });
      return vinviteService.updateTemplate(id, { name: name.trim() || t('new_template'), blocks, theme });
    },
    onSuccess: (updated) => {
      savedSigRef.current = pendingSigRef.current;
      setSaveState('saved');
      queryClient.setQueryData(['vi-template', updated.id], updated);
      queryClient.invalidateQueries({ queryKey: ['vi-templates'] });
    },
    onError: () => setSaveState('idle'),
  });

  const currentSig = JSON.stringify({ name, blocks, theme });
  useEffect(() => {
    if (!initialized) return;
    if (currentSig === savedSigRef.current) { setSaveState((s) => (s === 'saving' ? 'saved' : s)); return; }
    setSaveState('saving');
    const h = window.setTimeout(() => saveMutation.mutate(), 900);
    return () => window.clearTimeout(h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSig, initialized]);

  if (tplQuery.isLoading || !initialized) {
    return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span className="vi-spinner" /></div>;
  }

  return (
    <div className="adm-bg" style={{ minHeight: '100vh' }}>
      <nav style={{ position: 'sticky', top: 0, zIndex: 45, background: 'rgba(15,23,42,0.88)', backdropFilter: 'blur(16px)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto', padding: '10px 20px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <Link to="/templates" className="vi-btn vi-btn-ghost" style={{ fontSize: 13, padding: '7px 12px', color: '#e2e8f0', borderColor: 'rgba(255,255,255,0.16)' }}>← {t('back')}</Link>
          <span style={{ fontSize: 12, color: 'rgba(226,232,240,0.5)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('templates')}</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={{ background: 'transparent', border: 'none', outline: 'none', color: '#f8fafc', fontSize: 15, fontWeight: 700, minWidth: 120, flex: '0 1 260px' }}
          />
          <span style={{ marginLeft: 'auto', fontSize: 12, color: saveState === 'saved' ? '#4ade80' : 'rgba(226,232,240,0.55)' }}>
            {saveState === 'saving' ? `⟳ ${t('saving')}` : saveState === 'saved' ? `✓ ${t('saved')}` : ''}
          </span>
        </div>
      </nav>

      {(() => {
        const rich = readRichDesign(theme);
        return rich ? (
          <RichDesignEditor design={rich} onChange={(next) => setTheme(next as unknown as DesignTheme)} />
        ) : (
          <BlockEditor kind="invitation" blocks={blocks} theme={theme} onBlocksChange={setBlocks} onThemeChange={setTheme} t={bt} restaurantId="" showTrail />
        );
      })()}
    </div>
  );
};
