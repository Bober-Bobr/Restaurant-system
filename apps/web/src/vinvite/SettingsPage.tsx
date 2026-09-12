import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { vinviteService, TEMPLATE_TIERS, type TemplatePricing, type TemplateTier } from './api';
import { RICH_TEMPLATES } from './templates';
import { useVInviteStore } from './store';
import { useViT, type ViKey } from './i18n';
import { TIER_PRICE_CENTS } from './pricing';
import { formatSum } from '../utils/currency';

// ── Settings (SYSTEM_ADMIN) ─────────────────────────────────────────────────
// Which CATEGORY each built-in design belongs to. The designs themselves are
// code, so this page walks the registry and edits the studio's settings about
// each one.
//
// THERE IS NO PRICE FIELD HERE ANY MORE. A price belongs to the category, not
// to a design: the shop quotes three numbers, and keeping twelve in step to
// produce them meant a customer could be shown a different figure depending on
// which design happened to be cheapest inside a tier. The three live in
// `TIER_PRICE_CENTS` and are shown below, read-only, so whoever is filing a
// design into a category can see what that category costs — changing one is a
// deploy, deliberately.
//
// The stored `priceCents` column is still written, always as null, which clears
// whatever the old per-template board left behind.
//
// The whole board is edited and saved at once rather than row-by-row: an admin
// filing designs into categories is comparing them against each other, and a
// save per change would fire a request per click.

type Draft = Record<string, { tier: TemplateTier | null }>;

export const ViSettingsPage = () => {
  const t = useViT();
  const user = useVInviteStore((s) => s.user);
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saved, setSaved] = useState(false);

  const isSystemAdmin = user?.role === 'SYSTEM_ADMIN';

  const pricingQuery = useQuery({
    queryKey: ['vi-template-pricing'],
    queryFn: () => vinviteService.getTemplatePricing(),
    enabled: isSystemAdmin,
  });

  // Seed once the saved values arrive. Every template in the registry gets a row,
  // priced or not — an unpriced template is the thing the admin most needs to see.
  useEffect(() => {
    if (!pricingQuery.data || draft) return;
    const byId = new Map(pricingQuery.data.map((row) => [row.templateId, row]));
    const next: Draft = {};
    for (const template of RICH_TEMPLATES) {
      next[template.id] = { tier: byId.get(template.id)?.tier ?? null };
    }
    setDraft(next);
  }, [pricingQuery.data, draft]);

  const save = useMutation({
    mutationFn: () => vinviteService.saveTemplatePricing(
      RICH_TEMPLATES.map((template) => ({
        templateId: template.id,
        tier: draft![template.id]!.tier,
        // Always null. The column is the retired per-template price, and the
        // save is what clears it — leaving stale figures in the database would
        // mean a later reader could resurrect a price nothing quotes.
        priceCents: null,
      })),
    ),
    onSuccess: (rows: TemplatePricing[]) => {
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      queryClient.setQueryData(['vi-template-pricing'], rows);
    },
  });

  if (!isSystemAdmin) {
    return (
      <div className="vi-card" style={{ padding: 24, fontSize: 14, color: 'var(--vi-muted)' }}>
        {t('settings_admins_only')}
      </div>
    );
  }

  if (!draft) {
    return <div className="vi-card" style={{ padding: 20, color: 'var(--vi-muted)', fontSize: 14 }}>…</div>;
  }

  const setRow = (id: string, patch: Partial<Draft[string]>) =>
    setDraft({ ...draft, [id]: { ...draft[id]!, ...patch } });

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div>
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>{t('settings')}</h1>
        <p style={{ margin: '6px 0 0', fontSize: 13.5, lineHeight: 1.55, color: 'var(--vi-muted)' }}>
          {t('settings_pricing_sub')}
        </p>
      </div>

      {/* What each category costs. Read-only on purpose: the figures live in
          `TIER_PRICE_CENTS`, and this is here so the person filing a design
          into a category can see what that category sells for. */}
      <div className="vi-card" style={{ padding: 18, display: 'grid', gap: 10 }}>
        <span className="vi-label" style={{ fontSize: 10.5 }}>{t('settings_tier_prices')}</span>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {TEMPLATE_TIERS.map((tier) => (
            <div key={tier} style={{
              flex: '1 1 150px', padding: '10px 14px', borderRadius: 12,
              border: '1px solid var(--vi-border)',
            }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--vi-muted)' }}>
                {t(`tier_${tier.toLowerCase()}` as ViKey)}
              </div>
              <div style={{ fontSize: 16, fontWeight: 850, marginTop: 2 }}>
                {formatSum(TIER_PRICE_CENTS[tier])}
              </div>
            </div>
          ))}
        </div>
        <p style={{ margin: 0, fontSize: 12, color: 'var(--vi-muted)' }}>{t('settings_tier_prices_hint')}</p>
      </div>

      <div className="vi-card" style={{ padding: 18, display: 'grid', gap: 12 }}>
        {RICH_TEMPLATES.map((template) => {
          const row = draft[template.id]!;
          return (
            <div key={template.id} style={{
              display: 'grid', gap: 10, alignItems: 'center',
              gridTemplateColumns: 'minmax(140px, 1.4fr) minmax(140px, 1fr)',
              paddingBottom: 12, borderBottom: '1px solid var(--vi-border)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0 }}>
                <span style={{ fontSize: 20, flexShrink: 0 }}>{template.cover}</span>
                <span style={{
                  fontSize: 14, fontWeight: 700,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {t(template.nameKey as ViKey)}
                </span>
              </div>

              <label style={{ display: 'grid', gap: 4 }}>
                <span className="vi-label" style={{ fontSize: 10.5 }}>{t('settings_tier')}</span>
                <select
                  className="vi-input"
                  value={row.tier ?? ''}
                  onChange={(e) => setRow(template.id, { tier: (e.target.value || null) as TemplateTier | null })}
                >
                  <option value="">{t('settings_tier_none')}</option>
                  {TEMPLATE_TIERS.map((tier) => (
                    <option key={tier} value={tier}>{t(`tier_${tier.toLowerCase()}` as ViKey)}</option>
                  ))}
                </select>
              </label>

            </div>
          );
        })}

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button type="button" className="vi-btn vi-btn-primary"
            disabled={save.isPending}
            onClick={() => save.mutate()}>
            {save.isPending ? t('saving') : t('save')}
          </button>
          {saved && <span style={{ fontSize: 13, color: '#16a34a' }}>{t('saved')}</span>}
          {save.isError && (
            <span style={{ fontSize: 13, color: '#e11d48' }}>{t('settings_save_error')}</span>
          )}
        </div>
      </div>
    </div>
  );
};
