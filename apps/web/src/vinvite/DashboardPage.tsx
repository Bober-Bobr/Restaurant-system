import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { vinviteService, type InviteProjectSummary, type InviteTemplate } from './api';
import { useViT } from './i18n';
import { buildInviteSiteUrl, inviteDomain } from '../utils/subdomain';
import { builtinTemplates, type BuiltinTemplate } from '../blocks/builtinTemplates';
import { invitationTheme } from '../blocks/seed';

// ── Main menu: the user's invitation projects ─────────────────────────────────
export const ViDashboardPage = () => {
  const t = useViT();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [creating, setCreating] = useState(false);

  const projectsQuery = useQuery({ queryKey: ['vi-projects'], queryFn: () => vinviteService.listProjects() });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => vinviteService.removeProject(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['vi-projects'] }),
  });
  const renameMutation = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => vinviteService.updateProject(id, { name }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['vi-projects'] }),
  });

  const projects = projectsQuery.data ?? [];

  return (
    <section className="vi-fade-up">
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 22, flexWrap: 'wrap' }}>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, letterSpacing: '-0.02em' }}>{t('invitations')}</h1>
        <button type="button" className="vi-btn vi-btn-primary" style={{ marginLeft: 'auto' }} onClick={() => setCreating(true)}>
          ＋ {t('new_invitation')}
        </button>
      </div>

      {projectsQuery.isLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><span className="vi-spinner" /></div>
      ) : projects.length === 0 ? (
        <div className="vi-card" style={{ padding: '56px 24px', textAlign: 'center', color: 'var(--vi-muted)', fontSize: 15 }}>
          <div style={{ fontSize: 44, marginBottom: 12 }}>💌</div>
          {t('no_projects')}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
          {projects.map((p, i) => (
            <ProjectCard
              key={p.id}
              project={p}
              delayMs={i * 60}
              onOpen={() => navigate(`/projects/${p.id}`)}
              onRename={() => {
                const name = window.prompt(t('rename'), p.name);
                if (name?.trim()) renameMutation.mutate({ id: p.id, name: name.trim() });
              }}
              onDelete={() => { if (window.confirm(t('confirm_delete'))) deleteMutation.mutate(p.id); }}
            />
          ))}
        </div>
      )}

      {creating && <NewProjectModal onClose={() => setCreating(false)} />}
    </section>
  );
};

function ProjectCard({ project, delayMs, onOpen, onRename, onDelete }: {
  project: InviteProjectSummary; delayMs: number;
  onOpen: () => void; onRename: () => void; onDelete: () => void;
}) {
  const t = useViT();
  return (
    <div className="vi-card vi-card-hover vi-fade-up" style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 10, animationDelay: `${delayMs}ms` }} onClick={onOpen}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <div style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--vi-accent-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>💌</div>
        <div style={{ minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 15.5, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{project.name}</p>
          <p style={{ margin: '3px 0 0', fontSize: 12, color: 'var(--vi-muted)' }}>
            {t('edited')} · {new Date(project.updatedAt).toLocaleDateString()}
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span className={`vi-badge ${project.isPublished ? 'vi-badge-live' : 'vi-badge-draft'}`}>
          {project.isPublished ? `● ${t('published')}` : t('draft')}
        </span>
        {project.slug && (
          <a
            href={buildInviteSiteUrl(project.slug)} target="_blank" rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
            style={{ fontSize: 12, color: 'var(--vi-accent)', textDecoration: 'none', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis' }}
          >
            {inviteDomain()}/{project.slug} ↗
          </a>
        )}
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 'auto' }} onClick={(e) => e.stopPropagation()}>
        <button type="button" className="vi-btn vi-btn-ghost" style={{ flex: 1, fontSize: 12.5, padding: '8px 10px' }} onClick={onOpen}>{t('open')}</button>
        <button type="button" className="vi-btn vi-btn-ghost" style={{ fontSize: 12.5, padding: '8px 10px' }} onClick={onRename}>✏️</button>
        <button type="button" className="vi-btn vi-btn-danger" style={{ fontSize: 12.5, padding: '8px 10px' }} onClick={onDelete}>🗑</button>
      </div>
    </div>
  );
}

// ── New-project modal: name + start blank / from a template ──────────────────
function NewProjectModal({ onClose }: { onClose: () => void }) {
  const t = useViT();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  const templatesQuery = useQuery({ queryKey: ['vi-templates'], queryFn: () => vinviteService.listTemplates() });
  const builtins = builtinTemplates('invitation');

  const create = async (source: InviteTemplate | BuiltinTemplate | null) => {
    if (busy) return;
    setBusy(true);
    try {
      const project = await vinviteService.createProject({
        name: name.trim() || t('new_invitation'),
        blocks: source ? structuredClone(source.blocks) : [],
        theme: source ? { ...source.theme } : invitationTheme({}),
      });
      queryClient.invalidateQueries({ queryKey: ['vi-projects'] });
      navigate(`/projects/${project.id}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="vi-overlay" onClick={onClose}>
      <div className="vi-card vi-pop" style={{ width: '100%', maxWidth: 480, maxHeight: '86vh', overflowY: 'auto', padding: 24 }} onClick={(e) => e.stopPropagation()}>
        <h3 style={{ margin: '0 0 16px', fontSize: 18, fontWeight: 800 }}>{t('new_invitation')}</h3>

        <label className="vi-label">{t('name')}</label>
        <input className="vi-input" value={name} onChange={(e) => setName(e.target.value)} placeholder={t('new_invitation')} autoFocus style={{ marginBottom: 18 }} />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button type="button" className="vi-btn vi-btn-primary" disabled={busy} onClick={() => create(null)} style={{ justifyContent: 'flex-start', padding: '13px 16px' }}>
            ✨ {t('start_blank')}
          </button>

          {(builtins.length > 0 || (templatesQuery.data?.length ?? 0) > 0) && (
            <p style={{ margin: '8px 0 0', fontSize: 12, fontWeight: 700, color: 'var(--vi-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('start_from_template')}</p>
          )}
          {builtins.map((tpl) => (
            <button key={tpl.id} type="button" className="vi-btn vi-btn-ghost" disabled={busy} onClick={() => create(tpl)} style={{ justifyContent: 'flex-start', padding: '12px 16px' }}>
              🎀 {tpl.name}
            </button>
          ))}
          {(templatesQuery.data ?? []).map((tpl) => (
            <button key={tpl.id} type="button" className="vi-btn vi-btn-ghost" disabled={busy} onClick={() => create(tpl)} style={{ justifyContent: 'flex-start', padding: '12px 16px' }}>
              🎨 {tpl.name}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 18 }}>
          <button type="button" className="vi-btn vi-btn-ghost" onClick={onClose}>{t('cancel')}</button>
        </div>
      </div>
    </div>
  );
}
