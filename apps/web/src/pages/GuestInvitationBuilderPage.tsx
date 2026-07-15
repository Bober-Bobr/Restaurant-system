import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import { useAuthStore } from '../store/auth.store';
import { useAdminStore } from '../store/admin.store';
import { translate } from '../utils/translate';
import { guestInvitationService, type GuestInvitation, type TrailTemplate } from '../services/guestInvitation.service';
import { designTemplateService, type DesignTheme } from '../services/designTemplate.service';
import { buildSubdomainBase } from '../utils/subdomain';
import networkingLogoSrc from '../assets/networking-logo.png';
import { BlockEditor } from '../blocks/BlockEditor';
import type { Block } from '../blocks/types';
import type { PickedDesign } from '../blocks/builtinTemplates';
import { seedInvitationBlocks, invitationTheme } from '../blocks/seed';
import { TemplateChooser, useDesignSave } from './designerShared';
import { LinkQrButton } from '../components/LinkQrButton';

function slugify(s: string): string {
  return s.toLowerCase().replace(/[\s_]+/g, '-').replace(/[^a-z0-9-]/g, '').slice(0, 60) || 'invitation';
}

export const GuestInvitationBuilderPage = () => {
  const { id } = useParams();
  const isNew = !id;
  const accessToken = useAuthStore((s) => s.accessToken);
  const role = useAuthStore((s) => s.role);
  const { locale } = useAdminStore();
  const t = (k: Parameters<typeof translate>[0], p?: Record<string, string | number>) => translate(k, locale, p);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const existingQuery = useQuery({
    queryKey: ['guest-invitation', id],
    queryFn: () => guestInvitationService.get(String(id)),
    enabled: !!accessToken && !!id,
  });
  const rsvpsQuery = useQuery({
    queryKey: ['guest-invitation-rsvps', id],
    queryFn: () => guestInvitationService.listRsvps(String(id)),
    enabled: !!accessToken && !!id,
  });

  const [blocks, setBlocks] = useState<Block[]>([]);
  const [theme, setTheme] = useState<DesignTheme>({});
  const [slug, setSlug] = useState('');
  const [isPublished, setIsPublished] = useState(true);
  const [initialized, setInitialized] = useState(false);
  const [chosen, setChosen] = useState(false); // template chooser resolved
  const [showResponses, setShowResponses] = useState(false);
  const { flash, error, setError, savedFlash } = useDesignSave();

  useEffect(() => {
    if (existingQuery.data && !initialized) {
      const inv = existingQuery.data;
      setBlocks(inv.blocks && inv.blocks.length ? inv.blocks : seedInvitationBlocks(inv));
      setTheme(invitationTheme(inv));
      setSlug(inv.slug);
      setIsPublished(inv.isPublished);
      setInitialized(true);
      setChosen(true);
    }
  }, [existingQuery.data, initialized]);

  const applyTemplate = (tpl: PickedDesign | null) => {
    if (tpl) { setBlocks(structuredClone(tpl.blocks)); setTheme({ ...tpl.theme }); }
    else { setBlocks([]); setTheme(invitationTheme({})); }
    setChosen(true);
    setInitialized(true);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const finalSlug = slug.trim() || slugify('invitation');
      const payload: Partial<GuestInvitation> = {
        slug: finalSlug,
        isPublished,
        blocks,
        accentColor: theme.accentColor ?? null,
        backgroundColor: theme.backgroundColor ?? null,
        backgroundImageUrl: theme.backgroundImageUrl ?? null,
        textColor: theme.textColor ?? null,
        textScale: theme.textScale ?? 1,
        musicUrl: theme.musicUrl ?? null,
        trailTemplate: (theme.trailTemplate as TrailTemplate) ?? 'sparkle',
        trailColor: theme.trailColor ?? null,
      };
      if (!isNew && id) return guestInvitationService.update(id, payload);
      return guestInvitationService.create(payload as Partial<GuestInvitation> & { slug: string });
    },
    onSuccess: (inv) => {
      setError(null); flash();
      queryClient.invalidateQueries({ queryKey: ['manager-guest-invitations'] });
      if (isNew) navigate(`/invitations/${inv.id}`, { replace: true });
    },
    onError: (e) => {
      if (axios.isAxiosError(e)) setError((e.response?.data as { message?: string })?.message ?? e.message);
      else if (e instanceof Error) setError(e.message); else setError('Save failed');
    },
  });

  const saveTemplate = async () => {
    const name = window.prompt(t('template_name'));
    if (!name?.trim()) return;
    await designTemplateService.create({ name: name.trim(), kind: 'invitation', blocks, theme });
    setError(null); flash();
  };

  const deleteMutation = useMutation({
    mutationFn: () => (id ? guestInvitationService.remove(id) : Promise.resolve()),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['manager-guest-invitations'] }); navigate('/invitations'); },
  });

  if (!accessToken) return <Navigate to="/login" replace />;
  if (role !== 'MANAGER' && role !== 'CHIEF_ADMIN') return <Navigate to="/login" replace />;

  const publicUrl = slug ? buildSubdomainBase(`${slug}.invitation`, '/') : '';

  // New project → show the template chooser first.
  if (isNew && !chosen) {
    return <TemplateChooser kind="invitation" t={t} onPick={applyTemplate} backLink="/invitations" />;
  }

  return (
    <div className="adm-bg">
      <DesignerTopBar
        t={t} title={t('block_designer_invitation')} subtitle={slug}
        slug={slug} onSlug={setSlug} publicUrl={publicUrl}
        isPublished={isPublished} onPublished={setIsPublished}
        saving={saveMutation.isPending} isNew={isNew}
        onSave={() => saveMutation.mutate()} onSaveTemplate={saveTemplate}
        onDelete={!isNew ? () => { if (confirm('Delete?')) deleteMutation.mutate(); } : undefined}
        extra={!isNew ? <button type="button" className="adm-btn-ghost" style={{ fontSize: 12 }} onClick={() => setShowResponses(true)}>{t('responses')} ({rsvpsQuery.data?.length ?? 0})</button> : undefined}
        backLink="/invitations"
      />

      {error && <div style={{ maxWidth: 1180, margin: '12px auto 0', padding: 12, borderRadius: 10, background: 'rgba(220,38,38,0.15)', border: '1px solid rgba(220,38,38,0.35)', color: '#fca5a5', fontSize: 13 }}>{error}</div>}
      {savedFlash && <div style={{ maxWidth: 1180, margin: '12px auto 0', padding: 12, borderRadius: 10, background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.35)', color: '#4ade80', fontSize: 13, fontWeight: 600 }}>✓ {t('save')}</div>}

      <BlockEditor kind="invitation" blocks={blocks} theme={theme} onBlocksChange={setBlocks} onThemeChange={setTheme} t={t} restaurantId="" showTrail />

      {showResponses && (
        <ResponsesPanel onClose={() => setShowResponses(false)} t={t} rsvps={rsvpsQuery.data ?? []} />
      )}
    </div>
  );
};

// ── Shared designer top bar (also used by the flyer builder) ────────────────
export function DesignerTopBar({ t, title, subtitle, slug, onSlug, publicUrl, isPublished, onPublished, saving, isNew, onSave, onSaveTemplate, onDelete, extra, backLink }: {
  t: (k: Parameters<typeof translate>[0]) => string;
  title: string; subtitle?: string;
  slug: string; onSlug: (s: string) => void; publicUrl: string;
  isPublished: boolean; onPublished: (v: boolean) => void;
  saving: boolean; isNew: boolean;
  onSave: () => void; onSaveTemplate: () => void; onDelete?: () => void;
  extra?: React.ReactNode; backLink: string;
}) {
  return (
    <nav style={{ position: 'sticky', top: 0, zIndex: 45, background: 'rgba(15,23,42,0.85)', backdropFilter: 'blur(18px)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        <Link to={backLink} style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
          <img src={networkingLogoSrc} alt="" style={{ height: 36, width: 'auto' }} />
          <div>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#f8fafc' }}>{title}</p>
            <p style={{ margin: '2px 0 0', fontSize: 11, color: 'rgba(226,232,240,0.5)' }}>{subtitle}</p>
          </div>
        </Link>

        <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 12 }}>
          <span style={{ fontSize: 11, color: 'rgba(226,232,240,0.5)' }}>/</span>
          <input value={slug} onChange={(e) => onSlug(e.target.value)} placeholder="slug"
            style={{ background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#e2e8f0', padding: '6px 10px', fontSize: 12, width: 160, outline: 'none' }} />
        </label>

        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {extra}
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#e2e8f0' }}>
            <input type="checkbox" checked={isPublished} onChange={(e) => onPublished(e.target.checked)} />
            {t('published_label')}
          </label>
          {publicUrl && <LinkQrButton url={publicUrl} filename={slug || 'invitation'} t={t} />}
          {publicUrl && <a href={publicUrl} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: '#c9a42c', textDecoration: 'none', padding: '6px 12px', borderRadius: 8, background: 'rgba(201,164,44,0.08)', border: '1px solid rgba(201,164,44,0.3)' }}>↗</a>}
          <button type="button" className="adm-btn-ghost" style={{ fontSize: 12 }} onClick={onSaveTemplate}>{t('save_as_template')}</button>
          {onDelete && <button type="button" className="adm-btn-danger" style={{ fontSize: 12 }} onClick={onDelete}>{t('delete_block')}</button>}
          <button type="button" className="adm-btn-primary" style={{ fontSize: 13 }} disabled={saving} onClick={onSave}>
            {saving ? '...' : isNew ? t('create_project') : t('save_changes')}
          </button>
        </div>
      </div>
    </nav>
  );
}

function ResponsesPanel({ onClose, t, rsvps }: { onClose: () => void; t: (k: Parameters<typeof translate>[0]) => string; rsvps: { id: string; guestName: string; attending: boolean; createdAt: string }[] }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 55, display: 'flex', justifyContent: 'flex-end' }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)' }} />
      <div style={{ position: 'relative', width: '100%', maxWidth: 380, height: '100%', overflowY: 'auto', background: 'rgba(15,23,42,0.99)', borderLeft: '1px solid rgba(255,255,255,0.1)', padding: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
          <h3 style={{ margin: 0, color: '#f8fafc', fontSize: 15 }}>{t('responses')} ({rsvps.length})</h3>
          <button type="button" onClick={onClose} style={{ width: 30, height: 30, borderRadius: 8, border: '1px solid rgba(255,255,255,0.12)', background: 'transparent', color: '#e2e8f0', cursor: 'pointer' }}>×</button>
        </div>
        {rsvps.length === 0 ? <p style={{ color: 'rgba(226,232,240,0.5)', fontSize: 13 }}>—</p> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {rsvps.map((r) => (
              <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 10, background: 'rgba(15,23,42,0.5)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <span style={{ flex: 1, color: '#f8fafc', fontSize: 13 }}>{r.guestName}</span>
                <span className="adm-badge" style={{ background: r.attending ? 'rgba(34,197,94,0.15)' : 'rgba(220,38,38,0.15)', color: r.attending ? '#4ade80' : '#fca5a5', border: `1px solid ${r.attending ? 'rgba(34,197,94,0.35)' : 'rgba(220,38,38,0.35)'}` }}>{r.attending ? '✓' : '✕'}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
