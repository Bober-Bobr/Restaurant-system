import { useId, useState } from 'react';
import { useVInviteStore } from './store';
import { useViT, type ViKey } from './i18n';
import { brandOf, brandVars, longDescKey, shortDescKey } from './templateBrand';
import type { TemplateTier } from './api';
import type { TemplateDefinition } from './templates/types';

// ── One design in the catalog ────────────────────────────────────────────────
// Closed, it is a name, a price and a single line. Opened, it gives the full
// description and the button that matters — full-screen preview — pinned at the
// bottom where the reader's eye ends up after the description.
//
// Every colour comes from the design being advertised (see templateBrand.ts),
// so a row of cards reads as nine different products rather than nine copies of
// the site's own blue. The name is set in that design's own display face.

export function TemplateCard({ tpl, price, tier, selected, onPreview, onSelect, selectLabel }: {
  tpl: TemplateDefinition;
  price: string;
  tier?: TemplateTier | null;
  selected?: boolean;
  onPreview: () => void;
  /** Omitted on the landing page, where nothing is for sale yet. */
  onSelect?: () => void;
  selectLabel?: string;
}) {
  const t = useViT();
  const dark = useVInviteStore((s) => s.uiTheme) === 'dark';
  const [open, setOpen] = useState(false);
  const bodyId = useId();
  const brand = brandOf(tpl);

  return (
    <article
      className={`vi-tc${open ? ' open' : ''}${selected ? ' chosen' : ''}`}
      style={brandVars(brand, dark)}
    >
      {/* The whole head is the toggle: a card that says "more about this
          design" and then only responds to the last three words of it is a
          card people report as broken. */}
      <button
        type="button"
        className="vi-tc-head"
        aria-expanded={open}
        aria-controls={bodyId}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="vi-tc-emoji" aria-hidden>{tpl.cover}</span>

        <span className="vi-tc-headings">
          <span className="vi-tc-name">{t(tpl.nameKey as ViKey)}</span>
          <span className="vi-tc-short">{t(shortDescKey(tpl.id))}</span>
        </span>

        <span className="vi-tc-price">
          <span className="vi-tc-price-label">{t('cat_from')}</span>
          <strong>{price}</strong>
          {tier && <span className="vi-tc-tier">{t(`tier_${tier.toLowerCase()}` as ViKey)}</span>}
        </span>

        {/* Says what pressing does, rather than leaving a bare chevron to be
            deciphered. Hidden on a phone, where the head is already three
            columns wide and the price must not be squeezed for a label. */}
        <span className="vi-tc-toggle">
          {open ? t('cat_less') : t('cat_more')}
          <span className="vi-tc-chevron" aria-hidden>▾</span>
        </span>
      </button>

      {/* Removed from the page while closed rather than merely clipped: nine
          full descriptions of reserved-but-invisible height would leave the
          catalog grid full of holes. */}
      <div id={bodyId} className="vi-tc-body" hidden={!open}>
        <p className="vi-tc-long">{t(longDescKey(tpl.id))}</p>

        <div className="vi-tc-actions">
          <button type="button" className="vi-tc-btn" onClick={onPreview}>
            👁 {t('cat_preview')}
          </button>
          {onSelect && (
            <button type="button" className="vi-tc-btn ghost" onClick={onSelect}>
              {selectLabel} →
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
