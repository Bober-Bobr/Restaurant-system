import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Locale } from '../utils/translate';
import { useVInviteStore } from './store';
import { useViT, type ViKey } from './i18n';
import { ViLogo, ViThemeToggle } from './VInviteApp';
import { usePromoShowcase, COVER_SLOTS_DESKTOP, COVER_SLOTS_MOBILE } from './promoShowcase';
import { useTemplateOverrides } from './templateOverrides';
import { RichRenderer } from './templates/RichRenderer';
import { resolveAssetUrls } from './templates/utils';
import { LOCALES, type TemplateDefinition } from './templates/types';

// Stable identity: RichRenderer posts into the iframe whenever `config` or
// `languages` change by reference, so these must not be rebuilt per render.
const ALL_LOCALES = [...LOCALES];

// ── v-invite.uz/ — public marketing landing ──────────────────────────────────
// What a visitor sees: hero → our work (live template previews) → why us →
// closing CTA. There is no sign-in or sign-up here — the site sells templates,
// and choosing one leads to Pricing, not to an account. Everything animates on
// scroll; the whole
// page degrades gracefully under prefers-reduced-motion (see vinvite.css).

// Reveal-on-scroll: adds `.in` once an element scrolls into view. Elements are
// registered by ref callback, so sections can mount lazily without a re-scan.
// The observer is built on first use rather than in an effect: ref callbacks
// fire during commit, before effects run, so an effect-created observer would
// miss every element mounted on the first render and leave the page invisible.
function useReveal() {
  const observerRef = useRef<IntersectionObserver | null>(null);

  const getObserver = () => {
    if (observerRef.current) return observerRef.current;
    if (typeof IntersectionObserver === 'undefined') return null;
    observerRef.current = new IntersectionObserver(
      (entries, obs) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add('in');
            obs.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -60px 0px' },
    );
    return observerRef.current;
  };

  useEffect(() => () => observerRef.current?.disconnect(), []);

  return useCallback((el: HTMLElement | null) => {
    if (!el) return;
    el.classList.add('vi-lp-reveal');
    const observer = getObserver();
    // Without IntersectionObserver support, show the content immediately.
    if (observer) observer.observe(el);
    else el.classList.add('in');
  }, []);
}

// Live viewport check. Used to render *fewer* live template iframes on phones
// rather than merely hiding them with CSS — a hidden iframe still loads.
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

