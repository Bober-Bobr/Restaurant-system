import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import { useAuthStore } from '../store/auth.store';
import { useAdminStore } from '../store/admin.store';
import { translate } from '../utils/translate';
import { eventService } from '../services/event.service';
import { restaurantService } from '../services/restaurant.service';
import { invitationService, type Invitation } from '../services/invitation.service';
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
  const { restaurantId = '', eventId = '' } = useParams();
  const accessToken = useAuthStore((s) => s.accessToken);
  const role = useAuthStore((s) => s.role);
  const { locale } = useAdminStore();
  const t = (k: Parameters<typeof translate>[0], p?: Record<string, string | number>) => translate(k, locale, p);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const restaurantsQuery = useQuery({ queryKey: ['manager-restaurants'], queryFn: () => restaurantService.list(), enabled: !!accessToken });
  const eventsQuery = useQuery({ queryKey: ['manager-events', restaurantId], queryFn: () => eventService.list({ restaurantId }), enabled: !!accessToken && !!restaurantId });
  const existingQuery = useQuery({ queryKey: ['invitation-by-event', eventId], queryFn: () => invitationService.byEvent(String(eventId), restaurantId), enabled: !!accessToken && !!eventId });

  const event = (eventsQuery.data ?? []).find((e) => String(e.id) === String(eventId));
  const restaurant = restaurantsQuery.data?.find((r) => r.id === restaurantId);

  const [blocks, setBlocks] = useState<Block[]>([]);
  const [theme, setTheme] = useState<DesignTheme>({});
  const [slug, setSlug] = useState('');
  const [isPublished, setIsPublished] = useState(true);
  const [initialized, setInitialized] = useState(false);
  const [chosen, setChosen] = useState(false);
  const { flash, error, setError, savedFlash } = useDesignSave();

  const isEditing = !!existingQuery.data;

  useEffect(() => {
    if (existingQuery.data && !initialized) {
      const inv = existingQuery.data;
      setBlocks(inv.blocks && inv.blocks.length ? inv.blocks : seedFlyerBlocks(inv));
      setTheme(flyerTheme(inv));
      setSlug(inv.slug);
      setIsPublished(inv.isPublished);
      setInitialized(true);
      setChosen(true);
    } else if (!existingQuery.isLoading && !existingQuery.data && restaurant && event && !initialized && slug === '') {
      setSlug(slugify(`${restaurant.name}-${event.customerName}-${event.id}`));
    }
  }, [existingQuery.data, existingQuery.isLoading, restaurant, event, initialized, slug]);

  const applyTemplate = (tpl: PickedDesign | null) => {
    if (tpl) { setBlocks(structuredClone(tpl.blocks)); setTheme({ ...tpl.theme }); }
    else { setBlocks([]); setTheme(flyerTheme({})); }
    setChosen(true);
    setInitialized(true);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const finalSlug = slug.trim() || slugify(`${restaurant?.name}-${eventId}`);
      const payload: Partial<Invitation> = {
        slug: finalSlug,
        isPublished,
        blocks,
        accentColor: theme.accentColor ?? null,
        backgroundColor: theme.backgroundColor ?? null,
        backgroundImageUrl: theme.backgroundImageUrl ?? null,
        musicUrl: theme.musicUrl ?? null,
      };
      if (isEditing && existingQuery.data) return invitationService.update(existingQuery.data.id, payload);
      return invitationService.create({ ...payload, slug: finalSlug, restaurantId, eventId: String(eventId) });
    },
    onSuccess: (inv) => {
      setError(null); flash();
      queryClient.setQueryData(['invitation-by-event', eventId], inv);
      queryClient.invalidateQueries({ queryKey: ['manager-invitations', restaurantId] });
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
    mutationFn: () => existingQuery.data ? invitationService.remove(existingQuery.data.id) : Promise.resolve(),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['invitation-by-event', eventId] }); navigate(`/restaurants/${restaurantId}`); },
  });

  if (!accessToken) return <Navigate to="/login" replace />;
  if (role !== 'MANAGER' && role !== 'CHIEF_ADMIN') return <Navigate to="/login" replace />;

  const restaurantSlug = useMemo(() => (restaurant ? restaurant.name.toLowerCase().replace(/[\s_]+/g, '-').replace(/[^a-z0-9-]/g, '').slice(0, 63) : ''), [restaurant]);
  const publicUrl = slug && restaurantSlug ? buildSubdomainBase(`${restaurantSlug}.invitation`, `/${slug}`) : '';

  const backLink = `/restaurants/${restaurantId}`;

  // New flyer (no invitation for this event yet) → template chooser first.
  if (!existingQuery.isLoading && !isEditing && !chosen) {
    return <TemplateChooser kind="flyer" t={t} onPick={applyTemplate} backLink={backLink} />;
  }

  return (
    <div className="adm-bg">
      <DesignerTopBar
        t={t} title={t('block_designer_flyer')} subtitle={`${restaurant?.name ?? ''} · ${event?.customerName ?? ''}`}
        slug={slug} onSlug={setSlug} publicUrl={publicUrl}
        isPublished={isPublished} onPublished={setIsPublished}
        saving={saveMutation.isPending} isNew={!isEditing}
        onSave={() => saveMutation.mutate()} onSaveTemplate={saveTemplate}
        onDelete={isEditing ? () => { if (confirm('Delete?')) deleteMutation.mutate(); } : undefined}
        backLink={backLink}
      />

      {error && <div style={{ maxWidth: 1180, margin: '12px auto 0', padding: 12, borderRadius: 10, background: 'rgba(220,38,38,0.15)', border: '1px solid rgba(220,38,38,0.35)', color: '#fca5a5', fontSize: 13 }}>{error}</div>}
      {savedFlash && <div style={{ maxWidth: 1180, margin: '12px auto 0', padding: 12, borderRadius: 10, background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.35)', color: '#4ade80', fontSize: 13, fontWeight: 600 }}>✓ {t('save')}</div>}

      <BlockEditor kind="flyer" blocks={blocks} theme={theme} onBlocksChange={setBlocks} onThemeChange={setTheme} t={t} restaurantId={restaurantId} />
    </div>
  );
};
