import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Locale } from '../utils/translate';
import { useVInviteStore } from './store';
import { useViT, type ViKey } from './i18n';
import { useCountUp, useReveal, useScrollProgress, usePointerTilt } from './motion';
import { ViLogo, ViThemeToggle } from './VInviteApp';
import { usePromoShowcase, COVER_SLOTS_DESKTOP, COVER_SLOTS_MOBILE } from './promoShowcase';
import { useTemplateOverrides } from './templateOverrides';
import { RichRenderer } from './templates/RichRenderer';
import { getTemplate, readRichDesign } from './templates';
import { resolveAssetUrls } from './templates/utils';
import { InviteSiteView } from './InviteSiteView';
import { PreviewShell } from './PreviewShell';
import type { PromoWork } from './api';
import { LOCALES, type TemplateDefinition } from './templates/types';

// Stable identity: RichRenderer posts into the iframe whenever `config` or
// `languages` change by reference, so these must not be rebuilt per render.
const ALL_LOCALES = [...LOCALES];

// ── v-invite.uz/ — public marketing landing ──────────────────────────────────
// What a visitor sees: hero → our work → why us → closing CTA. There is no
// sign-in or sign-up here — the site sells invitations, and choosing a design
// happens on the Pricing page, not here. Everything animates on scroll; the
// whole page degrades gracefully under prefers-reduced-motion (see vinvite.css).
//
// "Our work" and the cover show REAL published invitations the administrator
// picked, falling back to the built-in templates until any are chosen — see
// promoShowcase.ts. Both are rendered live, so this file works in terms of a
// ShowcaseEntry that hides which of the two it is holding.

// Reveal-on-scroll lives in motion.ts. Elements are
// registered by ref callback, so sections can mount lazily without a re-scan.
// The observer is built on first use rather than in an effect: ref callbacks
// fire during commit, before effects run, so an effect-created observer would
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
// Either a published invitation or (before any are chosen) a built-in template.
// Both render live; everything else about a card — its name, its accent dot,
// its emoji — is normalised here so the layout never branches on the source.
export type ShowcaseEntry =
  | { kind: 'work'; id: string; name: string; emoji: string; accent: string; site: PromoWork }
  | { kind: 'template'; id: string; name: string; emoji: string; accent: string; tpl: TemplateDefinition };

function workEntry(site: PromoWork): ShowcaseEntry {
  // A rich invitation borrows its template's emoji and accent so the gallery
  // stays visually varied; a block design has neither, hence the fallbacks.
  const rich = readRichDesign(site.theme);
  const tpl = rich ? getTemplate(rich.templateId) : null;
  return {
    kind: 'work',
    id: site.slug,
    name: site.name,
    emoji: tpl?.cover ?? '💌',
    accent: tpl?.accent ?? (site.theme?.accentColor as string | undefined) ?? 'var(--vi-accent)',
    site,
  };
}

function templateEntry(tpl: TemplateDefinition, label: string): ShowcaseEntry {
  return { kind: 'template', id: tpl.id, name: label, emoji: tpl.cover, accent: tpl.accent, tpl };
}

