import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { vinviteService, type PromoShowcase } from './api';
import { RICH_TEMPLATES } from './templates';
import { COVER_SLOTS_DESKTOP } from './promoShowcase';
import { useViT, type ViKey } from './i18n';

// ── Promotional-site showcase (SYSTEM_ADMIN only) ───────────────────────────
// Controls what v-invite.uz shows a logged-out visitor.
//
// Two separate things, because they are two separate products on the page:
//
//  1. OUR WORK — real published invitations, chosen from the administrator's
//     own. This is opt-in: an invitation is a customer's, so it reaches the
//     marketing site only when deliberately added here. Unpublishing or
//     deleting one takes it off the site by itself.
//  2. THE PRICE LIST — which built-in templates are offered on /pricing.
//     Everything is offered unless hidden here, so shipping a new template
//     never requires re-saving this screen to make it visible.
//
// The editor works on a draft and saves explicitly: reordering is a series of
// small steps, and saving each one would fire a request per click and leave the
// site in half-finished states while the admin worked.
export const PromoShowcaseCard = () => {
  const t = useViT();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['vi-promo-showcase'],
    queryFn: () => vinviteService.getPromoShowcase(),
    staleTime: 60_000,
  });

  // The administrator's own invitations. Only published ones can be showcased:
  // an unpublished invitation has no public page for a visitor to be shown, and
  // it may well be a draft the customer has not approved.
  const projectsQuery = useQuery({
    queryKey: ['vi-projects'],
    queryFn: () => vinviteService.listProjects(),
  });
  const publishable = useMemo(
    () => (projectsQuery.data ?? []).filter((p) => p.isPublished && p.slug),
    [projectsQuery.data],
  );

  const [draft, setDraft] = useState<PromoShowcase | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!query.data || draft) return;
    setDraft({
      workSlugs: query.data.workSlugs,
      coverSlugs: query.data.coverSlugs,
      hiddenIds: query.data.hiddenIds.filter((id) => RICH_TEMPLATES.some((tpl) => tpl.id === id)),
    });
  }, [query.data, draft]);

  const save = useMutation({
    mutationFn: () => vinviteService.savePromoShowcase({
      workSlugs: draft!.workSlugs,
      coverSlugs: draft!.coverSlugs,
      hiddenIds: draft!.hiddenIds,
    }),
    onSuccess: (result) => {
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      // The landing page reads both keys, so it picks this up without a reload.
      queryClient.setQueryData(['vi-promo-showcase'], result);
      queryClient.invalidateQueries({ queryKey: ['vi-promo-showcase'] });
      queryClient.invalidateQueries({ queryKey: ['vi-promo-works'] });
    },
  });

  if (!draft) {
    return <div className="vi-card" style={{ padding: 20, color: 'var(--vi-muted)', fontSize: 14 }}>…</div>;
  }

  // Slugs that no longer resolve to a published invitation are still listed,
  // marked as missing: silently dropping one would hide the fact that the site
  // is showing less than the admin thinks.
  const bySlug = new Map(publishable.map((p) => [p.slug!, p]));
  const chosen = draft.workSlugs;
  const available = publishable.filter((p) => !chosen.includes(p.slug!));

  const setWork = (workSlugs: string[], coverSlugs = draft.coverSlugs) =>
    setDraft({ ...draft, workSlugs, coverSlugs });

  const add = (slug: string) => setWork([...chosen, slug]);
  const remove = (slug: string) =>
    setWork(chosen.filter((s) => s !== slug), draft.coverSlugs.filter((s) => s !== slug));

  const move = (index: number, delta: number) => {
    const next = [...chosen];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target]!, next[index]!];
    setWork(next);
  };

  const toggleCover = (slug: string) => {
    const on = draft.coverSlugs.includes(slug);
    setWork(chosen, on ? draft.coverSlugs.filter((s) => s !== slug) : [...draft.coverSlugs, slug]);
  };

  const toggleHidden = (id: string) => {
    const hidden = draft.hiddenIds.includes(id);
    setDraft({
      ...draft,
      hiddenIds: hidden ? draft.hiddenIds.filter((x) => x !== id) : [...draft.hiddenIds, id],
    });
  };

  // What the cover will actually render, given the slot limits. Falls back to
  // the front of the list, exactly as the landing page does.
  const coverOrder = draft.coverSlugs.length > 0
    ? chosen.filter((slug) => draft.coverSlugs.includes(slug))
    : chosen;

  const visibleTemplates = RICH_TEMPLATES.length - draft.hiddenIds.length;

  return (
    <div className="vi-card" style={{ padding: 20, display: 'grid', gap: 18 }}>
      <div>
        <h2 style={{ margin: 0, fontSize: 15, fontWeight: 800 }}>{t('promo_title')}</h2>
        <p style={{ margin: '6px 0 0', fontSize: 13, lineHeight: 1.55, color: 'var(--vi-muted)' }}>
          {t('promo_sub')}
        </p>
      </div>

      {/* ── 1 · Our work ── */}
      <section style={{ display: 'grid', gap: 10 }}>
        <h3 style={{ margin: 0, fontSize: 13, fontWeight: 800 }}>{t('promo_work_title')}</h3>

        <div style={{
          display: 'grid', gap: 6, padding: '12px 14px', borderRadius: 12,
          background: 'var(--vi-surface-2, rgba(127,127,127,0.07))',
          border: '1px solid var(--vi-border)',
        }}>
          <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--vi-muted)' }}>
            {t('promo_cover_now')}
          </span>
          <p style={{ margin: 0, fontSize: 13.5, fontWeight: 600 }}>
            {coverOrder.slice(0, COVER_SLOTS_DESKTOP)
              .map((slug) => bySlug.get(slug)?.name ?? slug).join('  ·  ') || '—'}
          </p>
          <p style={{ margin: 0, fontSize: 12, color: 'var(--vi-muted)' }}>{t('promo_cover_hint')}</p>
          {draft.coverSlugs.length === 0 && (
            <p style={{ margin: 0, fontSize: 12, color: 'var(--vi-muted)' }}>{t('promo_cover_auto')}</p>
          )}
        </div>

        {chosen.length === 0 && (
          <p style={{ margin: 0, fontSize: 12.5, color: 'var(--vi-muted)' }}>{t('promo_work_empty')}</p>
        )}

        <div style={{ display: 'grid', gap: 8 }}>
          {chosen.map((slug, i) => {
            const project = bySlug.get(slug);
            const onCover = draft.coverSlugs.includes(slug);
            const coverSlot = coverOrder.indexOf(slug);
            const overflow = onCover && coverSlot >= COVER_SLOTS_DESKTOP;
            return (
              <div key={slug} style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
                borderRadius: 12, border: '1px solid var(--vi-border)',
                opacity: project ? 1 : 0.6,
              }}>
                <div style={{ display: 'grid', gap: 2 }}>
                  <button type="button" onClick={() => move(i, -1)} disabled={i === 0}
                    aria-label={t('promo_move_up')} style={arrowBtn(i === 0)}>↑</button>
                  <button type="button" onClick={() => move(i, 1)} disabled={i === chosen.length - 1}
                    aria-label={t('promo_move_down')} style={arrowBtn(i === chosen.length - 1)}>↓</button>
                </div>

                <div style={{ minWidth: 0, flex: 1 }}>
                  <p style={{
                    margin: 0, fontSize: 14, fontWeight: 700,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {project?.name ?? slug}
                  </p>
                  <p style={{ margin: '2px 0 0', fontSize: 11.5, color: 'var(--vi-muted)' }}>
                    {project
                      ? (onCover
                        ? (overflow ? t('promo_cover_overflow') : `${t('promo_cover_slot')} #${coverSlot + 1}`)
                        : `/${slug}`)
                      : t('promo_work_missing')}
                  </p>
                </div>

                <button type="button" onClick={() => toggleCover(slug)}
                  title={t('promo_on_cover')} style={pillBtn(onCover)}>
                  {onCover ? '★' : '☆'} {t('promo_on_cover')}
                </button>
                <button type="button" onClick={() => remove(slug)}
                  title={t('promo_work_remove')} style={pillBtn(false)}>
                  ✕ {t('promo_work_remove')}
                </button>
              </div>
            );
          })}
        </div>

        {/* Adding is a plain picker rather than a second sortable list: the
            order that matters is the chosen one above. */}
        {available.length > 0 ? (
          <select
            className="vi-input"
            value=""
            onChange={(e) => { if (e.target.value) add(e.target.value); }}
          >
            <option value="">{t('promo_work_add')}</option>
            {available.map((p) => (
              <option key={p.id} value={p.slug!}>{p.name} — /{p.slug}</option>
            ))}
          </select>
        ) : (
          <p style={{ margin: 0, fontSize: 12.5, color: 'var(--vi-muted)' }}>
            {publishable.length === 0 ? t('promo_work_none_published') : t('promo_work_all_added')}
          </p>
        )}
      </section>

      {/* ── 2 · Price list ── */}
      <section style={{ display: 'grid', gap: 10 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 13, fontWeight: 800 }}>{t('promo_templates_title')}</h3>
          <p style={{ margin: '4px 0 0', fontSize: 12.5, lineHeight: 1.55, color: 'var(--vi-muted)' }}>
            {t('promo_templates_sub')}
          </p>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {RICH_TEMPLATES.map((tpl) => {
            const hidden = draft.hiddenIds.includes(tpl.id);
            return (
              <button key={tpl.id} type="button" onClick={() => toggleHidden(tpl.id)}
                style={{
                  ...pillBtn(!hidden),
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  textDecoration: hidden ? 'line-through' : undefined,
                }}>
                <span>{tpl.cover}</span>
                {t(tpl.nameKey as ViKey)}
              </button>
            );
          })}
        </div>

        {/* Hiding everything would leave the price list empty — worth refusing
            rather than letting it be saved by accident. */}
        {visibleTemplates === 0 && (
          <p style={{ margin: 0, fontSize: 13, color: '#e11d48' }}>{t('promo_none_visible')}</p>
        )}
      </section>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button type="button" className="vi-btn vi-btn-primary"
          disabled={save.isPending || visibleTemplates === 0}
          onClick={() => save.mutate()}>
          {save.isPending ? t('saving') : t('save')}
        </button>
        {saved && <span style={{ fontSize: 13, color: '#16a34a' }}>{t('saved')}</span>}
        {save.isError && <span style={{ fontSize: 13, color: '#e11d48' }}>{t('promo_save_error')}</span>}
      </div>
    </div>
  );
};

const arrowBtn = (disabled: boolean): React.CSSProperties => ({
  width: 22, height: 18, lineHeight: '16px', padding: 0, borderRadius: 5,
  border: '1px solid var(--vi-border)', background: 'transparent',
  color: 'var(--vi-muted)', fontSize: 11,
  cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.35 : 1,
});

const pillBtn = (active: boolean): React.CSSProperties => ({
  flexShrink: 0, padding: '6px 11px', borderRadius: 999, fontSize: 12, fontWeight: 700,
  border: `1px solid ${active ? 'var(--vi-accent, #c9a96a)' : 'var(--vi-border)'}`,
  background: active ? 'rgba(201,169,106,0.14)' : 'transparent',
  color: active ? 'var(--vi-accent, #c9a96a)' : 'var(--vi-muted)',
  cursor: 'pointer',
});
