import { Fragment, Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
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

  const [params, setParams] = useSearchParams();
  const chooseTier = useCallback((tier: TemplateTier | null) => {
    const next = new URLSearchParams(params);
    if (tier) next.set('tier', tier); else next.delete('tier');
    // A tier is the choice now, so a design named in the URL is stale the
    // moment one is picked.
    next.delete('template');
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

  /**
   * Which tier is chosen.
   *
   * `?tier=` is the live parameter. `?template=` is read as a FALLBACK and
   * resolved to whichever tier that design sits in, because the retired
   * /pricing page's links carry one and they have been shared — landing on the
   * right shelf is the nearest honest thing to what the link promised, now
   * that a design is not something a visitor selects.
   */
  const selectedTier = useMemo<TemplateTier | null>(() => {
    const named = params.get('tier');
    if (named && (TEMPLATE_TIERS as readonly string[]).includes(named)) return named as TemplateTier;
    const legacy = params.get('template');
    return legacy ? tierOf(legacy) : null;
  }, [params, tierOf]);

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
          templates={onOffer} byTemplate={byTemplate} priceLabel={priceLabel}
          selectedTier={selectedTier} onSelectTier={chooseTier}
          onPreview={previewTemplate}
        />
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
          {/* No "select" any more, for either kind. A customer's invitation was
              never on sale, and a design is now an illustration of its tier
              rather than the thing chosen — the choice is the tier, made on the
              card the preview was opened from. */}
          <LivePreviewModal target={preview} onClose={() => setPreview(null)} />
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
  /**
   * The headline rises word by word, each one slightly behind the last.
   *
   * The separating space sits OUTSIDE `.vi-lp-word`, and that is the whole of
   * it: the class is `display: inline-block`, and a space at the END of an
   * inline-block's content is trailing whitespace on that box's last line, so
   * CSS removes it. Inside the box the words rendered flush against each other
   * — measured, "которые" ended at x=303 and "запомнят" began at x=302.
   *
   * A `&nbsp;` would also have shown a gap and would have been wrong: the
   * headline has to wrap on a phone, and a non-breaking space is precisely the
   * instruction not to.
   */
  const line1 = t('lp_hero_title_1').split(' ');
  const line2 = t('lp_hero_title_2').split(' ');
  let wordIndex = 0;
  const word = (w: string, gradient = false) => {
    const delay = 220 + wordIndex * 85;
    wordIndex += 1;
    return (
      <Fragment key={`${w}-${delay}`}>
        <span className="vi-lp-word" style={{ animationDelay: `${delay}ms` }}>
          <span className={gradient ? 'vi-lp-gradient' : undefined}>{w}</span>
        </span>{' '}
      </Fragment>
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
  /**
   * Whether the rail needs the centring gutter.
   *
   * The card the reader is on sits in the middle, and reaching the middle with
   * the FIRST card requires half a rail of empty space in front of it. That is
   * right while there is more work than fits — and silly when there is not: a
   * gallery of four on a wide screen would show one card marooned in the centre
   * with the other three off to the right and a screen's worth of nothing on
   * the left.
   *
   * So the gutter is conditional, and the condition is measured rather than
   * guessed at a breakpoint.
   */
  const [needsGutter, setNeedsGutter] = useState(false);

  // The arrows are disabled at the ends rather than wrapping around: a slider
  // that silently jumps back to the first card reads as having lost your place.
  const measure = useCallback(() => {
    const el = railRef.current;
    if (!el) return;
    setAtStart(el.scrollLeft <= 2);
    // A tolerance, not equality — fractional zoom leaves a sub-pixel remainder
    // and the last card could never be reached.
    setAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 2);

    // Measured against the WRAPPER, not the rail: the rail's own width already
    // includes whatever gutter is currently applied, so asking it would answer
    // a question about the last answer.
    const card = el.firstElementChild as HTMLElement | null;
    const avail = el.parentElement?.clientWidth ?? 0;
    if (card && avail > 0) {
      const GAP = 18;
      const natural = entries.length * card.offsetWidth + (entries.length - 1) * GAP;
      setNeedsGutter(natural > avail);
    }
  }, [entries.length]);

  useEffect(() => {
    measure();
    const el = railRef.current;
    if (!el) return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    if (el.parentElement) ro.observe(el.parentElement);
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
          <div
            className={`vi-slider-rail${needsGutter ? ' is-centred' : ''}`}
            ref={railRef}
            onScroll={measure}
          >
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

// ── Prices ───────────────────────────────────────────────────────────────────
// This was its own page. It is here because a visitor deciding what to buy
// should not have to leave the page that convinced them.
//
// WHAT IS CHOSEN IS A TIER, not a design. The three are a ladder — each one
// buys more elaborate work than the last — and that is the decision a customer
// is actually able to make before speaking to anyone: which of these is the
// evening worth. Picking a specific design was asking them to commit to
// something they can still change, and it made the page a catalog rather than
// a price list. The designs are still shown inside their tier, and still open
// full screen, because that is what makes a tier mean anything — but they are
// illustrations of the tier now, not the thing being selected.
//
// Only designs carrying BOTH a tier and a price appear; see `sellableTemplates`.

const TIER_ACCENT: Record<TemplateTier, string> = {
  STANDARD: 'var(--vi-muted)',
  PREMIUM: 'var(--vi-accent)',
  LUXURY: '#c9a96a',
};

/** The ladder, drawn. One mark for Standard, three for Luxury. */
const TIER_MARKS: Record<TemplateTier, number> = { STANDARD: 1, PREMIUM: 2, LUXURY: 3 };

function PricingSection({
  t, reveal, num, templates, byTemplate, priceLabel, selectedTier, onSelectTier, onPreview,
}: {
  t: (k: ViKey) => string;
  reveal: (el: HTMLElement | null) => void;
  num: string;
  templates: TemplateMeta[];
  byTemplate: Map<string, { tier: TemplateTier | null; priceCents?: number | null }>;
  priceLabel: (id: string) => string;
  selectedTier: TemplateTier | null;
  onSelectTier: (tier: TemplateTier | null) => void;
  onPreview: (meta: TemplateMeta) => void;
}) {
  const contactFor = usePlatformContacts();
  const contact = contactFor('vinvite');

  const grouped = useMemo(() => groupByTier(templates, byTemplate), [templates, byTemplate]);
  /** Tiers that actually have something in them — an empty column is not an offer. */
  const tiers = useMemo(
    () => TEMPLATE_TIERS.filter((tier) => grouped.buckets[tier].length > 0),
    [grouped],
  );

  /**
   * The cheapest design in a tier, which is what "from" means.
   *
   * Read off `priceLabel` rather than formatted here, so there is still exactly
   * one definition of what a price reads as.
   */
  const fromPrice = (tier: TemplateTier): string => {
    const inTier = grouped.buckets[tier];
    let best: { id: string; cents: number } | null = null;
    for (const meta of inTier) {
      const cents = byTemplate.get(meta.id)?.priceCents;
      if (cents == null) continue;
      if (!best || cents < best.cents) best = { id: meta.id, cents };
    }
    return best ? priceLabel(best.id) : '';
  };

  return (
    <section id="pricing" style={{ padding: '90px 0 90px', scrollMarginTop: 70 }}>
      <div style={{ maxWidth: 1180, margin: '0 auto', padding: '0 20px' }}>
        <SectionHead
          num={num} kicker={t('pricing_kicker')} title={t('pricing_title')}
          sub={t('pricing_sub')} reveal={reveal}
        />
      </div>

      {/* Nothing priced yet. Said plainly rather than rendered as three empty
          columns, which reads as a broken page rather than an unfinished one. */}
      {tiers.length === 0 ? (
        <p style={{ margin: '0 auto', maxWidth: 520, padding: '0 20px', textAlign: 'center', fontSize: 15, color: 'var(--vi-muted)' }}>
          {t('pricing_none')}
        </p>
      ) : (
        <>
          <p style={{
            margin: '0 auto 26px', maxWidth: 520, padding: '0 20px',
            textAlign: 'center', fontSize: 14, color: 'var(--vi-muted)',
          }}>
            {selectedTier ? t('pricing_tier_chosen') : t('pricing_pick_tier')}
          </p>

          <TierSlider
            t={t} tiers={tiers} grouped={grouped} fromPrice={fromPrice}
            selectedTier={selectedTier} onSelectTier={onSelectTier} onPreview={onPreview}
          />
        </>
      )}

      {/* Contact details, exactly as the system administrator entered them.
          Rendered only where a value exists — an empty row would advertise a
          channel the studio does not actually answer. */}
      <div ref={reveal} className="vi-r vi-r-up" style={{ margin: '46px auto 0', maxWidth: 560, padding: '0 20px', textAlign: 'center' }}>
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
    </section>
  );
}

/**
 * The three tiers as a carousel, the chosen one held in the centre.
 *
 * Centred rather than left-aligned because the point of the control is the
 * LADDER: what a tier costs only means something beside the one below and the
 * one above it, so the chosen card sits in the middle with its neighbours
 * visible at its shoulders. Left-aligning would put Luxury alone against the
 * edge of the screen with nothing to be more expensive than.
 *
 * The centring is done twice over, and both are needed. `scroll-snap-align:
 * center` is what a finger lands on; `scrollIntoView({ inline: 'center' })` is
 * what a click on a neighbour does, because pressing a card must bring it in
 * rather than leave the reader to drag it there.
 */
function TierSlider({ t, tiers, grouped, fromPrice, selectedTier, onSelectTier, onPreview }: {
  t: (k: ViKey) => string;
  tiers: TemplateTier[];
  grouped: { buckets: Record<TemplateTier, TemplateMeta[]> };
  fromPrice: (tier: TemplateTier) => string;
  selectedTier: TemplateTier | null;
  onSelectTier: (tier: TemplateTier | null) => void;
  onPreview: (meta: TemplateMeta) => void;
}) {
  const railRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef(new Map<TemplateTier, HTMLDivElement>());

  /**
   * Bring the chosen tier to the middle.
   *
   * Two deliberate choices here.
   *
   * `scrollTo`, not `scrollIntoView`: the latter scrolls every scrollable
   * ancestor, so on the first paint it would drag the PAGE down to the price
   * list as well — a page that jumps to its middle as it loads.
   *
   * And the animation is left to CSS (`scroll-behavior` on the rail) rather
   * than passed as `behavior: 'smooth'` here. That keeps this function
   * deterministic — it sets a position, and the position is the thing worth
   * being sure of — and it means the reduced-motion block that already governs
   * the rail governs this too, instead of the preference having to be checked
   * again in script. The first paint is instant because the rail only gains
   * `scroll-behavior: smooth` once it is settled, for the same reason: a page
   * that scrolls itself sideways while loading reads as broken, and `?tier=` in
   * the URL means the card should simply already be there.
   */
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    const tier = selectedTier ?? tiers[Math.floor(tiers.length / 2)];
    const card = tier ? cardRefs.current.get(tier) : null;
    const rail = railRef.current;
    if (!card || !rail) return;
    rail.scrollTo({ left: card.offsetLeft - (rail.clientWidth - card.clientWidth) / 2 });
    if (!settled) setSettled(true);
  }, [selectedTier, tiers, settled]);

  return (
    <div className="vi-tierslider">
      <div className={`vi-tierslider-rail${settled ? ' is-settled' : ''}`} ref={railRef}>
        {tiers.map((tier) => {
          const chosen = selectedTier === tier;
          const inTier = grouped.buckets[tier];
          return (
            <div
              key={tier}
              data-tier={tier}
              data-selected={chosen ? 'yes' : 'no'}
              ref={(el) => { if (el) cardRefs.current.set(tier, el); else cardRefs.current.delete(tier); }}
              className={`vi-tiercard${chosen ? ' chosen' : ''}`}
              style={{ ['--tier-accent' as string]: TIER_ACCENT[tier] }}
            >
              {/* The head is the control. A card that says "Premium" and only
                  responds to a small button in its corner is a card people
                  press three times and report as broken. */}
              <button
                type="button"
                className="vi-tiercard-head"
                aria-pressed={chosen}
                onClick={() => onSelectTier(chosen ? null : tier)}
              >
                <span className="vi-tiercard-marks" aria-hidden>
                  {Array.from({ length: TIER_MARKS[tier] }, (_, i) => <i key={i} />)}
                </span>
                <span className="vi-tiercard-name">{t(`tier_${tier.toLowerCase()}` as ViKey)}</span>
                <span className="vi-tiercard-price">
                  <span className="vi-tiercard-from">{t('cat_from')}</span>
                  <strong>{fromPrice(tier)}</strong>
                </span>
                <span className="vi-tiercard-desc">{t(`pricing_${tier.toLowerCase()}_desc` as ViKey)}</span>
                <span className="vi-tiercard-pick">
                  {chosen ? `✓ ${t('pricing_tier_picked')}` : t('pricing_tier_pick')}
                </span>
              </button>

              {/* What the tier actually contains. Not selectable — these are
                  illustrations of what the money buys, and the choice above is
                  the choice. */}
              <div className="vi-tiercard-list">
                <span className="vi-tiercard-listhead">{t('pricing_tier_includes')}</span>
                {inTier.map((meta) => (
                  <button
                    key={meta.id}
                    type="button"
                    className="vi-tiercard-design"
                    onClick={() => onPreview(meta)}
                    title={t('cat_preview')}
                  >
                    <span className="vi-tiercard-emoji" aria-hidden>{meta.cover}</span>
                    <span className="vi-tiercard-designtext">
                      <span className="vi-tiercard-designname">{t(meta.nameKey as ViKey)}</span>
                      <span className="vi-tiercard-designdesc">{t(shortDescKey(meta.id))}</span>
                    </span>
                    <span className="vi-tiercard-eye" aria-hidden>👁</span>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
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
