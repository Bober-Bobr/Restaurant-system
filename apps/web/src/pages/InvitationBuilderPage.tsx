import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import { useAuthStore } from '../store/auth.store';
import { useAdminStore } from '../store/admin.store';
import { translate } from '../utils/translate';
import { eventService } from '../services/event.service';
import { restaurantService } from '../services/restaurant.service';
import { invitationService, type Invitation, type InvitationRequest } from '../services/invitation.service';
import { type DesignTheme, designTemplateService } from '../services/designTemplate.service';
import { buildSubdomainBase } from '../utils/subdomain';
import { BlockEditor } from '../blocks/BlockEditor';
import type { Block } from '../blocks/types';
import type { PickedDesign } from '../blocks/builtinTemplates';
import { seedFlyerBlocks, flyerTheme } from '../blocks/seed';
import { DesignerTopBar } from './GuestInvitationBuilderPage';
import { TemplateChooser, useDesignSave } from './designerShared';

function slugify(s: string): string {
  return s.toLowerCase().replace(/[\s_]+/g, '-').replace(/[^a-z0-9-]/g, '').slice(0, 60) || 'invitation';
}

export const InvitationBuilderPage = () => {
  const { restaurantId = '', eventId = '', flyerId = '' } = useParams();
  // Standalone flyers (restaurant not in the system) are opened without a
  // restaurantId/eventId — they use /flyers/new and /flyers/:flyerId.
  const standalone = !restaurantId;
  const accessToken = useAuthStore((s) => s.accessToken);
  const role = useAuthStore((s) => s.role);
  const { locale } = useAdminStore();
  const t = (k: Parameters<typeof translate>[0], p?: Record<string, string | number>) => translate(k, locale, p);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const restaurantsQuery = useQuery({ queryKey: ['manager-restaurants'], queryFn: () => restaurantService.list(), enabled: !!accessToken && !standalone });
  const eventsQuery = useQuery({ queryKey: ['manager-events', restaurantId], queryFn: () => eventService.list({ restaurantId }), enabled: !!accessToken && !standalone && !!restaurantId });
  const byEventQuery = useQuery({ queryKey: ['invitation-by-event', eventId], queryFn: () => invitationService.byEvent(String(eventId), restaurantId), enabled: !!accessToken && !standalone && !!eventId });
  const byIdQuery = useQuery({ queryKey: ['flyer', flyerId], queryFn: () => invitationService.get(flyerId), enabled: !!accessToken && standalone && !!flyerId });

  const existing = standalone ? byIdQuery.data : byEventQuery.data;
  const existingLoading = standalone ? byIdQuery.isLoading : byEventQuery.isLoading;

  const event = (eventsQuery.data ?? []).find((e) => String(e.id) === String(eventId));
  const restaurant = restaurantsQuery.data?.find((r) => r.id === restaurantId);

  const [blocks, setBlocks] = useState<Block[]>([]);
  const [theme, setTheme] = useState<DesignTheme>({});
  const [slug, setSlug] = useState('');
  const [isPublished, setIsPublished] = useState(true);
  const [initialized, setInitialized] = useState(false);
  const [chosen, setChosen] = useState(false);
  const { flash, error, setError, savedFlash } = useDesignSave();

  const isEditing = !!existing;

  useEffect(() => {
    if (existing && !initialized) {
      const inv = existing;
      setBlocks(inv.blocks && inv.blocks.length ? inv.blocks : seedFlyerBlocks(inv));
      setTheme(flyerTheme(inv));
      setSlug(inv.slug);
      setIsPublished(inv.isPublished);
      setInitialized(true);
      setChosen(true);
    } else if (standalone && !flyerId && !initialized && slug === '') {
      // Brand-new standalone flyer → a unique default slug the manager can edit.
      setSlug(slugify(`flyer-${Math.random().toString(36).slice(2, 8)}`));
    } else if (!standalone && !existingLoading && !existing && restaurant && event && !initialized && slug === '') {
      setSlug(slugify(`${restaurant.name}-${event.customerName}-${event.id}`));
    }
  }, [existing, existingLoading, standalone, flyerId, restaurant, event, initialized, slug]);

  const applyTemplate = (tpl: PickedDesign | null) => {
    if (tpl) { setBlocks(structuredClone(tpl.blocks)); setTheme({ ...tpl.theme }); }
    else { setBlocks([]); setTheme(flyerTheme({})); }
    setChosen(true);
    setInitialized(true);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const finalSlug = slug.trim() || slugify(standalone ? 'flyer' : `${restaurant?.name}-${eventId}`);
      const payload: Partial<Invitation> = {
        slug: finalSlug,
        isPublished,
        blocks,
        accentColor: theme.accentColor ?? null,
        backgroundColor: theme.backgroundColor ?? null,
        backgroundImageUrl: theme.backgroundImageUrl ?? null,
        musicUrl: theme.musicUrl ?? null,
      };
      if (isEditing && existing) return invitationService.update(existing.id, payload);
      if (standalone) return invitationService.create({ ...payload, slug: finalSlug });
      return invitationService.create({ ...payload, slug: finalSlug, restaurantId, eventId: String(eventId) });
    },
    onSuccess: (inv) => {
      setError(null); flash();
      if (standalone) {
        queryClient.setQueryData(['flyer', inv.id], inv);
        queryClient.invalidateQueries({ queryKey: ['manager-standalone-flyers'] });
        if (!flyerId) navigate(`/flyers/${inv.id}`, { replace: true });
      } else {
        queryClient.setQueryData(['invitation-by-event', eventId], inv);
        queryClient.invalidateQueries({ queryKey: ['manager-invitations', restaurantId] });
      }
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
      if (standalone) { queryClient.invalidateQueries({ queryKey: ['manager-standalone-flyers'] }); navigate('/'); }
      else { queryClient.invalidateQueries({ queryKey: ['invitation-by-event', eventId] }); navigate(`/restaurants/${restaurantId}`); }
    },
  });

  if (!accessToken) return <Navigate to="/login" replace />;
  if (role !== 'MANAGER' && role !== 'CHIEF_ADMIN') return <Navigate to="/login" replace />;

  const restaurantSlug = useMemo(() => (restaurant ? restaurant.name.toLowerCase().replace(/[\s_]+/g, '-').replace(/[^a-z0-9-]/g, '').slice(0, 63) : ''), [restaurant]);
  // Flyers are served from the `.event.` host: event.v-menu.uz/<slug> (standalone)
  // or <restaurant>.event.v-menu.uz/<slug> (restaurant-linked).
  const publicUrl = slug
    ? (standalone
        ? buildSubdomainBase('event', `/${slug}`)
        : (restaurantSlug ? buildSubdomainBase(`${restaurantSlug}.event`, `/${slug}`) : ''))
    : '';

  const backLink = standalone ? '/' : `/restaurants/${restaurantId}`;

  // New flyer (nothing loaded yet) → template chooser first.
  if (!existingLoading && !isEditing && !chosen) {
    return <TemplateChooser kind="flyer" t={t} onPick={applyTemplate} backLink={backLink} />;
  }

  const subtitle = standalone ? slug : `${restaurant?.name ?? ''} · ${event?.customerName ?? ''}`;

  return (
    <div className="adm-bg">
      <DesignerTopBar
        t={t} title={t('block_designer_flyer')} subtitle={subtitle}
        slug={slug} onSlug={setSlug} publicUrl={publicUrl}
        isPublished={isPublished} onPublished={setIsPublished}
        saving={saveMutation.isPending} isNew={!isEditing}
        onSave={() => saveMutation.mutate()} onSaveTemplate={saveTemplate}
        onDelete={isEditing ? () => { if (confirm('Delete?')) deleteMutation.mutate(); } : undefined}
        backLink={backLink}
        extra={isEditing && existing ? <RequestsButton invitationId={existing.id} t={t} /> : undefined}
      />

      {error && <div style={{ maxWidth: 1180, margin: '12px auto 0', padding: 12, borderRadius: 10, background: 'rgba(220,38,38,0.15)', border: '1px solid rgba(220,38,38,0.35)', color: '#fca5a5', fontSize: 13 }}>{error}</div>}
      {savedFlash && <div style={{ maxWidth: 1180, margin: '12px auto 0', padding: 12, borderRadius: 10, background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.35)', color: '#4ade80', fontSize: 13, fontWeight: 600 }}>✓ {t('save')}</div>}

      <BlockEditor kind="flyer" blocks={blocks} theme={theme} onBlocksChange={setBlocks} onThemeChange={setTheme} t={t} restaurantId={standalone ? '' : restaurantId}
        eventDate={standalone ? null : (event?.eventDate ?? null)} logoUrl={standalone ? null : (restaurant?.logoUrl ?? restaurant?.company?.logoUrl ?? null)} />
    </div>
  );
};

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
