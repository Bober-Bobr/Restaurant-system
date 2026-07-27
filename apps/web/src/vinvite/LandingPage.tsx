import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Locale } from '../utils/translate';
import { useVInviteStore } from './store';
import { useViT, type ViKey } from './i18n';
import { ViLogo, ViThemeToggle } from './VInviteApp';
import { RICH_TEMPLATES } from './templates';
import { RichRenderer } from './templates/RichRenderer';
import { resolveAssetUrls } from './templates/utils';
import { LOCALES, type TemplateDefinition } from './templates/types';

// ── v-invite.uz/ — public marketing landing ──────────────────────────────────
// What a logged-out visitor sees: hero → our work (live template previews) →
// why choose us → FAQ → closing CTA. Everything animates on scroll; the whole
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

export const ViLandingPage = () => {
  const t = useViT();
  const navigate = useNavigate();
  const locale = useVInviteStore((s) => s.locale);
  const setLocale = useVInviteStore((s) => s.setLocale);
  const reveal = useReveal();
  const [stuck, setStuck] = useState(false);
  const [preview, setPreview] = useState<TemplateDefinition | null>(null);

  useEffect(() => {
    const onScroll = () => setStuck(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const goCreate = () => navigate('/login');

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', overflowX: 'hidden' }}>

      {/* ── Header ── */}
      <header className={`vi-lp-head${stuck ? ' stuck' : ''}`}>
        <div style={{ maxWidth: 1180, margin: '0 auto', padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
          <ViLogo />
          <nav style={{ marginLeft: 26, display: 'flex', gap: 2 }} className="vi-lp-nav">
            <button type="button" className="vi-lp-navlink" onClick={() => scrollTo('work')}>{t('lp_nav_work')}</button>
            <button type="button" className="vi-lp-navlink" onClick={() => scrollTo('why')}>{t('lp_nav_why')}</button>
            <button type="button" className="vi-lp-navlink" onClick={() => scrollTo('faq')}>{t('lp_nav_faq')}</button>
          </nav>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
            <select
              className="vi-select"
              style={{ width: 'auto', padding: '8px 10px', fontSize: 13 }}
              value={locale}
              onChange={(e) => setLocale(e.target.value as Locale)}
            >
              <option value="ru">RU</option>
              <option value="uz">UZ</option>
              <option value="en">EN</option>
            </select>
            <ViThemeToggle />
            <button type="button" className="vi-btn vi-btn-ghost" style={{ fontSize: 13 }} onClick={goCreate}>
              {t('lp_signin')}
            </button>
          </div>
        </div>
      </header>

      <main style={{ flex: 1 }}>
        <HeroSection t={t} onCreate={goCreate} onWork={() => scrollTo('work')} />
        <WorkSection t={t} reveal={reveal} onPreview={setPreview} onCreate={goCreate} />
        <WhySection t={t} reveal={reveal} />
        <FaqSection t={t} reveal={reveal} />
        <FinalCta t={t} reveal={reveal} onCreate={goCreate} />
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

      {preview && <PreviewModal tpl={preview} t={t} onClose={() => setPreview(null)} onCreate={goCreate} />}

      {/* Landing-only responsive tweaks. */}
      <style>{`
        @media (max-width: 860px) {
          .vi-lp-nav { display: none !important; }
          .vi-lp-hero-grid { grid-template-columns: 1fr !important; }
          .vi-lp-hero-art { display: none !important; }
        }
      `}</style>
    </div>
  );
};

// ── Hero ─────────────────────────────────────────────────────────────────────

function HeroSection({ t, onCreate, onWork }: {
  t: (k: ViKey) => string; onCreate: () => void; onWork: () => void;
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
    { value: String(RICH_TEMPLATES.length), label: 'lp_stat_templates' },
    { value: '3', label: 'lp_stat_languages' },
    { value: '5', label: 'lp_stat_minutes' },
  ];

  return (
    <section style={{ position: 'relative', padding: '70px 20px 90px', overflow: 'hidden' }}>
      {/* Drifting aurora fields */}
      <div className="vi-lp-aurora" style={{ width: 620, height: 620, top: -240, right: -160, background: 'radial-gradient(circle, rgba(37,99,235,0.34), transparent 68%)' }} />
      <div className="vi-lp-aurora" style={{ width: 520, height: 520, bottom: -220, left: -170, background: 'radial-gradient(circle, rgba(217,168,90,0.34), transparent 68%)', animationDelay: '-8s' }} />
      <div className="vi-lp-aurora" style={{ width: 400, height: 400, top: '38%', left: '46%', background: 'radial-gradient(circle, rgba(167,139,250,0.26), transparent 70%)', animationDelay: '-15s' }} />

      <div
        className="vi-lp-hero-grid"
        style={{
          position: 'relative', maxWidth: 1180, margin: '0 auto',
          display: 'grid', gridTemplateColumns: '1.05fr 0.95fr', gap: 48, alignItems: 'center',
        }}
      >
        <div>
          <span
            className="vi-pop"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '7px 15px', borderRadius: 999, fontSize: 13, fontWeight: 650,
              background: 'var(--vi-accent-soft)', color: 'var(--vi-accent)',
              border: '1px solid var(--vi-border)', animationDelay: '80ms',
            }}
          >
            ✨ {t('lp_badge')}
          </span>

          <h1 style={{
            margin: '20px 0 0', fontSize: 'clamp(38px, 6vw, 66px)', lineHeight: 1.07,
            fontWeight: 850, letterSpacing: '-0.035em',
          }}>
            <span style={{ display: 'block', overflow: 'hidden', paddingBottom: 4 }}>
              {line1.map((w) => word(w))}
            </span>
            <span style={{ display: 'block', overflow: 'hidden', paddingBottom: 4 }}>
              {line2.map((w) => word(w, true))}
            </span>
          </h1>

          <p className="vi-fade-up" style={{
            margin: '22px 0 0', maxWidth: 540, fontSize: 17, lineHeight: 1.65,
            color: 'var(--vi-muted)', animationDelay: '620ms',
          }}>
            {t('lp_hero_sub')}
          </p>

          <div className="vi-fade-up" style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 30, animationDelay: '760ms' }}>
            <button type="button" className="vi-btn vi-btn-primary" style={{ padding: '15px 30px', fontSize: 15.5, borderRadius: 14 }} onClick={onCreate}>
              {t('lp_cta_primary')} <span style={{ fontSize: 17 }}>→</span>
            </button>
            <button type="button" className="vi-btn vi-btn-ghost" style={{ padding: '15px 26px', fontSize: 15.5, borderRadius: 14 }} onClick={onWork}>
              👁 {t('lp_cta_secondary')}
            </button>
          </div>

          <div className="vi-fade-up" style={{ display: 'flex', gap: 38, marginTop: 44, flexWrap: 'wrap', animationDelay: '900ms' }}>
            {stats.map((s) => (
              <div key={s.label}>
                <div style={{ fontSize: 32, fontWeight: 850, letterSpacing: '-0.03em', color: 'var(--vi-accent)' }}>{s.value}</div>
                <div style={{ fontSize: 13, color: 'var(--vi-muted)', marginTop: 2 }}>{t(s.label)}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Live template cards, gently drifting */}
        <HeroArt />
      </div>

      {/* Scroll cue */}
      <div className="vi-fade-up" style={{
        position: 'relative', maxWidth: 1180, margin: '58px auto 0',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
        animationDelay: '1100ms',
      }}>
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

// Two real templates rendered live, stacked and drifting at different rhythms.
function HeroArt() {
  const cards = RICH_TEMPLATES.slice(0, 2);
  const configs = useMemo(() => cards.map((tpl) => resolveAssetUrls(tpl, tpl.defaultConfig as Record<string, unknown>)), [cards]);
  if (cards.length === 0) return <div />;

  return (
    <div className="vi-lp-hero-art" style={{ position: 'relative', height: 520 }}>
      {cards.map((tpl, i) => {
        const front = i === cards.length - 1;
        return (
          <div
            key={tpl.id}
            className="vi-lp-float vi-pop"
            style={{
              position: 'absolute',
              top: front ? 40 : 0,
              left: front ? '30%' : '2%',
              width: 262, height: 430,
              borderRadius: 26, overflow: 'hidden',
              border: '1px solid var(--vi-border)',
              boxShadow: 'var(--vi-shadow-lg)',
              background: '#0b0f1c',
              zIndex: front ? 2 : 1,
              ['--r' as string]: front ? '4deg' : '-6deg',
              transform: `rotate(${front ? 4 : -6}deg)`,
              animationDelay: `${i * 1.4}s, ${300 + i * 140}ms`,
            }}
          >
            <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
              <RichRenderer html={tpl.html} config={configs[i]!} languages={[...LOCALES]} interactive />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Our work ─────────────────────────────────────────────────────────────────

function WorkSection({ t, reveal, onPreview, onCreate }: {
  t: (k: ViKey) => string;
  reveal: (el: HTMLElement | null) => void;
  onPreview: (tpl: TemplateDefinition) => void;
  onCreate: () => void;
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
          {RICH_TEMPLATES.map((tpl, i) => (
            <WorkCard key={tpl.id} tpl={tpl} t={t} reveal={reveal} delayMs={i * 110} onPreview={() => onPreview(tpl)} />
          ))}
        </div>

        <div ref={reveal} style={{ textAlign: 'center', marginTop: 44 }}>
          <button type="button" className="vi-btn vi-btn-ghost" style={{ padding: '14px 28px', fontSize: 15, borderRadius: 14 }} onClick={onCreate}>
            {t('lp_work_cta')} →
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
  const config = useMemo(() => resolveAssetUrls(tpl, tpl.defaultConfig as Record<string, unknown>), [tpl]);

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
            <RichRenderer html={tpl.html} config={config} languages={[...LOCALES]} interactive />
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
  const items: { icon: string; title: ViKey; desc: ViKey }[] = [
    { icon: '✨', title: 'lp_why_1_t', desc: 'lp_why_1_d' },
    { icon: '📱', title: 'lp_why_2_t', desc: 'lp_why_2_d' },
    { icon: '🌍', title: 'lp_why_3_t', desc: 'lp_why_3_d' },
    { icon: '💌', title: 'lp_why_4_t', desc: 'lp_why_4_d' },
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
            <div key={item.title} ref={reveal} style={{ transitionDelay: `${i * 90}ms` }}>
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

// ── FAQ ──────────────────────────────────────────────────────────────────────

function FaqSection({ t, reveal }: { t: (k: ViKey) => string; reveal: (el: HTMLElement | null) => void }) {
  const faqs: { q: ViKey; a: ViKey }[] = [
    { q: 'lp_faq_1_q', a: 'lp_faq_1_a' },
    { q: 'lp_faq_2_q', a: 'lp_faq_2_a' },
    { q: 'lp_faq_3_q', a: 'lp_faq_3_a' },
    { q: 'lp_faq_4_q', a: 'lp_faq_4_a' },
    { q: 'lp_faq_5_q', a: 'lp_faq_5_a' },
    { q: 'lp_faq_6_q', a: 'lp_faq_6_a' },
  ];
  // Single-open accordion; the first question starts expanded.
  const [open, setOpen] = useState(0);

  return (
    <section id="faq" style={{ padding: '90px 20px', scrollMarginTop: 70 }}>
      <div style={{ maxWidth: 820, margin: '0 auto' }}>
        <div ref={reveal} style={{ textAlign: 'center', marginBottom: 42 }}>
          <span className="vi-lp-kicker">{t('lp_faq_kicker')}</span>
          <h2 style={{ margin: 0, fontSize: 'clamp(28px, 4vw, 42px)', fontWeight: 830, letterSpacing: '-0.03em' }}>
            {t('lp_faq_title')}
          </h2>
        </div>

        <div style={{ display: 'grid', gap: 12 }}>
          {faqs.map((faq, i) => {
            const isOpen = open === i;
            return (
              <div key={faq.q} ref={reveal} style={{ transitionDelay: `${i * 70}ms` }}>
                <div className={`vi-lp-faq${isOpen ? ' open' : ''}`}>
                  <button
                    type="button"
                    className="vi-lp-faq-q"
                    aria-expanded={isOpen}
                    onClick={() => setOpen(isOpen ? -1 : i)}
                  >
                    {t(faq.q)}
                    <span className="vi-lp-faq-sign" aria-hidden="true" />
                  </button>
                  <div className="vi-lp-faq-a">
                    <div><p>{t(faq.a)}</p></div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ── Closing CTA ──────────────────────────────────────────────────────────────

function FinalCta({ t, reveal, onCreate }: {
  t: (k: ViKey) => string; reveal: (el: HTMLElement | null) => void; onCreate: () => void;
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
              onClick={onCreate}
            >
              {t('lp_cta_primary')} <span style={{ fontSize: 18 }}>→</span>
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

// ── Full-screen template preview ─────────────────────────────────────────────

function PreviewModal({ tpl, t, onClose, onCreate }: {
  tpl: TemplateDefinition; t: (k: ViKey) => string; onClose: () => void; onCreate: () => void;
}) {
  const config = useMemo(() => resolveAssetUrls(tpl, tpl.defaultConfig as Record<string, unknown>), [tpl]);

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
          <RichRenderer html={tpl.html} config={config} languages={[...LOCALES]} interactive />
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

        <div style={{ padding: 12, background: 'var(--vi-card)', borderTop: '1px solid var(--vi-border)' }}>
          <button type="button" className="vi-btn vi-btn-primary" style={{ width: '100%', padding: '13px' }} onClick={onCreate}>
            ✨ {t('lp_cta_primary')}
          </button>
        </div>
      </div>
    </div>
  );
}
