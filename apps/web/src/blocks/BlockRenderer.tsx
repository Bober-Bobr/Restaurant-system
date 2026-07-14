import { useEffect, useState } from 'react';
import type { Block, BlockProps, ButtonAction, GalleryItem, MenuShowcaseItem, SocialLink, TimingItem } from './types';
import { str, bool } from './types';
import { AnimatedSection } from './AnimatedSection';
import { getPhotoUrl } from '../utils/photoUrl';

export type RenderCtx = {
  accent: string;
  // Primary text color (derived from the page background for contrast).
  text?: string;
  replayAnim?: boolean;
  // When provided (invitations), the RSVP block persists responses.
  submitRsvp?: (p: { guestName: string; attending: boolean }) => Promise<void>;
  // When provided (flyers), the form block sends a call-back request to the manager.
  submitLead?: (p: { name: string; phone: string; message?: string }) => Promise<void>;
  // Event start (ISO): countdown blocks without an explicit target count down to it.
  eventDate?: string | null;
  // Restaurant logo: image blocks with "useLogo" render it automatically.
  logoUrl?: string | null;
};

const TEXT = '#1a1a1a';

function hexToRgba(hex: string, alpha: number): string {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex.trim());
  if (!m) return `rgba(201,164,44,${alpha})`;
  return `rgba(${parseInt(m[1], 16)},${parseInt(m[2], 16)},${parseInt(m[3], 16)},${alpha})`;
}

// Pick a legible text color (dark or light) for a given background color.
export function readableText(bg: string | null | undefined): string {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec((bg || '').trim());
  if (!m) return TEXT;
  const [r, g, b] = [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)];
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance < 0.5 ? '#f5f5f5' : TEXT;
}

const img = (u?: string | null) => (u ? (getPhotoUrl(u) ?? u) : null);
const arr = <T,>(p: BlockProps, k: string): T[] => (Array.isArray(p[k]) ? (p[k] as T[]) : []);

// ── One block → markup ───────────────────────────────────────────────────────
export function BlockView({ block, ctx }: { block: Block; ctx: RenderCtx }) {
  // The section sets the inherited text color; sub-components use `inherit`.
  return (
    <AnimatedSection anim={block.anim} replay={ctx.replayAnim} style={{ color: ctx.text ?? TEXT }}>
      <BlockBody block={block} ctx={ctx} />
    </AnimatedSection>
  );
}

