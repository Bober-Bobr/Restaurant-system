import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import QRCode from 'qrcode';
import { vinviteService, type InviteProjectSummary } from './api';
import { useViT, type ViKey } from './i18n';
import { buildInviteSiteUrl, inviteDomain } from '../utils/subdomain';
import { getTemplate, readRichDesign, richEventDateISO } from './templates';

// ── Main menu: the user's invitation projects ─────────────────────────────────
export const ViDashboardPage = () => {
  const t = useViT();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const projectsQuery = useQuery({ queryKey: ['vi-projects'], queryFn: () => vinviteService.listProjects() });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => vinviteService.removeProject(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['vi-projects'] }),
  });
  const publishMutation = useMutation({
    mutationFn: ({ id, isPublished }: { id: string; isPublished: boolean }) => vinviteService.updateProject(id, { isPublished }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['vi-projects'] }),
  });

  const projects = projectsQuery.data ?? [];

  return (
    <section className="vi-fade-up">
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 22, flexWrap: 'wrap' }}>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, letterSpacing: '-0.02em' }}>{t('invitations')}</h1>
        {/* New invitations always begin from a ready-made template. */}
        <button type="button" className="vi-btn vi-btn-primary" style={{ marginLeft: 'auto' }} onClick={() => navigate('/templates')}>
          ＋ {t('new_invitation')}
        </button>
      </div>

      {projectsQuery.isLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><span className="vi-spinner" /></div>
      ) : projects.length === 0 ? (
        <div className="vi-card" style={{ padding: '56px 24px', textAlign: 'center', color: 'var(--vi-muted)', fontSize: 15 }}>
          <div style={{ fontSize: 44, marginBottom: 12 }}>💌</div>
          <p style={{ margin: '0 0 16px' }}>{t('no_projects')}</p>
          <button type="button" className="vi-btn vi-btn-primary" onClick={() => navigate('/templates')}>🎨 {t('browse_templates')}</button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 18 }}>
          {projects.map((p, i) => (
            <ProjectCard
              key={p.id}
              project={p}
              delayMs={i * 60}
              onDelete={() => { if (window.confirm(t('confirm_delete'))) deleteMutation.mutate(p.id); }}
              onPublishToggle={(isPublished) => publishMutation.mutate({ id: p.id, isPublished })}
            />
          ))}
        </div>
      )}
    </section>
  );
};

