import { Component, createContext, useContext, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Block, BlockProps, ButtonAction, GalleryItem, MenuShowcaseItem, SocialLink, TimingItem } from './types';
import { str, bool, fontScale, elementScale, BLOCK_DEFS } from './types';
import { fontStack } from './fonts';
import { AnimatedSection } from './AnimatedSection';
import { getPhotoUrl } from '../utils/photoUrl';
import { translate } from '../utils/translate';
import networkingLogoSrc from '../assets/networking-logo.png';

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
  // Page-wide text size multiplier (1 = default). Scales all block text.
  textScale?: number | null;
  // Restaurant/company name — shown in the lead-form success confirmation.
  brandName?: string | null;
};

const TEXT = '#1a1a1a';

// Always-on "passive" animations shared by several blocks (shimmer sweep, a tiny
// periodic twitch, a gentle bounce) + bold placeholders for the lead form.
const PASSIVE_KEYFRAMES = `
@keyframes blkShimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
@keyframes blkTwitch { 0%, 88%, 100% { transform: rotate(0deg); } 91% { transform: rotate(-2.2deg); } 94% { transform: rotate(2.2deg); } 97% { transform: rotate(-1deg); } }
@keyframes blkBounce { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }
@keyframes blkGlow { 0%, 100% { box-shadow: 0 0 0 0 rgba(0,0,0,0); } 50% { box-shadow: 0 0 15px 1px var(--blk-glow); } }
@keyframes saPop { from { transform: scale(0.85); opacity: 0; } to { transform: scale(1); opacity: 1; } }
@keyframes saCircle { to { stroke-dashoffset: 0; } }
@keyframes saCheck { to { stroke-dashoffset: 0; } }
.blk-form-field::placeholder { font-weight: 700; color: #9aa0a6; }
`;

// Moving light sweep laid over a (relative, overflow-hidden) element.
function Sheen({ opacity = 0.35, seconds = 2.8 }: { opacity?: number; seconds?: number }) {
  return <span aria-hidden style={{ position: 'absolute', inset: 0, background: `linear-gradient(115deg, transparent 35%, rgba(255,255,255,${opacity}) 50%, transparent 65%)`, backgroundSize: '250% 100%', animation: `blkShimmer ${seconds}s linear infinite`, pointerEvents: 'none' }} />;
}

// Success confirmation modal with a green check inside a soft pale-green disc.
// Shown after a lead form is submitted; rendered through a portal over the page.
function SuccessAlert({ title, subtitle }: { title: string; subtitle?: string }) {
  const [open, setOpen] = useState(true);
  if (!open) return null;
  return createPortal(
    <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 2147483600, background: 'rgba(var(--adm-bg-rgb),0.55)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <style>{PASSIVE_KEYFRAMES}</style>
      <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 360, background: '#fff', borderRadius: 14, padding: '30px 26px 24px', textAlign: 'center', boxShadow: '0 24px 60px rgba(0,0,0,0.35)', animation: 'saPop 0.35s cubic-bezier(0.22,1,0.36,1)', fontFamily: 'var(--blk-font-b, system-ui, sans-serif)' }}>
        {/* Green check inside a light-green ringed disc */}
        <div style={{ width: 84, height: 84, margin: '0 auto 18px', borderRadius: '50%', background: '#eafaf0', border: '2px solid #c7ecd5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg viewBox="0 0 52 52" style={{ width: 46, height: 46, display: 'block' }}>
            <path d="M14 27 l8 8 l16 -17" fill="none" stroke="#43b96a" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" style={{ strokeDasharray: 48, strokeDashoffset: 48, animation: 'saCheck 0.4s 0.15s ease forwards' }} />
          </svg>
        </div>
        <h3 style={{ margin: '0 0 8px', fontSize: 17, color: '#2f3b34', fontWeight: 600 }}>{title}</h3>
        {subtitle && <p style={{ margin: 0, fontSize: 14.5, color: '#6b7770', lineHeight: 1.5 }}>{subtitle}</p>}
        <button type="button" onClick={() => setOpen(false)} style={{ marginTop: 22, padding: '10px 30px', borderRadius: 8, border: '1px solid #dcdcdc', background: '#f0f0f0', color: '#444', fontWeight: 600, fontSize: 13.5, cursor: 'pointer', letterSpacing: '0.06em' }}>ЗАКРЫТЬ</button>
      </div>
    </div>,
    document.body,
  );
}

// Page-wide text scale, provided by BlockList and read by each text component
// via `useFs` (body) and `useFsH` (headings). Each scale is the page-wide
// textScale multiplied by the block's own heading/body multiplier, so a block
// can size its title and its body text independently.
const ScaleCtx = createContext<{ h: number; b: number }>({ h: 1, b: 1 });
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
function useFs(): (n: number) => number {
  const s = useContext(ScaleCtx);
  return (n: number) => round2(n * (s.b || 1));
}
function useFsH(): (n: number) => number {
  const s = useContext(ScaleCtx);
  return (n: number) => round2(n * (s.h || 1));
}

// ── Element size ─────────────────────────────────────────────────────────────
// The per-block multiplier for everything that is NOT text: photos, videos,
// gallery tiles, icons, buttons, the countdown card, the divider's gap. Provided
// by BlockView from `elementScale(block.props)` and read here by `useEs` (a px
// dimension) and `useMediaWidth` (something already the full column width).
const ElemCtx = createContext<number>(1);
function useEs(): (n: number) => number {
  const es = useContext(ElemCtx);
  return (n: number) => round2(n * (es || 1));
}

/**
 * A width for media that is otherwise `width: 100%` of the 420px column. These
 * blocks are capped at 1 by `elementScaleRange`, so this only ever narrows —
 * turning a full-bleed photo into a small centred one, which is the main thing
 * the control is for.
 */
function useMediaWidth(): string {
  const es = useContext(ElemCtx) || 1;
  return es >= 1 ? '100%' : `${round2(es * 100)}%`;
}

function hexToRgba(hex: string, alpha: number): string {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex.trim());
  if (!m) return `rgba(216,180,95,${alpha})`;
  return `rgba(${parseInt(m[1], 16)},${parseInt(m[2], 16)},${parseInt(m[3], 16)},${alpha})`;
}

// A translucent wash of an arbitrary CSS color — used for hairline rules and
// chip borders that must follow the page's text color. Hex is converted
// directly; anything else (rgb(), named, var()) falls back to color-mix.
function softInk(color: string, alpha: number): string {
  const hex = color.trim().replace(/^#/, '');
  const full = hex.length === 3 ? hex.split('').map((c) => c + c).join('') : hex;
  if (/^[a-f\d]{6}$/i.test(full)) {
    return `rgba(${parseInt(full.slice(0, 2), 16)},${parseInt(full.slice(2, 4), 16)},${parseInt(full.slice(4, 6), 16)},${alpha})`;
  }
  return `color-mix(in srgb, ${color} ${Math.round(alpha * 100)}%, transparent)`;
}

// Pick a legible text color (dark or light) for a given background color.
export function readableText(bg: string | null | undefined): string {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec((bg || '').trim());
  if (!m) return TEXT;
  const [r, g, b] = [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)];
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance < 0.5 ? '#f5f5f5' : TEXT;
}