// The live preview itself. A template is rendered from its shipped html plus
// the administrator's Design+ overrides; an invitation is rendered exactly as
// its guests see it, minus the music and cursor chrome.
function LivePreview({ entry }: { entry: ShowcaseEntry }) {
  const { effectiveConfig } = useTemplateOverrides();
  const config = useMemo(
    () => (entry.kind === 'template'
      ? resolveAssetUrls(entry.tpl, effectiveConfig(entry.tpl) as Record<string, unknown>)
      : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [entry, effectiveConfig],
  );
  if (entry.kind === 'work') return <InviteSiteView site={entry.site} chrome={false} />;
  return <RichRenderer html={entry.tpl.html} config={config!} languages={ALL_LOCALES} interactive />;
}

export const ViLandingPage = () => {
  const t = useViT();
  const navigate = useNavigate();
  const locale = useVInviteStore((s) => s.locale);
  const setLocale = useVInviteStore((s) => s.setLocale);
  const reveal = useReveal();
  const progress = useScrollProgress();
  const [stuck, setStuck] = useState(false);
  const [preview, setPreview] = useState<ShowcaseEntry | null>(null);
  const isMobile = useMediaQuery('(max-width: 860px)');
  // The invitations the administrator chose, or the built-in templates until
  // they choose any. Falls back to the shipped set while loading or if the
  // request fails, so the page is never empty.
  const { items } = usePromoShowcase();

  const { work, cover } = useMemo(() => {
    if (items.kind === 'works') {
      return { work: items.works.map(workEntry), cover: items.cover.map(workEntry) };
    }
    const entries = items.templates.map((tpl) => templateEntry(tpl, t(tpl.nameKey as ViKey)));
    return { work: entries, cover: entries };
  }, [items, t]);

  useEffect(() => {
    const onScroll = () => setStuck(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const goPricing = () => navigate('/pricing');

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
      {/* Reading position, as a hairline across the top. */}
      <div className="vi-lp-progress" style={{ transform: `scaleX(${progress})` }} aria-hidden />

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
        <NameMarquee entries={work} />
        <WorkSection t={t} entries={work} live={items.kind === 'works'} reveal={reveal}
          onPreview={setPreview} onPricing={() => goPricing()} />
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

      {preview && <PreviewModal entry={preview} onClose={() => setPreview(null)} />}
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

// ── Shared section furniture ─────────────────────────────────────────────────

// A numbered header whose rule draws itself outward as the block arrives. The
// number gives the page a spine — a visitor can tell how far through they are
// without a table of contents.
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
function NameMarquee({ entries }: { entries: ShowcaseEntry[] }) {
  if (entries.length === 0) return null;
  const row = (hidden: boolean) => entries.map((entry) => (
    <span className="vi-lp-marquee-item" key={`${entry.id}-${hidden}`} aria-hidden={hidden || undefined}>
      <span className="vi-lp-marquee-dot" />
      <span style={{ fontSize: 17 }}>{entry.emoji}</span>
      {entry.name}
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

function HeroSection({ t, isMobile, cover, work, onWork, onPricing }: {
  t: (k: ViKey) => string; isMobile: boolean;
  cover: ShowcaseEntry[]; work: ShowcaseEntry[];
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

  const stats: { value: number; label: ViKey }[] = [
    // Count what a visitor can actually browse, not what ships in the bundle —
    // a design kept off the site must not be advertised.
    { value: work.length, label: 'lp_stat_templates' },
    { value: 3, label: 'lp_stat_languages' },
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
          {stats.map((stat) => (
            <CountStat key={stat.label} value={stat.value} label={t(stat.label)} />
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

// Real work rendered live. Desktop stacks two drifting cards; phones show a
// single upright card — one iframe instead of two, and no rotation to cut off.
function HeroArt({ isMobile, cover }: { isMobile: boolean; cover: ShowcaseEntry[] }) {
  const cards = useMemo(
    () => cover.slice(0, isMobile ? COVER_SLOTS_MOBILE : COVER_SLOTS_DESKTOP),
    [cover, isMobile],
  );
  if (cards.length === 0) return <div className="vi-lp-hero-art" />;

  return (
    <div className="vi-lp-hero-art">
      {cards.map((entry, i) => {
        const front = i === cards.length - 1;
        const rot = isMobile ? 0 : front ? 4 : -6;
        return (
          <div
            key={entry.id}
            className={`vi-lp-hero-card vi-pop${isMobile ? '' : ' vi-lp-float'}${front ? ' front' : ' back'}`}
            style={{
              zIndex: front ? 2 : 1,
              ['--r' as string]: `${rot}deg`,
              transform: `rotate(${rot}deg)`,
              animationDelay: isMobile ? '300ms' : `${i * 1.4}s, ${300 + i * 140}ms`,
            }}
          >
            <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
              <LivePreview entry={entry} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Our work ─────────────────────────────────────────────────────────────────

function WorkSection({ t, entries, live, reveal, onPreview, onPricing }: {
  t: (k: ViKey) => string;
  entries: ShowcaseEntry[];
  /** True once the gallery is showing real invitations rather than templates. */
  live: boolean;
  reveal: (el: HTMLElement | null) => void;
  onPreview: (entry: ShowcaseEntry) => void;
  onPricing: () => void;
}) {
  return (
    <section id="work" style={{ padding: '90px 20px', scrollMarginTop: 70 }}>
      <div style={{ maxWidth: 1180, margin: '0 auto' }}>
        <SectionHead
          num="01" kicker={t('lp_work_kicker')} title={t('lp_work_title')}
          sub={t(live ? 'lp_work_sub' : 'lp_work_sub_templates')} reveal={reveal}
        />

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))', gap: 26 }}>
          {entries.map((entry, i) => (
            <WorkCard key={entry.id} entry={entry} t={t} reveal={reveal} delayMs={i * 90} index={i}
              onPreview={() => onPreview(entry)} />
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

function CountStat({ value, label }: { value: number; label: string }) {
  const { ref, display } = useCountUp(value);
  return (
    <div ref={ref}>
      <div className="vi-lp-stat-value vi-lp-count">{display}</div>
      <div className="vi-lp-stat-label">{label}</div>
    </div>
  );
}

function WorkCard({ entry, t, reveal, delayMs, index, onPreview }: {
  entry: ShowcaseEntry;
  t: (k: ViKey) => string;
  reveal: (el: HTMLElement | null) => void;
  delayMs: number;
  index: number;
  onPreview: () => void;
}) {
  const tilt = usePointerTilt(5);

  return (
    <div ref={reveal} className="vi-r vi-r-blur" style={{ ['--d' as string]: `${delayMs}ms` }}>
      <div className="vi-lp-work vi-lp-tilt" {...tilt}>
        <button
          type="button"
          onClick={onPreview}
          title={t('lp_work_open')}
          style={{
            position: 'relative', display: 'block', width: '100%', height: 430,
            border: 'none', padding: 0, cursor: 'pointer', background: '#0b0f1c', overflow: 'hidden',
          }}
        >
          <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
            <LivePreview entry={entry} />
          </div>

          <span style={{
            position: 'absolute', top: 14, left: 14, display: 'inline-flex', alignItems: 'center', gap: 6,
            fontSize: 11, fontWeight: 750, letterSpacing: '0.05em', padding: '5px 11px', borderRadius: 999,
            background: 'rgba(10,12,20,0.55)', color: '#fff', backdropFilter: 'blur(6px)',
          }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#4ade80' }} />
            {t('lp_work_live')}
          </span>

          {/* Index, so the gallery reads as a numbered body of work. */}
          <span style={{
            position: 'absolute', top: 14, right: 14,
            fontSize: 11.5, fontWeight: 800, letterSpacing: '0.08em',
            padding: '5px 10px', borderRadius: 999,
            background: 'rgba(10,12,20,0.55)', color: '#fff', backdropFilter: 'blur(6px)',
            fontVariantNumeric: 'tabular-nums',
          }}>
            {String(index + 1).padStart(2, '0')}
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
          <span style={{ width: 11, height: 11, borderRadius: '50%', background: entry.accent, flexShrink: 0 }} />
          <span style={{
            fontSize: 16, fontWeight: 720, minWidth: 0,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {entry.name}
          </span>
          <span style={{ marginLeft: 'auto', fontSize: 20 }}>{entry.emoji}</span>
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
  // `span` is in sixths of the bento grid: 6 = full row, 3 = half, 2 = third.
  const items: { icon: string; title: ViKey; desc: ViKey; span: 2 | 3 | 6 }[] = [
    { icon: '✨', title: 'lp_why_1_t', desc: 'lp_why_1_d', span: 6 },
    { icon: '🎬', title: 'lp_why_7_t', desc: 'lp_why_7_d', span: 3 },
    { icon: '🎼', title: 'lp_why_8_t', desc: 'lp_why_8_d', span: 3 },
    { icon: '🖼', title: 'lp_why_9_t', desc: 'lp_why_9_d', span: 2 },
    { icon: '⏳', title: 'lp_why_10_t', desc: 'lp_why_10_d', span: 2 },
    { icon: '📱', title: 'lp_why_2_t', desc: 'lp_why_2_d', span: 2 },
    { icon: '🌍', title: 'lp_why_3_t', desc: 'lp_why_3_d', span: 2 },
    { icon: '💌', title: 'lp_why_4_t', desc: 'lp_why_4_d', span: 2 },
    { icon: '🗺', title: 'lp_why_11_t', desc: 'lp_why_11_d', span: 2 },
    { icon: '🎨', title: 'lp_why_12_t', desc: 'lp_why_12_d', span: 3 },
    // Half each, so the grid closes on a full row rather than a ragged one.
    { icon: '🔗', title: 'lp_why_6_t', desc: 'lp_why_6_d', span: 3 },
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
        <SectionHead
          num="02" kicker={t('lp_why_kicker')} title={t('lp_why_title')}
          sub={t('lp_why_sub')} reveal={reveal}
        />

        {/* Bento: the animation claim takes the full width and carries a slowly
            rotating ring behind it; the next two take half each; the rest tile.
            A grid of identical boxes reads as a list — this reads as a page. */}
        <div className="vi-lp-bento">
          {items.map((item, i) => (
            <div
              key={item.title}
              ref={reveal}
              className={`vi-r ${item.span === 6 ? 'vi-r-zoom span-6' : item.span === 3 ? 'vi-r-up span-3' : 'vi-r-up'}`}
              style={{ ['--d' as string]: `${Math.min(i, 8) * 55}ms` }}
            >
              <div
                className={`vi-lp-tile vi-lp-sheenwrap${item.span === 6 ? ' vi-lp-feature' : ''}`}
                onMouseMove={onMove}
                style={{ height: '100%' }}
              >
                <span className="vi-lp-tile-icon">{item.icon}</span>
                <h3 style={{
                  margin: '18px 0 8px', fontWeight: 780, letterSpacing: '-0.02em',
                  fontSize: item.span === 6 ? 'clamp(20px, 2.6vw, 27px)' : 18,
                }}>
                  {t(item.title)}
                </h3>
                <p style={{
                  margin: 0, lineHeight: 1.62, color: 'var(--vi-muted)',
                  fontSize: item.span === 6 ? 16 : 14.5,
                  maxWidth: item.span === 6 ? 640 : undefined,
                }}>
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

// ── Full-screen preview ──────────────────────────────────────────────────────
// Look, don't buy: choosing a design happens on the Pricing page, where the
// tiers and the prices are. A "select" button here would send a visitor onward
// having picked an INVITATION — somebody else's finished work, not something
// they can order.

function PreviewModal({ entry, onClose }: { entry: ShowcaseEntry; onClose: () => void }) {
  return (
    <PreviewShell onClose={onClose}>
      <LivePreview entry={entry} />
    </PreviewShell>
  );
}
