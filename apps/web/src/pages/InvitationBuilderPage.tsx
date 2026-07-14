import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import { useAuthStore } from '../store/auth.store';
import { useAdminStore } from '../store/admin.store';
import { translate } from '../utils/translate';
import { invitationService, type Invitation, type InvitationRequest } from '../services/invitation.service';
import { type DesignTheme, designTemplateService } from '../services/designTemplate.service';
import { buildSubdomainBase } from '../utils/subdomain';
import { BlockEditor } from '../blocks/BlockEditor';
import type { Block } from '../blocks/types';
import type { PickedDesign } from '../blocks/builtinTemplates';
import { seedFlyerBlocks, flyerTheme } from '../blocks/seed';
import { TemplateChooser, useDesignSave } from './designerShared';
import { LinkQrButton } from '../components/LinkQrButton';
import networkingLogoSrc from '../assets/networking-logo.png';

type TFn = (k: Parameters<typeof translate>[0], p?: Record<string, string | number>) => string;

// Subdomain-safe slug: the flyer publishes at <slug>.event.v-menu.uz.
function slugify(s: string): string {
  return s.toLowerCase().replace(/[\s_]+/g, '-').replace(/[^a-z0-9-]/g, '').replace(/^-+|-+$/g, '').slice(0, 60) || 'flyer';
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
  const { flash, error, setError, savedFlash } = useDesignSave();

  const existing = existingQuery.data;
  const isEditing = !!existing;

  // Switching to another flyer (or to /flyers/new) re-seeds the editor state.
  useEffect(() => {
    setInitialized(false);
    setChosen(false);
  }, [flyerId]);

  useEffect(() => {
    if (existing && !initialized) {
      setBlocks(existing.blocks && existing.blocks.length ? existing.blocks : seedFlyerBlocks(existing));
      setTheme(flyerTheme(existing));
      setSlug(existing.slug);
      setIsPublished(existing.isPublished);
      setInitialized(true);
      setChosen(true);
    } else if (!flyerId && !initialized) {
      // Brand-new project → a unique default slug the manager can edit.
      setBlocks([]);
      setTheme(flyerTheme({}));
      setSlug(slugify(`flyer-${Math.random().toString(36).slice(2, 8)}`));
      setIsPublished(false);
      setInitialized(true);
    }
  }, [existing, initialized, flyerId]);

  const applyTemplate = (tpl: PickedDesign | null) => {
    if (tpl) { setBlocks(structuredClone(tpl.blocks)); setTheme({ ...tpl.theme }); }
    else { setBlocks([]); setTheme(flyerTheme({})); }
    setChosen(true);
  };

  const saveMutation = useMutation({
    mutationFn: async (overrides?: { isPublished?: boolean }) => {
      const finalSlug = slugify(slug.trim() || 'flyer');
      const payload: Partial<Invitation> = {
        slug: finalSlug,
        isPublished: overrides?.isPublished ?? isPublished,
        blocks,
        accentColor: theme.accentColor ?? null,
        backgroundColor: theme.backgroundColor ?? null,
        backgroundImageUrl: theme.backgroundImageUrl ?? null,
        musicUrl: theme.musicUrl ?? null,
      };
      if (isEditing && existing) return invitationService.update(existing.id, payload);
      return invitationService.create({ ...payload, slug: finalSlug });
    },
    onSuccess: (inv) => {
      setError(null); flash();
      setSlug(inv.slug);
      setIsPublished(inv.isPublished);
      queryClient.setQueryData(['flyer', inv.id], inv);
      queryClient.invalidateQueries({ queryKey: ['manager-my-flyers'] });
      if (!flyerId) navigate(`/flyers/${inv.id}`, { replace: true });
    },
    onError: (e) => {
      if (axios.isAxiosError(e)) setError((e.response?.data as { message?: string })?.message ?? e.message);
      else if (e instanceof Error) setError(e.message); else setError('Save failed');
    },
  });

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

  const publicUrl = slug ? buildSubdomainBase(`${slugify(slug)}.event`, '/') : '';

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
        onPublishToggle={() => saveMutation.mutate({ isPublished: !isPublished })}
        saving={saveMutation.isPending} isNew={!isEditing}
        onSave={() => saveMutation.mutate(undefined)}
        onSaveTemplate={saveTemplate}
        onDelete={isEditing ? () => { if (confirm('Delete?')) deleteMutation.mutate(); } : undefined}
        flyers={myFlyersQuery.data ?? []}
        currentId={flyerId}
        onSwitch={(id) => navigate(id === '__new' ? '/flyers/new' : `/flyers/${id}`)}
        extra={isEditing && existing ? <RequestsButton invitationId={existing.id} t={t} /> : undefined}
      />

      {error && <div style={{ maxWidth: 1180, margin: '12px auto 0', padding: 12, borderRadius: 10, background: 'rgba(220,38,38,0.15)', border: '1px solid rgba(220,38,38,0.35)', color: '#fca5a5', fontSize: 13 }}>{error}</div>}
      {savedFlash && <div style={{ maxWidth: 1180, margin: '12px auto 0', padding: 12, borderRadius: 10, background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.35)', color: '#4ade80', fontSize: 13, fontWeight: 600 }}>✓ {t('save')}</div>}

      <BlockEditor kind="flyer" blocks={blocks} theme={theme} onBlocksChange={setBlocks} onThemeChange={setTheme} t={t} restaurantId="" />
    </div>
  );
};

// ── Flyer top bar: full-size link + publish, project switcher on the right ──
function FlyerTopBar({ t, slug, onSlug, publicUrl, isPublished, onPublishToggle, saving, isNew, onSave, onSaveTemplate, onDelete, flyers, currentId, onSwitch, extra }: {
  t: TFn;
  slug: string; onSlug: (s: string) => void; publicUrl: string;
  isPublished: boolean; onPublishToggle: () => void;
  saving: boolean; isNew: boolean;
  onSave: () => void; onSaveTemplate: () => void; onDelete?: () => void;
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
  const suffix = publicUrl ? `.${publicUrl.replace(/^https:\/\/[^.]*\./, '').replace(/\/$/, '')}` : '.event.v-menu.uz';

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
            {extra}
            <button type="button" className="adm-btn-ghost" style={{ fontSize: 12 }} onClick={onSaveTemplate}>{t('save_as_template')}</button>
            {onDelete && <button type="button" className="adm-btn-danger" style={{ fontSize: 12 }} onClick={onDelete}>{t('delete_block')}</button>}
            <button type="button" className="adm-btn-primary" style={{ fontSize: 13 }} disabled={saving} onClick={onSave}>
              {saving ? '...' : isNew ? t('create_project') : t('save_changes')}
            </button>
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
            <span style={{ fontSize: 13, color: '#c9a42c' }}>https://</span>
            <input
              value={slug}
              onChange={(e) => onSlug(e.target.value)}
              placeholder="my-flyer"
              style={{ flex: '0 1 auto', width: Math.max(60, slug.length * 8 + 16), minWidth: 60, background: 'rgba(201,164,44,0.08)', border: '1px solid rgba(201,164,44,0.3)', borderRadius: 6, color: '#c9a42c', padding: '3px 8px', fontSize: 13, fontWeight: 600, outline: 'none' }}
            />
            <span style={{ fontSize: 13, color: '#c9a42c', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{suffix}</span>
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
            disabled={saving}
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

// Top-bar button that opens the call-back leads captured from this flyer's form block.
function RequestsButton({ invitationId, t }: { invitationId: string; t: (k: Parameters<typeof translate>[0]) => string }) {
  const [open, setOpen] = useState(false);
  const { data: requests = [] } = useQuery({
    queryKey: ['invitation-requests', invitationId],
    queryFn: () => invitationService.listRequests(invitationId),
    enabled: open,
  });
  return (
    <>
      <button type="button" className="adm-btn-ghost" style={{ fontSize: 12 }} onClick={() => setOpen(true)}>
        {t('flyer_requests')}
      </button>
      {open && (
        <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 520, maxHeight: '80vh', overflowY: 'auto', borderRadius: 18, background: 'rgba(15,23,42,0.98)', border: '1px solid rgba(255,255,255,0.12)', padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <h3 style={{ margin: 0, color: '#f8fafc', fontSize: 16 }}>{t('flyer_requests')} · {requests.length}</h3>
              <button type="button" onClick={() => setOpen(false)} style={{ width: 30, height: 30, borderRadius: 8, border: '1px solid rgba(255,255,255,0.12)', background: 'transparent', color: '#e2e8f0', cursor: 'pointer' }}>×</button>
            </div>
            {requests.length === 0 ? (
              <p style={{ margin: 0, color: 'rgba(226,232,240,0.6)', fontSize: 13 }}>{t('no_requests')}</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {requests.map((r: InvitationRequest) => (
                  <div key={r.id} style={{ padding: 12, borderRadius: 10, background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(255,255,255,0.08)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                      <span style={{ color: '#f8fafc', fontWeight: 600, fontSize: 14 }}>{r.name}</span>
                      <a href={`tel:${r.phone}`} style={{ color: '#c9a42c', fontSize: 13, textDecoration: 'none' }}>{r.phone}</a>
                    </div>
                    {r.message && <p style={{ margin: '6px 0 0', color: 'rgba(226,232,240,0.75)', fontSize: 13 }}>{r.message}</p>}
                    <p style={{ margin: '6px 0 0', color: 'rgba(226,232,240,0.4)', fontSize: 11 }}>{new Date(r.createdAt).toLocaleString()}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