/**
 * Several blocks are a solid pill that paints its OWN dark surface — the button,
 * Save contact, the social rows, the menu header, the RSVP submit, the map
 * button. Because the surface is fixed, the `color` the section wrapper sets
 * never reached the label, so setting a block's text colour appeared to do
 * nothing at all on exactly those blocks.
 *
 * `ink` is the block's EXPLICIT per-block colour, not the page-wide one — with
 * none set every caller renders byte-identically to before, so no existing
 * flyer or plaque changes appearance.
 *
 * When one is set the label takes it and the surface flips to light if the
 * chosen ink is dark. Without that flip, picking a dark colour for one of these
 * blocks would write near-black text onto a near-black pill: the setting would
 * "work" and the block would go blank, which is worse than it not working.
 */
function pillSurface(ink: string | null, base: string, defaultFg: string): { bg: string; fg: string } {
  if (!ink) return { bg: base, fg: defaultFg };
  // readableText(ink) is a colour that contrasts with the ink: dark for a light
  // ink (so the pill keeps its original dark surface), light for a dark one.
  return { bg: readableText(ink) === TEXT ? base : '#f4f2ee', fg: ink };
}

// ── Image loading ────────────────────────────────────────────────────────────
// Gallery tiles, promo art, the logo block and the attribution mark are
// `loading="lazy"`: they sit below the fold, and the block wrapping them starts
// at opacity 0 anyway, so the fetch lands right about when the reveal does.
//
// The `hero` and `image` blocks get `decoding="async"` but stay EAGER. Every
// plaque template opens with one, so it is the page's main image on a phone
// that has just been tapped against a tag — deferring the one picture the
// visitor came to see is the wrong trade even though it is the largest.
const img = (u?: string | null) => (u ? (getPhotoUrl(u) ?? u) : null);
const arr = <T,>(p: BlockProps, k: string): T[] => (Array.isArray(p[k]) ? (p[k] as T[]) : []);

// ── One block → markup ───────────────────────────────────────────────────────
export function BlockView({ block, ctx }: { block: Block; ctx: RenderCtx }) {
  // Skip unknown/removed block types (e.g. legacy "artist" blocks in old designs).
  if (!BLOCK_DEFS[block.type]) return null;
  // The section sets the inherited text color; sub-components use `inherit`.
  // Per-block `textColor` overrides the page-wide color (ctx.text).
  const color = str(block.props, 'textColor') || ctx.text || TEXT;
  const base = ctx.textScale ?? 1;
  const scales = { h: base * fontScale(block.props, 'headingScale'), b: base * fontScale(block.props, 'bodyScale') };
  // The non-text size multiplier. Deliberately NOT multiplied by ctx.textScale:
  // the page-wide text scale is about reading, and pulling photos and icons
  // along with it is not what a designer means by "bigger text".
  const es = elementScale(block.props, block.type);
  const fontVars: React.CSSProperties = {};
  const hFont = fontStack(block.props.headingFont);
  const bFont = fontStack(block.props.bodyFont);
  if (hFont) (fontVars as Record<string, string>)['--blk-font-h'] = hFont;
  if (bFont) (fontVars as Record<string, string>)['--blk-font-b'] = bFont;
  return (
    <ScaleCtx.Provider value={scales}>
      <ElemCtx.Provider value={es}>
        <AnimatedSection anim={block.anim} replay={ctx.replayAnim} style={{ color, ...fontVars }}>
          <BlockBody block={block} ctx={ctx} />
        </AnimatedSection>
      </ElemCtx.Provider>
    </ScaleCtx.Provider>
  );
}

