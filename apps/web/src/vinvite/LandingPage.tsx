import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { Locale } from '../utils/translate';
import { useVInviteStore } from './store';
import { useViT, type ViKey } from './i18n';
import { useReveal, useScrollProgress, usePointerTilt } from './motion';
import { ViLogo, ViThemeToggle } from './VInviteApp';
import { usePromoShowcase } from './promoShowcase';
import { useTemplatePricing } from './templatePricing';
import { groupByTier, sellableTemplates, instagramHref, telegramHref } from './pricing';
import { usePlatformContacts } from '../hooks/usePlatformContacts';
import { getTemplateMeta, type TemplateMeta } from './templates/meta';
import { brandOf, brandVars, longDescKey, shortDescKey, type TemplateBrand } from './templateBrand';
import { TEMPLATE_TIERS, type PromoWork, type TemplateTier } from './api';

// ── v-invite.uz/main — public marketing landing ──────────────────────────────
// What a visitor sees: hero → our work → prices → closing CTA. There is no
// sign-in or sign-up here; the product is sold, not self-served.
//
// THE RULE THAT SHAPES THIS FILE: nothing on it renders a live invitation until
// a visitor asks for one. Every rich design is an iframe that pulls its own
// bundled artwork — measured, the two hero cards alone fetched over a megabyte
// of one template's photographs, and a gallery of live cards multiplied that by
// the number of cards. So the gallery and the price list are drawn from
// `templates/meta.ts` (a name, an emoji, an accent) and the machinery that can
// actually render a design — the registry, its markup, RichRenderer — is behind
// a `lazy()` boundary that only loads when a preview opens.
//
// "Our work" is REAL published invitations the administrator picked. It is
// opt-in and the section does not render at all until they pick some: filling
// it with blank templates advertised unfinished goods as a portfolio.

// The live renderer, and everything it drags with it. Split out so the 374 kB
// of template markup is fetched on the first preview rather than on page load.
const LivePreviewModal = lazy(() => import('./LivePreviewModal'));
// Type-only, so it is erased at build time and does NOT pull the chunk back in.
import type { PreviewTarget } from './LivePreviewModal';

function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(query).matches,
  );
  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    onChange();
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [query]);
  return matches;
}

// ── One thing the gallery can show ───────────────────────────────────────────
// A published invitation, reduced to what a poster needs. The design it was
// built from supplies the emoji and the palette, so the row stays visually
// varied without anything being rendered.
export type ShowcaseEntry = {
  id: string;
  name: string;
  meta: TemplateMeta | null;
  emoji: string;
  accent: string;
  site: PromoWork;
};

function workEntry(site: PromoWork): ShowcaseEntry {
  // A rich invitation borrows its design's emoji and accent; a block design has
  // neither, hence the fallbacks. Read from the METADATA, not the registry —
  // asking the registry here would pull every template's markup onto the page.
  const templateId = (site.theme as { templateId?: string } | null)?.templateId;
  const meta = typeof templateId === 'string' ? getTemplateMeta(templateId) : null;
  return {
    id: site.slug,
    name: site.name,
    meta,
    emoji: meta?.cover ?? '💌',
    accent: meta?.accent ?? (site.theme?.accentColor as string | undefined) ?? 'var(--vi-accent)',
    site,
  };
}

