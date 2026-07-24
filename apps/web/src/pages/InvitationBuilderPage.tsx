import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import { useAuthStore } from '../store/auth.store';
import { useAdminStore } from '../store/admin.store';
import { translate } from '../utils/translate';
import { invitationService, type Invitation } from '../services/invitation.service';
import { type DesignTheme, designTemplateService } from '../services/designTemplate.service';
import { buildSubdomainBase } from '../utils/subdomain';
import { BlockEditor } from '../blocks/BlockEditor';
import type { Block } from '../blocks/types';
import type { PickedDesign } from '../blocks/builtinTemplates';
import { seedFlyerBlocks, flyerTheme } from '../blocks/seed';
import { TemplateChooser, useDesignSave } from './designerShared';
import { LinkQrButton } from '../components/LinkQrButton';
import { TelegramConnectButton } from '../components/TelegramConnectButton';
import networkingLogoSrc from '../assets/networking-logo.png';

type TFn = (k: Parameters<typeof translate>[0], p?: Record<string, string | number>) => string;

// Subdomain-safe slug: the flyer publishes at <slug>.event.v-menu.uz.
function slugify(s: string): string {
  return s.toLowerCase().replace(/[\s_]+/g, '-').replace(/[^a-z0-9-]/g, '').replace(/^-+|-+$/g, '').slice(0, 60) || 'flyer';
}

type SaveState = 'idle' | 'saving' | 'saved';

// A stable signature of everything that gets persisted — used to detect changes
// for auto-save and to avoid re-saving an unchanged flyer.
function flyerSig(slug: string, isPublished: boolean, blocks: Block[], theme: DesignTheme): string {
  return JSON.stringify({ slug: slugify(slug), isPublished, blocks, theme });
}