function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()}`;
}

function daysUntil(iso: string): number | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return Math.max(0, Math.ceil((d.getTime() - Date.now()) / 86400000));
}

// ── One invitation: a rich stat + share card ─────────────────────────────────
function ProjectCard({ project, delayMs, onDelete, onPublishToggle }: {
  project: InviteProjectSummary; delayMs: number;
  onDelete: () => void; onPublishToggle: (isPublished: boolean) => void;
}) {
  const t = useViT();
  const navigate = useNavigate();

  const rich = readRichDesign(project.theme);
  const template = rich ? getTemplate(rich.templateId) : null;
  const eventISO = rich ? richEventDateISO(rich) : null;
  const dateStr = eventISO ? fmtDate(eventISO) : null;
  const days = eventISO ? daysUntil(eventISO) : null;

  const publicUrl = project.slug ? buildInviteSiteUrl(project.slug) : '';
  const canShare = project.isPublished && !!publicUrl;

  const openRsvp = () => navigate(`/projects/${project.id}?tab=rsvp`);

  const activate = () => {
    if (project.isPublished) { onPublishToggle(false); return; }
    if (!project.slug) { navigate(`/projects/${project.id}`); return; } // pick a link first
    onPublishToggle(true);
  };

  return (
    <div className="vi-card vi-fade-up" style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 16, animationDelay: `${delayMs}ms` }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ width: 46, height: 46, borderRadius: 13, background: template ? `${template.accent}22` : 'var(--vi-accent-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>
          {template?.cover ?? '💌'}
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <p style={{ margin: 0, fontSize: 17, fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', letterSpacing: '-0.01em' }}>{project.name}</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
            {dateStr && <span style={{ fontSize: 12, color: 'var(--vi-muted)', fontWeight: 600 }}>{t('date_lbl')}: {dateStr}</span>}
            <span className={`vi-badge ${project.isPublished ? 'vi-badge-live' : 'vi-badge-draft'}`}>
              {project.isPublished ? `● ${t('published')}` : t('draft')}
            </span>
          </div>
          {template && (
            <p style={{ margin: '5px 0 0', fontSize: 10.5, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--vi-muted)' }}>
              {t('template_lbl')}: {t(template.nameKey as ViKey)}
            </p>
          )}
        </div>
        <button type="button" className="vi-icon-btn" title={t('delete')} onClick={onDelete} style={{ color: 'var(--vi-danger)' }}>🗑</button>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
        <StatTile icon="👁" value={String(project.views)} label={t('views')} />
        <StatTile icon="👥" value={String(project.guestCount)} label={t('guests_lbl')} />
        <StatTile icon="⏳" value={days === null ? '—' : String(days)} label={t('days_left')} />
      </div>

      {/* Quick share */}
      <div>
        <p style={{ margin: '0 0 7px', fontSize: 10.5, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--vi-muted)' }}>{t('quick_share')}</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
          <CopyShare url={publicUrl} disabled={!canShare} label={t('copy_link')} copiedLabel={t('copied')} />
          <ShareTile
            icon="✈️" label="Telegram" disabled={!canShare}
            onClick={() => window.open(`https://t.me/share/url?url=${encodeURIComponent(publicUrl)}&text=${encodeURIComponent(project.name)}`, '_blank', 'noopener')}
          />
          <ShareTile
            icon="💬" label="WhatsApp" disabled={!canShare}
            onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(`${project.name} — ${publicUrl}`)}`, '_blank', 'noopener')}
          />
          <QrShare url={publicUrl} disabled={!canShare} label={t('qr_code')} title={project.name} scanLabel={t('scan_to_open')} />
        </div>
        {!canShare && <p style={{ margin: '7px 0 0', fontSize: 11.5, color: 'var(--vi-muted)' }}>{t('share_hint')}</p>}
      </div>

      {/* Responses */}
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="button" className="vi-btn vi-btn-ghost" style={{ flex: 1, fontSize: 12.5, padding: '9px 8px' }} onClick={openRsvp}>💬 {t('wishes')} ({project.wishCount})</button>
        <button type="button" className="vi-btn vi-btn-ghost" style={{ flex: 1, fontSize: 12.5, padding: '9px 8px' }} onClick={openRsvp}>👥 {t('guests_lbl')} ({project.rsvpCount})</button>
      </div>

      {/* View / Edit */}
      <div style={{ display: 'flex', gap: 8 }}>
        <a
          href={canShare ? publicUrl : undefined} target="_blank" rel="noreferrer"
          className="vi-btn vi-btn-ghost"
          aria-disabled={!canShare}
          onClick={(e) => { if (!canShare) e.preventDefault(); }}
          style={{ flex: 1, fontSize: 12.5, padding: '9px 8px', opacity: canShare ? 1 : 0.5, pointerEvents: canShare ? 'auto' : 'none' }}
        >
          👁 {t('view')}
        </a>
        <button type="button" className="vi-btn vi-btn-ghost" style={{ flex: 1, fontSize: 12.5, padding: '9px 8px' }} onClick={() => navigate(`/projects/${project.id}`)}>✏️ {t('edit')}</button>
      </div>

      {/* Activate */}
      <button
        type="button"
        onClick={activate}
        className="vi-btn"
        style={{
          fontSize: 14, fontWeight: 800, padding: '13px', letterSpacing: '0.02em',
          background: project.isPublished ? 'rgba(34,197,94,0.14)' : 'linear-gradient(135deg, #d4a94a, #b6892f)',
          color: project.isPublished ? '#16a34a' : '#fff',
          border: project.isPublished ? '1px solid rgba(34,197,94,0.4)' : 'none',
          boxShadow: project.isPublished ? 'none' : '0 8px 22px rgba(182,137,47,0.35)',
        }}
      >
        {project.isPublished ? `✓ ${t('active')}` : `⚡ ${t('activate')}`}
      </button>
      {project.slug && (
        <a
          href={publicUrl} target="_blank" rel="noreferrer"
          onClick={(e) => e.stopPropagation()}
          style={{ fontSize: 11.5, color: 'var(--vi-accent)', textDecoration: 'none', fontWeight: 600, textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis' }}
        >
          {inviteDomain()}/{project.slug} ↗
        </a>
      )}
    </div>
  );
}

function StatTile({ icon, value, label }: { icon: string; value: string; label: string }) {
  return (
    <div style={{ padding: '11px 6px', borderRadius: 12, background: 'var(--vi-bg-soft)', border: '1px solid var(--vi-border)', textAlign: 'center' }}>
      <div style={{ fontSize: 14, color: 'var(--vi-accent)' }}>{icon}</div>
      <div style={{ fontSize: 19, fontWeight: 800, marginTop: 2 }}>{value}</div>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--vi-muted)', marginTop: 1 }}>{label}</div>
    </div>
  );
}

function ShareTile({ icon, label, onClick, disabled }: { icon: string; label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button" onClick={onClick} disabled={disabled} title={label}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, padding: '9px 4px',
        borderRadius: 11, background: 'var(--vi-bg-soft)', border: '1px solid var(--vi-border)',
        color: 'var(--vi-text)', cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.45 : 1,
        fontSize: 10.5, fontWeight: 600, fontFamily: 'inherit', transition: 'border-color 0.2s ease, background 0.2s ease',
      }}
      onMouseEnter={(e) => { if (!disabled) e.currentTarget.style.borderColor = 'var(--vi-ring)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--vi-border)'; }}
    >
      <span style={{ fontSize: 16 }}>{icon}</span>
      {label}
    </button>
  );
}

function CopyShare({ url, disabled, label, copiedLabel }: { url: string; disabled?: boolean; label: string; copiedLabel: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* clipboard unavailable */ }
  };
  return <ShareTile icon={copied ? '✓' : '📋'} label={copied ? copiedLabel : label} onClick={copy} disabled={disabled} />;
}

// Compact QR button + modal (reuses the `qrcode` lib already bundled).
function QrShare({ url, disabled, label, title, scanLabel }: { url: string; disabled?: boolean; label: string; title: string; scanLabel: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <ShareTile icon="🔳" label={label} onClick={() => setOpen(true)} disabled={disabled} />
      {open && <QrModal url={url} title={title} scanLabel={scanLabel} onClose={() => setOpen(false)} />}
    </>
  );
}

function QrModal({ url, title, scanLabel, onClose }: { url: string; title: string; scanLabel: string; onClose: () => void }) {
  const [qr, setQr] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    QRCode.toDataURL(url, { width: 460, margin: 2, errorCorrectionLevel: 'H', color: { dark: '#0b1120', light: '#ffffff' } })
      .then((d) => { if (alive) setQr(d); })
      .catch(() => { if (alive) setQr(null); });
    return () => { alive = false; };
  }, [url]);

  return createPortal(
    <div className="vi-overlay" onClick={onClose}>
      <div className="vi-card vi-pop" style={{ padding: 22, width: '100%', maxWidth: 340, textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
        <h3 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 800 }}>{title}</h3>
        <p style={{ margin: '0 0 16px', fontSize: 12.5, color: 'var(--vi-muted)' }}>{scanLabel}</p>
        <div style={{ display: 'inline-block', padding: 12, background: '#fff', borderRadius: 16, boxShadow: 'var(--vi-shadow)' }}>
          {qr ? <img src={qr} alt="QR" style={{ display: 'block', width: 220, height: 220 }} /> : <div style={{ width: 220, height: 220 }} />}
        </div>
        <button type="button" className="vi-btn vi-btn-ghost" style={{ marginTop: 16, width: '100%' }} onClick={onClose}>OK</button>
      </div>
    </div>,
    document.body,
  );
}
