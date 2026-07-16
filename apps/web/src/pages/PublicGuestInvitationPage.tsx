import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  guestInvitationService,
  type GuestInvitation,
  type SectionAnimation,
  type AnimationType,
  type SectionKey,
} from '../services/guestInvitation.service';
import { getPhotoUrl } from '../utils/photoUrl';
import { FingerTrail } from '../components/FingerTrail';
import { MusicPlayer } from '../components/MusicPlayer';
import { getInvitationSubdomainSlug } from '../utils/subdomain';
import { useParams } from 'react-router-dom';
import { BlockList, readableText, type RenderCtx } from '../blocks/BlockRenderer';
import { ParticleField } from '../blocks/ParticleField';

const TEXT = '#1a1a1a';

function hexToRgba(hex: string, alpha: number): string {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex.trim());
  if (!m) return `rgba(201,164,44,${alpha})`;
  return `rgba(${parseInt(m[1], 16)},${parseInt(m[2], 16)},${parseInt(m[3], 16)},${alpha})`;
}

function useCountdown(target: string | null | undefined) {
  const [now, setNow] = useState<number>(Date.now());
  useEffect(() => {
    const idt = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(idt);
  }, []);
  if (!target) return null;
  const diff = Math.max(0, new Date(target).getTime() - now);
  return {
    days: Math.floor(diff / 86400000),
    hours: Math.floor((diff / 3600000) % 24),
    minutes: Math.floor((diff / 60000) % 60),
    seconds: Math.floor((diff / 1000) % 60),
  };
}

// ── Per-section animation wrapper ────────────────────────────────────────────
function hiddenStyle(type: AnimationType): React.CSSProperties {
  switch (type) {
    case 'none': return {};
    case 'fade': return { opacity: 0 };
    case 'slide-up': return { opacity: 0, transform: 'translateY(40px)' };
    case 'slide-down': return { opacity: 0, transform: 'translateY(-40px)' };
    case 'slide-left': return { opacity: 0, transform: 'translateX(40px)' };
    case 'slide-right': return { opacity: 0, transform: 'translateX(-40px)' };
    case 'zoom': return { opacity: 0, transform: 'scale(0.85)' };
    case 'blur': return { opacity: 0, filter: 'blur(12px)' };
    case 'flip': return { opacity: 0, transform: 'perspective(800px) rotateX(35deg)' };
    default: return { opacity: 0 };
  }
}

function AnimatedSection({ anim, style, children }: { anim?: SectionAnimation; style?: React.CSSProperties; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const type = anim?.type ?? 'fade';
  const [shown, setShown] = useState(type === 'none');

  useEffect(() => {
    if (shown) return;
    const el = ref.current;
    if (!el) return;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce || !('IntersectionObserver' in window)) { setShown(true); return; }
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) { setShown(true); io.disconnect(); } }),
      { threshold: 0.12, rootMargin: '0px 0px -8% 0px' }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [shown]);

  const dur = anim?.durationMs ?? 700;
  const delay = anim?.delayMs ?? 0;
  const transition = `opacity ${dur}ms ease ${delay}ms, transform ${dur}ms cubic-bezier(0.22,1,0.36,1) ${delay}ms, filter ${dur}ms ease ${delay}ms`;
  const visible: React.CSSProperties = { opacity: 1, transform: 'none', filter: 'none' };

  return (
    <div ref={ref} style={{ ...style, transition, willChange: 'opacity, transform', ...(shown ? visible : hiddenStyle(type)) }}>
      {children}
    </div>
  );
}

// ── Dispatcher: try the guest-invitation table first, else the flyer page ─────
export const InvitationSubdomainDispatcher = () => {
  const { slug: pathSlug } = useParams();
  const slug = pathSlug || getInvitationSubdomainSlug() || '';
  const { data, isLoading, isError } = useQuery({
    queryKey: ['public-guest-invitation', slug],
    queryFn: () => guestInvitationService.publicBySlug(slug),
    enabled: !!slug,
    retry: false,
  });

  if (isLoading) {
    return <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fafaf7' }}>...</main>;
  }
  // Flyers now live on the `.event.` host; this subdomain serves only guest invitations.
  if (isError || !data) {
    return <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fafaf7', color: '#1a1a1a', fontFamily: 'serif' }}>Not found</main>;
  }
  return <GuestInvitationView invitation={data} />;
};