function BlockBody({ block, ctx }: { block: Block; ctx: RenderCtx }) {
  const { props: p } = block;
  const accent = ctx.accent;
  const es = useEs();
  const mw = useMediaWidth();
  // The block's OWN colour, if the designer set one — deliberately not falling
  // back to ctx.text. The blocks below paint their own surface, and only an
  // explicit choice should change it; see pillSurface.
  const ink = str(p, 'textColor') || null;
  const fs = useFs();
  const fsH = useFsH();
  switch (block.type) {
    case 'hero': {
      const src = img(str(p, 'imageUrl'));
      return (
        <section style={{ minHeight: `${es(80)}vh`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '40px 24px', position: 'relative', background: src ? `linear-gradient(rgba(255,255,255,0.05),rgba(255,255,255,0.05)), url(${src}) center / cover` : 'transparent' }}>
          {str(p, 'title') && <h1 style={{ fontFamily: 'var(--blk-font-h, inherit)', margin: 0, fontSize: fsH(40), lineHeight: 1.15, fontWeight: 500, letterSpacing: '0.04em', color: 'inherit' }}>{str(p, 'title')}</h1>}
          {str(p, 'subtitle') && <p style={{ position: 'absolute', bottom: 28, margin: 0, fontSize: fs(12), letterSpacing: '0.25em', color: accent, fontFamily: 'var(--blk-font-b, system-ui, sans-serif)', fontWeight: 700 }}>{str(p, 'subtitle')}</p>}
        </section>
      );
    }
    case 'heading':
      if (bool(p, 'marquee')) return <MarqueeHeading text={str(p, 'text')} />;
      return <h2 style={{ fontFamily: 'var(--blk-font-h, inherit)', margin: 0, padding: '22px 24px 6px', fontSize: fsH(26), letterSpacing: '0.08em', textAlign: (str(p, 'align', 'center') as 'left'), color: 'inherit' }}>{str(p, 'text')}</h2>;
    case 'text':
      return <p style={{ margin: 0, padding: '10px 24px', fontSize: fs(14), lineHeight: 1.7, letterSpacing: '0.03em', textAlign: (str(p, 'align', 'center') as 'left'), color: 'inherit', opacity: 0.85, fontFamily: 'var(--blk-font-b, system-ui, sans-serif)', whiteSpace: 'pre-line' }}>{str(p, 'text')}</p>;
    case 'image': {
      // "useLogo" → always show the restaurant's current logo instead of a fixed photo.
      if (bool(p, 'useLogo')) {
        const logo = img(ctx.logoUrl);
        if (!logo) return <Placeholder label="Logo" />;
        return <div style={{ padding: '16px 16px', textAlign: 'center' }}><img src={logo} alt="" loading="lazy" decoding="async" style={{ maxWidth: es(200), maxHeight: es(150), width: 'auto', height: 'auto', objectFit: 'contain', display: 'inline-block' }} /></div>;
      }
      const src = img(str(p, 'url'));
      if (!src) return <Placeholder label="Image" />;
      // Full-bleed: no padding so the photo meets the page edges. The "rounded"
      // toggle keeps a small inset so its corners aren't clipped at the edge.
      const rounded = bool(p, 'rounded');
      // Optional countdown pinned to the bottom of the photo.
      const showTimer = bool(p, 'timer');
      const timerAt = (typeof p.timerAt === 'string' && p.timerAt ? p.timerAt : null) ?? ctx.eventDate ?? null;
      if (showTimer) {
        return (
          <div style={{ position: 'relative', padding: rounded ? '12px 16px' : 0, width: mw, margin: '0 auto' }}>
            <img src={src} alt="" decoding="async" style={{ width: '100%', display: 'block', borderRadius: rounded ? 16 : 0 }} />
            <div style={{ position: 'absolute', left: rounded ? 16 : 0, right: rounded ? 16 : 0, bottom: rounded ? 12 : 0, paddingTop: 40, borderRadius: rounded ? '0 0 16px 16px' : 0, background: 'linear-gradient(to top, rgba(0,0,0,0.62) 0%, rgba(0,0,0,0.28) 55%, rgba(0,0,0,0) 100%)' }}>
              <CountdownView targetAt={timerAt} label={str(p, 'timerLabel')} accent={accent} light />
            </div>
          </div>
        );
      }
      return rounded
        ? <div style={{ padding: '12px 16px', width: mw, margin: '0 auto' }}><img src={src} alt="" decoding="async" style={{ width: '100%', display: 'block', borderRadius: 16 }} /></div>
        : <img src={src} alt="" decoding="async" style={{ width: mw, display: 'block', margin: '0 auto' }} />;
    }
    case 'video':
      return <VideoView p={p} />;
    case 'button':
      return <div style={{ padding: '12px 24px', textAlign: 'center' }}><ActionButton label={str(p, 'label', 'Button')} action={p.action as ButtonAction | undefined} accent={accent} ink={ink} /></div>;
    case 'countdown':
      // No explicit target → count down to the linked event's start time.
      return <CountdownView targetAt={(typeof p.targetAt === 'string' && p.targetAt ? p.targetAt : null) ?? ctx.eventDate ?? null} label={str(p, 'label')} accent={accent} />;
    case 'timing':
      return <TimingView title={str(p, 'title', 'TIMING')} items={arr<TimingItem>(p, 'items')} accent={accent} />;
    case 'gallery':
      return <GalleryCarousel items={arr<GalleryItem>(p, 'items')} accent={accent} autoSlide={bool(p, 'autoSlide')} intervalMs={Math.max(1, typeof p.slideInterval === 'number' ? p.slideInterval : 4) * 1000} />;
    case 'menu':
      return <MenuShowcase title={str(p, 'title', 'МЕНЮ')} items={arr<MenuShowcaseItem>(p, 'items')} accent={accent} ink={ink} />;
    case 'link':
      return <LinkBar label={str(p, 'label', 'Link')} sublabel={str(p, 'sublabel')} action={p.action as ButtonAction | undefined} color={str(p, 'color')} accent={accent} />;
    case 'socials':
      return <SocialsView title={str(p, 'title')} links={arr<SocialLink>(p, 'links')} accent={accent} ink={ink} />;
    case 'contacts':
      return <ContactsView p={p} accent={accent} />;
    case 'map':
      return <MapView label={str(p, 'label', 'КАРТА')} address={str(p, 'address')} ink={ink} />;
    case 'promo':
      return <PromoCard p={p} accent={accent} />;
    case 'html':
      return <HtmlBlock html={str(p, 'html')} />;
    case 'rsvp':
      return <RsvpForm title={str(p, 'title')} accent={accent} submit={ctx.submitRsvp} ink={ink} />;
    case 'form':
      return <LeadForm title={str(p, 'title')} subtitle={str(p, 'subtitle')} buttonLabel={str(p, 'buttonLabel')} showMessage={bool(p, 'showMessage')} accent={accent} brandName={ctx.brandName ?? null} submit={ctx.submitLead} />;
    case 'savecontact':
      return <SaveContactButton label={str(p, 'label')} name={str(p, 'name')} phone={str(p, 'phone')} accent={accent} ink={ink} />;
    case 'divider':
      return <Divider shape={str(p, 'shape', 'line')} text={str(p, 'text')} accent={accent} />;
    case 'vccontact':
      return (
        <VConnectContact
          phone={str(p, 'phone')} telegram={str(p, 'telegram')} instagram={str(p, 'instagram')}
          title={translate('vc_contact_title', 'ru')}
          callLabel={translate('vc_call', 'ru')}
          telegramLabel={translate('vc_telegram', 'ru')}
          instagramLabel={translate('vc_instagram', 'ru')}
          color={str(p, 'textColor') || ctx.text}
        />
      );
    default:
      return null;
  }
}

// Raw-HTML block: renders the manager's own markup verbatim. Authored by the
// trusted manager for their own page, so the markup is injected as-is.
// We set innerHTML via a ref (instead of dangerouslySetInnerHTML) so that any
// <script> tags in the markup actually execute — React-injected scripts don't
// run on their own — enabling JS-driven animations. `overflow: visible` keeps
// CSS animations from being clipped at their start position.
function HtmlBlock({ html }: { html: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const host = ref.current;
    if (!host) return;
    host.innerHTML = html || '';
    // Re-create <script> nodes so the browser executes them.
    host.querySelectorAll('script').forEach((old) => {
      const s = document.createElement('script');
      for (const a of Array.from(old.attributes)) s.setAttribute(a.name, a.value);
      s.textContent = old.textContent;
      old.replaceWith(s);
    });
    return () => { host.innerHTML = ''; };
  }, [html]);
  if (!html.trim()) return <Placeholder label="HTML" />;
  return <div ref={ref} style={{ width: '100%', overflow: 'visible' }} />;
}

function Placeholder({ label }: { label: string }) {
  return <div style={{ margin: '12px 16px', aspectRatio: '3/2', borderRadius: 12, border: '1px dashed rgba(0,0,0,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(0,0,0,0.4)', fontSize: 13, fontFamily: 'var(--blk-font-b, system-ui, sans-serif)' }}>{label}</div>;
}

// Self-hosted video block: plays inline within the page. autoplay requires the
// video to be muted (browser policy), so that pairing is enforced.
function VideoView({ p }: { p: BlockProps }) {
  const mw = useMediaWidth();
  const src = img(str(p, 'url'));
  if (!src) return <Placeholder label="Video" />;
  const rounded = bool(p, 'rounded');
  const autoplay = bool(p, 'autoplay');
  const muted = autoplay || bool(p, 'muted');
  return (
    <div style={{ padding: rounded ? '12px 16px' : 0, width: mw, margin: '0 auto' }}>
      <video
        // React doesn't reliably reflect the `muted` prop to the attribute, which
        // browsers require before allowing muted autoplay — set it on the node.
        ref={(el) => { if (el) el.muted = muted; }}
        src={src}
        controls={bool(p, 'controls')}
        autoPlay={autoplay}
        loop={bool(p, 'loop')}
        playsInline
        preload="metadata"
        style={{ width: '100%', display: 'block', borderRadius: rounded ? 16 : 0, background: '#000' }}
      />
    </div>
  );
}

