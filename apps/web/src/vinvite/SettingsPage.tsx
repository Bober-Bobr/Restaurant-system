import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { vinviteService, TEMPLATE_TIERS, type TemplatePricing, type TemplateTier } from './api';
import { RICH_TEMPLATES } from './templates';
import { useVInviteStore } from './store';
import { useViT, type ViKey } from './i18n';
import { formatSum, groupDigits, parseSumToTiyin } from '../utils/currency';

// ── Settings (SYSTEM_ADMIN) ─────────────────────────────────────────────────
// Where each built-in template is assigned a commercial tier and a price. The
// templates themselves are code, so this page walks the registry and edits the
// studio's settings ABOUT each one.
//
// The whole board is edited and saved at once rather than row-by-row: an admin
// setting up a price list is comparing templates against each other, and a save
// per keystroke would fire a request per digit.

type Draft = Record<string, { tier: TemplateTier | null; price: string }>;

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
      const saved = byId.get(template.id);
      next[template.id] = {
        tier: saved?.tier ?? null,
        // Prices are stored in tiyin and typed in so'm.
        price: saved?.priceCents != null ? groupDigits(String(Math.round(saved.priceCents / 100))) : '',
      };
    }
    setDraft(next);
  }, [pricingQuery.data, draft]);

  const save = useMutation({
    mutationFn: () => vinviteService.saveTemplatePricing(
      RICH_TEMPLATES.map((template) => {
        const row = draft![template.id]!;
        const parsed = parseSumToTiyin(row.price);
        return {
          templateId: template.id,
          tier: row.tier,
          // An empty field means "not priced", which is not the same as free —
          // so it is sent as null rather than 0.
          priceCents: row.price.trim() === '' ? null : parsed,
        };
      }),
    ),
    onSuccess: (rows: TemplatePricing[]) => {
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      queryClient.setQueryData(['vi-template-pricing'], rows);
    },
  });

  // A field with something typed in it that is not a number would otherwise be
  // sent as null and silently wipe a price.
  const invalid = useMemo(() => {
    if (!draft) return [];
    return RICH_TEMPLATES.filter((template) => {
      const value = draft[template.id]?.price ?? '';
      return value.trim() !== '' && parseSumToTiyin(value) === null;
    }).map((template) => template.id);
  }, [draft]);

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

      <div className="vi-card" style={{ padding: 18, display: 'grid', gap: 12 }}>
        {RICH_TEMPLATES.map((template) => {
          const row = draft[template.id]!;
          const isInvalid = invalid.includes(template.id);
          const tiyin = row.price.trim() === '' ? null : parseSumToTiyin(row.price);
          return (
            <div key={template.id} style={{
              display: 'grid', gap: 10, alignItems: 'center',
              gridTemplateColumns: 'minmax(140px, 1.4fr) minmax(120px, 1fr) minmax(120px, 1fr)',
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

              <label style={{ display: 'grid', gap: 4 }}>
                <span className="vi-label" style={{ fontSize: 10.5 }}>{t('settings_price')}</span>
                <input
                  className="vi-input"
                  inputMode="numeric"
                  value={row.price}
                  placeholder={t('settings_price_none')}
                  onChange={(e) => setRow(template.id, { price: groupDigits(e.target.value) })}
                  style={isInvalid ? { borderColor: '#e11d48' } : undefined}
                />
                {tiyin != null && (
                  <span style={{ fontSize: 11, color: 'var(--vi-muted)' }}>{formatSum(tiyin)}</span>
                )}
              </label>
            </div>
          );
        })}

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button type="button" className="vi-btn vi-btn-primary"
            disabled={save.isPending || invalid.length > 0}
            onClick={() => save.mutate()}>
            {save.isPending ? t('saving') : t('save')}
          </button>
          {saved && <span style={{ fontSize: 13, color: '#16a34a' }}>{t('saved')}</span>}
          {invalid.length > 0 && (
            <span style={{ fontSize: 13, color: '#e11d48' }}>{t('settings_price_invalid')}</span>
          )}
          {save.isError && (
            <span style={{ fontSize: 13, color: '#e11d48' }}>{t('settings_save_error')}</span>
          )}
        </div>
      </div>
    </div>
  );
};