function BlockBody({ block, ctx }: { block: Block; ctx: RenderCtx }) {
  const { props: p } = block;
  const accent = ctx.accent;
  switch (block.type) {
    case 'hero': {
      const src = img(str(p, 'imageUrl'));
      return (
        <section style={{ minHeight: '80vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '40px 24px', position: 'relative', background: src ? `linear-gradient(rgba(255,255,255,0.05),rgba(255,255,255,0.05)), url(${src}) center / cover` : 'transparent' }}>
          {str(p, 'title') && <h1 style={{ margin: 0, fontSize: 40, lineHeight: 1.15, fontWeight: 500, letterSpacing: '0.04em', color: 'inherit' }}>{str(p, 'title')}</h1>}
          {str(p, 'subtitle') && <p style={{ position: 'absolute', bottom: 28, margin: 0, fontSize: 12, letterSpacing: '0.25em', color: accent, fontFamily: 'system-ui, sans-serif', fontWeight: 700 }}>{str(p, 'subtitle')}</p>}
        </section>
      );
    }
    case 'heading':
      if (bool(p, 'marquee')) return <MarqueeHeading text={str(p, 'text')} />;
      return <h2 style={{ margin: 0, padding: '22px 24px 6px', fontSize: 26, letterSpacing: '0.08em', textAlign: (str(p, 'align', 'center') as 'left'), color: 'inherit' }}>{str(p, 'text')}</h2>;
    case 'text':
      return <p style={{ margin: 0, padding: '10px 24px', fontSize: 14, lineHeight: 1.7, letterSpacing: '0.03em', textAlign: (str(p, 'align', 'center') as 'left'), color: 'inherit', opacity: 0.85, fontFamily: 'system-ui, sans-serif', whiteSpace: 'pre-line' }}>{str(p, 'text')}</p>;
    case 'image': {
      // "useLogo" → always show the restaurant's current logo instead of a fixed photo.
      if (bool(p, 'useLogo')) {
        const logo = img(ctx.logoUrl);
        if (!logo) return <Placeholder label="Logo" />;
        return <div style={{ padding: '16px 16px', textAlign: 'center' }}><img src={logo} alt="" style={{ maxWidth: 200, maxHeight: 150, width: 'auto', height: 'auto', objectFit: 'contain', display: 'inline-block' }} /></div>;
      }
      const src = img(str(p, 'url'));
      if (!src) return <Placeholder label="Image" />;
      // Full-bleed: no padding so the photo meets the page edges. The "rounded"
      // toggle keeps a small inset so its corners aren't clipped at the edge.
      const rounded = bool(p, 'rounded');
      return rounded
        ? <div style={{ padding: '12px 16px' }}><img src={src} alt="" style={{ width: '100%', display: 'block', borderRadius: 16 }} /></div>
        : <img src={src} alt="" style={{ width: '100%', display: 'block' }} />;
    }
    case 'button':
      return <div style={{ padding: '12px 24px', textAlign: 'center' }}><ActionButton label={str(p, 'label', 'Button')} action={p.action as ButtonAction | undefined} accent={accent} /></div>;
    case 'countdown':
      // No explicit target → count down to the linked event's start time.
      return <CountdownView targetAt={(typeof p.targetAt === 'string' && p.targetAt ? p.targetAt : null) ?? ctx.eventDate ?? null} label={str(p, 'label')} accent={accent} />;
    case 'timing':
      return <TimingView title={str(p, 'title', 'TIMING')} items={arr<TimingItem>(p, 'items')} accent={accent} />;
    case 'gallery':
      return <GalleryCarousel items={arr<GalleryItem>(p, 'items')} accent={accent} />;
    case 'menu':
      return <MenuShowcase title={str(p, 'title', 'МЕНЮ')} items={arr<MenuShowcaseItem>(p, 'items')} accent={accent} />;
    case 'artist':
      return <ArtistShowcase title={str(p, 'title')} items={arr<MenuShowcaseItem>(p, 'items')} accent={accent} />;
    case 'link':
      return <LinkBar label={str(p, 'label', 'Link')} sublabel={str(p, 'sublabel')} action={p.action as ButtonAction | undefined} color={str(p, 'color')} accent={accent} />;
    case 'socials':
      return <SocialsView title={str(p, 'title')} links={arr<SocialLink>(p, 'links')} accent={accent} />;
    case 'contacts':
      return <ContactsView p={p} accent={accent} />;
    case 'map':
      return <MapView label={str(p, 'label', 'КАРТА')} address={str(p, 'address')} />;
    case 'promo':
      return <PromoCard p={p} accent={accent} />;
    case 'rsvp':
      return <RsvpForm title={str(p, 'title')} accent={accent} submit={ctx.submitRsvp} />;
    case 'form':
      return <LeadForm title={str(p, 'title')} subtitle={str(p, 'subtitle')} buttonLabel={str(p, 'buttonLabel')} showMessage={bool(p, 'showMessage')} accent={accent} submit={ctx.submitLead} />;
    case 'savecontact':
      return <SaveContactButton label={str(p, 'label')} name={str(p, 'name')} phone={str(p, 'phone')} accent={accent} />;
    case 'divider':
      return <Divider shape={str(p, 'shape', 'line')} text={str(p, 'text')} accent={accent} />;
    default:
      return null;
  }
}

function Placeholder({ label }: { label: string }) {
  return <div style={{ margin: '12px 16px', aspectRatio: '3/2', borderRadius: 12, border: '1px dashed rgba(0,0,0,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(0,0,0,0.4)', fontSize: 13, fontFamily: 'system-ui, sans-serif' }}>{label}</div>;
}

function yandexMaps(address: string) {
  window.open(`https://yandex.com/maps/?text=${encodeURIComponent(address)}`, '_blank', 'noopener,noreferrer');
}

function ActionButton({ label, action, accent }: { label: string; action?: ButtonAction; accent: string }) {
  const onClick = () => {
    if (!action?.value) return;
    if (action.kind === 'phone') window.location.href = `tel:${action.value}`;
    else if (action.kind === 'map') yandexMaps(action.value);
    else window.open(action.value, '_blank', 'noopener,noreferrer');
  };
  return (
    <button type="button" onClick={onClick} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 10, width: '100%', padding: '14px 18px', borderRadius: 14, border: 'none', cursor: 'pointer', background: '#000', color: accent, fontSize: 14, fontWeight: 700, letterSpacing: '0.1em', fontFamily: 'system-ui, sans-serif' }}>{label}</button>
  );
}