function yandexMaps(address: string) {
  window.open(`https://yandex.com/maps/?text=${encodeURIComponent(address)}`, '_blank', 'noopener,noreferrer');
}

function ActionButton({ label, action, accent, ink }: { label: string; action?: ButtonAction; accent: string; ink?: string | null }) {
  const es = useEs();
  const surface = pillSurface(ink ?? null, '#000', accent);
  const fs = useFs();
  const onClick = () => {
    if (!action?.value) return;
    if (action.kind === 'phone') window.location.href = `tel:${action.value}`;
    else if (action.kind === 'map') yandexMaps(action.value);
    else window.open(action.value, '_blank', 'noopener,noreferrer');
  };
  return (
    <button type="button" onClick={onClick} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 10, width: '100%', padding: `${es(14)}px ${es(18)}px`, borderRadius: es(14), border: 'none', cursor: 'pointer', background: surface.bg, color: surface.fg, fontSize: fs(14), fontWeight: 700, letterSpacing: '0.1em', fontFamily: 'var(--blk-font-b, system-ui, sans-serif)' }}>{label}</button>
  );
}

function MapView({ label, address, ink }: { label: string; address: string; ink?: string | null }) {
  const es = useEs();
  const surface = pillSurface(ink ?? null, '#000', '#fff');
  const fs = useFs();
  return (
    <div style={{ padding: '14px 24px', textAlign: 'center' }}>
      <button type="button" onClick={() => address && yandexMaps(address)} style={{ display: 'inline-block', padding: `${es(12)}px ${es(40)}px`, borderRadius: 999, border: 'none', cursor: 'pointer', background: surface.bg, color: surface.fg, fontSize: fs(14), fontWeight: 700, letterSpacing: '0.2em', fontFamily: 'var(--blk-font-b, system-ui, sans-serif)' }}>{label}</button>
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

// ── Flip-clock countdown ─────────────────────────────────────────────────────
const CD_H = 52; // card height
const CD_W = 34; // card width
const CD_KEYFRAMES = `
@keyframes cdFlipTop { from { transform: rotateX(0deg); } to { transform: rotateX(-90deg); } }
@keyframes cdFlipBottom { from { transform: rotateX(90deg); } to { transform: rotateX(0deg); } }`;

const cdFaceBase: React.CSSProperties = {
  position: 'absolute', left: 0, right: 0, height: CD_H / 2, overflow: 'hidden',
  display: 'flex', justifyContent: 'center', background: '#f6f5f1', backfaceVisibility: 'hidden',
};
function cdDigit(): React.CSSProperties {
  return { fontSize: 32, fontWeight: 800, lineHeight: `${CD_H}px`, height: CD_H, color: '#161616', fontFamily: 'var(--blk-font-b, system-ui, sans-serif)' };
}
function CdFace({ d, part, flap, zIndex }: { d: string; part: 'top' | 'bottom'; flap?: boolean; zIndex?: number }) {
  const isTop = part === 'top';
  const style: React.CSSProperties = {
    ...cdFaceBase,
    ...(isTop
      ? { top: 0, alignItems: 'flex-start', borderRadius: '10px 10px 0 0', borderBottom: '1px solid rgba(0,0,0,0.10)' }
      : { bottom: 0, alignItems: 'flex-end', borderRadius: '0 0 10px 10px' }),
    ...(flap
      ? isTop
        ? { transformOrigin: 'bottom', animation: 'cdFlipTop 0.3s ease-in forwards', zIndex }
        : { transformOrigin: 'top', transform: 'rotateX(90deg)', animation: 'cdFlipBottom 0.3s ease-out 0.3s forwards', zIndex }
      : { zIndex }),
  };
  return <div style={style}><span style={cdDigit()}>{d}</span></div>;
}

// One split-flap digit card that flips smoothly whenever its value changes.
function FlipDigit({ value }: { value: string }) {
  const [display, setDisplay] = useState(value);
  const [old, setOld] = useState(value);
  const [flipKey, setFlipKey] = useState(0);
  const [flipping, setFlipping] = useState(false);
  useEffect(() => {
    if (value !== display) {
      setOld(display);
      setDisplay(value);
      setFlipKey((k) => k + 1);
      setFlipping(true);
      const t = setTimeout(() => setFlipping(false), 640);
      return () => clearTimeout(t);
    }
  }, [value, display]);
  return (
    <div style={{ position: 'relative', width: CD_W, height: CD_H, perspective: 220, borderRadius: 10, boxShadow: '0 4px 12px rgba(0,0,0,0.28)' }}>
      <CdFace d={display} part="top" />
      <CdFace d={flipping ? old : display} part="bottom" />
      {flipping && (
        <>
          <CdFace key={`t${flipKey}`} d={old} part="top" flap zIndex={3} />
          <CdFace key={`b${flipKey}`} d={display} part="bottom" flap zIndex={3} />
        </>
      )}
    </div>
  );
}

function CdColon({ accent }: { accent: string }) {
  const dot = { width: 7, height: 7, borderRadius: '50%', background: accent } as React.CSSProperties;
  return <div style={{ height: CD_H, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 12 }}><span style={dot} /><span style={dot} /></div>;
}

// `light` = rendered over a photo (e.g. the image block's bottom timer): text is
// forced white and padding tightened; otherwise it inherits the page text color.
function CountdownView({ targetAt, label, accent, light }: { targetAt: string | null; label: string; accent: string; light?: boolean }) {
  const fs = useFs();
  const fsH = useFsH();
  const cd = useCountdown(targetAt);
  const groups = [
    { v: cd?.days ?? 0, l: 'Дни' },
    { v: cd?.hours ?? 0, l: 'Часы' },
    { v: cd?.minutes ?? 0, l: 'Минуты' },
    { v: cd?.seconds ?? 0, l: 'Секунды' },
  ];
  const labelColor = light ? '#fff' : 'inherit';
  return (
    <section style={{ padding: light ? '8px 12px 12px' : '28px 12px', textAlign: 'center' }}>
      <style>{CD_KEYFRAMES}</style>
      {label && <h2 style={{ fontFamily: 'var(--blk-font-h, inherit)', margin: light ? '0 0 12px' : '0 0 20px', fontSize: fsH(light ? 18 : 22), letterSpacing: '0.08em', color: labelColor }}>{label}</h2>}
      <div style={{ display: 'flex', gap: 6, justifyContent: 'center', alignItems: 'flex-start', flexWrap: 'wrap' }}>
        {groups.map((g, gi) => {
          const s = String(Math.min(99, Math.max(0, g.v))).padStart(2, '0');
          return (
            <div key={g.l} style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                <div style={{ display: 'flex', gap: 4 }}>
                  <FlipDigit value={s[0]} />
                  <FlipDigit value={s[1]} />
                </div>
                <span style={{ fontSize: fs(10), letterSpacing: '0.08em', textTransform: 'uppercase', color: labelColor, opacity: 0.85, fontFamily: 'var(--blk-font-b, system-ui, sans-serif)' }}>{g.l}</span>
              </div>
              {gi < groups.length - 1 && <CdColon accent={accent} />}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function TimingView({ title, items, accent }: { title: string; items: TimingItem[]; accent: string }) {
  const fs = useFs();
  const fsH = useFsH();
  if (items.length === 0) return <Placeholder label="Timing" />;
  return (
    <section style={{ padding: '36px 32px' }}>
      {title && <h2 style={{ fontFamily: 'var(--blk-font-h, inherit)', margin: '0 0 26px', fontSize: fsH(38), textAlign: 'center', letterSpacing: '0.08em', color: 'inherit' }}>{title}</h2>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {items.map((it, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'baseline', gap: 18 }}>
            <span style={{ fontSize: fs(16), color: accent, fontFamily: 'var(--blk-font-b, system-ui, sans-serif)', minWidth: 52 }}>{it.time}</span>
            <span style={{ fontSize: fs(18), letterSpacing: '0.05em', color: 'inherit' }}>{it.label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function GalleryCarousel({ items, accent, autoSlide, intervalMs = 4000 }: { items: GalleryItem[]; accent: string; autoSlide?: boolean; intervalMs?: number }) {
  const mw = useMediaWidth();
  const es = useEs();
  const [idx, setIdx] = useState(0);
  const touchX = useRef<number | null>(null);
  const n = items.length;
  const clamped = n ? Math.min(idx, n - 1) : 0;
  const atStart = clamped === 0;
  const atEnd = clamped === n - 1;
  // Manual moves clamp at the ends; auto-slide wraps around continuously.
  const go = (dir: -1 | 1) => setIdx((i) => Math.max(0, Math.min(n - 1, i + dir)));
  // Auto-slide: cycle at the configured interval using the sliding transition.
  useEffect(() => {
    if (!autoSlide || n < 2) return;
    const id = window.setInterval(() => setIdx((i) => (i + 1) % n), Math.max(1000, intervalMs));
    return () => window.clearInterval(id);
  }, [autoSlide, n, intervalMs]);
  if (n === 0) return <Placeholder label="Gallery" />;
  const onTouchStart = (e: React.TouchEvent) => { touchX.current = e.touches[0].clientX; };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchX.current;
    touchX.current = null;
    if (dx <= -40) go(1);
    else if (dx >= 40) go(-1);
  };
  return (
    <div style={{ padding: '12px 16px', width: mw, margin: '0 auto' }}>
      <div style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', background: '#000' }} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        {/* Sliding track: all photos in a row, shifted by translateX with a smooth transition. */}
        <div style={{ display: 'flex', transform: `translateX(-${clamped * 100}%)`, transition: 'transform 0.5s cubic-bezier(0.22,1,0.36,1)' }}>
          {items.map((it, i) => {
            const s = img(it.photoUrl);
            const video = it.videoUrl || null;
            return (
              <div key={i} onClick={() => video && window.open(video, '_blank', 'noopener,noreferrer')}
                style={{ position: 'relative', flex: '0 0 100%', aspectRatio: '3/4', cursor: video ? 'pointer' : 'default' }}>
                {s && <img src={s} alt="" loading="lazy" decoding="async" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                {video && <span style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 56, height: 56, borderRadius: '50%', background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 22, border: '2px solid rgba(255,255,255,0.85)' }}>▶</span>}
              </div>
            );
          })}
        </div>
        {/* Arrows appear only when there's somewhere to go in that direction. */}
        {n > 1 && !atStart && (
          <button type="button" onClick={(e) => { e.stopPropagation(); go(-1); }} style={navBtn('left', accent, es)}>‹</button>
        )}
        {n > 1 && !atEnd && (
          <button type="button" onClick={(e) => { e.stopPropagation(); go(1); }} style={navBtn('right', accent, es)}>›</button>
        )}
      </div>
      {n > 1 && <div style={{ display: 'flex', justifyContent: 'center', gap: 6, paddingTop: 10 }}>{items.map((_, i) => <span key={i} style={{ width: 8, height: 8, borderRadius: '50%', background: i === clamped ? accent : '#ccc' }} />)}</div>}
    </div>
  );
}
function navBtn(side: 'left' | 'right', accent: string, es: (n: number) => number): React.CSSProperties {
  return { position: 'absolute', top: '50%', transform: 'translateY(-50%)', [side]: 10, width: es(36), height: es(36), borderRadius: '50%', background: accent, color: '#fff', border: 'none', fontSize: 22, cursor: 'pointer' } as React.CSSProperties;
}

function MenuShowcase({ title, items, accent, ink }: { title: string; items: MenuShowcaseItem[]; accent: string; ink?: string | null }) {
  const fs = useFs();
  const es = useEs();
  const surface = pillSurface(ink ?? null, '#000', accent);
  if (items.length === 0) return <Placeholder label="Menu" />;
  return (
    <div>
      {title && <div style={{ background: surface.bg, color: surface.fg, padding: '10px 0', textAlign: 'center', fontWeight: 800, fontSize: fs(14), letterSpacing: '0.3em', fontFamily: 'var(--blk-font-b, system-ui, sans-serif)' }}>{title}</div>}
      <div style={{ padding: '18px 16px', display: 'flex', flexDirection: 'column', gap: 18 }}>
        {items.map((it, i) => {
          const left = i % 2 === 0;
          const src = img(it.photoUrl);
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14, flexDirection: left ? 'row' : 'row-reverse' }}>
              {/* The dish disc scales; the number badge pinned to it does NOT.
                  It is a text chip, and scaling the disc while leaving the digit
                  alone (as the no-resizing-text rule requires) puts a 14px
                  numeral inside an 8px circle at the low end of the range. */}
              <div style={{ position: 'relative', width: es(120), height: es(120), flexShrink: 0 }}>
                <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: src ? `url(${src}) center / cover` : '#eaeaea', border: `3px solid ${accent}` }} />
                <span style={{ position: 'absolute', top: -4, left: -4, width: 26, height: 26, borderRadius: '50%', background: accent, color: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 14, fontFamily: 'var(--blk-font-b, system-ui, sans-serif)', border: '2px solid #fff' }}>{it.number}</span>
              </div>
              <p style={{ margin: 0, fontSize: fs(22), fontStyle: 'italic', fontWeight: 700, color: 'inherit' }}>{it.name}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SocialsView({ title, links, accent, ink }: { title: string; links: SocialLink[]; accent: string; ink?: string | null }) {
  const fs = useFs();
  const es = useEs();
  const surface = pillSurface(ink ?? null, '#111', '#fff');
  const fsH = useFsH();
  return (
    <section style={{ padding: '24px 20px' }}>
      <style>{PASSIVE_KEYFRAMES}</style>
      {title && <h3 style={{ margin: '0 0 14px', textAlign: 'center', fontSize: fsH(17), fontWeight: 800, letterSpacing: '0.1em', fontFamily: 'var(--blk-font-h, system-ui, sans-serif)', color: 'inherit' }}>{title}</h3>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {links.map((l, i) => (
          <a key={i} href={l.url} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', gap: es(12), padding: `${es(12)}px ${es(16)}px`, background: surface.bg, borderRadius: es(12), color: surface.fg, textDecoration: 'none', fontFamily: 'var(--blk-font-b, system-ui, sans-serif)', transformOrigin: 'left center', animation: `blkTwitch ${4 + (i % 3) * 0.6}s ease-in-out ${i * 0.5}s infinite` }}>
            <span style={{ width: es(34), height: es(34), borderRadius: es(8), background: accent, color: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800 }}>@</span>
            <span style={{ fontSize: fs(13) }}>{l.label}</span>
          </a>
        ))}
      </div>
    </section>
  );
}

function ContactsView({ p }: { p: BlockProps; accent: string }) {
  const fs = useFs();
  const fsH = useFsH();
  const phone = str(p, 'phone'); const tg = str(p, 'telegramUrl'); const ig = str(p, 'instagramUrl');
  return (
    <section style={{ padding: '28px 20px', textAlign: 'center' }}>
      <style>{PASSIVE_KEYFRAMES}</style>
      {str(p, 'title') && <h3 style={{ margin: '0 0 16px', fontSize: fsH(18), fontWeight: 800, letterSpacing: '0.12em', fontFamily: 'var(--blk-font-h, system-ui, sans-serif)', color: 'inherit' }}>{str(p, 'title')}</h3>}
      <div style={{ display: 'flex', gap: 16, justifyContent: 'center' }}>
        {tg && <IconLink href={tg} delay={0}><SvgTelegram /></IconLink>}
        {phone && <IconLink href={`tel:${phone}`} delay={0.35}><SvgPhone /></IconLink>}
        {ig && <IconLink href={ig} delay={0.7}><SvgInstagram /></IconLink>}
      </div>
    </section>
  );
}
function IconLink({ href, children, delay = 0 }: { href: string; children: React.ReactNode; delay?: number }) {
  const es = useEs();
  return <a href={href} target="_blank" rel="noreferrer" style={{ width: es(52), height: es(52), borderRadius: '50%', background: '#0d0d0d', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none', animation: `blkBounce 2.4s ease-in-out ${delay}s infinite` }}>{children}</a>;
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
  const fs = useFs();
  const mw = useMediaWidth();
  const src = img(str(p, 'imageUrl'));
  return (
    <section style={{ padding: '16px', width: mw, margin: '0 auto' }}>
      <div style={{ borderRadius: 16, overflow: 'hidden', background: '#fdfcf8', boxShadow: '0 8px 24px rgba(0,0,0,0.08)' }}>
        <div style={{ position: 'relative' }}>
          {src ? <img src={src} alt="" loading="lazy" decoding="async" style={{ width: '100%', display: 'block' }} /> : <div style={{ aspectRatio: '4/3', background: `linear-gradient(135deg, ${hexToRgba(accent, 0.25)} 0%, ${accent} 100%)`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 24, fontWeight: 800 }}>{str(p, 'title', 'Promo')}</div>}
          {str(p, 'code') && <div style={{ position: 'absolute', bottom: 10, left: '50%', transform: 'translateX(-50%)', background: accent, color: '#0f0f0f', padding: '6px 18px', borderRadius: 999, fontWeight: 800, fontSize: 14 }}>{str(p, 'code')}</div>}
        </div>
        {str(p, 'subtitle') && <p style={{ margin: 0, padding: '12px 16px', fontSize: fs(12), textAlign: 'center', fontWeight: 600, color: str(p, 'textColor') || 'inherit', fontFamily: 'var(--blk-font-b, system-ui, sans-serif)' }}>{str(p, 'subtitle')}</p>}
      </div>
    </section>
  );
}

function RsvpForm({ title, accent, submit, ink }: { title: string; accent: string; submit?: (p: { guestName: string; attending: boolean }) => Promise<void>; ink?: string | null }) {
  const surface = pillSurface(ink ?? null, '#000', '#fff');
  const fs = useFs();
  const fsH = useFsH();
  const [name, setName] = useState('');
  const [attending, setAttending] = useState<boolean | null>(null);
  const [state, setState] = useState<'idle' | 'sending' | 'done' | 'error'>('idle');
  const go = async () => {
    if (!name.trim() || attending === null) return;
    setState('sending');
    try { if (submit) await submit({ guestName: name.trim(), attending }); setState('done'); } catch { setState('error'); }
  };
  const radio = (val: boolean, label: string) => (
    <label style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', fontSize: fs(16), color: 'inherit', fontFamily: 'var(--blk-font-b, system-ui, sans-serif)' }}>
      <span style={{ width: 26, height: 26, borderRadius: '50%', border: `2px solid ${attending === val ? accent : 'currentColor'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{attending === val && <span style={{ width: 12, height: 12, borderRadius: '50%', background: accent }} />}</span>
      {label}
    </label>
  );
  return (
    <section style={{ padding: '40px 24px', textAlign: 'center' }}>
      {title && <h2 style={{ fontFamily: 'var(--blk-font-h, inherit)', margin: '0 0 22px', fontSize: fsH(28), letterSpacing: '0.06em', color: 'inherit' }}>{title}</h2>}
      {state === 'done' ? (
        <p style={{ margin: 0, fontSize: fs(18), color: accent, fontFamily: 'var(--blk-font-b, system-ui, sans-serif)', fontWeight: 600 }}>Спасибо! Ваш ответ получен.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18, maxWidth: 360, margin: '0 auto' }}>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Напишите Имя" style={{ padding: '16px 18px', fontSize: fs(16), border: '1px solid currentColor', borderRadius: 2, outline: 'none', background: 'transparent', color: 'inherit', fontFamily: 'var(--blk-font-b, system-ui, sans-serif)' }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, alignItems: 'flex-start' }}>{radio(true, 'смогу присутствовать')}{radio(false, 'не смогу присутствовать')}</div>
          <button type="button" onClick={go} disabled={state === 'sending' || !name.trim() || attending === null} style={{ alignSelf: 'center', padding: '14px 44px', borderRadius: 999, border: 'none', cursor: 'pointer', background: surface.bg, color: surface.fg, fontSize: fs(14), fontWeight: 700, letterSpacing: '0.2em', fontFamily: 'var(--blk-font-b, system-ui, sans-serif)', opacity: !name.trim() || attending === null ? 0.5 : 1 }}>{state === 'sending' ? '...' : 'ОТПРАВИТЬ'}</button>
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
function LeadForm({ title, subtitle, buttonLabel, showMessage, accent, brandName, submit }: {
  title: string; subtitle: string; buttonLabel: string; showMessage: boolean;
  accent: string; brandName?: string | null; submit?: (p: { name: string; phone: string; message?: string }) => Promise<void>;
}) {
  const fs = useFs();
  const fsH = useFsH();
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
  // Fields: solid white with a distinct border; a soft accent glow pulses as an
  // outer halo but the crisp white fill + border stay legible on their own.
  const glowBase: React.CSSProperties = {
    ['--blk-glow' as string]: hexToRgba(accent, 0.85),
    animation: 'blkGlow 2.6s ease-in-out infinite',
    background: '#ffffff',
    border: '1.5px solid rgba(0,0,0,0.25)',
    borderRadius: 12,
    color: '#1a1a1a',
  };
  const field: React.CSSProperties = { padding: '16px 18px', fontSize: fs(15), outline: 'none', fontFamily: 'var(--blk-font-b, system-ui, sans-serif)', width: '100%', boxSizing: 'border-box', ...glowBase };
  return (
    <section style={{ padding: '36px 24px', textAlign: 'center' }}>
      <style>{PASSIVE_KEYFRAMES}</style>
      {title && <h2 style={{ fontFamily: 'var(--blk-font-h, inherit)', margin: '0 0 8px', fontSize: fsH(26), letterSpacing: '0.04em', color: 'inherit' }}>{title}</h2>}
      {subtitle && <p style={{ margin: '0 0 22px', fontSize: fs(13), lineHeight: 1.5, opacity: 0.85, fontFamily: 'var(--blk-font-b, system-ui, sans-serif)', color: 'inherit' }}>{subtitle}</p>}
      {state === 'done' ? (
        <>
          <SuccessAlert
            title="Заявка успешно отправлена!"
            subtitle={brandName ? `Администратор ${brandName} скоро свяжется с вами.` : 'Администратор скоро свяжется с вами.'}
          />
          <p style={{ margin: 0, fontSize: fs(17), color: accent, fontFamily: 'var(--blk-font-b, system-ui, sans-serif)', fontWeight: 600 }}>Спасибо! Мы вам перезвоним.</p>
        </>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 360, margin: '0 auto' }}>
          <input className="blk-form-field" value={name} onChange={(e) => setName(e.target.value)} placeholder="Имя" style={field} />
          {/* Phone: country/dial-code picker + the number input side by side in one box */}
          <div style={{ display: 'flex', alignItems: 'stretch', overflow: 'hidden', ...glowBase }}>
            <select
              value={country}
              onChange={(e) => setCountry(Number(e.target.value))}
              style={{ border: 'none', outline: 'none', background: 'transparent', color: 'inherit', fontSize: fs(15), fontFamily: 'var(--blk-font-b, system-ui, sans-serif)', padding: '16px 6px 16px 14px', cursor: 'pointer', appearance: 'auto' }}
            >
              {DIAL_CODES.map((c, i) => <option key={c.name} value={i} style={{ color: '#111' }}>{c.flag} {c.code}</option>)}
            </select>
            <span style={{ alignSelf: 'center', width: 1, height: 26, background: 'currentColor', opacity: 0.3 }} />
            <input className="blk-form-field" value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" placeholder="Телефон"
              style={{ flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'transparent', color: 'inherit', fontSize: fs(15), fontFamily: 'var(--blk-font-b, system-ui, sans-serif)', padding: '16px 18px 16px 12px' }} />
          </div>
          {showMessage && <textarea className="blk-form-field" value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Текстовое поле" rows={3} style={{ ...field, resize: 'vertical' }} />}
          <button type="button" onClick={go} disabled={state === 'sending' || !canSend} style={{ alignSelf: 'stretch', padding: '15px 24px', borderRadius: 12, border: 'none', cursor: canSend ? 'pointer' : 'default', background: accent, color: readableText(accent), fontSize: fs(14), fontWeight: 700, letterSpacing: '0.12em', fontFamily: 'var(--blk-font-b, system-ui, sans-serif)', opacity: canSend ? 1 : 0.5 }}>{state === 'sending' ? '...' : (buttonLabel || 'ОТПРАВИТЬ')}</button>
          {state === 'error' && <p style={{ margin: 0, fontSize: 13, color: '#c00' }}>Не удалось отправить.</p>}
        </div>
      )}
    </section>
  );
}

// "Save contact" button — builds a vCard on the fly and downloads it.
function SaveContactButton({ label, name, phone, accent, ink }: { label: string; name: string; phone: string; accent: string; ink?: string | null }) {
  const surface = pillSurface(ink ?? null, '#0d0d0d', accent);
  const fs = useFs();
  const es = useEs();
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
      <style>{PASSIVE_KEYFRAMES}</style>
      <button type="button" onClick={save} style={{ position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: es(14), width: '100%', padding: `${es(16)}px ${es(18)}px`, borderRadius: es(14), border: 'none', cursor: 'pointer', background: surface.bg, color: surface.fg, fontFamily: 'var(--blk-font-b, system-ui, sans-serif)' }}>
        <Sheen opacity={0.28} />
        <svg width={es(22)} height={es(22)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        <span style={{ textAlign: 'left' }}>
          <span style={{ display: 'block', fontSize: fs(13), fontWeight: 700, letterSpacing: '0.1em' }}>{label || 'СОХРАНИТЬ КОНТАКТЫ'}</span>
          {(name || phone) && <span style={{ display: 'block', fontSize: fs(11), fontWeight: 400, opacity: 0.85 }}>{name || phone}</span>}
        </span>
      </button>
    </div>
  );
}

// Section divider with a selectable shape.
function Divider({ shape, text, accent }: { shape: string; text: string; accent: string }) {
  const fs = useFs();
  const es = useEs();
  if (shape === 'spacer') return <div style={{ height: es(44) }} />;
  if (shape === 'icon') {
    return (
      <div style={{ padding: '18px 24px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14 }}>
        <span style={{ flex: 1, height: 1, background: 'currentColor', opacity: 0.25 }} />
        <span style={{ color: accent, fontSize: es(18) }}>{text || '★'}</span>
        <span style={{ flex: 1, height: 1, background: 'currentColor', opacity: 0.25 }} />
      </div>
    );
  }
  if (shape === 'text') {
    return (
      <div style={{ padding: '18px 24px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14 }}>
        <span style={{ flex: 1, height: 1, background: 'currentColor', opacity: 0.25 }} />
        <span style={{ fontSize: fs(12), letterSpacing: '0.15em', opacity: 0.7, fontFamily: 'var(--blk-font-b, system-ui, sans-serif)', color: 'inherit' }}>{text || 'или'}</span>
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
  const fs = useFs();
  const fsH = useFsH();
  const content = Array(4).fill(text || '…').join('   •   ');
  const half: React.CSSProperties = { paddingRight: 36, flexShrink: 0 };
  return (
    <div style={{ overflow: 'hidden', whiteSpace: 'nowrap', padding: '18px 0 8px' }}>
      <style>{'@keyframes blkMarquee { from { transform: translateX(0); } to { transform: translateX(-50%); } }'}</style>
      <div style={{ display: 'inline-flex', animation: 'blkMarquee 16s linear infinite', willChange: 'transform' }}>
        <h2 style={{ ...half, fontFamily: 'var(--blk-font-h, inherit)', margin: 0, fontSize: fsH(26), letterSpacing: '0.08em', color: 'inherit', fontWeight: 600 }}>{content}</h2>
        <h2 style={{ ...half, fontFamily: 'var(--blk-font-h, inherit)', margin: 0, fontSize: fsH(26), letterSpacing: '0.08em', color: 'inherit', fontWeight: 600 }} aria-hidden>{content}</h2>
      </div>
    </div>
  );
}

// Single wide link button with a label + sub-label and a custom background color.
function LinkBar({ label, sublabel, action, color, accent }: { label: string; sublabel: string; action?: ButtonAction; color: string; accent: string }) {
  const fs = useFs();
  const onClick = () => {
    if (!action?.value) return;
    if (action.kind === 'phone') window.location.href = `tel:${action.value}`;
    else if (action.kind === 'map') yandexMaps(action.value);
    else window.open(action.value, '_blank', 'noopener,noreferrer');
  };
  return (
    <div style={{ padding: '10px 20px' }}>
      <button type="button" onClick={onClick} style={{ display: 'flex', alignItems: 'center', gap: 14, width: '100%', padding: '12px 16px', borderRadius: 10, border: 'none', cursor: 'pointer', background: color || accent, color: '#fff', textAlign: 'left', fontFamily: 'var(--blk-font-b, system-ui, sans-serif)' }}>
        <span style={{ fontSize: 22, lineHeight: 1 }}>☰</span>
        <span>
          <span style={{ display: 'block', fontSize: fs(14), fontWeight: 800, letterSpacing: '0.1em' }}>{label}</span>
          {sublabel && <span style={{ display: 'block', fontSize: fs(12), opacity: 0.9, marginTop: 2 }}>{sublabel}</span>}
        </span>
      </button>
    </div>
  );
}

// ── One block may not take the page down with it ─────────────────────────────
// Blocks render data typed by a manager and stored as free-form JSON. React
// unmounts the WHOLE tree when a render throws, so without a boundary here one
// malformed block turns a published flyer into a blank page — and the visitor
// gets no hint that the rest of it exists. Per block, the damage is one gap.
class BlockBoundary extends Component<{ children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(err: unknown) { console.error('[block] render failed', err); }
  render() { return this.state.failed ? null : this.props.children; }
}

// Render an ordered block list (used by both the editor preview and public pages).
// Hidden blocks are skipped entirely on the page.
export function BlockList({ blocks, ctx }: { blocks: Block[]; ctx: RenderCtx }) {
  // Each BlockView provides its own (heading/body) scale context, so no outer
  // provider is needed here. `vccontact` is pulled out and rendered below the
  // footer by the flyer page, so it never shows in the normal flow.
  // Keys are de-duplicated rather than trusted. Ids come from saved JSON, and a
  // design applied twice — or one saved before ids carried a random suffix —
  // can repeat one. React drops all but one child of a repeated key, which
  // looks exactly like "that block and the ones after it never loaded".
  const seen = new Map<string, number>();
  const key = (id: string) => {
    const n = (seen.get(id) ?? 0) + 1;
    seen.set(id, n);
    return n === 1 ? id : `${id}#${n}`;
  };
  return (
    <>
      {blocks.filter((b) => !b.hidden && b.type !== 'vccontact').map((b) => (
        <BlockBoundary key={key(b.id)}><BlockView block={b} ctx={ctx} /></BlockBoundary>
      ))}
    </>
  );
}

// The V-connect contact info a flyer carries (in its single `vccontact` block),
// used to render the contact card beneath the attribution footer.
export function findVcContact(blocks: Block[]): { phone: string; telegram: string; instagram: string } | null {
  const b = blocks.find((x) => x.type === 'vccontact' && !x.hidden);
  if (!b) return null;
  return { phone: str(b.props, 'phone'), telegram: str(b.props, 'telegram'), instagram: str(b.props, 'instagram') };
}

// Mandatory attribution shown at the bottom of every flyer: "Website developed
// by" → the V-connect logo → "V-connect" in bold. Not a block — always
// rendered, not removable. `label` is the leading "Website developed by" line.
// `color` is the page's resolved text color, so the attribution follows the
// theme instead of staying black on a dark flyer. Callers pass ctx.text.
export function VConnectFooter({ label, color }: { label: string; color?: string | null }) {
  const ink = (color || '').trim() || '#000';
  return (
    <div
      aria-label="V-connect"
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
        padding: '26px 20px 30px', margin: '10px 0 0',
        borderTop: `1px solid ${softInk(ink, 0.12)}`,
      }}
    >
      <span style={{ fontSize: 13, fontWeight: 500, letterSpacing: '0.08em', color: ink, fontFamily: 'var(--blk-font-b, system-ui, sans-serif)', textAlign: 'center', textTransform: 'uppercase', opacity: 0.75 }}>
        {label}
      </span>
      <img src={networkingLogoSrc} alt="V-connect" loading="lazy" decoding="async" style={{ height: 60, width: 'auto' }} />
      <span style={{ fontSize: 20, fontWeight: 800, letterSpacing: '0.03em', color: ink, fontFamily: 'var(--blk-font-b, system-ui, sans-serif)' }}>
        V-CONNECT
      </span>
    </div>
  );
}

// "Contact us" section for reaching V-connect, rendered just below the footer
// ad. Phone and Telegram are set per flyer in the builder (the `vccontact`
// block). Renders nothing until at least one is filled in.
export function VConnectContact({ phone, telegram, instagram, title, callLabel, telegramLabel, instagramLabel, color }: {
  phone?: string | null; telegram?: string | null; instagram?: string | null;
  title: string; callLabel: string; telegramLabel: string; instagramLabel: string;
  // The page's resolved text color; chips invert around it so they stay legible
  // on a dark theme instead of being fixed black-on-white.
  color?: string | null;
}) {
  const tel = (phone || '').trim();
  const tg = (telegram || '').trim();
  const ig = (instagram || '').trim();
  if (!tel && !tg && !ig) return null;
  const ink = (color || '').trim() || '#000';
  const onInk = readableText(ink);
  const tgHref = tg.startsWith('http') ? tg : `https://t.me/${tg.replace(/^@/, '')}`;
  const igHref = ig.startsWith('http') ? ig : `https://instagram.com/${ig.replace(/^@/, '')}`;
  const chip: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', gap: 8, padding: '11px 22px', borderRadius: 999,
    fontSize: 14, fontWeight: 700, letterSpacing: '0.04em', fontFamily: 'var(--blk-font-b, system-ui, sans-serif)',
    textDecoration: 'none', border: `1px solid ${softInk(ink, 0.28)}`,
  };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, padding: '4px 20px 34px' }}>
      <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: ink, opacity: 0.7, fontFamily: 'var(--blk-font-b, system-ui, sans-serif)' }}>{title}</span>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
        {tel && <a href={`tel:${tel.replace(/\s+/g, '')}`} style={{ ...chip, background: ink, color: onInk }}>{callLabel} {tel}</a>}
        {tg && <a href={tgHref} target="_blank" rel="noopener noreferrer" style={{ ...chip, background: 'transparent', color: ink }}>{telegramLabel}</a>}
        {ig && <a href={igHref} target="_blank" rel="noopener noreferrer" style={{ ...chip, background: 'transparent', color: ink }}>{instagramLabel}</a>}
      </div>
    </div>
  );
}
