import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { vinviteService, TEMPLATE_TIERS, type TemplatePricing, type TemplateTier } from './api';
import { RICH_TEMPLATES } from './templates';
import { usePromoShowcase } from './promoShowcase';
import { groupByTier } from './pricing';
import { useViT, type ViKey } from './i18n';
import { ViLogo, ViThemeToggle } from './VInviteApp';
import { formatSum } from '../utils/currency';

// ── Pricing ─────────────────────────────────────────────────────────────────
// Reached by choosing a template in the preview. Shows the three tiers and what
// each template inside them costs, with the chosen one called out.
//
// Only templates the promotional showcase actually shows are listed: a template
// the administrator hid must not be advertised here either, and the showcase is
// already the single place that decides visibility.

const TIER_ACCENT: Record<TemplateTier, string> = {
  STANDARD: 'var(--vi-muted)',
  PREMIUM: 'var(--vi-accent)',
  LUXURY: '#c9a96a',
};

export const ViPricingPage = () => {
  const t = useViT();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const selectedId = params.get('template');

  const { work } = usePromoShowcase();

  const pricingQuery = useQuery({
    queryKey: ['vi-template-pricing'],
    queryFn: () => vinviteService.getTemplatePricing(),
    staleTime: 60_000,
  });

  const byTemplate = useMemo(() => {
    const map = new Map<string, TemplatePricing>();
    for (const row of pricingQuery.data ?? []) map.set(row.templateId, row);
    return map;
  }, [pricingQuery.data]);

  const selected = RICH_TEMPLATES.find((tpl) => tpl.id === selectedId) ?? null;
  const selectedPricing = selected ? byTemplate.get(selected.id) : undefined;

  // Group the visible templates by tier. Anything with no tier set yet falls
  // into `unassigned` rather than being dropped — an administrator needs to see
  // that a template is missing from the price list, and a visitor seeing it
  // without a price is better than a template that silently vanished.
  const grouped = useMemo(() => groupByTier(work, byTemplate), [work, byTemplate]);

  const priceLabel = (templateId: string): string => {
    const price = byTemplate.get(templateId)?.priceCents;
    if (price == null) return t('pricing_on_request');
    if (price === 0) return t('pricing_free');
    return formatSum(price);
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header className="vi-lp-head stuck">
        <div className="vi-lp-head-bar">
          <button type="button" onClick={() => navigate('/main')}
            style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'inherit', display: 'flex' }}
            aria-label="v-invite.uz">
            <ViLogo size={30} />
          </button>
          <div className="vi-lp-head-right" style={{ marginLeft: 'auto' }}>
            <ViThemeToggle />
            <button type="button" className="vi-btn vi-btn-ghost" style={{ fontSize: 13 }}
              onClick={() => navigate('/main')}>
              ← {t('pricing_back')}
            </button>
          </div>
        </div>
      </header>

      <main style={{ flex: 1, padding: '46px 20px 90px' }}>
        <div style={{ maxWidth: 1180, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', maxWidth: 640, margin: '0 auto 40px' }}>
            <span className="vi-lp-kicker">{t('pricing_kicker')}</span>
            <h1 style={{ margin: 0, fontSize: 'clamp(28px, 4vw, 42px)', fontWeight: 830, letterSpacing: '-0.03em' }}>
              {t('pricing_title')}
            </h1>
            <p style={{ margin: '14px 0 0', fontSize: 16.5, lineHeight: 1.6, color: 'var(--vi-muted)' }}>
              {t('pricing_sub')}
            </p>
          </div>

          {/* The chosen template, called out above the tiers. */}
          {selected && (
            <div className="vi-card vi-pop" style={{
              maxWidth: 560, margin: '0 auto 40px', padding: 20,
              display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap',
              border: '1px solid var(--vi-accent)',
            }}>
              <span style={{ fontSize: 34 }}>{selected.cover}</span>
              <div style={{ minWidth: 0, flex: 1 }}>
                <span className="vi-label" style={{ marginBottom: 2 }}>{t('pricing_your_choice')}</span>
                <p style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>{t(selected.nameKey as ViKey)}</p>
                {selectedPricing?.tier && (
                  <span style={{
                    display: 'inline-block', marginTop: 6, padding: '3px 10px', borderRadius: 999,
                    fontSize: 11, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase',
                    color: TIER_ACCENT[selectedPricing.tier],
                    border: `1px solid ${TIER_ACCENT[selectedPricing.tier]}`,
                  }}>
                    {t(`tier_${selectedPricing.tier.toLowerCase()}` as ViKey)}
                  </span>
                )}
              </div>
              <strong style={{ fontSize: 22, fontWeight: 850, whiteSpace: 'nowrap' }}>
                {priceLabel(selected.id)}
              </strong>
            </div>
          )}

          {/* The three tiers. */}
          <div style={{ display: 'grid', gap: 22, gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
            {TEMPLATE_TIERS.map((tier) => {
              const templates = grouped.buckets[tier];
              return (
                <section key={tier} className="vi-card" style={{
                  padding: 22, display: 'flex', flexDirection: 'column', gap: 14,
                  border: selectedPricing?.tier === tier ? '1px solid var(--vi-accent)' : undefined,
                }}>
                  <div>
                    <span style={{
                      fontSize: 11, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase',
                      color: TIER_ACCENT[tier],
                    }}>
                      {t(`tier_${tier.toLowerCase()}` as ViKey)}
                    </span>
                    <p style={{ margin: '8px 0 0', fontSize: 14, lineHeight: 1.6, color: 'var(--vi-muted)' }}>
                      {t(`pricing_${tier.toLowerCase()}_desc` as ViKey)}
                    </p>
                  </div>

                  <hr style={{ border: 0, borderTop: '1px solid var(--vi-border)', margin: 0 }} />

                  {templates.length === 0 ? (
                    <p style={{ margin: 0, fontSize: 13.5, color: 'var(--vi-muted)' }}>{t('pricing_tier_empty')}</p>
                  ) : (
                    <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: 10 }}>
                      {templates.map((tpl) => (
                        <li key={tpl.id} style={{
                          display: 'flex', alignItems: 'center', gap: 10,
                          padding: '8px 10px', borderRadius: 10,
                          background: tpl.id === selectedId ? 'var(--vi-accent-soft)' : 'transparent',
                        }}>
                          <span style={{ fontSize: 17 }}>{tpl.cover}</span>
                          <span style={{
                            flex: 1, minWidth: 0, fontSize: 14, fontWeight: 650,
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          }}>
                            {t(tpl.nameKey as ViKey)}
                          </span>
                          <strong style={{ fontSize: 14, whiteSpace: 'nowrap' }}>{priceLabel(tpl.id)}</strong>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              );
            })}
          </div>

          {grouped.unassigned.length > 0 && (
            <section style={{ marginTop: 30 }}>
              <p style={{ margin: '0 0 12px', fontSize: 13, color: 'var(--vi-muted)' }}>
                {t('pricing_unassigned')}
              </p>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {grouped.unassigned.map((tpl) => (
                  <span key={tpl.id} className="vi-card" style={{
                    padding: '8px 12px', display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13.5,
                    border: tpl.id === selectedId ? '1px solid var(--vi-accent)' : undefined,
                  }}>
                    <span>{tpl.cover}</span>
                    {t(tpl.nameKey as ViKey)}
                    <strong style={{ color: 'var(--vi-muted)' }}>{priceLabel(tpl.id)}</strong>
                  </span>
                ))}
              </div>
            </section>
          )}

          <p style={{
            margin: '38px auto 0', maxWidth: 560, textAlign: 'center',
            fontSize: 14.5, lineHeight: 1.6, color: 'var(--vi-muted)',
          }}>
            {t('pricing_contact')}
          </p>
        </div>
      </main>
    </div>
  );
};