export const ViLandingPage = () => {
  const t = useViT();
  const navigate = useNavigate();
  const locale = useVInviteStore((s) => s.locale);
  const setLocale = useVInviteStore((s) => s.setLocale);
  const reveal = useReveal();
  const [stuck, setStuck] = useState(false);
  const [preview, setPreview] = useState<TemplateDefinition | null>(null);
  const isMobile = useMediaQuery('(max-width: 860px)');
  // Which templates the system administrator has put on the cover and in what
  // order the rest are listed. Falls back to the shipped order while loading or
  // if the request fails, so the page is never empty.
  const { cover, work } = usePromoShowcase();

  useEffect(() => {
    const onScroll = () => setStuck(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const goPricing = (templateId?: string) =>
    navigate(templateId ? `/pricing?template=${encodeURIComponent(templateId)}` : '/pricing');

  const scrollTo = (id: string) => {
    // Nav entries carrying a route navigate instead of scrolling.
    const item = NAV_ITEMS.find((entry) => entry.id === id);
    if (item?.to) { navigate(item.to); return; }
    if (id === 'top') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const goWork = () => scrollTo('work');

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', overflowX: 'hidden' }}>

      <LandingHeader
        t={t}
        stuck={stuck}
        locale={locale}
        setLocale={setLocale}
        isMobile={isMobile}
        onNav={scrollTo}
      />

      <main style={{ flex: 1 }}>
        <HeroSection t={t} isMobile={isMobile} cover={cover} work={work} onWork={goWork} onPricing={() => goPricing()} />
        <WorkSection t={t} templates={work} reveal={reveal} onPreview={setPreview} onPricing={() => goPricing()} />
        <WhySection t={t} reveal={reveal} />
        <FinalCta t={t} reveal={reveal} onPricing={() => goPricing()} />
      </main>

      {/* ── Footer ── */}
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

      {preview && (
        <PreviewModal tpl={preview} t={t} onClose={() => setPreview(null)}
          onSelect={() => goPricing(preview.id)} />
      )}
    </div>
  );
};

// ── Header ───────────────────────────────────────────────────────────────────
// Desktop: logo + inline section links + locale/theme/sign-in.
// Mobile: compact bar (logo + theme + burger); the links, language picker and
// sign-in move into a sheet that drops down under the bar.

// `to` navigates; `id` scrolls to a section on this page.
const NAV_ITEMS: { id: string; label: ViKey; to?: string }[] = [
  { id: 'work', label: 'lp_nav_work' },
  { id: 'why', label: 'lp_nav_why' },
  { id: 'pricing', label: 'lp_nav_pricing', to: '/pricing' },
];

function LandingHeader({ t, stuck, locale, setLocale, isMobile, onNav }: {
  t: (k: ViKey) => string;
  stuck: boolean;
  locale: Locale;
  setLocale: (l: Locale) => void;
  isMobile: boolean;
  onNav: (id: string) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);

  // The sheet only exists on mobile — collapse it if the viewport grows.
  useEffect(() => { if (!isMobile) setMenuOpen(false); }, [isMobile]);

  // Escape closes the sheet, and the page behind it must not scroll away.
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

        {/* Desktop links */}
        <nav className="vi-lp-nav">
          {NAV_ITEMS.map((item) => (
            <button key={item.id} type="button" className="vi-lp-navlink" onClick={() => go(item.id)}>
              {t(item.label)}
            </button>
          ))}
        </nav>

        <div className="vi-lp-head-right">
          <span className="vi-lp-desktop-only">{localeSelect(true)}</span>
          <ViThemeToggle />

          {/* No sign-in or sign-up: this site has no self-serve accounts. */}

          {/* Burger — mobile only */}
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

      {/* Mobile sheet */}
      {isMobile && (
        <>
          <div
            className={`vi-lp-sheet-scrim${menuOpen ? ' open' : ''}`}
            onClick={() => setMenuOpen(false)}
            aria-hidden="true"
          />
          <div className={`vi-lp-sheet${menuOpen ? ' open' : ''}`}>
            <nav style={{ display: 'grid', gap: 4 }}>
              {NAV_ITEMS.map((item, i) => (
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

// ── Hero ─────────────────────────────────────────────────────────────────────

function HeroSection({ t, isMobile, cover, work, onWork, onPricing }: {
  t: (k: ViKey) => string; isMobile: boolean;
  cover: TemplateDefinition[]; work: TemplateDefinition[];
  onWork: () => void; onPricing: () => void;
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
        <span className={gradient ? 'vi-lp-gradient' : undefined}>{w}</span>{' '}
      </span>
    );
  };

  const stats: { value: string; label: ViKey }[] = [
    // Count what a visitor can actually browse, not what ships in the bundle —
    // a hidden template must not be advertised.
    { value: String(work.length), label: 'lp_stat_templates' },
    { value: '3', label: 'lp_stat_languages' },
    { value: '5', label: 'lp_stat_minutes' },
  ];

  return (
    <section className="vi-lp-hero">
      {/* Drifting aurora fields */}
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

        {/* Live template cards, gently drifting */}
        <HeroArt isMobile={isMobile} cover={cover} />

        <div className="vi-fade-up vi-lp-hero-stats" style={{ animationDelay: '900ms' }}>
          {stats.map((s) => (
            <div key={s.label}>
              <div className="vi-lp-stat-value">{s.value}</div>
              <div className="vi-lp-stat-label">{t(s.label)}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Scroll cue */}
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

// Real templates rendered live. Desktop stacks two drifting cards; phones show a
// single upright card — one iframe instead of two, and no rotation to cut off.
function HeroArt({ isMobile, cover }: { isMobile: boolean; cover: TemplateDefinition[] }) {
  const { effectiveConfig } = useTemplateOverrides();
  const cards = useMemo(
    () => cover.slice(0, isMobile ? COVER_SLOTS_MOBILE : COVER_SLOTS_DESKTOP),
    [cover, isMobile],
  );
  // The admin's saved design, not the shipped default — otherwise a template
  // edited in Design+ looks one way everywhere in the app and another on the
  // cover that is meant to be selling it.
  const configs = useMemo(
    () => cards.map((tpl) => resolveAssetUrls(tpl, effectiveConfig(tpl) as Record<string, unknown>)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cards, effectiveConfig],
  );
  if (cards.length === 0) return <div className="vi-lp-hero-art" />;

  return (
    <div className="vi-lp-hero-art">
      {cards.map((tpl, i) => {
        const front = i === cards.length - 1;
        const rot = isMobile ? 0 : front ? 4 : -6;
        return (
          <div
            key={tpl.id}
            className={`vi-lp-hero-card vi-pop${isMobile ? '' : ' vi-lp-float'}${front ? ' front' : ' back'}`}
            style={{
              zIndex: front ? 2 : 1,
              ['--r' as string]: `${rot}deg`,
              transform: `rotate(${rot}deg)`,
              animationDelay: isMobile ? '300ms' : `${i * 1.4}s, ${300 + i * 140}ms`,
            }}
          >
            <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
              <RichRenderer html={tpl.html} config={configs[i]!} languages={ALL_LOCALES} interactive />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Our work ─────────────────────────────────────────────────────────────────

function WorkSection({ t, templates, reveal, onPreview, onPricing }: {
  t: (k: ViKey) => string;
  templates: TemplateDefinition[];
  reveal: (el: HTMLElement | null) => void;
  onPreview: (tpl: TemplateDefinition) => void;
  onPricing: () => void;
}) {
  return (
    <section id="work" style={{ padding: '90px 20px', scrollMarginTop: 70 }}>
      <div style={{ maxWidth: 1180, margin: '0 auto' }}>
        <div ref={reveal} style={{ textAlign: 'center', maxWidth: 660, margin: '0 auto 46px' }}>
          <span className="vi-lp-kicker">{t('lp_work_kicker')}</span>
          <h2 style={{ margin: 0, fontSize: 'clamp(28px, 4vw, 42px)', fontWeight: 830, letterSpacing: '-0.03em' }}>
            {t('lp_work_title')}
          </h2>
          <p style={{ margin: '14px 0 0', fontSize: 16.5, lineHeight: 1.6, color: 'var(--vi-muted)' }}>
            {t('lp_work_sub')}
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))', gap: 26 }}>
          {templates.map((tpl, i) => (
            <WorkCard key={tpl.id} tpl={tpl} t={t} reveal={reveal} delayMs={i * 110} onPreview={() => onPreview(tpl)} />
          ))}
        </div>

        <div ref={reveal} style={{ textAlign: 'center', marginTop: 44 }}>
          <button type="button" className="vi-btn vi-btn-ghost" style={{ padding: '14px 28px', fontSize: 15, borderRadius: 14 }} onClick={onPricing}>
            💎 {t('lp_nav_pricing')} →
          </button>
        </div>
      </div>
    </section>
  );
}

function WorkCard({ tpl, t, reveal, delayMs, onPreview }: {
  tpl: TemplateDefinition;
  t: (k: ViKey) => string;
  reveal: (el: HTMLElement | null) => void;
  delayMs: number;
  onPreview: () => void;
}) {
  const { effectiveConfig } = useTemplateOverrides();
  const config = useMemo(
    () => resolveAssetUrls(tpl, effectiveConfig(tpl) as Record<string, unknown>),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tpl, effectiveConfig],
  );

  return (
    <div ref={reveal} style={{ transitionDelay: `${delayMs}ms` }}>
      <div className="vi-lp-work">
        <button
          type="button"
          onClick={onPreview}
          title={t('lp_work_open')}
          style={{
            position: 'relative', display: 'block', width: '100%', height: 430,
            border: 'none', padding: 0, cursor: 'pointer', background: '#0b0f1c', overflow: 'hidden',
          }}
        >
          <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
            <RichRenderer html={tpl.html} config={config} languages={ALL_LOCALES} interactive />
          </div>

          <span style={{
            position: 'absolute', top: 14, left: 14, display: 'inline-flex', alignItems: 'center', gap: 6,
            fontSize: 11, fontWeight: 750, letterSpacing: '0.05em', padding: '5px 11px', borderRadius: 999,
            background: 'rgba(10,12,20,0.55)', color: '#fff', backdropFilter: 'blur(6px)',
          }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#4ade80' }} />
            {t('lp_work_live')}
          </span>

          <span className="vi-lp-work-veil">
            <span style={{
              padding: '11px 20px', borderRadius: 12, fontSize: 14, fontWeight: 700,
              background: 'rgba(255,255,255,0.96)', color: '#111827',
            }}>
              👁 {t('lp_work_open')}
            </span>
          </span>
        </button>

        <div style={{ padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ width: 11, height: 11, borderRadius: '50%', background: tpl.accent, boxShadow: `0 0 0 3px ${tpl.accent}33`, flexShrink: 0 }} />
          <span style={{ fontSize: 16, fontWeight: 720 }}>{t(tpl.nameKey as ViKey)}</span>
          <span style={{ marginLeft: 'auto', fontSize: 20 }}>{tpl.cover}</span>
        </div>
      </div>
    </div>
  );
}

// ── Why choose us ────────────────────────────────────────────────────────────

function WhySection({ t, reveal }: { t: (k: ViKey) => string; reveal: (el: HTMLElement | null) => void }) {
  // The animation tile is the headline claim and spans the full width, because
  // it is what actually distinguishes these invitations from a picture of one —
  // and it is the one thing a static list of bullet points cannot demonstrate.
  const items: { icon: string; title: ViKey; desc: ViKey; wide?: boolean }[] = [
    { icon: '✨', title: 'lp_why_1_t', desc: 'lp_why_1_d', wide: true },
    { icon: '🎬', title: 'lp_why_7_t', desc: 'lp_why_7_d' },
    { icon: '🎼', title: 'lp_why_8_t', desc: 'lp_why_8_d' },
    { icon: '🖼', title: 'lp_why_9_t', desc: 'lp_why_9_d' },
    { icon: '⏳', title: 'lp_why_10_t', desc: 'lp_why_10_d' },
    { icon: '📱', title: 'lp_why_2_t', desc: 'lp_why_2_d' },
    { icon: '🌍', title: 'lp_why_3_t', desc: 'lp_why_3_d' },
    { icon: '💌', title: 'lp_why_4_t', desc: 'lp_why_4_d' },
    { icon: '🗺', title: 'lp_why_11_t', desc: 'lp_why_11_d' },
    { icon: '🎨', title: 'lp_why_12_t', desc: 'lp_why_12_d' },
    { icon: '⚡', title: 'lp_why_5_t', desc: 'lp_why_5_d' },
    { icon: '🔗', title: 'lp_why_6_t', desc: 'lp_why_6_d' },
  ];

  // The pointer-following glow is decorative; the tile is readable without it.
  const onMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const r = el.getBoundingClientRect();
    el.style.setProperty('--mx', `${e.clientX - r.left}px`);
    el.style.setProperty('--my', `${e.clientY - r.top}px`);
  };

  return (
    <section id="why" style={{ position: 'relative', padding: '90px 20px', scrollMarginTop: 70 }}>
      <div className="vi-lp-aurora" style={{ width: 560, height: 560, top: '10%', right: -220, background: 'radial-gradient(circle, rgba(167,139,250,0.20), transparent 68%)', animationDelay: '-5s' }} />

      <div style={{ position: 'relative', maxWidth: 1180, margin: '0 auto' }}>
        <div ref={reveal} style={{ textAlign: 'center', maxWidth: 640, margin: '0 auto 46px' }}>
          <span className="vi-lp-kicker">{t('lp_why_kicker')}</span>
          <h2 style={{ margin: 0, fontSize: 'clamp(28px, 4vw, 42px)', fontWeight: 830, letterSpacing: '-0.03em' }}>
            {t('lp_why_title')}
          </h2>
          <p style={{ margin: '14px 0 0', fontSize: 16.5, lineHeight: 1.6, color: 'var(--vi-muted)' }}>
            {t('lp_why_sub')}
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))', gap: 20 }}>
          {items.map((item, i) => (
            <div key={item.title} ref={reveal} style={{
              transitionDelay: `${i * 60}ms`,
              // The wide tile only spans columns where there is more than one.
              gridColumn: item.wide ? '1 / -1' : undefined,
            }}>
              <div className="vi-lp-tile" onMouseMove={onMove} style={{ height: '100%' }}>
                <span className="vi-lp-tile-icon">{item.icon}</span>
                <h3 style={{ margin: '18px 0 8px', fontSize: 18, fontWeight: 750, letterSpacing: '-0.015em' }}>
                  {t(item.title)}
                </h3>
                <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.62, color: 'var(--vi-muted)' }}>
                  {t(item.desc)}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Closing CTA ──────────────────────────────────────────────────────────────

function FinalCta({ t, reveal, onPricing }: {
  t: (k: ViKey) => string; reveal: (el: HTMLElement | null) => void; onPricing: () => void;
}) {
  return (
    <section style={{ padding: '20px 20px 100px' }}>
      <div ref={reveal} style={{ maxWidth: 1180, margin: '0 auto' }}>
        <div style={{
          position: 'relative', overflow: 'hidden', borderRadius: 26, padding: '62px 30px', textAlign: 'center',
          border: '1px solid var(--vi-border)',
          background: 'linear-gradient(135deg, var(--vi-accent-soft), transparent 60%), var(--vi-card)',
          boxShadow: 'var(--vi-shadow)',
        }}>
          <div className="vi-lp-aurora" style={{ width: 420, height: 420, top: -190, left: '50%', marginLeft: -210, background: 'radial-gradient(circle, rgba(37,99,235,0.28), transparent 68%)' }} />
          <div style={{ position: 'relative' }}>
            <h2 style={{ margin: 0, fontSize: 'clamp(26px, 3.6vw, 38px)', fontWeight: 840, letterSpacing: '-0.03em' }}>
              {t('lp_final_title')}
            </h2>
            <p style={{ margin: '14px auto 0', maxWidth: 460, fontSize: 16.5, lineHeight: 1.6, color: 'var(--vi-muted)' }}>
              {t('lp_final_sub')}
            </p>
            <button
              type="button"
              className="vi-btn vi-btn-primary"
              style={{ marginTop: 28, padding: '16px 34px', fontSize: 16, borderRadius: 14 }}
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

// ── Full-screen template preview ─────────────────────────────────────────────

function PreviewModal({ tpl, t, onClose, onSelect }: {
  tpl: TemplateDefinition; t: (k: ViKey) => string; onClose: () => void; onSelect: () => void;
}) {
  const { effectiveConfig } = useTemplateOverrides();
  const config = useMemo(
    () => resolveAssetUrls(tpl, effectiveConfig(tpl) as Record<string, unknown>),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tpl, effectiveConfig],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div className="vi-overlay" onClick={onClose}>
      <div
        className="vi-pop"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(420px, 100%)', height: 'min(860px, 92vh)',
          borderRadius: 22, overflow: 'hidden', position: 'relative',
          background: '#0b0f1c', boxShadow: 'var(--vi-shadow-lg)',
          display: 'flex', flexDirection: 'column',
        }}
      >
        <div style={{ flex: 1, position: 'relative' }}>
          <RichRenderer html={tpl.html} config={config} languages={ALL_LOCALES} interactive />
        </div>

        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          style={{
            position: 'absolute', top: 12, right: 12, zIndex: 5,
            width: 36, height: 36, borderRadius: '50%', border: 'none', cursor: 'pointer',
            background: 'rgba(10,12,20,0.6)', color: '#fff', fontSize: 18, lineHeight: 1,
            backdropFilter: 'blur(6px)',
          }}
        >
          ✕
        </button>

        {/* Pinned under the preview rather than revealed by scrolling it: the
            template renders inside a sandboxed iframe on an opaque origin, so
            the parent cannot observe how far the visitor has scrolled inside it.
            A button that only appeared after an event we cannot detect would be
            a button that never appeared. */}
        <div style={{ padding: 12, background: 'var(--vi-card)', borderTop: '1px solid var(--vi-border)' }}>
          <button type="button" className="vi-btn vi-btn-primary" style={{ width: '100%', padding: '13px' }} onClick={onSelect}>
            {t('lp_select')} <span style={{ fontSize: 17 }}>→</span>
          </button>
        </div>
      </div>
    </div>
  );
}
