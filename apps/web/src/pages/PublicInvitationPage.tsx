import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { invitationService, normalizeGalleryItems, type Invitation, type InvitationGalleryItem } from '../services/invitation.service';
import { getPhotoUrl } from '../utils/photoUrl';

const ACCENT = '#c9a42c';
const PAGE_BG = `
  radial-gradient(circle at 20% 0%, rgba(212,175,55,0.18) 0%, transparent 40%),
  radial-gradient(circle at 80% 100%, rgba(212,175,55,0.14) 0%, transparent 50%),
  #fafaf7
`;
const PAPER_BG = '#fdfcf8';
const TEXT = '#1a1a1a';

function hexToRgba(hex: string, alpha: number): string {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex.trim());
  if (!m) return `rgba(201,164,44,${alpha})`;
  const r = parseInt(m[1], 16), g = parseInt(m[2], 16), b = parseInt(m[3], 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function useCountdown(target: string | null | undefined) {
  const [now, setNow] = useState<number>(Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);
  if (!target) return null;
  const diff = Math.max(0, new Date(target).getTime() - now);
  const days = Math.floor(diff / (24 * 60 * 60 * 1000));
  const hours = Math.floor((diff / (60 * 60 * 1000)) % 24);
  const minutes = Math.floor((diff / (60 * 1000)) % 60);
  const seconds = Math.floor((diff / 1000) % 60);
  return { days, hours, minutes, seconds };
}

function Block({ children, padded = true }: { children: React.ReactNode; padded?: boolean }) {
  return (
    <div style={{
      background: PAPER_BG,
      borderRadius: 16,
      boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
      padding: padded ? 20 : 0,
      overflow: 'hidden',
    }}>
      {children}
    </div>
  );
}

export const PublicInvitationPage = () => {
  const { slug = '' } = useParams();
  const { data: invitation, isLoading, isError } = useQuery<Invitation>({
    queryKey: ['public-invitation', slug],
    queryFn: () => invitationService.publicBySlug(slug),
    enabled: !!slug,
  });

  const cd = useCountdown(invitation?.countdownAt);

  if (isLoading) {
    return <main style={{ minHeight: '100vh', background: PAGE_BG, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>...</main>;
  }
  if (isError || !invitation) {
    return <main style={{ minHeight: '100vh', background: PAGE_BG, display: 'flex', alignItems: 'center', justifyContent: 'center', color: TEXT, fontFamily: 'serif' }}>Invitation not found</main>;
  }

  const promoImg = invitation.promoImageUrl ? (getPhotoUrl(invitation.promoImageUrl) ?? invitation.promoImageUrl) : null;
  const welcomeImg = invitation.welcomeImageUrl ? (getPhotoUrl(invitation.welcomeImageUrl) ?? invitation.welcomeImageUrl) : null;
  const restaurantLogo = invitation.restaurant?.logoUrl ? (getPhotoUrl(invitation.restaurant.logoUrl) ?? invitation.restaurant.logoUrl) : null;

  // ── Theme from the invitation ──
  const accent = invitation.accentColor || ACCENT;
  const bgColor = invitation.backgroundColor || '#fafaf7';
  const bgImage = invitation.backgroundImageUrl ? (getPhotoUrl(invitation.backgroundImageUrl) ?? invitation.backgroundImageUrl) : null;
  const galleryItems = normalizeGalleryItems(invitation.galleryPhotos);
  const pageBackground = bgImage
    ? `linear-gradient(rgba(0,0,0,0.25), rgba(0,0,0,0.35)), url(${bgImage}) center / cover fixed, ${bgColor}`
    : `radial-gradient(circle at 20% 0%, ${hexToRgba(accent, 0.18)} 0%, transparent 40%), radial-gradient(circle at 80% 100%, ${hexToRgba(accent, 0.14)} 0%, transparent 50%), ${bgColor}`;

  return (
    <main style={{
      minHeight: '100vh',
      background: pageBackground,
      color: TEXT,
      fontFamily: '"Playfair Display", Georgia, serif',
      padding: '20px 16px',
      display: 'flex', justifyContent: 'center',
      position: 'relative',
    }}>
      <FingerTrail accent={accent} />
      <div style={{ width: '100%', maxWidth: 420, display: 'flex', flexDirection: 'column', gap: 16, position: 'relative', zIndex: 1 }}>

        {/* Top promo / gift card */}
        <Block padded={false}>
          <div style={{ position: 'relative' }}>
            {promoImg ? (
              <img src={promoImg} alt="" style={{ width: '100%', height: 'auto', display: 'block' }} />
            ) : (
              <div style={{ aspectRatio: '4 / 3', background: `linear-gradient(135deg, ${hexToRgba(accent, 0.25)} 0%, ${accent} 100%)`, position: 'relative' }}>
                <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, fontWeight: 800, color: '#fff', letterSpacing: '0.05em' }}>
                  {invitation.promoTitle ?? 'Online invitation'}
                </span>
              </div>
            )}
            {invitation.promoCode && (
              <div style={{
                position: 'absolute', bottom: 10, left: '50%', transform: 'translateX(-50%)',
                background: accent, color: '#0f0f0f',
                padding: '6px 18px', borderRadius: 999,
                fontWeight: 800, fontSize: 14, letterSpacing: '0.05em',
                boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
              }}>
                {invitation.promoCode}
              </div>
            )}
            <span style={{
              position: 'absolute', top: 10, left: -2,
              background: '#000', color: accent,
              padding: '4px 12px', fontWeight: 800, fontSize: 11, letterSpacing: '0.15em',
              transform: 'rotate(-12deg)',
            }}>FREE</span>
          </div>
          {invitation.promoSubtitle && (
            <p style={{ margin: 0, padding: '12px 16px', fontSize: 12, textAlign: 'center', fontWeight: 600, color: TEXT, fontFamily: 'system-ui, sans-serif' }}>
              {invitation.promoSubtitle}
            </p>
          )}
        </Block>

        {/* Promo code alt + description */}
        {(invitation.promoCodeAlt || invitation.promoDescription) && (
          <Block>
            {invitation.promoCodeAlt && (
              <h3 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 800, color: TEXT, fontFamily: 'system-ui, sans-serif' }}>{invitation.promoCodeAlt}</h3>
            )}
            {invitation.promoDescription && (
              <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5, color: '#444', fontFamily: 'system-ui, sans-serif' }}>{invitation.promoDescription}</p>
            )}
          </Block>
        )}

        {/* Telegram CTA */}
        {invitation.telegramUrl && (
          <a href={invitation.telegramUrl} target="_blank" rel="noreferrer"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
              padding: '14px 16px',
              background: '#2aabee',
              borderRadius: 14,
              color: '#fff',
              textDecoration: 'none',
              fontWeight: 800, fontSize: 15, letterSpacing: '0.1em',
              fontFamily: 'system-ui, sans-serif',
              boxShadow: '0 6px 16px rgba(42,171,238,0.35)',
            }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M9.78 18.65l.28-4.23 7.68-6.92c.34-.31-.07-.46-.52-.19L7.74 13.24 3.64 11.94c-.88-.25-.89-.86.2-1.3l15.97-6.16c.73-.33 1.43.18 1.15 1.3l-2.72 12.81c-.19.91-.74 1.13-1.5.71L12.6 16.3 10.55 18.28c-.24.24-.43.45-.85.45z"/></svg>
            {invitation.telegramLabel ?? 'TELEGRAM'}
          </a>
        )}

        {/* Welcome card with countdown */}
        <Block padded={false}>
          {welcomeImg && (
            <div style={{ position: 'relative' }}>
              <img src={welcomeImg} alt="" style={{ width: '100%', display: 'block' }} />
            </div>
          )}
          <div style={{ padding: '22px 20px', textAlign: 'center' }}>
            {/* Restaurant logo above the congratulatory text */}
            {restaurantLogo && (
              <img
                src={restaurantLogo}
                alt={invitation.restaurant?.name ?? ''}
                style={{ maxWidth: 150, maxHeight: 110, height: 'auto', width: 'auto', objectFit: 'contain', margin: '0 auto 16px', display: 'block' }}
              />
            )}
            {invitation.welcomeTitle && (
              <p style={{ margin: 0, fontSize: 26, fontStyle: 'italic', color: TEXT }}>{invitation.welcomeTitle}</p>
            )}
            {invitation.welcomeSubtitle && (
              <p style={{ margin: '4px 0 0', fontSize: 22, fontStyle: 'italic', color: TEXT }}>{invitation.welcomeSubtitle}</p>
            )}

            {invitation.countdownAt && (
              <>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 14, marginTop: 14, background: '#fff', borderRadius: 999, padding: '6px 14px', boxShadow: '0 2px 6px rgba(0,0,0,0.08)' }}>
                  {invitation.countdownLabel && (
                    <span style={{ background: '#d22', color: '#fff', borderRadius: 999, padding: '4px 12px', fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', fontFamily: 'system-ui, sans-serif' }}>
                      {invitation.countdownLabel}
                    </span>
                  )}
                  <span style={{ fontFamily: 'system-ui, sans-serif', fontWeight: 700, fontSize: 14 }}>
                    {new Date(invitation.countdownAt).toLocaleDateString(undefined, { day: '2-digit', month: 'short' })}
                  </span>
                  <span style={{ fontFamily: 'system-ui, sans-serif', fontWeight: 700, fontSize: 14 }}>
                    {new Date(invitation.countdownAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>

                {cd && (
                  <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginTop: 18, fontFamily: 'system-ui, sans-serif' }}>
                    {[
                      { v: cd.days, label: 'Days' },
                      { v: cd.hours, label: 'Hrs' },
                      { v: cd.minutes, label: 'Min' },
                      { v: cd.seconds, label: 'Sec' },
                    ].map((slot) => (
                      <div key={slot.label} style={{ flex: 1, background: '#fff', borderRadius: 8, padding: '8px 4px', boxShadow: '0 1px 4px rgba(0,0,0,0.1)' }}>
                        <p style={{ margin: 0, fontSize: 22, fontWeight: 800, color: TEXT }}>{String(slot.v).padStart(2, '0')}</p>
                        <p style={{ margin: '2px 0 0', fontSize: 9, color: '#666', letterSpacing: '0.1em', textTransform: 'uppercase' }}>{slot.label}</p>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {invitation.welcomeMessage && (
              <p style={{ margin: '20px 0 0', fontSize: 14, lineHeight: 1.5, color: TEXT, fontFamily: 'system-ui, sans-serif', fontWeight: 600 }}>
                {invitation.welcomeMessage}
              </p>
            )}
          </div>
        </Block>

        {/* Menu showcase */}
        {invitation.menuItems.length > 0 && (
          <Block padded={false}>
            <div style={{ background: '#000', color: accent, padding: '10px 0', textAlign: 'center', fontWeight: 800, fontSize: 14, letterSpacing: '0.3em', fontFamily: 'system-ui, sans-serif' }}>
              МЕНЮ · MENU · МЕНЮ
            </div>
            <div style={{ padding: '18px 16px', display: 'flex', flexDirection: 'column', gap: 18 }}>
              {invitation.menuItems.map((item, i) => {
                const left = i % 2 === 0;
                const imgSrc = item.photoUrl ? (getPhotoUrl(item.photoUrl) ?? item.photoUrl) : null;
                return (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14, flexDirection: left ? 'row' : 'row-reverse' }}>
                    <div style={{ position: 'relative', width: 130, height: 130, flexShrink: 0 }}>
                      <div style={{
                        position: 'absolute', inset: 0, borderRadius: '50%',
                        background: imgSrc ? `url(${imgSrc}) center / cover` : '#eaeaea',
                        border: `3px solid ${accent}`,
                      }} />
                      <span style={{
                        position: 'absolute', top: -4, left: -4,
                        width: 26, height: 26, borderRadius: '50%',
                        background: accent, color: '#000',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontWeight: 800, fontSize: 14,
                        fontFamily: 'system-ui, sans-serif',
                        border: '2px solid #fff',
                      }}>{item.number}</span>
                    </div>
                    <p style={{ margin: 0, fontSize: 22, fontStyle: 'italic', fontWeight: 700, color: TEXT }}>{item.name}</p>
                  </div>
                );
              })}
            </div>
            <div style={{ background: '#000', color: accent, padding: '10px 0', textAlign: 'center', fontWeight: 800, fontSize: 12, letterSpacing: '0.25em', fontFamily: 'system-ui, sans-serif' }}>
              ★ {(invitation.restaurant?.name ?? 'RESTAURANT').toUpperCase()} RESTAURANT ★
            </div>
          </Block>
        )}

        {/* Gallery — Instagram video stills */}
        {galleryItems.length > 0 && (
          <Block padded={false}>
            <GalleryCarousel items={galleryItems} accent={accent} />
          </Block>
        )}

        {/* Contacts */}
        <Block>
          <h3 style={{ margin: '0 0 14px', textAlign: 'center', fontSize: 18, fontWeight: 800, letterSpacing: '0.15em', fontFamily: 'system-ui, sans-serif', color: TEXT }}>
            {invitation.contactsTitle ?? 'НАШИ КОНТАКТЫ'}
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {invitation.phone && (
              <a href={`tel:${invitation.phone}`} style={contactLinkStyle}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                PHONE
              </a>
            )}
            {invitation.instagramUrl && (
              <a href={invitation.instagramUrl} target="_blank" rel="noreferrer" style={contactLinkStyle}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" /><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>
                <div style={{ textAlign: 'left' }}>
                  <p style={{ margin: 0, fontSize: 12, fontWeight: 700, letterSpacing: '0.1em' }}>INSTAGRAM</p>
                  <p style={{ margin: 0, fontSize: 11, fontWeight: 400 }}>{invitation.instagramLabel ?? ''}</p>
                </div>
              </a>
            )}
            {invitation.contactVCardUrl && (
              <a href={invitation.contactVCardUrl} download style={{ ...contactLinkStyle, background: '#000', color: accent }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                <div style={{ textAlign: 'left' }}>
                  <p style={{ margin: 0, fontSize: 12, fontWeight: 700, letterSpacing: '0.1em' }}>СОХРАНИТЬ КОНТАКТЫ</p>
                  {invitation.restaurant?.name && (
                    <p style={{ margin: 0, fontSize: 11, fontWeight: 400 }}>«{invitation.restaurant.name}» restaurant</p>
                  )}
                </div>
              </a>
            )}
          </div>
        </Block>

        <p style={{ margin: 0, textAlign: 'center', fontSize: 11, color: '#777', fontFamily: 'system-ui, sans-serif', padding: '12px 0' }}>
          {invitation.restaurant?.name ?? ''}
        </p>
      </div>
    </main>
  );
};

const contactLinkStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14,
  padding: '14px 16px',
  background: '#fff',
  borderRadius: 12,
  color: TEXT,
  textDecoration: 'none',
  fontWeight: 700, fontSize: 14, letterSpacing: '0.1em',
  fontFamily: 'system-ui, sans-serif',
  boxShadow: '0 2px 6px rgba(0,0,0,0.06)',
};

function GalleryCarousel({ items, accent }: { items: InvitationGalleryItem[]; accent: string }) {
  const [idx, setIdx] = useState(0);
  const prev = () => setIdx((i) => (i - 1 + items.length) % items.length);
  const next = () => setIdx((i) => (i + 1) % items.length);
  const current = items[idx];
  const src = getPhotoUrl(current.photoUrl) ?? current.photoUrl;
  const video = current.videoUrl || null;

  const openVideo = () => { if (video) window.open(video, '_blank', 'noopener,noreferrer'); };

  return (
    <div style={{ position: 'relative' }}>
      <div
        onClick={openVideo}
        style={{ aspectRatio: '4 / 3', background: '#000', position: 'relative', overflow: 'hidden', cursor: video ? 'pointer' : 'default' }}
      >
        <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        {video && (
          // Play badge signalling this still opens an Instagram video
          <span style={{
            position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
            width: 56, height: 56, borderRadius: '50%',
            background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(2px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontSize: 22, paddingLeft: 4,
            border: '2px solid rgba(255,255,255,0.85)',
          }}>▶</span>
        )}
        {items.length > 1 && (
          <>
            <button type="button" onClick={(e) => { e.stopPropagation(); prev(); }} style={carouselBtn('left', accent)}>‹</button>
            <button type="button" onClick={(e) => { e.stopPropagation(); next(); }} style={carouselBtn('right', accent)}>›</button>
          </>
        )}
      </div>
      {video ? (
        <a href={video} target="_blank" rel="noopener noreferrer"
          style={{ display: 'block', margin: 0, padding: '12px 16px', textAlign: 'center', color: accent, fontWeight: 700, fontSize: 13, fontFamily: 'system-ui, sans-serif', textDecoration: 'none' }}>
          НАЖМИТЕ ЧТОБЫ ПОСМОТРЕТЬ
        </a>
      ) : (
        <p style={{ margin: 0, padding: '12px 16px', textAlign: 'center', color: accent, fontWeight: 700, fontSize: 13, fontFamily: 'system-ui, sans-serif' }}>
          НАЖМИТЕ ЧТОБЫ ПОСМОТРЕТЬ
        </p>
      )}
      {items.length > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 6, paddingBottom: 12 }}>
          {items.map((_, i) => (
            <span key={i} style={{ width: 8, height: 8, borderRadius: '50%', background: i === idx ? accent : '#ccc' }} />
          ))}
        </div>
      )}
    </div>
  );
}
function carouselBtn(side: 'left' | 'right', accent: string): React.CSSProperties {
  return {
    position: 'absolute', top: '50%', transform: 'translateY(-50%)',
    [side]: 10,
    width: 38, height: 38, borderRadius: '50%',
    background: accent, color: '#fff', border: 'none',
    fontSize: 24, fontWeight: 700, cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
  };
}

// ── Finger-trail effect ─────────────────────────────────────────────────────
// A sparkly trail of accent-colored dots that follows the finger/cursor across
// the invitation. Renders on a full-screen canvas behind the content.
function FingerTrail({ accent }: { accent: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rgb = (() => {
      const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(accent.trim());
      return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : [201, 164, 44];
    })();

    type P = { x: number; y: number; vx: number; vy: number; life: number; size: number };
    let particles: P[] = [];
    let raf = 0;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    let lastX = 0, lastY = 0, hasLast = false;
    const emit = (x: number, y: number) => {
      // Number of particles scales with how fast the finger moves.
      const dist = hasLast ? Math.hypot(x - lastX, y - lastY) : 0;
      const count = Math.min(6, 1 + Math.floor(dist / 8));
      for (let i = 0; i < count; i++) {
        particles.push({
          x, y,
          vx: (Math.random() - 0.5) * 0.6,
          vy: (Math.random() - 0.5) * 0.6 - 0.3,
          life: 1,
          size: 2 + Math.random() * 3,
        });
      }
      if (particles.length > 400) particles = particles.slice(-400);
      lastX = x; lastY = y; hasLast = true;
    };

    const onMouse = (e: MouseEvent) => emit(e.clientX, e.clientY);
    const onTouch = (e: TouchEvent) => {
      const t = e.touches[0];
      if (t) emit(t.clientX, t.clientY);
    };
    window.addEventListener('mousemove', onMouse, { passive: true });
    window.addEventListener('touchmove', onTouch, { passive: true });

    const tick = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const p of particles) {
        p.x += p.vx; p.y += p.vy; p.life -= 0.025;
        if (p.life <= 0) continue;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${p.life * 0.85})`;
        ctx.shadowBlur = 8;
        ctx.shadowColor = `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${p.life})`;
        ctx.fill();
      }
      particles = particles.filter((p) => p.life > 0);
      raf = requestAnimationFrame(tick);
    };
    tick();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', onMouse);
      window.removeEventListener('touchmove', onTouch);
    };
  }, [accent]);

  return (
    <canvas
      ref={canvasRef}
      style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 50 }}
    />
  );
}