function MapView({ label, address }: { label: string; address: string }) {
  return (
    <div style={{ padding: '14px 24px', textAlign: 'center' }}>
      <button type="button" onClick={() => address && yandexMaps(address)} style={{ display: 'inline-block', padding: '12px 40px', borderRadius: 999, border: 'none', cursor: 'pointer', background: '#000', color: '#fff', fontSize: 14, fontWeight: 700, letterSpacing: '0.2em', fontFamily: 'system-ui, sans-serif' }}>{label}</button>
    </div>
  );
}

function useCountdown(target: string | null) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const i = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(i); }, []);
  if (!target) return null;
  const diff = Math.max(0, new Date(target).getTime() - now);
  return { days: Math.floor(diff / 86400000), hours: Math.floor((diff / 3600000) % 24), minutes: Math.floor((diff / 60000) % 60), seconds: Math.floor((diff / 1000) % 60) };
}

function CountdownView({ targetAt, label, accent }: { targetAt: string | null; label: string; accent: string }) {
  const cd = useCountdown(targetAt);
  return (
    <section style={{ padding: '32px 24px', textAlign: 'center' }}>
      {label && <h2 style={{ margin: '0 0 18px', fontSize: 24, letterSpacing: '0.08em', color: 'inherit' }}>{label}</h2>}
      <div style={{ display: 'flex', gap: 10, justifyContent: 'center', fontFamily: 'system-ui, sans-serif' }}>
        {[{ v: cd?.days ?? 0, l: 'Days' }, { v: cd?.hours ?? 0, l: 'Hrs' }, { v: cd?.minutes ?? 0, l: 'Min' }, { v: cd?.seconds ?? 0, l: 'Sec' }].map((s) => (
          <div key={s.l} style={{ minWidth: 58 }}>
            <p style={{ margin: 0, fontSize: 36, fontWeight: 600, color: 'inherit' }}>{String(s.v).padStart(2, '0')}</p>
            <p style={{ margin: '2px 0 0', fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: hexToRgba(accent, 0.9) }}>{s.l}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function TimingView({ title, items, accent }: { title: string; items: TimingItem[]; accent: string }) {
  if (items.length === 0) return <Placeholder label="Timing" />;
  return (
    <section style={{ padding: '36px 32px' }}>
      {title && <h2 style={{ margin: '0 0 26px', fontSize: 38, textAlign: 'center', letterSpacing: '0.08em', color: 'inherit' }}>{title}</h2>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {items.map((it, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'baseline', gap: 18 }}>
            <span style={{ fontSize: 16, color: accent, fontFamily: 'system-ui, sans-serif', minWidth: 52 }}>{it.time}</span>
            <span style={{ fontSize: 18, letterSpacing: '0.05em', color: 'inherit' }}>{it.label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function GalleryCarousel({ items, accent }: { items: GalleryItem[]; accent: string }) {
  const [idx, setIdx] = useState(0);
  if (items.length === 0) return <Placeholder label="Gallery" />;
  const cur = items[Math.min(idx, items.length - 1)];
  const src = img(cur.photoUrl);
  const video = cur.videoUrl || null;
  return (
    <div style={{ padding: '12px 16px' }}>
      <div style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', background: '#000' }}>
        <div onClick={() => video && window.open(video, '_blank', 'noopener,noreferrer')} style={{ aspectRatio: '4/3', cursor: video ? 'pointer' : 'default' }}>
          {src && <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
          {video && <span style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 56, height: 56, borderRadius: '50%', background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 22, border: '2px solid rgba(255,255,255,0.85)' }}>▶</span>}
        </div>
        {items.length > 1 && (
          <>
            <button type="button" onClick={(e) => { e.stopPropagation(); setIdx((i) => (i - 1 + items.length) % items.length); }} style={navBtn('left', accent)}>‹</button>
            <button type="button" onClick={(e) => { e.stopPropagation(); setIdx((i) => (i + 1) % items.length); }} style={navBtn('right', accent)}>›</button>
          </>
        )}
      </div>
      {items.length > 1 && <div style={{ display: 'flex', justifyContent: 'center', gap: 6, paddingTop: 10 }}>{items.map((_, i) => <span key={i} style={{ width: 8, height: 8, borderRadius: '50%', background: i === idx ? accent : '#ccc' }} />)}</div>}
    </div>
  );
}
function navBtn(side: 'left' | 'right', accent: string): React.CSSProperties {
  return { position: 'absolute', top: '50%', transform: 'translateY(-50%)', [side]: 10, width: 36, height: 36, borderRadius: '50%', background: accent, color: '#fff', border: 'none', fontSize: 22, cursor: 'pointer' } as React.CSSProperties;
}

function MenuShowcase({ title, items, accent }: { title: string; items: MenuShowcaseItem[]; accent: string }) {
  if (items.length === 0) return <Placeholder label="Menu" />;
  return (
    <div>
      {title && <div style={{ background: '#000', color: accent, padding: '10px 0', textAlign: 'center', fontWeight: 800, fontSize: 14, letterSpacing: '0.3em', fontFamily: 'system-ui, sans-serif' }}>{title}</div>}
      <div style={{ padding: '18px 16px', display: 'flex', flexDirection: 'column', gap: 18 }}>
        {items.map((it, i) => {
          const left = i % 2 === 0;
          const src = img(it.photoUrl);
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14, flexDirection: left ? 'row' : 'row-reverse' }}>
              <div style={{ position: 'relative', width: 120, height: 120, flexShrink: 0 }}>
                <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: src ? `url(${src}) center / cover` : '#eaeaea', border: `3px solid ${accent}` }} />
                <span style={{ position: 'absolute', top: -4, left: -4, width: 26, height: 26, borderRadius: '50%', background: accent, color: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 14, fontFamily: 'system-ui, sans-serif', border: '2px solid #fff' }}>{it.number}</span>
              </div>
              <p style={{ margin: 0, fontSize: 22, fontStyle: 'italic', fontWeight: 700, color: 'inherit' }}>{it.name}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SocialsView({ title, links, accent }: { title: string; links: SocialLink[]; accent: string }) {
  return (
    <section style={{ padding: '24px 20px' }}>
      {title && <h3 style={{ margin: '0 0 14px', textAlign: 'center', fontSize: 17, fontWeight: 800, letterSpacing: '0.1em', fontFamily: 'system-ui, sans-serif', color: 'inherit' }}>{title}</h3>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {links.map((l, i) => (
          <a key={i} href={l.url} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: '#111', borderRadius: 12, color: '#fff', textDecoration: 'none', fontFamily: 'system-ui, sans-serif' }}>
            <span style={{ width: 34, height: 34, borderRadius: 8, background: accent, color: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800 }}>@</span>
            <span style={{ fontSize: 13 }}>{l.label}</span>
          </a>
        ))}
      </div>
    </section>
  );
}

function ContactsView({ p }: { p: BlockProps; accent: string }) {
  const phone = str(p, 'phone'); const tg = str(p, 'telegramUrl'); const ig = str(p, 'instagramUrl');
  return (
    <section style={{ padding: '28px 20px', textAlign: 'center' }}>
      {str(p, 'title') && <h3 style={{ margin: '0 0 16px', fontSize: 18, fontWeight: 800, letterSpacing: '0.12em', fontFamily: 'system-ui, sans-serif', color: 'inherit' }}>{str(p, 'title')}</h3>}
      <div style={{ display: 'flex', gap: 16, justifyContent: 'center' }}>
        {tg && <IconLink href={tg}><SvgTelegram /></IconLink>}
        {phone && <IconLink href={`tel:${phone}`}><SvgPhone /></IconLink>}
        {ig && <IconLink href={ig}><SvgInstagram /></IconLink>}
      </div>
    </section>
  );
}
function IconLink({ href, children }: { href: string; children: React.ReactNode }) {
  return <a href={href} target="_blank" rel="noreferrer" style={{ width: 52, height: 52, borderRadius: '50%', background: '#0d0d0d', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none' }}>{children}</a>;
}
function SvgTelegram() {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M9.78 18.65l.28-4.23 7.68-6.92c.34-.31-.07-.46-.52-.19L7.74 13.24 3.64 11.94c-.88-.25-.89-.86.2-1.3l15.97-6.16c.73-.33 1.43.18 1.15 1.3l-2.72 12.81c-.19.91-.74 1.13-1.5.71L12.6 16.3 10.55 18.28c-.24.24-.43.45-.85.45z"/></svg>;
}
function SvgPhone() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>;
}
function SvgInstagram() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>;
}

function PromoCard({ p, accent }: { p: BlockProps; accent: string }) {
  const src = img(str(p, 'imageUrl'));
  return (
    <section style={{ padding: '16px' }}>
      <div style={{ borderRadius: 16, overflow: 'hidden', background: '#fdfcf8', boxShadow: '0 8px 24px rgba(0,0,0,0.08)' }}>
        <div style={{ position: 'relative' }}>
          {src ? <img src={src} alt="" style={{ width: '100%', display: 'block' }} /> : <div style={{ aspectRatio: '4/3', background: `linear-gradient(135deg, ${hexToRgba(accent, 0.25)} 0%, ${accent} 100%)`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 24, fontWeight: 800 }}>{str(p, 'title', 'Promo')}</div>}
          {str(p, 'code') && <div style={{ position: 'absolute', bottom: 10, left: '50%', transform: 'translateX(-50%)', background: accent, color: '#0f0f0f', padding: '6px 18px', borderRadius: 999, fontWeight: 800, fontSize: 14 }}>{str(p, 'code')}</div>}
        </div>
        {str(p, 'subtitle') && <p style={{ margin: 0, padding: '12px 16px', fontSize: 12, textAlign: 'center', fontWeight: 600, color: TEXT, fontFamily: 'system-ui, sans-serif' }}>{str(p, 'subtitle')}</p>}
      </div>
    </section>
  );
}

function RsvpForm({ title, accent, submit }: { title: string; accent: string; submit?: (p: { guestName: string; attending: boolean }) => Promise<void> }) {
  const [name, setName] = useState('');
  const [attending, setAttending] = useState<boolean | null>(null);
  const [state, setState] = useState<'idle' | 'sending' | 'done' | 'error'>('idle');
  const go = async () => {
    if (!name.trim() || attending === null) return;
    setState('sending');
    try { if (submit) await submit({ guestName: name.trim(), attending }); setState('done'); } catch { setState('error'); }
  };
  const radio = (val: boolean, label: string) => (
    <label style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', fontSize: 16, color: 'inherit', fontFamily: 'system-ui, sans-serif' }}>
      <span style={{ width: 26, height: 26, borderRadius: '50%', border: `2px solid ${attending === val ? accent : 'currentColor'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{attending === val && <span style={{ width: 12, height: 12, borderRadius: '50%', background: accent }} />}</span>
      {label}
    </label>
  );
  return (
    <section style={{ padding: '40px 24px', textAlign: 'center' }}>
      {title && <h2 style={{ margin: '0 0 22px', fontSize: 28, letterSpacing: '0.06em', color: 'inherit' }}>{title}</h2>}
      {state === 'done' ? (
        <p style={{ margin: 0, fontSize: 18, color: accent, fontFamily: 'system-ui, sans-serif', fontWeight: 600 }}>Спасибо! Ваш ответ получен.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18, maxWidth: 360, margin: '0 auto' }}>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Напишите Имя" style={{ padding: '16px 18px', fontSize: 16, border: '1px solid currentColor', borderRadius: 2, outline: 'none', background: 'transparent', color: 'inherit', fontFamily: 'system-ui, sans-serif' }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, alignItems: 'flex-start' }}>{radio(true, 'смогу присутствовать')}{radio(false, 'не смогу присутствовать')}</div>
          <button type="button" onClick={go} disabled={state === 'sending' || !name.trim() || attending === null} style={{ alignSelf: 'center', padding: '14px 44px', borderRadius: 999, border: 'none', cursor: 'pointer', background: '#000', color: '#fff', fontSize: 14, fontWeight: 700, letterSpacing: '0.2em', fontFamily: 'system-ui, sans-serif', opacity: !name.trim() || attending === null ? 0.5 : 1 }}>{state === 'sending' ? '...' : 'ОТПРАВИТЬ'}</button>
          {state === 'error' && <p style={{ margin: 0, fontSize: 13, color: '#c00' }}>Не удалось отправить.</p>}
        </div>
      )}
    </section>
  );
}

// Country dialing codes selectable in the lead form's phone field.
const DIAL_CODES: { flag: string; code: string; name: string }[] = [
  { flag: '🇺🇿', code: '+998', name: 'UZ' },
  { flag: '🇷🇺', code: '+7', name: 'RU' },
  { flag: '🇰🇿', code: '+7', name: 'KZ' },
  { flag: '🇰🇬', code: '+996', name: 'KG' },
  { flag: '🇹🇯', code: '+992', name: 'TJ' },
  { flag: '🇹🇲', code: '+993', name: 'TM' },
  { flag: '🇦🇿', code: '+994', name: 'AZ' },
  { flag: '🇹🇷', code: '+90', name: 'TR' },
  { flag: '🇦🇪', code: '+971', name: 'AE' },
  { flag: '🇺🇸', code: '+1', name: 'US' },
];

// Lead-capture form (flyer). Collects name + phone (+ optional message) and
// posts a call-back request the manager can review.
function LeadForm({ title, subtitle, buttonLabel, showMessage, accent, submit }: {
  title: string; subtitle: string; buttonLabel: string; showMessage: boolean;
  accent: string; submit?: (p: { name: string; phone: string; message?: string }) => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [country, setCountry] = useState(0);
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'done' | 'error'>('idle');
  const canSend = name.trim().length > 0 && phone.trim().length > 0;
  const go = async () => {
    if (!canSend) return;
    setState('sending');
    try {
      if (submit) await submit({ name: name.trim(), phone: `${DIAL_CODES[country].code} ${phone.trim()}`, message: message.trim() || undefined });
      setState('done');
    } catch { setState('error'); }
  };
  const field: React.CSSProperties = { padding: '16px 18px', fontSize: 15, border: '1px solid currentColor', borderRadius: 12, outline: 'none', background: 'transparent', color: 'inherit', fontFamily: 'system-ui, sans-serif', width: '100%', boxSizing: 'border-box' };
  return (
    <section style={{ padding: '36px 24px', textAlign: 'center' }}>
      {title && <h2 style={{ margin: '0 0 8px', fontSize: 26, letterSpacing: '0.04em', color: 'inherit' }}>{title}</h2>}
      {subtitle && <p style={{ margin: '0 0 22px', fontSize: 13, lineHeight: 1.5, opacity: 0.85, fontFamily: 'system-ui, sans-serif', color: 'inherit' }}>{subtitle}</p>}
      {state === 'done' ? (
        <p style={{ margin: 0, fontSize: 17, color: accent, fontFamily: 'system-ui, sans-serif', fontWeight: 600 }}>Спасибо! Мы вам перезвоним.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 360, margin: '0 auto' }}>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Имя" style={field} />
          {/* Phone: country/dial-code picker + the number input side by side in one box */}
          <div style={{ display: 'flex', alignItems: 'stretch', border: '1px solid currentColor', borderRadius: 12, overflow: 'hidden' }}>
            <select
              value={country}
              onChange={(e) => setCountry(Number(e.target.value))}
              style={{ border: 'none', outline: 'none', background: 'transparent', color: 'inherit', fontSize: 15, fontFamily: 'system-ui, sans-serif', padding: '16px 6px 16px 14px', cursor: 'pointer', appearance: 'auto' }}
            >
              {DIAL_CODES.map((c, i) => <option key={c.name} value={i} style={{ color: '#111' }}>{c.flag} {c.code}</option>)}
            </select>
            <span style={{ alignSelf: 'center', width: 1, height: 26, background: 'currentColor', opacity: 0.3 }} />
            <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" placeholder="Телефон"
              style={{ flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'transparent', color: 'inherit', fontSize: 15, fontFamily: 'system-ui, sans-serif', padding: '16px 18px 16px 12px' }} />
          </div>
          {showMessage && <textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Текстовое поле" rows={3} style={{ ...field, resize: 'vertical' }} />}
          <button type="button" onClick={go} disabled={state === 'sending' || !canSend} style={{ alignSelf: 'stretch', padding: '15px 24px', borderRadius: 12, border: 'none', cursor: canSend ? 'pointer' : 'default', background: accent, color: readableText(accent), fontSize: 14, fontWeight: 700, letterSpacing: '0.12em', fontFamily: 'system-ui, sans-serif', opacity: canSend ? 1 : 0.5 }}>{state === 'sending' ? '...' : (buttonLabel || 'ОТПРАВИТЬ')}</button>
          {state === 'error' && <p style={{ margin: 0, fontSize: 13, color: '#c00' }}>Не удалось отправить.</p>}
        </div>
      )}
    </section>
  );
}

// "Save contact" button — builds a vCard on the fly and downloads it.
function SaveContactButton({ label, name, phone, accent }: { label: string; name: string; phone: string; accent: string }) {
  const save = () => {
    const vcard = ['BEGIN:VCARD', 'VERSION:3.0', `FN:${name || phone}`, phone ? `TEL;TYPE=CELL:${phone}` : '', 'END:VCARD']
      .filter(Boolean).join('\r\n');
    const blob = new Blob([vcard], { type: 'text/vcard;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(name || 'contact').replace(/\s+/g, '_')}.vcf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return (
    <div style={{ padding: '14px 20px' }}>
      <button type="button" onClick={save} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, width: '100%', padding: '16px 18px', borderRadius: 14, border: 'none', cursor: 'pointer', background: '#0d0d0d', color: accent, fontFamily: 'system-ui, sans-serif' }}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        <span style={{ textAlign: 'left' }}>
          <span style={{ display: 'block', fontSize: 13, fontWeight: 700, letterSpacing: '0.1em' }}>{label || 'СОХРАНИТЬ КОНТАКТЫ'}</span>
          {(name || phone) && <span style={{ display: 'block', fontSize: 11, fontWeight: 400, opacity: 0.85 }}>{name || phone}</span>}
        </span>
      </button>
    </div>
  );
}

// Section divider with a selectable shape.
function Divider({ shape, text, accent }: { shape: string; text: string; accent: string }) {
  if (shape === 'spacer') return <div style={{ height: 44 }} />;
  if (shape === 'icon') {
    return (
      <div style={{ padding: '18px 24px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14 }}>
        <span style={{ flex: 1, height: 1, background: 'currentColor', opacity: 0.25 }} />
        <span style={{ color: accent, fontSize: 18 }}>{text || '★'}</span>
        <span style={{ flex: 1, height: 1, background: 'currentColor', opacity: 0.25 }} />
      </div>
    );
  }
  if (shape === 'text') {
    return (
      <div style={{ padding: '18px 24px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14 }}>
        <span style={{ flex: 1, height: 1, background: 'currentColor', opacity: 0.25 }} />
        <span style={{ fontSize: 12, letterSpacing: '0.15em', opacity: 0.7, fontFamily: 'system-ui, sans-serif', color: 'inherit' }}>{text || 'или'}</span>
        <span style={{ flex: 1, height: 1, background: 'currentColor', opacity: 0.25 }} />
      </div>
    );
  }
  if (shape === 'wave' || shape === 'zigzag') {
    const path = shape === 'wave'
      ? 'M0,5 C7.5,0 12.5,10 20,5 C27.5,0 32.5,10 40,5'
      : 'M0,8 L5,2 L10,8 L15,2 L20,8 L25,2 L30,8 L35,2 L40,8';
    return (
      <div style={{ padding: '16px 24px' }}>
        <svg viewBox="0 0 40 10" preserveAspectRatio="none" style={{ width: '100%', height: 14, display: 'block' }}>
          <path d={path} fill="none" stroke={accent} strokeWidth={1.2} />
        </svg>
      </div>
    );
  }
  // 'line' (default)
  return <div style={{ padding: '14px 24px' }}><div style={{ height: 1, background: 'currentColor', opacity: 0.18 }} /></div>;
}

// Heading in "scrolling text" (ticker) mode: the text loops horizontally forever.
// Content is duplicated so the -50% translate loops seamlessly.
function MarqueeHeading({ text }: { text: string }) {
  const content = Array(4).fill(text || '…').join('   •   ');
  const half: React.CSSProperties = { paddingRight: 36, flexShrink: 0 };
  return (
    <div style={{ overflow: 'hidden', whiteSpace: 'nowrap', padding: '18px 0 8px' }}>
      <style>{'@keyframes blkMarquee { from { transform: translateX(0); } to { transform: translateX(-50%); } }'}</style>
      <div style={{ display: 'inline-flex', animation: 'blkMarquee 16s linear infinite', willChange: 'transform' }}>
        <h2 style={{ ...half, margin: 0, fontSize: 26, letterSpacing: '0.08em', color: 'inherit', fontWeight: 600 }}>{content}</h2>
        <h2 style={{ ...half, margin: 0, fontSize: 26, letterSpacing: '0.08em', color: 'inherit', fontWeight: 600 }} aria-hidden>{content}</h2>
      </div>
    </div>
  );
}

// Performing-artist card: photo carousel with a name badge and dots.
function ArtistShowcase({ title, items, accent }: { title: string; items: MenuShowcaseItem[]; accent: string }) {
  const [idx, setIdx] = useState(0);
  return (
    <section style={{ padding: '20px 0 10px' }}>
      {title && <h2 style={{ margin: '0 0 14px', padding: '0 24px', fontSize: 24, letterSpacing: '0.08em', textAlign: 'center', color: 'inherit' }}>{title}</h2>}
      {items.length === 0 ? <Placeholder label="Artist" /> : (() => {
        const cur = items[Math.min(idx, items.length - 1)];
        const src = img(cur.photoUrl);
        return (
          <div style={{ padding: '0 16px' }}>
            <div style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', background: '#111' }}>
              <div style={{ aspectRatio: '4/5' }}>
                {src && <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
              </div>
              {cur.name && (
                <div style={{ position: 'absolute', bottom: 14, left: 0, right: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                  {cur.name.split('\n').map((line, i) => (
                    <span key={i} style={{ background: 'rgba(250,250,247,0.92)', color: '#111', padding: '5px 16px', borderRadius: 8, fontSize: 15, fontStyle: 'italic', fontWeight: 700, boxShadow: '0 2px 8px rgba(0,0,0,0.35)' }}>{line}</span>
                  ))}
                </div>
              )}
              {items.length > 1 && (
                <>
                  <button type="button" onClick={(e) => { e.stopPropagation(); setIdx((i) => (i - 1 + items.length) % items.length); }} style={navBtn('left', accent)}>‹</button>
                  <button type="button" onClick={(e) => { e.stopPropagation(); setIdx((i) => (i + 1) % items.length); }} style={navBtn('right', accent)}>›</button>
                </>
              )}
            </div>
            {items.length > 1 && <div style={{ display: 'flex', justifyContent: 'center', gap: 6, paddingTop: 10 }}>{items.map((_, i) => <span key={i} style={{ width: 8, height: 8, borderRadius: '50%', background: i === idx ? accent : '#ccc' }} />)}</div>}
          </div>
        );
      })()}
    </section>
  );
}

// Single wide link button with a label + sub-label and a custom background color.
function LinkBar({ label, sublabel, action, color, accent }: { label: string; sublabel: string; action?: ButtonAction; color: string; accent: string }) {
  const onClick = () => {
    if (!action?.value) return;
    if (action.kind === 'phone') window.location.href = `tel:${action.value}`;
    else if (action.kind === 'map') yandexMaps(action.value);
    else window.open(action.value, '_blank', 'noopener,noreferrer');
  };
  return (
    <div style={{ padding: '10px 20px' }}>
      <button type="button" onClick={onClick} style={{ display: 'flex', alignItems: 'center', gap: 14, width: '100%', padding: '12px 16px', borderRadius: 10, border: 'none', cursor: 'pointer', background: color || accent, color: '#fff', textAlign: 'left', fontFamily: 'system-ui, sans-serif' }}>
        <span style={{ fontSize: 22, lineHeight: 1 }}>☰</span>
        <span>
          <span style={{ display: 'block', fontSize: 14, fontWeight: 800, letterSpacing: '0.1em' }}>{label}</span>
          {sublabel && <span style={{ display: 'block', fontSize: 12, opacity: 0.9, marginTop: 2 }}>{sublabel}</span>}
        </span>
      </button>
    </div>
  );
}

// Render an ordered block list (used by both the editor preview and public pages).
export function BlockList({ blocks, ctx }: { blocks: Block[]; ctx: RenderCtx }) {
  return <>{blocks.map((b) => <BlockView key={b.id} block={b} ctx={ctx} />)}</>;
}
