import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { vinviteService, type PromoShowcase } from './api';
import { RICH_TEMPLATES } from './templates';
import { EMPTY_SHOWCASE, resolveShowcase, COVER_SLOTS_DESKTOP } from './promoShowcase';
import { useViT, type ViKey } from './i18n';

// ── Promotional-site showcase (SYSTEM_ADMIN only) ───────────────────────────
// Controls how the built-in templates appear on v-invite.uz to a logged-out
// visitor: which are featured on the main cover, in what order the rest are
// listed, and which are kept off the site.
//
// The editor works on a draft and saves explicitly, because reordering is a
// series of small steps and saving each one would fire a request per click and
// leave the site in half-finished states while the admin worked.
export const PromoShowcaseCard = () => {
  const t = useViT();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['vi-promo-showcase'],
    queryFn: () => vinviteService.getPromoShowcase(),
    staleTime: 60_000,
  });

  const [draft, setDraft] = useState<PromoShowcase | null>(null);
  const [saved, setSaved] = useState(false);

  // Seed once the settings arrive. The stored order is sparse — templates the
  // admin never touched are absent — so seed from the RESOLVED order instead,
  // giving the list a concrete position for every template to move around.
  useEffect(() => {
    if (!query.data || draft) return;
    const resolvedOrder = resolveShowcase({ ...query.data, hiddenIds: [] }).work;
    setDraft({
      coverIds: query.data.coverIds.filter((id) => RICH_TEMPLATES.some((tpl) => tpl.id === id)),
      orderIds: resolvedOrder.map((tpl) => tpl.id),
      hiddenIds: query.data.hiddenIds.filter((id) => RICH_TEMPLATES.some((tpl) => tpl.id === id)),
    });
  }, [query.data, draft]);

  const save = useMutation({
    mutationFn: () => vinviteService.savePromoShowcase({
      coverIds: draft!.coverIds,
      orderIds: draft!.orderIds,
      hiddenIds: draft!.hiddenIds,
    }),
    onSuccess: (result) => {
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      // The landing page reads the same query key, so it picks this up without
      // a reload.
      queryClient.setQueryData(['vi-promo-showcase'], result);
      queryClient.invalidateQueries({ queryKey: ['vi-promo-showcase'] });
    },
  });

  // What the cover will actually render, given the slot limits.
  const preview = useMemo(
    () => resolveShowcase(draft ?? EMPTY_SHOWCASE).cover,
    [draft],
  );

  if (!draft) {
    return (
      <div className="vi-card" style={{ padding: 20, color: 'var(--vi-muted)', fontSize: 14 }}>…</div>
    );
  }

  const rows = draft.orderIds
    .map((id) => RICH_TEMPLATES.find((tpl) => tpl.id === id))
    .filter((tpl): tpl is (typeof RICH_TEMPLATES)[number] => !!tpl);

  const move = (index: number, delta: number) => {
    const next = [...draft.orderIds];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target]!, next[index]!];
    setDraft({ ...draft, orderIds: next });
  };

  const toggleCover = (id: string) => {
    const on = draft.coverIds.includes(id);
    setDraft({
      ...draft,
      coverIds: on ? draft.coverIds.filter((x) => x !== id) : [...draft.coverIds, id],
      // Featuring something that is hidden would be contradictory, so starring
      // un-hides it rather than producing a setting with no visible effect.
      hiddenIds: on ? draft.hiddenIds : draft.hiddenIds.filter((x) => x !== id),
    });
  };

  const toggleHidden = (id: string) => {
    const hidden = draft.hiddenIds.includes(id);
    setDraft({
      ...draft,
      hiddenIds: hidden ? draft.hiddenIds.filter((x) => x !== id) : [...draft.hiddenIds, id],
      // Hiding something removes it from the cover for the same reason.
      coverIds: hidden ? draft.coverIds : draft.coverIds.filter((x) => x !== id),
    });
  };

  const visibleCount = rows.length - draft.hiddenIds.length;

  return (
    <div className="vi-card" style={{ padding: 20, display: 'grid', gap: 16 }}>
      <div>
        <h2 style={{ margin: 0, fontSize: 15, fontWeight: 800 }}>{t('promo_title')}</h2>
        <p style={{ margin: '6px 0 0', fontSize: 13, lineHeight: 1.55, color: 'var(--vi-muted)' }}>
          {t('promo_sub')}
        </p>
      </div>

      {/* What the cover will show, in order, given the slot limits. Stated
          plainly because the cover renders fewer cards than can be starred. */}
      <div style={{
        display: 'grid', gap: 6, padding: '12px 14px', borderRadius: 12,
        background: 'var(--vi-surface-2, rgba(127,127,127,0.07))',
        border: '1px solid var(--vi-border)',
      }}>
        <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--vi-muted)' }}>
          {t('promo_cover_now')}
        </span>
        <p style={{ margin: 0, fontSize: 13.5, fontWeight: 600 }}>
          {preview.slice(0, COVER_SLOTS_DESKTOP).map((tpl) => `${tpl.cover} ${t(tpl.nameKey as ViKey)}`).join('  ·  ') || '—'}
        </p>
        <p style={{ margin: 0, fontSize: 12, color: 'var(--vi-muted)' }}>
          {t('promo_cover_hint')}
        </p>
        {draft.coverIds.length === 0 && (
          <p style={{ margin: 0, fontSize: 12, color: 'var(--vi-muted)' }}>{t('promo_cover_auto')}</p>
        )}
      </div>

      <div style={{ display: 'grid', gap: 8 }}>
        {rows.map((tpl, i) => {
          const onCover = draft.coverIds.includes(tpl.id);
          const hidden = draft.hiddenIds.includes(tpl.id);
          const coverSlot = draft.coverIds.indexOf(tpl.id);
          // Starred beyond the last rendered slot: kept, but not on the cover
          // today. Saying so avoids the admin thinking the star did nothing.
          const overflow = onCover && coverSlot >= COVER_SLOTS_DESKTOP;
          return (
            <div
              key={tpl.id}
              style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
                borderRadius: 12, border: '1px solid var(--vi-border)',
                opacity: hidden ? 0.5 : 1,
              }}
            >
              <div style={{ display: 'grid', gap: 2 }}>
                <button type="button" onClick={() => move(i, -1)} disabled={i === 0}
                  aria-label={t('promo_move_up')} style={arrowBtn(i === 0)}>↑</button>
                <button type="button" onClick={() => move(i, 1)} disabled={i === rows.length - 1}
                  aria-label={t('promo_move_down')} style={arrowBtn(i === rows.length - 1)}>↓</button>
              </div>

              <span style={{ fontSize: 20, flexShrink: 0 }}>{tpl.cover}</span>

              <div style={{ minWidth: 0, flex: 1 }}>
                <p style={{
                  margin: 0, fontSize: 14, fontWeight: 700,
                  textDecoration: hidden ? 'line-through' : undefined,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {t(tpl.nameKey as ViKey)}
                </p>
                {onCover && (
                  <p style={{ margin: '2px 0 0', fontSize: 11.5, color: 'var(--vi-muted)' }}>
                    {overflow
                      ? t('promo_cover_overflow')
                      : `${t('promo_cover_slot')} #${coverSlot + 1}`}
                  </p>
                )}
              </div>

              <button type="button" onClick={() => toggleCover(tpl.id)}
                title={t('promo_on_cover')} style={pillBtn(onCover)}>
                {onCover ? '★' : '☆'} {t('promo_on_cover')}
              </button>
              <button type="button" onClick={() => toggleHidden(tpl.id)}
                title={t('promo_hidden')} style={pillBtn(hidden)}>
                {hidden ? '🚫' : '👁'} {hidden ? t('promo_hidden') : t('promo_visible')}
              </button>
            </div>
          );
        })}
      </div>

      {/* Hiding everything would leave the promotional site with no templates at
          all — worth refusing rather than letting it be saved by accident. */}
      {visibleCount === 0 && (
        <p style={{ margin: 0, fontSize: 13, color: '#e11d48' }}>{t('promo_none_visible')}</p>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button type="button" className="vi-btn vi-btn-primary"
          disabled={save.isPending || visibleCount === 0}
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
