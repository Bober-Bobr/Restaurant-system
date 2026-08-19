import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { TEMPLATE_TIERS, type TemplateTier } from './api';
import { RICH_TEMPLATES } from './templates';
import { usePromoShowcase } from './promoShowcase';
import { groupByTier, instagramHref, telegramHref } from './pricing';
import { useViT, type ViKey } from './i18n';
import { ViLogo, ViThemeToggle } from './VInviteApp';
import { usePlatformContacts } from '../hooks/usePlatformContacts';
import { useReveal, useScrollProgress, usePointerTilt } from './motion';
import { useTemplateOverrides } from './templateOverrides';
import { RichRenderer } from './templates/RichRenderer';
import { resolveAssetUrls } from './templates/utils';
import { PreviewShell } from './PreviewShell';
import { TemplateCard } from './TemplateCard';
import { brandOf, brandVars } from './templateBrand';
import { useVInviteStore } from './store';
import { useTemplatePricing } from './templatePricing';
import { LOCALES, type TemplateDefinition } from './templates/types';

// Stable identity: RichRenderer posts into the iframe whenever `config` or
// `languages` change by reference, so this must not be rebuilt per render.
const ALL_LOCALES = [...LOCALES];

// ── Pricing ─────────────────────────────────────────────────────────────────
// The three tiers and what each template inside them costs, with the chosen one
// called out. This is also where a visitor picks a design: every row can be
// previewed live and selected, because the promotional gallery now shows
// finished invitations belonging to customers, which are not on sale.
//
// Only templates the administrator has not hidden are listed — that setting is
// the single place deciding what is advertised.

const TIER_ACCENT: Record<TemplateTier, string> = {
  STANDARD: 'var(--vi-muted)',
  PREMIUM: 'var(--vi-accent)',
  LUXURY: '#c9a96a',
};

