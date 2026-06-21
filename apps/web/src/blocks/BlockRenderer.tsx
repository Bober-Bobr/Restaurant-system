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
      return <h2 style={{ margin: 0, padding: '22px 24px 6px', fontSize: 26, letterSpacing: '0.08em', textAlign: (str(p, 'align', 'center') as 'left'), color: 'inherit' }}>{str(p, 'text')}</h2>;
    case 'text':
      return <p style={{ margin: 0, padding: '10px 24px', fontSize: 14, lineHeight: 1.7, letterSpacing: '0.03em', textAlign: (str(p, 'align', 'center') as 'left'), color: 'inherit', opacity: 0.85, fontFamily: 'system-ui, sans-serif', whiteSpace: 'pre-line' }}>{str(p, 'text')}</p>;
    case 'image': {
      const src = img(str(p, 'url'));
      if (!src) return <Placeholder label="Image" />;
      return <div style={{ padding: '12px 16px' }}><img src={src} alt="" style={{ width: '100%', display: 'block', borderRadius: bool(p, 'rounded') ? 16 : 4 }} /></div>;
    }
    case 'button':
      return <div style={{ padding: '12px 24px', textAlign: 'center' }}><ActionButton label={str(p, 'label', 'Button')} action={p.action as ButtonAction | undefined} accent={accent} /></div>;
    case 'countdown':
      return <CountdownView targetAt={(p.targetAt as string) ?? null} label={str(p, 'label')} accent={accent} />;
    case 'timing':
      return <TimingView title={str(p, 'title', 'TIMING')} items={arr<TimingItem>(p, 'items')} accent={accent} />;
    case 'gallery':
      return <GalleryCarousel items={arr<GalleryItem>(p, 'items')} accent={accent} />;
    case 'menu':
      return <MenuShowcase title={str(p, 'title', 'МЕНЮ')} items={arr<MenuShowcaseItem>(p, 'items')} accent={accent} />;
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
    case 'divider':
      return <div style={{ padding: '14px 24px' }}><div style={{ height: 1, background: 'rgba(0,0,0,0.12)' }} /></div>;
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

// Render an ordered block list (used by both the editor preview and public pages).
export function BlockList({ blocks, ctx }: { blocks: Block[]; ctx: RenderCtx }) {
  return <>{blocks.map((b) => <BlockView key={b.id} block={b} ctx={ctx} />)}</>;
}