export const ViLandingPage = () => {
  const t = useViT();
  const locale = useVInviteStore((s) => s.locale);
  const setLocale = useVInviteStore((s) => s.setLocale);
  const reveal = useReveal();
  const progress = useScrollProgress();
  const [stuck, setStuck] = useState(false);
  const isMobile = useMediaQuery('(max-width: 860px)');
  const [preview, setPreview] = useState<PreviewTarget | null>(null);

  const { items, templates } = usePromoShowcase();
  const { byTemplate, priceLabel, tierOf } = useTemplatePricing();

  // `?template=` survives from the retired /pricing page's links, so a shared
  // or bookmarked URL still lands on the design it named.
  const [params, setParams] = useSearchParams();
  const selectedId = params.get('template');
  const choose = useCallback((id: string | null) => {
    const next = new URLSearchParams(params);
    if (id) next.set('template', id); else next.delete('template');
    // `replace`: changing your mind five times should not mean five presses of
    // the browser Back button to leave the page.
    setParams(next, { replace: true });
  }, [params, setParams]);

  // Already in gallery order — `splitWorks` puts the administrator's starred
  // invitations at the front. The section renders only when there ARE works:
  // filling it with blank templates advertised unfinished goods as a portfolio.
  const work = useMemo(
    () => (items.kind === 'works' ? items.works.map(workEntry) : []),
    [items],
  );

  /**
   * The designs actually on offer: the administrator has not hidden them, AND
   * they carry both a tier and a price. A listing with neither is a product a
   * visitor cannot be quoted — see `sellableTemplates`.
   */
  const onOffer = useMemo(
    () => sellableTemplates(
      templates.map((tpl) => getTemplateMeta(tpl.id)).filter((m): m is TemplateMeta => !!m),
      byTemplate,
    ),
    [templates, byTemplate],
  );

  useEffect(() => {
    const onScroll = () => setStuck(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const scrollTo = useCallback((id: string) => {
    if (id === 'top') { window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  /**
   * Arriving at `/main#pricing` — which is where `/pricing` now forwards to.
   *
   * The browser cannot do this itself: the section does not exist at the moment
   * the URL is read, because the price list is still being fetched. So it waits
   * for the element rather than for a timer, gives up after a few seconds
   * instead of polling a page that will never have one, and jumps rather than
   * smooth-scrolls — a slow glide down a page the visitor has only just landed
   * on reads as the page moving on its own.
   */
  const hash = typeof window !== 'undefined' ? window.location.hash.slice(1) : '';
  useEffect(() => {
    if (!hash) return;
    let tries = 0;
    const id = window.setInterval(() => {
      const el = document.getElementById(hash);
      if (el) { el.scrollIntoView({ block: 'start' }); window.clearInterval(id); }
      else if (++tries > 40) window.clearInterval(id);
    }, 100);
    return () => window.clearInterval(id);
  }, [hash]);

  const goPricing = () => scrollTo('pricing');
  const goWork = () => scrollTo(work.length > 0 ? 'work' : 'pricing');

  const previewTemplate = useCallback((meta: TemplateMeta) => setPreview({
    kind: 'template', id: meta.id, name: t(meta.nameKey as ViKey),
    emoji: meta.cover, price: priceLabel(meta.id),
  }), [t, priceLabel]);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', overflowX: 'hidden' }}>
      <div className="vi-lp-progress" style={{ transform: `scaleX(${progress})` }} aria-hidden />

      <LandingHeader
        t={t} stuck={stuck} locale={locale} setLocale={setLocale}
        isMobile={isMobile} onNav={scrollTo} hasWork={work.length > 0}
      />

      <main style={{ flex: 1 }}>
        <HeroSection t={t} onWork={goWork} onPricing={goPricing} />
        <NameMarquee entries={work} fallback={onOffer} t={t} />
        {work.length > 0 && (
          <WorkSection
            t={t} entries={work} reveal={reveal} num="01"
            onOpen={(entry) => setPreview({
              kind: 'work', site: entry.site, name: entry.name, emoji: entry.emoji,
            })}
          />
        )}
        <PricingSection
          t={t} reveal={reveal} num={work.length > 0 ? '02' : '01'}
          templates={onOffer} byTemplate={byTemplate}
          priceLabel={priceLabel} tierOf={tierOf}
          selectedId={selectedId} onSelect={choose}
          onPreview={previewTemplate}
        />
        <FinalCta t={t} reveal={reveal} onPricing={goPricing} />
      </main>

      <footer style={{ borderTop: '1px solid var(--vi-border)', padding: '30px 20px' }}>
        <div style={{
          maxWidth: 1180, margin: '0 auto', display: 'flex', alignItems: 'center',
          gap: 14, flexWrap: 'wrap', justifyContent: 'space-between',
        }}>
          <div>
            <ViLogo size={30} />
            <p style={{ margin: '8px 0 0', fontSize: 13, color: 'var(--vi-muted)' }}>{t('lp_footer_tag')}</p>
          </div>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--vi-muted)' }}>
            © {new Date().getFullYear()} v-invite.uz — {t('lp_rights')}
          </p>
        </div>
      </footer>

      {/* The only live invitation on the page, and only once asked for. The
          fallback is blank rather than a spinner: the shell it opens into is
          already on screen, so a spinner inside a frame reads as an error. */}
      {preview && (
        <Suspense fallback={null}>
          <LivePreviewModal
            target={preview}
            selectLabel={t('lp_select')}
            onSelect={preview.kind === 'template' ? () => { choose(preview.id); setPreview(null); } : undefined}
            onClose={() => setPreview(null)}
          />
        </Suspense>
      )}
    </div>
  );
};

// ── Header ───────────────────────────────────────────────────────────────────

const NAV_ITEMS: { id: string; label: ViKey }[] = [
  { id: 'work', label: 'lp_nav_work' },
  { id: 'pricing', label: 'lp_nav_pricing' },
];

function LandingHeader({ t, stuck, locale, setLocale, isMobile, onNav, hasWork }: {
  t: (k: ViKey) => string;
  stuck: boolean;
  locale: Locale;
  setLocale: (l: Locale) => void;
  isMobile: boolean;
  onNav: (id: string) => void;
  /** "Our work" is dropped from the nav when there is none — a link to a
      section that is not on the page does nothing and looks broken. */
  hasWork: boolean;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const items = hasWork ? NAV_ITEMS : NAV_ITEMS.filter((i) => i.id !== 'work');

  useEffect(() => { if (!isMobile) setMenuOpen(false); }, [isMobile]);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenuOpen(false); };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [menuOpen]);

  // Closing the sheet also releases the body scroll lock, but that only happens
  // once React commits — so the scroll has to wait for the next frame or it
  // would run against a still-locked body and do nothing.
  const go = (id: string) => {
    if (!menuOpen) { onNav(id); return; }
    setMenuOpen(false);
    requestAnimationFrame(() => requestAnimationFrame(() => onNav(id)));
  };

  const localeSelect = (compact: boolean) => (
    <select
      className="vi-select"
      style={compact
        ? { width: 'auto', padding: '8px 10px', fontSize: 13 }
        : { width: '100%', padding: '12px 14px', fontSize: 15 }}
      value={locale}
      onChange={(e) => setLocale(e.target.value as Locale)}
      aria-label="Language"
    >
      <option value="ru">RU — Русский</option>
      <option value="uz">UZ — Ozbekcha</option>
      <option value="en">EN — English</option>
    </select>
  );

  return (
    <header className={`vi-lp-head${stuck || menuOpen ? ' stuck' : ''}`}>
      <div className="vi-lp-head-bar">
        <button
          type="button"
          onClick={() => go('top')}
          style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'inherit', display: 'flex' }}
          aria-label="v-invite.uz"
        >
          <ViLogo size={isMobile ? 28 : 34} />
        </button>

        <nav className="vi-lp-nav">
          {items.map((item) => (
            <button key={item.id} type="button" className="vi-lp-navlink" onClick={() => go(item.id)}>
              {t(item.label)}
            </button>
          ))}
        </nav>

        <div className="vi-lp-head-right">
          <span className="vi-lp-desktop-only">{localeSelect(true)}</span>
          <ViThemeToggle />

          {/* No sign-in or sign-up: this site has no self-serve accounts. */}

          <button
            type="button"
            className={`vi-lp-burger${menuOpen ? ' open' : ''}`}
            aria-label="Menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}
          >
            <span /><span /><span />
          </button>
        </div>
      </div>

      {isMobile && (
        <>
          <div
            className={`vi-lp-sheet-scrim${menuOpen ? ' open' : ''}`}
            onClick={() => setMenuOpen(false)}
            aria-hidden="true"
          />
          <div className={`vi-lp-sheet${menuOpen ? ' open' : ''}`}>
            <nav style={{ display: 'grid', gap: 4 }}>
              {items.map((item, i) => (
                <button
                  key={item.id}
                  type="button"
                  className="vi-lp-sheet-link"
                  style={{ transitionDelay: menuOpen ? `${60 + i * 45}ms` : '0ms' }}
                  onClick={() => go(item.id)}
                >
                  {t(item.label)}
                  <span aria-hidden="true">→</span>
                </button>
              ))}
            </nav>
            <div style={{ display: 'grid', gap: 10, marginTop: 16 }}>
              {localeSelect(false)}
            </div>
          </div>
        </>
      )}
    </header>
  );
}

// ── Shared section furniture ─────────────────────────────────────────────────

function SectionHead({ num, kicker, title, sub, reveal }: {
  num: string; kicker: string; title: string; sub: string;
  reveal: (el: HTMLElement | null) => void;
}) {
  return (
    <div ref={reveal} className="vi-r vi-r-up" style={{ maxWidth: 720, margin: '0 auto 46px' }}>
      <div className="vi-lp-sec-head">
        <span className="vi-lp-sec-num">{num}</span>
        <span className="vi-lp-kicker" style={{ margin: 0 }}>{kicker}</span>
        <span className="vi-lp-sec-rule" />
      </div>
      <h2 className="vi-lp-display">{title}</h2>
      <p style={{ margin: '14px 0 0', fontSize: 16.5, lineHeight: 1.6, color: 'var(--vi-muted)', maxWidth: 560 }}>
        {sub}
      </p>
    </div>
  );
}

// A slow band of names between the hero and the gallery. Duplicated once so the
// loop is seamless — the track translates exactly -50%, which lands the copy
// precisely where the original started. The copy is aria-hidden so a screen
// reader hears the list once, not twice.
function NameMarquee({ entries, fallback, t }: {
  entries: ShowcaseEntry[];
  /** Design names, for a site with no published work chosen yet. */
  fallback: TemplateMeta[];
  t: (k: ViKey) => string;
}) {
  const names = entries.length > 0
    ? entries.map((e) => ({ key: e.id, emoji: e.emoji, name: e.name }))
    : fallback.map((m) => ({ key: m.id, emoji: m.cover, name: t(m.nameKey as ViKey) }));
  if (names.length === 0) return null;
  const row = (hidden: boolean) => names.map((n) => (
    <span className="vi-lp-marquee-item" key={`${n.key}-${hidden}`} aria-hidden={hidden || undefined}>
      <span className="vi-lp-marquee-dot" />
      <span style={{ fontSize: 17 }}>{n.emoji}</span>
      {n.name}
    </span>
  ));
  return (
    <div className="vi-lp-marquee">
      <div className="vi-lp-marquee-track">
        {row(false)}
        {row(true)}
      </div>
    </div>
  );
}

// ── Hero ─────────────────────────────────────────────────────────────────────
// Type only. The two live invitation cards that used to sit beside it were the
// single most expensive thing on the site — measured, they fetched over a
// megabyte of one design's photographs before a visitor had asked to see
// anything — and the counters beside them ("12 designs, 3 languages") were
// removed on request.

function HeroSection({ t, onWork, onPricing }: {
  t: (k: ViKey) => string; onWork: () => void; onPricing: () => void;
}) {
  // The headline rises word by word, each one slightly behind the last.
  const line1 = t('lp_hero_title_1').split(' ');
  const line2 = t('lp_hero_title_2').split(' ');
  let wordIndex = 0;
  const word = (w: string, gradient = false) => {
    const delay = 220 + wordIndex * 85;
    wordIndex += 1;
    return (
      <span key={`${w}-${delay}`} className="vi-lp-word" style={{ animationDelay: `${delay}ms` }}>
        <span className={gradient ? 'vi-lp-gradient' : undefined}>{w}</span>{' '}
      </span>
    );
  };

  return (
    <section className="vi-lp-hero vi-lp-hero-solo">
      <div className="vi-lp-aurora vi-lp-aurora-a" style={{ background: 'radial-gradient(circle, rgba(37,99,235,0.34), transparent 68%)' }} />
      <div className="vi-lp-aurora vi-lp-aurora-b" style={{ background: 'radial-gradient(circle, rgba(217,168,90,0.34), transparent 68%)', animationDelay: '-8s' }} />
      <div className="vi-lp-aurora vi-lp-aurora-c" style={{ background: 'radial-gradient(circle, rgba(167,139,250,0.26), transparent 70%)', animationDelay: '-15s' }} />

      <div className="vi-lp-hero-grid">
        <div className="vi-lp-hero-copy">
          <span className="vi-pop vi-lp-badge" style={{ animationDelay: '80ms' }}>
            ✨ {t('lp_badge')}
          </span>

          <h1 className="vi-lp-h1">
            <span style={{ display: 'block', overflow: 'hidden', paddingBottom: 4 }}>
              {line1.map((w) => word(w))}
            </span>
            <span style={{ display: 'block', overflow: 'hidden', paddingBottom: 4 }}>
              {line2.map((w) => word(w, true))}
            </span>
          </h1>

          <p className="vi-fade-up vi-lp-hero-sub" style={{ animationDelay: '620ms' }}>
            {t('lp_hero_sub')}
          </p>

          <div className="vi-fade-up vi-lp-hero-cta" style={{ animationDelay: '760ms' }}>
            <button type="button" className="vi-btn vi-btn-primary" onClick={onWork}>
              👁 {t('lp_cta_secondary')}
            </button>
            <button type="button" className="vi-btn vi-btn-ghost" onClick={onPricing}>
              💎 {t('lp_nav_pricing')}
            </button>
          </div>
        </div>
      </div>

      <div className="vi-fade-up vi-lp-scroll" style={{ animationDelay: '1100ms' }}>
        <span style={{ fontSize: 11.5, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--vi-muted)', fontWeight: 700 }}>
          {t('lp_scroll')}
        </span>
        <span style={{
          width: 24, height: 38, borderRadius: 999, border: '2px solid var(--vi-border)',
          display: 'flex', justifyContent: 'center', paddingTop: 7,
        }}>
          <span className="vi-lp-scroll-dot" style={{ width: 4, height: 7, borderRadius: 999, background: 'var(--vi-accent)' }} />
        </span>
      </div>
    </section>
  );
}

// ── A design, drawn without rendering it ─────────────────────────────────────
// The poster that stands in for a live preview. Everything it shows comes from
// the design's own palette and display face (templateBrand.ts), so a row of
// them reads as a shelf of different products — and it costs no requests at
// all, which is the entire point.

function DesignPoster({ emoji, name, accent, brand, dark, caption }: {
  emoji: string; name: string; accent: string; brand: TemplateBrand; dark: boolean;
  caption?: string;
}) {
  return (
    <span className="vi-poster" style={{ ...brandVars(brand, dark), ['--pa' as string]: accent }}>
      <span className="vi-poster-glow" aria-hidden />
      <span className="vi-poster-rule" aria-hidden />
      <span className="vi-poster-emoji" aria-hidden>{emoji}</span>
      <span className="vi-poster-name">{name}</span>
      {caption && <span className="vi-poster-caption">{caption}</span>}
      <span className="vi-poster-rule" aria-hidden />
    </span>
  );
}

// ── Our work ─────────────────────────────────────────────────────────────────
// Finished invitations, as a slider. Nothing here is for sale — an invitation
// belongs to the customer whose wedding it was — so there is no price and no
// "select", only the name and the way in.
//
// A slider rather than a grid: a studio accumulates work indefinitely, and a
// grid of everything ever published turns the page into a scroll. It is built
// on native scroll-snap, so a phone flicks through it with no JS at all and the
// buttons are an addition for pointer users rather than the mechanism.

function WorkSection({ t, entries, reveal, num, onOpen }: {
  t: (k: ViKey) => string;
  entries: ShowcaseEntry[];
  reveal: (el: HTMLElement | null) => void;
  num: string;
  onOpen: (entry: ShowcaseEntry) => void;
}) {
  const dark = useVInviteStore((s) => s.uiTheme) === 'dark';
  const railRef = useRef<HTMLDivElement>(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);

  // The arrows are disabled at the ends rather than wrapping around: a slider
  // that silently jumps back to the first card reads as having lost your place.
  const measure = useCallback(() => {
    const el = railRef.current;
    if (!el) return;
    setAtStart(el.scrollLeft <= 2);
    // A tolerance, not equality — fractional zoom leaves a sub-pixel remainder
    // and the last card could never be reached.
    setAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 2);
  }, []);

  useEffect(() => {
    measure();
    const el = railRef.current;
    if (!el) return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [measure, entries.length]);

  const page = (dir: -1 | 1) => {
    const el = railRef.current;
    if (!el) return;
    // One card at a time, taken from the first child's real width, so the step
    // follows the layout instead of a number that has to be kept in step with
    // the CSS.
    const card = el.firstElementChild as HTMLElement | null;
    const step = card ? card.offsetWidth + 18 : el.clientWidth * 0.8;
    el.scrollBy({ left: dir * step, behavior: 'smooth' });
  };

  return (
    <section id="work" style={{ padding: '90px 20px', scrollMarginTop: 70 }}>
      <div style={{ maxWidth: 1180, margin: '0 auto' }}>
        <SectionHead
          num={num} kicker={t('work_kicker')} title={t('work_title')}
          sub={t('work_sub')} reveal={reveal}
        />

        <div ref={reveal} className="vi-r vi-r-up vi-slider">
          <div className="vi-slider-rail" ref={railRef} onScroll={measure}>
            {entries.map((entry, i) => (
              <button
                key={entry.id}
                type="button"
                className="vi-work vi-slider-slide"
                onClick={() => onOpen(entry)}
                title={t('work_open')}
              >
                <span className="vi-work-stage">
                  <DesignPoster
                    emoji={entry.emoji}
                    name={entry.name}
                    accent={entry.accent}
                    brand={brandOf(entry.meta ?? { id: entry.id, accent: entry.accent })}
                    dark={dark}
                  />
                  <span className="vi-work-veil"><span>👁 {t('work_open')}</span></span>
                </span>
                <span className="vi-work-foot">
                  <span className="vi-work-dot" style={{ background: entry.accent }} />
                  <span className="vi-work-name">{entry.name}</span>
                  <span className="vi-work-num">{String(i + 1).padStart(2, '0')}</span>
                </span>
              </button>
            ))}
          </div>

          {/* Hidden entirely when everything already fits — two dead arrows are
              worse than none. */}
          {!(atStart && atEnd) && (
            <div className="vi-slider-nav">
              <button type="button" className="vi-slider-btn" onClick={() => page(-1)}
                disabled={atStart} aria-label={t('slider_prev')}>‹</button>
              <button type="button" className="vi-slider-btn" onClick={() => page(1)}
                disabled={atEnd} aria-label={t('slider_next')}>›</button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

// ── Prices, and choosing a design ────────────────────────────────────────────
// This was its own page. It is here because a visitor deciding what to buy
// should not have to leave the page that convinced them — and because the two
// halves, "what does it cost" and "which one", were split across two screens
// that each had to re-explain the other.
//
// Only designs carrying BOTH a tier and a price appear; see `sellableTemplates`.

const TIER_ACCENT: Record<TemplateTier, string> = {
  STANDARD: 'var(--vi-muted)',
  PREMIUM: 'var(--vi-accent)',
  LUXURY: '#c9a96a',
};

function PricingSection({
  t, reveal, num, templates, byTemplate, priceLabel, tierOf, selectedId, onSelect, onPreview,
}: {
  t: (k: ViKey) => string;
  reveal: (el: HTMLElement | null) => void;
  num: string;
  templates: TemplateMeta[];
  byTemplate: Map<string, { tier: TemplateTier | null; priceCents?: number | null }>;
  priceLabel: (id: string) => string;
  tierOf: (id: string) => TemplateTier | null;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onPreview: (meta: TemplateMeta) => void;
}) {
  const contactFor = usePlatformContacts();
  const contact = contactFor('vinvite');
  const dark = useVInviteStore((s) => s.uiTheme) === 'dark';
  const tilt = usePointerTilt(4);

  const grouped = useMemo(() => groupByTier(templates, byTemplate), [templates, byTemplate]);
  const selected = templates.find((m) => m.id === selectedId) ?? null;
  const selectedTier = selected ? tierOf(selected.id) : null;

  return (
    <section id="pricing" style={{ padding: '90px 20px', scrollMarginTop: 70 }}>
      <div style={{ maxWidth: 1180, margin: '0 auto' }}>
        <SectionHead
          num={num} kicker={t('pricing_kicker')} title={t('pricing_title')}
          sub={t('pricing_sub')} reveal={reveal}
        />

        {/* Nothing priced yet. Said plainly rather than rendered as three empty
            columns, which reads as a broken page rather than an unfinished one. */}
        {templates.length === 0 ? (
          <p style={{ margin: '0 auto', maxWidth: 520, textAlign: 'center', fontSize: 15, color: 'var(--vi-muted)' }}>
            {t('pricing_none')}
          </p>
        ) : (
          <>
            {selected && (
              <div className="vi-card vi-pop vi-lp-sheenwrap" {...tilt} style={{
                maxWidth: 560, margin: '0 auto 40px', padding: 20,
                display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap',
                // The callout wears the chosen design's colours, so the page
                // confirms the choice in the language of the thing chosen.
                ...brandVars(brandOf(selected), dark),
                border: '1px solid var(--tb-border)',
              }}>
                <span style={{ fontSize: 34 }}>{selected.cover}</span>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <span className="vi-label" style={{ marginBottom: 2 }}>{t('pricing_your_choice')}</span>
                  <p className="vi-tc-name" style={{ margin: 0 }}>{t(selected.nameKey as ViKey)}</p>
                  {selectedTier && (
                    <span style={{
                      display: 'inline-block', marginTop: 6, padding: '3px 10px', borderRadius: 999,
                      fontSize: 11, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase',
                      color: TIER_ACCENT[selectedTier],
                      border: `1px solid ${TIER_ACCENT[selectedTier]}`,
                    }}>
                      {t(`tier_${selectedTier.toLowerCase()}` as ViKey)}
                    </span>
                  )}
                </div>
                <div style={{ display: 'grid', gap: 6, justifyItems: 'end' }}>
                  <strong style={{ fontSize: 22, fontWeight: 850, whiteSpace: 'nowrap' }}>
                    {priceLabel(selected.id)}
                  </strong>
                  <button type="button" className="vi-btn vi-btn-ghost"
                    style={{ fontSize: 12.5, padding: '6px 12px' }}
                    onClick={() => onSelect(null)}>
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

            <div style={{ display: 'grid', gap: 22, gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
              {TEMPLATE_TIERS.map((tier, i) => {
                const inTier = grouped.buckets[tier];
                // Premium is called out unless the visitor has already chosen,
                // in which case their own tier is the one to highlight.
                const featured = selectedTier ? selectedTier === tier : tier === 'PREMIUM';
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

                    {inTier.length === 0 ? (
                      <p style={{ margin: 0, fontSize: 13.5, color: 'var(--vi-muted)' }}>{t('pricing_tier_empty')}</p>
                    ) : (
                      <div style={{ display: 'grid', gap: 12 }}>
                        {inTier.map((meta) => (
                          <DesignRow
                            key={meta.id}
                            meta={meta}
                            t={t}
                            price={priceLabel(meta.id)}
                            tier={tierOf(meta.id)}
                            selected={meta.id === selectedId}
                            onPreview={() => onPreview(meta)}
                            onSelect={() => onSelect(meta.id)}
                          />
                        ))}
                      </div>
                    )}
                  </section>
                );
              })}
            </div>
          </>
        )}

        {/* Contact details, exactly as the system administrator entered them.
            Rendered only where a value exists — an empty row would advertise a
            channel the studio does not actually answer. */}
        <div ref={reveal} className="vi-r vi-r-up" style={{ margin: '46px auto 0', maxWidth: 560, textAlign: 'center' }}>
          <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.6, color: 'var(--vi-muted)' }}>
            {t('pricing_contact')}
          </p>
          <div style={{ marginTop: 18, display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
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
        </div>
      </div>
    </section>
  );
}

// One design in a tier. The same card the catalog used, minus its dependency on
// the registry: it takes metadata, so listing every design costs no markup.
function DesignRow({ meta, t, price, tier, selected, onPreview, onSelect }: {
  meta: TemplateMeta;
  t: (k: ViKey) => string;
  price: string;
  tier: TemplateTier | null;
  selected: boolean;
  onPreview: () => void;
  onSelect: () => void;
}) {
  const dark = useVInviteStore((s) => s.uiTheme) === 'dark';
  const [open, setOpen] = useState(false);

  return (
    <article className={`vi-tc${open ? ' open' : ''}${selected ? ' chosen' : ''}`} style={brandVars(brandOf(meta), dark)}>
      {/* The whole head is the toggle: a card that says "more about this
          design" and then only responds to the last three words of it is a
          card people report as broken. */}
      <button type="button" className="vi-tc-head" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <span className="vi-tc-top">
          <span className="vi-tc-emoji" aria-hidden>{meta.cover}</span>
          <span className="vi-tc-headings">
            <span className="vi-tc-name">{t(meta.nameKey as ViKey)}</span>
            <span className="vi-tc-short">{t(shortDescKey(meta.id))}</span>
          </span>
          <span className="vi-tc-price">
            <span className="vi-tc-price-label">{t('cat_from')}</span>
            <strong>{price}</strong>
            {tier && <span className="vi-tc-tier">{t(`tier_${tier.toLowerCase()}` as ViKey)}</span>}
          </span>
        </span>
        <span className="vi-tc-toggle">
          {open ? t('cat_less') : t('cat_more')}
          <span className="vi-tc-chevron" aria-hidden>▾</span>
        </span>
      </button>

      {/* Removed from the page while closed rather than merely clipped: twelve
          full descriptions of reserved-but-invisible height would leave the
          columns full of holes. */}
      <div className="vi-tc-body" hidden={!open}>
        <p className="vi-tc-long">{t(longDescKey(meta.id))}</p>
        <div className="vi-tc-actions">
          <button type="button" className="vi-tc-btn" onClick={onPreview}>
            👁 {t('cat_preview')}
          </button>
          <button type="button" className="vi-tc-btn ghost" onClick={onSelect}>
            {t('lp_select')} →
          </button>
        </div>
      </div>
    </article>
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

// ── Closing CTA ──────────────────────────────────────────────────────────────

function FinalCta({ t, reveal, onPricing }: {
  t: (k: ViKey) => string; reveal: (el: HTMLElement | null) => void; onPricing: () => void;
}) {
  return (
    <section style={{ padding: '20px 20px 100px' }}>
      <div ref={reveal} className="vi-r vi-r-zoom" style={{ maxWidth: 1180, margin: '0 auto' }}>
        <div style={{
          position: 'relative', overflow: 'hidden', borderRadius: 26, padding: '62px 30px', textAlign: 'center',
          border: '1px solid var(--vi-border)',
          background: 'linear-gradient(135deg, var(--vi-accent-soft), transparent 60%), var(--vi-card)',
          boxShadow: 'var(--vi-shadow)',
        }}>
          <div className="vi-lp-aurora" style={{ width: 420, height: 420, top: -190, left: '50%', marginLeft: -210, background: 'radial-gradient(circle, rgba(37,99,235,0.28), transparent 68%)' }} />
          <div style={{ position: 'relative' }}>
            <h2 className="vi-lp-display" style={{ fontSize: 'clamp(26px, 3.8vw, 42px)' }}>
              {t('lp_final_title')}
            </h2>
            <p style={{ margin: '14px auto 0', maxWidth: 460, fontSize: 16.5, lineHeight: 1.6, color: 'var(--vi-muted)' }}>
              {t('lp_final_sub')}
            </p>
            <button
              type="button"
              className="vi-btn vi-btn-primary vi-lp-cta"
              style={{ marginTop: 28, padding: '16px 34px', fontSize: 16, borderRadius: 14 }}
              onMouseMove={(e) => {
                const r = e.currentTarget.getBoundingClientRect();
                e.currentTarget.style.setProperty('--mx', `${e.clientX - r.left}px`);
                e.currentTarget.style.setProperty('--my', `${e.clientY - r.top}px`);
              }}
              onClick={onPricing}
            >
              {t('lp_nav_pricing')} <span style={{ fontSize: 18 }}>→</span>
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