export const ViPricingPage = () => {
  const t = useViT();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const selectedId = params.get('template');

  const choose = (templateId: string | null) => {
    const next = new URLSearchParams(params);
    if (templateId) next.set('template', templateId); else next.delete('template');
    // `replace`: changing your mind five times should not mean five presses of
    // the browser Back button to leave the page.
    setParams(next, { replace: true });
  };

  const contactFor = usePlatformContacts();
  const contact = contactFor('vinvite');
  const reveal = useReveal();
  const progress = useScrollProgress();
  const tilt = usePointerTilt(4);

  const { templates: visible } = usePromoShowcase();
  const dark = useVInviteStore((state) => state.uiTheme) === 'dark';
  const [preview, setPreview] = useState<TemplateDefinition | null>(null);

  const { byTemplate, priceLabel, tierOf } = useTemplatePricing();

  const selected = RICH_TEMPLATES.find((tpl) => tpl.id === selectedId) ?? null;
  const selectedPricing = selected ? byTemplate.get(selected.id) : undefined;

  // Group the visible templates by tier. Anything with no tier set yet falls
  // into `unassigned` rather than being dropped — an administrator needs to see
  // that a template is missing from the price list, and a visitor seeing it
  // without a price is better than a template that silently vanished.
  const grouped = useMemo(() => groupByTier(visible, byTemplate), [visible, byTemplate]);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <div className="vi-lp-progress" style={{ transform: `scaleX(${progress})` }} aria-hidden />

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
          <div ref={reveal} className="vi-r vi-r-up" style={{ maxWidth: 720, margin: '0 auto 40px' }}>
            <div className="vi-lp-sec-head">
              <span className="vi-lp-sec-num">03</span>
              <span className="vi-lp-kicker" style={{ margin: 0 }}>{t('pricing_kicker')}</span>
              <span className="vi-lp-sec-rule" />
            </div>
            <h1 className="vi-lp-display">{t('pricing_title')}</h1>
            <p style={{ margin: '14px 0 0', fontSize: 16.5, lineHeight: 1.6, color: 'var(--vi-muted)', maxWidth: 560 }}>
              {t('pricing_sub')}
            </p>
          </div>

          {/* The chosen template, called out above the tiers. */}
          {selected && (
            <div className="vi-card vi-pop vi-lp-sheenwrap" {...tilt} style={{
              maxWidth: 560, margin: '0 auto 40px', padding: 20,
              display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap',
              // The callout wears the chosen design's colours too, so the page
              // confirms the choice in the language of the thing chosen.
              ...brandVars(brandOf(selected), dark),
              border: '1px solid var(--tb-border)',
            }}>
              <span style={{ fontSize: 34 }}>{selected.cover}</span>
              <div style={{ minWidth: 0, flex: 1 }}>
                <span className="vi-label" style={{ marginBottom: 2 }}>{t('pricing_your_choice')}</span>
                <p className="vi-tc-name" style={{ margin: 0 }}>{t(selected.nameKey as ViKey)}</p>
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
              <div style={{ display: 'grid', gap: 6, justifyItems: 'end' }}>
                <strong style={{ fontSize: 22, fontWeight: 850, whiteSpace: 'nowrap' }}>
                  {priceLabel(selected.id)}
                </strong>
                <button type="button" className="vi-btn vi-btn-ghost"
                  style={{ fontSize: 12.5, padding: '6px 12px' }}
                  onClick={() => choose(null)}>
                  {t('pricing_change')}
                </button>
              </div>
            </div>
          )}

          {!selected && (
            <p style={{
              margin: '0 auto 30px', maxWidth: 520, textAlign: 'center',
              fontSize: 14, color: 'var(--vi-muted)',
            }}>
              {t('pricing_pick_hint')}
            </p>
          )}

          {/* The three tiers. */}
          <div style={{ display: 'grid', gap: 22, gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
            {TEMPLATE_TIERS.map((tier, i) => {
              const templates = grouped.buckets[tier];
              // Premium is called out unless the visitor has already chosen a
              // template, in which case its own tier is the one to highlight.
              const featured = selectedPricing?.tier ? selectedPricing.tier === tier : tier === 'PREMIUM';
              return (
                <section
                  key={tier}
                  ref={reveal}
                  className={`vi-lp-tier vi-r vi-r-up${featured ? ' featured' : ''}`}
                  style={{ ['--d' as string]: `${i * 110}ms` }}
                >
                  <div>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: 7,
                      fontSize: 11, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase',
                      color: TIER_ACCENT[tier],
                    }}>
                      <span style={{
                        width: 7, height: 7, borderRadius: 2, transform: 'rotate(45deg)',
                        background: 'currentColor',
                      }} />
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
                    <div style={{ display: 'grid', gap: 12 }}>
                      {templates.map((tpl) => (
                        <TemplateCard
                          key={tpl.id}
                          tpl={tpl}
                          price={priceLabel(tpl.id)}
                          tier={tierOf(tpl.id)}
                          selected={tpl.id === selectedId}
                          onPreview={() => setPreview(tpl)}
                          onSelect={() => choose(tpl.id)}
                          selectLabel={t('lp_select')}
                        />
                      ))}
                    </div>
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
              <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
                {grouped.unassigned.map((tpl) => (
                  <TemplateCard
                    key={tpl.id}
                    tpl={tpl}
                    price={priceLabel(tpl.id)}
                    selected={tpl.id === selectedId}
                    onPreview={() => setPreview(tpl)}
                    onSelect={() => choose(tpl.id)}
                    selectLabel={t('lp_select')}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Contact details, exactly as the system administrator entered them.
              Rendered only where a value exists — an empty row would advertise a
              channel the studio does not actually answer. */}
          <section ref={reveal} className="vi-r vi-r-up" style={{ margin: '46px auto 0', maxWidth: 560, textAlign: 'center' }}>
            <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.6, color: 'var(--vi-muted)' }}>
              {t('pricing_contact')}
            </p>

            <div style={{
              marginTop: 18, display: 'flex', gap: 10,
              flexWrap: 'wrap', justifyContent: 'center',
            }}>
              {contact.phone.trim() && (
                <ContactLink href={`tel:${contact.phone.replace(/\s+/g, '')}`} icon="📞" label={contact.phone} />
              )}
              {contact.telegram.trim() && (
                <ContactLink href={telegramHref(contact.telegram)} icon="✈️" label={contact.telegram} />
              )}
              {contact.instagram.trim() && (
                <ContactLink href={instagramHref(contact.instagram)} icon="📷" label={contact.instagram} />
              )}
            </div>
          </section>
        </div>
      </main>

      {preview && (
        <TemplatePreviewModal
          tpl={preview}
          price={priceLabel(preview.id)}
          name={t(preview.nameKey as ViKey)}
          label={t('lp_select')}
          onSelect={() => { choose(preview.id); setPreview(null); }}
          onClose={() => setPreview(null)}
        />
      )}
    </div>
  );
};

// Live preview of one template, framed in that template's own palette, with
// its name and price above and the action that brings a visitor here pinned
// underneath.
function TemplatePreviewModal({ tpl, price, name, label, onSelect, onClose }: {
  tpl: TemplateDefinition; price: string; name: string; label: string;
  onSelect: () => void; onClose: () => void;
}) {
  const { effectiveConfig } = useTemplateOverrides();
  const dark = useVInviteStore((s) => s.uiTheme) === 'dark';
  // The administrator's saved Design+ config, not the shipped default — a
  // template edited in the studio must look the same here as everywhere else.
  const config = useMemo(
    () => resolveAssetUrls(tpl, effectiveConfig(tpl) as Record<string, unknown>),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tpl, effectiveConfig],
  );
  return (
    <PreviewShell
      onClose={onClose}
      brandStyle={brandVars(brandOf(tpl), dark)}
      header={(
        <>
          <span className="vi-pv-head-emoji" aria-hidden>{tpl.cover}</span>
          <span className="vi-pv-head-name">{name}</span>
          <span className="vi-pv-head-price">{price}</span>
        </>
      )}
      footer={(
        <button type="button" className="vi-tc-btn" style={{ width: '100%' }} onClick={onSelect}>
          {label} <span style={{ fontSize: 17 }}>→</span>
        </button>
      )}
    >
      <RichRenderer html={tpl.html} config={config} languages={ALL_LOCALES} interactive />
    </PreviewShell>
  );
}

function ContactLink({ href, icon, label }: { href: string; icon: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="vi-card"
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 16px',
        fontSize: 14.5, fontWeight: 650, textDecoration: 'none', color: 'inherit',
      }}
    >
      <span aria-hidden>{icon}</span>
      {label}
    </a>
  );
}