// ── Flyer project editor: /flyers/new and /flyers/:flyerId ──────────────────
// Flyers are standalone projects (no restaurant/event linkage). The top bar
// shows the full public link with a publish button, plus a dropdown to switch
// between the manager's flyer projects.
export const InvitationBuilderPage = () => {
  const { flyerId = '' } = useParams();
  const accessToken = useAuthStore((s) => s.accessToken);
  const role = useAuthStore((s) => s.role);
  const { locale } = useAdminStore();
  const t: TFn = (k, p) => translate(k, locale, p);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const myFlyersQuery = useQuery({ queryKey: ['manager-my-flyers'], queryFn: () => invitationService.listMine(), enabled: !!accessToken });
  const existingQuery = useQuery({ queryKey: ['flyer', flyerId], queryFn: () => invitationService.get(flyerId), enabled: !!accessToken && !!flyerId });

  const [blocks, setBlocks] = useState<Block[]>([]);
  const [theme, setTheme] = useState<DesignTheme>({});
  const [slug, setSlug] = useState('');
  const [isPublished, setIsPublished] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [chosen, setChosen] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const { flash, error, setError, savedFlash } = useDesignSave();

  // Signature of the last-persisted state; changes vs the current signature drive
  // auto-save. `pendingSig` holds the signature of the in-flight save.
  const savedSigRef = useRef<string>('');
  const pendingSigRef = useRef<string>('');

  const existing = existingQuery.data;
  const isEditing = !!existing;

  // Switching to another flyer (or to /flyers/new) re-seeds the editor state.
  useEffect(() => {
    setInitialized(false);
    setChosen(false);
  }, [flyerId]);

  useEffect(() => {
    if (existing && !initialized) {
      const loadedBlocks = existing.blocks && existing.blocks.length ? existing.blocks : seedFlyerBlocks(existing);
      const loadedTheme = flyerTheme(existing);
      setBlocks(loadedBlocks);
      setTheme(loadedTheme);
      setSlug(existing.slug);
      setIsPublished(existing.isPublished);
      savedSigRef.current = flyerSig(existing.slug, existing.isPublished, loadedBlocks, loadedTheme);
      setInitialized(true);
      setChosen(true);
    } else if (!flyerId && !initialized) {
      // Brand-new project → a unique default slug the manager can edit.
      const s = slugify(`flyer-${Math.random().toString(36).slice(2, 8)}`);
      setBlocks([]);
      setTheme(flyerTheme({}));
      setSlug(s);
      setIsPublished(false);
      // Empty-flyer baseline: no auto-create until the manager actually edits.
      savedSigRef.current = flyerSig(s, false, [], flyerTheme({}));
      setInitialized(true);
    }
  }, [existing, initialized, flyerId]);

  const applyTemplate = (tpl: PickedDesign | null) => {
    if (tpl) { setBlocks(structuredClone(tpl.blocks)); setTheme({ ...tpl.theme }); }
    else { setBlocks([]); setTheme(flyerTheme({})); }
    setChosen(true);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const finalSlug = slugify(slug.trim() || 'flyer');
      pendingSigRef.current = flyerSig(finalSlug, isPublished, blocks, theme);
      const payload: Partial<Invitation> = {
        slug: finalSlug,
        isPublished,
        blocks,
        accentColor: theme.accentColor ?? null,
        backgroundColor: theme.backgroundColor ?? null,
        backgroundImageUrl: theme.backgroundImageUrl ?? null,
        textColor: theme.textColor ?? null,
        textScale: theme.textScale ?? 1,
        particles: theme.particles ?? null,
        particlesImageUrl: theme.particlesImageUrl ?? null,
        particlesColor: theme.particlesColor ?? null,
        trailTemplate: theme.trailTemplate ?? null,
        trailColor: theme.trailColor ?? null,
        trailImageUrl: theme.trailImageUrl ?? null,
        musicUrl: theme.musicUrl ?? null,
      };
      if (isEditing && existing) return invitationService.update(existing.id, payload);
      return invitationService.create({ ...payload, slug: finalSlug });
    },
    onSuccess: (inv) => {
      setError(null);
      savedSigRef.current = pendingSigRef.current;
      setSaveState('saved');
      queryClient.setQueryData(['flyer', inv.id], inv);
      queryClient.invalidateQueries({ queryKey: ['manager-my-flyers'] });
      if (!flyerId) navigate(`/flyers/${inv.id}`, { replace: true });
    },
    onError: (e) => {
      setSaveState('idle');
      if (axios.isAxiosError(e)) setError((e.response?.data as { message?: string })?.message ?? e.message);
      else if (e instanceof Error) setError(e.message); else setError('Save failed');
    },
  });

  // ── Auto-save: debounce changes and persist automatically ──────────────────
  const currentSig = flyerSig(slug, isPublished, blocks, theme);
  useEffect(() => {
    if (!initialized || !chosen || !slug.trim()) return;
    if (currentSig === savedSigRef.current) { setSaveState((s) => (s === 'saving' ? 'saved' : s)); return; }
    setSaveState('saving');
    const h = window.setTimeout(() => saveMutation.mutate(), 900);
    return () => window.clearTimeout(h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSig, initialized, chosen]);

  const saveTemplate = async () => {
    const name = window.prompt(t('template_name'));
    if (!name?.trim()) return;
    await designTemplateService.create({ name: name.trim(), kind: 'flyer', blocks, theme });
    setError(null); flash();
  };

  const deleteMutation = useMutation({
    mutationFn: () => existing ? invitationService.remove(existing.id) : Promise.resolve(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['manager-my-flyers'] });
      navigate('/');
    },
  });

  if (!accessToken) return <Navigate to="/login" replace />;
  if (role !== 'MANAGER' && role !== 'CHIEF_ADMIN') return <Navigate to="/login" replace />;

  // Path-based flyer link: event.v-menu.uz/<slug> (the .uz registrar has no
  // wildcard DNS, matching the v-invite scheme).
  const publicUrl = slug ? buildSubdomainBase('event', `/${slugify(slug)}`) : '';

  // New flyer → template chooser first.
  if (!flyerId && !chosen) {
    return <TemplateChooser kind="flyer" t={t} onPick={applyTemplate} backLink="/" />;
  }

  return (
    <div className="adm-bg">
      <FlyerTopBar
        t={t}
        slug={slug} onSlug={setSlug} publicUrl={publicUrl}
        isPublished={isPublished}
        onPublishToggle={() => setIsPublished((v) => !v)}
        saveState={saveState}
        onSaveTemplate={saveTemplate}
        onDelete={isEditing ? () => { if (confirm('Delete?')) deleteMutation.mutate(); } : undefined}
        flyers={myFlyersQuery.data ?? []}
        currentId={flyerId}
        onSwitch={(id) => navigate(id === '__new' ? '/flyers/new' : `/flyers/${id}`)}
        extra={isEditing && existing ? (
          <>
            <RequestsButton invitationId={existing.id} t={t} />
            {blocks.some((b) => b.type === 'form') && (
              <TelegramConnectButton
                id={existing.id}
                t={t}
                queryKey="flyer-telegram"
                api={{
                  status: invitationService.telegramStatus,
                  rotate: invitationService.telegramRotate,
                  removeLink: invitationService.telegramRemoveLink,
                }}
              />
            )}
          </>
        ) : undefined}
      />

      {error && <div style={{ maxWidth: 1180, margin: '12px auto 0', padding: 12, borderRadius: 10, background: 'rgba(220,38,38,0.15)', border: '1px solid rgba(220,38,38,0.35)', color: '#fca5a5', fontSize: 13 }}>{error}</div>}
      {savedFlash && <div style={{ maxWidth: 1180, margin: '12px auto 0', padding: 12, borderRadius: 10, background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.35)', color: '#4ade80', fontSize: 13, fontWeight: 600 }}>✓ {t('save')}</div>}

      <BlockEditor kind="flyer" blocks={blocks} theme={theme} onBlocksChange={setBlocks} onThemeChange={setTheme} t={t} restaurantId="" showTrail />
    </div>
  );
};

// ── Flyer top bar: full-size link + publish, project switcher on the right ──
function FlyerTopBar({ t, slug, onSlug, publicUrl, isPublished, onPublishToggle, saveState, onSaveTemplate, onDelete, flyers, currentId, onSwitch, extra }: {
  t: TFn;
  slug: string; onSlug: (s: string) => void; publicUrl: string;
  isPublished: boolean; onPublishToggle: () => void;
  saveState: SaveState;
  onSaveTemplate: () => void; onDelete?: () => void;
  flyers: Invitation[]; currentId: string; onSwitch: (id: string) => void;
  extra?: React.ReactNode;
}) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch { /* clipboard unavailable */ }
  };
  // Path-based link prefix: https://event.v-menu.uz/  (slug appended after it).
  const linkPrefix = buildSubdomainBase('event', '/');

  return (
    <nav style={{ position: 'sticky', top: 0, zIndex: 45, background: 'rgba(15,23,42,0.85)', backdropFilter: 'blur(18px)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '10px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {/* Row 1: identity + actions + project switcher (top-right) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
            <img src={networkingLogoSrc} alt="" style={{ height: 34, width: 'auto' }} />
            <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#f8fafc' }}>{t('block_designer_flyer')}</p>
          </Link>

          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            {/* Auto-save status (replaces the old manual Save button) */}
            <span style={{ fontSize: 12, color: saveState === 'saved' ? '#4ade80' : 'rgba(226,232,240,0.55)', whiteSpace: 'nowrap', minWidth: 92, textAlign: 'right' }}>
              {saveState === 'saving' ? `⟳ ${t('saving')}` : saveState === 'saved' ? `✓ ${t('saved')}` : ''}
            </span>
            {extra}
            <button type="button" className="adm-btn-ghost" style={{ fontSize: 12 }} onClick={onSaveTemplate}>{t('save_as_template')}</button>
            {onDelete && <button type="button" className="adm-btn-danger" style={{ fontSize: 12 }} onClick={onDelete}>{t('delete_block')}</button>}
            {/* Project switcher */}
            <select
              value={currentId || '__current'}
              onChange={(e) => { if (e.target.value !== '__current') onSwitch(e.target.value); }}
              title={t('my_flyers')}
              style={{
                background: 'rgba(15,23,42,0.9)', border: '1px solid rgba(255,255,255,0.14)', borderRadius: 8,
                color: '#e2e8f0', padding: '8px 10px', fontSize: 12, outline: 'none', cursor: 'pointer', maxWidth: 170, colorScheme: 'dark',
              }}
            >
              {!currentId && <option value="__current">{t('new_flyer')}</option>}
              {flyers.map((f) => <option key={f.id} value={f.id}>{f.slug}</option>)}
              <option value="__new">＋ {t('new_flyer')}</option>
            </select>
          </div>
        </div>

        {/* Row 2: full-size public link + publish */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div style={{
            flex: 1, minWidth: 260, display: 'flex', alignItems: 'center', gap: 6,
            background: 'rgba(15,23,42,0.7)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '8px 12px',
          }}>
            <span style={{ fontSize: 13, color: 'rgba(226,232,240,0.55)', whiteSpace: 'nowrap' }}>{t('my_link')}:</span>
            <span style={{ fontSize: 13, color: '#c9a42c', whiteSpace: 'nowrap' }}>{linkPrefix}</span>
            <input
              value={slug}
              onChange={(e) => onSlug(e.target.value)}
              placeholder="my-flyer"
              style={{ flex: '0 1 auto', width: Math.max(60, slug.length * 8 + 16), minWidth: 60, background: 'rgba(201,164,44,0.08)', border: '1px solid rgba(201,164,44,0.3)', borderRadius: 6, color: '#c9a42c', padding: '3px 8px', fontSize: 13, fontWeight: 600, outline: 'none' }}
            />
            <span style={{ flex: 1 }} />
            <button type="button" className="adm-btn-ghost" style={{ fontSize: 11, padding: '5px 10px' }} onClick={copy} disabled={!publicUrl}>
              {copied ? `✓ ${t('copied')}` : t('copy_link')}
            </button>
            {publicUrl && <LinkQrButton url={publicUrl} filename={slug || 'flyer'} t={t} />}
            {publicUrl && (
              <a href={publicUrl} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: '#c9a42c', textDecoration: 'none', padding: '5px 10px', borderRadius: 8, background: 'rgba(201,164,44,0.08)', border: '1px solid rgba(201,164,44,0.3)' }}>↗</a>
            )}
          </div>
          <button
            type="button"
            onClick={onPublishToggle}
            className={isPublished ? 'adm-btn-ghost' : 'adm-btn-primary'}
            style={{ fontSize: 13, ...(isPublished ? { color: '#4ade80', borderColor: 'rgba(34,197,94,0.4)' } : {}) }}
          >
            {isPublished ? `✓ ${t('published_label')}` : t('publish')}
          </button>
        </div>
      </div>
    </nav>
  );
}

// Top-bar link to the flyer's requests page (table of all form submissions).
function RequestsButton({ invitationId, t }: { invitationId: string; t: (k: Parameters<typeof translate>[0]) => string }) {
  return (
    <Link to={`/flyers/${invitationId}/requests`} className="adm-btn-ghost" style={{ fontSize: 12, textDecoration: 'none' }}>
      {t('flyer_requests')}
    </Link>
  );
}