// ── The wedding-style renderer ───────────────────────────────────────────────
function GuestInvitationView({ invitation: inv }: { invitation: GuestInvitation }) {
  const accent = inv.accentColor || '#c9a42c';
  const bgColor = inv.backgroundColor || '#fafaf7';
  const trailColor = inv.trailColor || accent;
  const heroImg = inv.heroImageUrl ? (getPhotoUrl(inv.heroImageUrl) ?? inv.heroImageUrl) : null;
  const venueImg = inv.venueImageUrl ? (getPhotoUrl(inv.venueImageUrl) ?? inv.venueImageUrl) : null;
  const musicSrc = inv.musicUrl ? (getPhotoUrl(inv.musicUrl) ?? inv.musicUrl) : null;
  const cd = useCountdown(inv.countdownAt);

  const anim = (k: SectionKey) => inv.sectionAnimations?.[k];
  const openMap = () => {
    if (!inv.mapAddress) return;
    window.open(`https://yandex.com/maps/?text=${encodeURIComponent(inv.mapAddress)}`, '_blank', 'noopener,noreferrer');
  };

  const bgImg = inv.backgroundImageUrl ? (getPhotoUrl(inv.backgroundImageUrl) ?? inv.backgroundImageUrl) : null;
  const pageBackground = bgImg
    ? `${bgColor} url(${bgImg}) top center / contain repeat`
    : `radial-gradient(circle at 20% 0%, ${hexToRgba(accent, 0.16)} 0%, transparent 42%), radial-gradient(circle at 80% 100%, ${hexToRgba(accent, 0.12)} 0%, transparent 50%), ${bgColor}`;

  // New block-based layout takes over when present; otherwise fall back to the
  // legacy fixed wedding layout below.
  if (inv.blocks && inv.blocks.length > 0) {
    const ctx: RenderCtx = { accent, text: inv.textColor || (bgImg ? '#f5f5f5' : readableText(bgColor)), textScale: inv.textScale ?? 1, submitRsvp: (p) => guestInvitationService.submitRsvp(inv.slug, p) };
    return (
      <main style={{ minHeight: '100vh', background: pageBackground, color: TEXT, fontFamily: '"Playfair Display", Georgia, serif', display: 'flex', justifyContent: 'center', position: 'relative' }}>
        <ParticleField kind={inv.particles} fixed />
        <FingerTrail accent={trailColor} template={inv.trailTemplate ?? 'sparkle'} />
        {musicSrc && <MusicPlayer src={musicSrc} accent={accent} />}
        <div style={{ width: '100%', maxWidth: 440, display: 'flex', flexDirection: 'column', position: 'relative', zIndex: 1 }}>
          <BlockList blocks={inv.blocks} ctx={ctx} />
        </div>
      </main>
    );
  }

  const mapButton = inv.mapAddress ? (
    <button type="button" onClick={openMap} style={{
      display: 'inline-block', padding: '12px 40px', borderRadius: 999, border: 'none', cursor: 'pointer',
      background: '#000', color: '#fff', fontSize: 14, fontWeight: 700, letterSpacing: '0.2em',
      fontFamily: 'system-ui, sans-serif',
    }}>{inv.mapButtonLabel || 'КАРТА'}</button>
  ) : null;

  return (
    <main style={{
      minHeight: '100vh', background: pageBackground, color: TEXT,
      fontFamily: '"Playfair Display", Georgia, serif', display: 'flex', justifyContent: 'center', position: 'relative',
    }}>
      <FingerTrail accent={trailColor} template={inv.trailTemplate ?? 'sparkle'} />
      {musicSrc && <MusicPlayer src={musicSrc} accent={accent} />}

      <div style={{ width: '100%', maxWidth: 440, display: 'flex', flexDirection: 'column', position: 'relative', zIndex: 1 }}>

        {/* Hero */}
        <AnimatedSection anim={anim('hero')}>
          <section style={{
            minHeight: '88vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            textAlign: 'center', padding: '40px 24px', position: 'relative',
            background: heroImg ? `linear-gradient(rgba(255,255,255,0.05), rgba(255,255,255,0.05)), url(${heroImg}) center / cover` : 'transparent',
          }}>
            {inv.coupleNames && (
              <h1 style={{ margin: 0, fontSize: 40, lineHeight: 1.15, fontWeight: 500, letterSpacing: '0.04em', color: TEXT }}>{inv.coupleNames}</h1>
            )}
            {inv.heroSubtitle && (
              <p style={{ position: 'absolute', bottom: 28, margin: 0, fontSize: 12, letterSpacing: '0.25em', color: accent, fontFamily: 'system-ui, sans-serif', fontWeight: 700 }}>{inv.heroSubtitle}</p>
            )}
          </section>
        </AnimatedSection>

        {/* Dear guest */}
        {(inv.greetingTitle || inv.greetingMessage || inv.coupleSignature) && (
          <AnimatedSection anim={anim('greeting')}>
            <section style={{ padding: '48px 28px', textAlign: 'center' }}>
              {inv.greetingTitle && <h2 style={{ margin: '0 0 18px', fontSize: 26, letterSpacing: '0.1em', color: TEXT }}>{inv.greetingTitle}</h2>}
              {inv.greetingMessage && (
                <p style={{ margin: '0 auto', maxWidth: 360, fontSize: 14, lineHeight: 1.7, letterSpacing: '0.05em', color: '#444', fontFamily: 'system-ui, sans-serif', whiteSpace: 'pre-line' }}>{inv.greetingMessage}</p>
              )}
              {inv.coupleSignature && (
                <>
                  <div style={{ width: 120, height: 1, background: accent, margin: '22px auto' }} />
                  <p style={{ margin: 0, fontSize: 26, letterSpacing: '0.12em', color: TEXT }}>{inv.coupleSignature}</p>
                </>
              )}
            </section>
          </AnimatedSection>
        )}

        {/* Venue + map */}
        {(inv.venueName || venueImg || inv.mapAddress) && (
          <AnimatedSection anim={anim('venue')}>
            <section style={{ padding: '40px 28px', textAlign: 'center' }}>
              {inv.venueLabel && <p style={{ margin: '0 0 4px', fontSize: 13, letterSpacing: '0.25em', color: accent, fontFamily: 'system-ui, sans-serif', fontWeight: 700 }}>{inv.venueLabel}</p>}
              {inv.venueName && <h2 style={{ margin: '0 0 18px', fontSize: 30, letterSpacing: '0.06em', color: TEXT }}>{inv.venueName}</h2>}
              <div style={{ display: 'flex', alignItems: 'center', gap: 18, justifyContent: 'center', flexWrap: 'wrap' }}>
                {inv.eventDate && (
                  <div style={{ fontSize: 44, fontWeight: 600, lineHeight: 1.1, color: TEXT }}>
                    {new Date(inv.eventDate).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit' }).split('.').map((p, i) => (
                      <div key={i} style={{ position: 'relative' }}>{p}{i < 2 && <span style={{ position: 'absolute', right: -6, bottom: 8, width: 6, height: 6, borderRadius: '50%', background: accent }} />}</div>
                    ))}
                  </div>
                )}
                {venueImg && <img src={venueImg} alt="" style={{ width: 200, height: 220, objectFit: 'cover', borderRadius: 4 }} />}
              </div>
              {mapButton && <div style={{ marginTop: 26 }}>{mapButton}</div>}
            </section>
          </AnimatedSection>
        )}

        {/* Timing */}
        {inv.timingItems.length > 0 && (
          <AnimatedSection anim={anim('timing')}>
            <section style={{ padding: '40px 32px' }}>
              {inv.timingTitle && <h2 style={{ margin: '0 0 28px', fontSize: 40, textAlign: 'center', letterSpacing: '0.08em', color: TEXT }}>{inv.timingTitle}</h2>}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
                {inv.timingItems.map((it, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'baseline', gap: 18 }}>
                    <span style={{ fontSize: 17, color: accent, fontFamily: 'system-ui, sans-serif', minWidth: 56 }}>{it.time}</span>
                    <span style={{ fontSize: 18, letterSpacing: '0.05em', color: TEXT }}>{it.label}</span>
                  </div>
                ))}
              </div>
            </section>
          </AnimatedSection>
        )}

        {/* Countdown */}
        {inv.countdownAt && cd && (
          <AnimatedSection anim={anim('countdown')}>
            <section style={{ padding: '40px 28px', textAlign: 'center' }}>
              {inv.countdownLabel && <h2 style={{ margin: '0 0 22px', fontSize: 28, letterSpacing: '0.08em', color: TEXT }}>{inv.countdownLabel}</h2>}
              <div style={{ display: 'flex', gap: 10, justifyContent: 'center', fontFamily: 'system-ui, sans-serif' }}>
                {[{ v: cd.days, l: 'Days' }, { v: cd.hours, l: 'Hrs' }, { v: cd.minutes, l: 'Min' }, { v: cd.seconds, l: 'Sec' }].map((s) => (
                  <div key={s.l} style={{ minWidth: 60 }}>
                    <p style={{ margin: 0, fontSize: 40, fontWeight: 600, color: TEXT, fontFamily: '"Playfair Display", Georgia, serif' }}>{String(s.v).padStart(2, '0')}</p>
                    <p style={{ margin: '2px 0 0', fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: hexToRgba(accent, 0.9) }}>{s.l}</p>
                  </div>
                ))}
              </div>
            </section>
          </AnimatedSection>
        )}

        {/* RSVP */}
        {inv.rsvpEnabled && (
          <AnimatedSection anim={anim('rsvp')}>
            <RsvpForm slug={inv.slug} title={inv.rsvpTitle} accent={accent} />
          </AnimatedSection>
        )}

        {/* Contacts / brand */}
        <AnimatedSection anim={anim('contacts')}>
          <section style={{ padding: '44px 28px 56px', textAlign: 'center' }}>
            {inv.brandLabel && <p style={{ margin: '0 0 18px', fontSize: 15, letterSpacing: '0.3em', color: TEXT, fontFamily: 'system-ui, sans-serif', fontWeight: 600 }}>{inv.brandLabel}</p>}
            <div style={{ display: 'flex', gap: 14, justifyContent: 'center' }}>
              {inv.telegramUrl && <SocialIcon href={inv.telegramUrl}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M9.78 18.65l.28-4.23 7.68-6.92c.34-.31-.07-.46-.52-.19L7.74 13.24 3.64 11.94c-.88-.25-.89-.86.2-1.3l15.97-6.16c.73-.33 1.43.18 1.15 1.3l-2.72 12.81c-.19.91-.74 1.13-1.5.71L12.6 16.3 10.55 18.28c-.24.24-.43.45-.85.45z"/></svg>
              </SocialIcon>}
              {inv.phone && <SocialIcon href={`tel:${inv.phone}`}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
              </SocialIcon>}
              {inv.instagramUrl && <SocialIcon href={inv.instagramUrl}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" /><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>
              </SocialIcon>}
            </div>
          </section>
        </AnimatedSection>
      </div>
    </main>
  );
}

