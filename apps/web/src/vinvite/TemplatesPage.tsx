import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { vinviteService } from './api';
import { useViT } from './i18n';
import { invitationTheme } from '../blocks/seed';

// ── Templates: fully customizable starting points for new invitations ────────
export const ViTemplatesPage = () => {
  const t = useViT();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const templatesQuery = useQuery({ queryKey: ['vi-templates'], queryFn: () => vinviteService.listTemplates() });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => vinviteService.removeTemplate(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['vi-templates'] }),
  });

  const createBlank = async () => {
    const name = window.prompt(t('template_name'));
    if (!name?.trim()) return;
    const tpl = await vinviteService.createTemplate({ name: name.trim(), blocks: [], theme: invitationTheme({}) });
    queryClient.invalidateQueries({ queryKey: ['vi-templates'] });
    navigate(`/templates/${tpl.id}/edit`);
  };

  const useTemplate = async (id: string) => {
    const tpl = await vinviteService.getTemplate(id);
    const project = await vinviteService.createProject({
      name: tpl.name,
      blocks: structuredClone(tpl.blocks),
      theme: { ...tpl.theme },
    });
    queryClient.invalidateQueries({ queryKey: ['vi-projects'] });
    navigate(`/projects/${project.id}`);
  };

  const templates = templatesQuery.data ?? [];

  return (
    <section className="vi-fade-up">
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 22, flexWrap: 'wrap' }}>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, letterSpacing: '-0.02em' }}>{t('templates')}</h1>
        <button type="button" className="vi-btn vi-btn-primary" style={{ marginLeft: 'auto' }} onClick={createBlank}>
          ＋ {t('new_template')}
        </button>
      </div>

      {templatesQuery.isLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><span className="vi-spinner" /></div>
      ) : templates.length === 0 ? (
        <div className="vi-card" style={{ padding: '56px 24px', textAlign: 'center', color: 'var(--vi-muted)', fontSize: 15 }}>
          <div style={{ fontSize: 44, marginBottom: 12 }}>🎨</div>
          {t('no_templates')}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
          {templates.map((tpl, i) => (
            <div key={tpl.id} className="vi-card vi-card-hover vi-fade-up" style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 10, animationDelay: `${i * 60}ms` }} onClick={() => navigate(`/templates/${tpl.id}/edit`)}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--vi-accent-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>🎨</div>
                <div style={{ minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: 15.5, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tpl.name}</p>
                  <p style={{ margin: '3px 0 0', fontSize: 12, color: 'var(--vi-muted)' }}>
                    {t('edited')} · {new Date(tpl.updatedAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 'auto' }} onClick={(e) => e.stopPropagation()}>
                <button type="button" className="vi-btn vi-btn-primary" style={{ flex: 1, fontSize: 12.5, padding: '8px 10px' }} onClick={() => useTemplate(tpl.id)}>✨ {t('use')}</button>
                <button type="button" className="vi-btn vi-btn-ghost" style={{ fontSize: 12.5, padding: '8px 10px' }} onClick={() => navigate(`/templates/${tpl.id}/edit`)}>✏️</button>
                <button type="button" className="vi-btn vi-btn-danger" style={{ fontSize: 12.5, padding: '8px 10px' }} onClick={() => { if (window.confirm(t('confirm_delete_tpl'))) deleteMutation.mutate(tpl.id); }}>🗑</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
};