function SocialIcon({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" style={{
      width: 46, height: 46, borderRadius: '50%', background: '#000', color: '#fff',
      display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none',
    }}>{children}</a>
  );
}

function RsvpForm({ slug, title, accent }: { slug: string; title: string | null; accent: string }) {
  const [name, setName] = useState('');
  const [attending, setAttending] = useState<boolean | null>(null);
  const [state, setState] = useState<'idle' | 'sending' | 'done' | 'error'>('idle');

  const submit = async () => {
    if (!name.trim() || attending === null) return;
    setState('sending');
    try {
      await guestInvitationService.submitRsvp(slug, { guestName: name.trim(), attending });
      setState('done');
    } catch {
      setState('error');
    }
  };

  const radio = (val: boolean, label: string) => (
    <label style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', fontSize: 16, color: TEXT, fontFamily: 'system-ui, sans-serif' }}>
      <span style={{ width: 26, height: 26, borderRadius: '50%', border: `2px solid ${attending === val ? accent : '#bbb'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        {attending === val && <span style={{ width: 12, height: 12, borderRadius: '50%', background: accent }} />}
      </span>
      <input type="radio" checked={attending === val} onChange={() => setAttending(val)} style={{ display: 'none' }} />
      {label}
    </label>
  );

  return (
    <section style={{ padding: '48px 28px', textAlign: 'center' }}>
      {title && <h2 style={{ margin: '0 0 26px', fontSize: 30, letterSpacing: '0.06em', color: TEXT }}>{title}</h2>}
      {state === 'done' ? (
        <p style={{ margin: 0, fontSize: 18, color: accent, fontFamily: 'system-ui, sans-serif', fontWeight: 600 }}>Спасибо! Ваш ответ получен.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18, maxWidth: 360, margin: '0 auto' }}>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Напишите Имя"
            style={{ padding: '16px 18px', fontSize: 16, border: '1px solid #ccc', borderRadius: 2, outline: 'none', background: 'transparent', color: TEXT, fontFamily: 'system-ui, sans-serif' }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, alignItems: 'flex-start' }}>
            {radio(true, 'смогу присутствовать')}
            {radio(false, 'не смогу присутствовать')}
          </div>
          <button type="button" onClick={submit} disabled={state === 'sending' || !name.trim() || attending === null}
            style={{ alignSelf: 'center', padding: '14px 44px', borderRadius: 999, border: 'none', cursor: 'pointer', background: '#000', color: '#fff', fontSize: 14, fontWeight: 700, letterSpacing: '0.2em', fontFamily: 'system-ui, sans-serif', opacity: !name.trim() || attending === null ? 0.5 : 1 }}>
            {state === 'sending' ? '...' : 'ОТПРАВИТЬ'}
          </button>
          {state === 'error' && <p style={{ margin: 0, fontSize: 13, color: '#c00' }}>Не удалось отправить. Попробуйте снова.</p>}
        </div>
      )}
    </section>
  );
}
