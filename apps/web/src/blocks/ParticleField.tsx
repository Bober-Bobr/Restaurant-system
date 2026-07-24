import { useMemo } from 'react';

export type ParticleKind = 'none' | 'confetti' | 'birthday' | 'snow' | 'candy' | 'hearts' | 'custom';

// fall = vertical drop; sway = gentle side drift; tumble = 3D paper flip (gives
// confetti its realistic spinning look); heart = soft rock + pulse; drift = a
// slow flat rotation (snowflakes / candies as they fall).
const KEYFRAMES = `
@keyframes pfFall { from { transform: translateY(-14vh); } to { transform: translateY(114vh); } }
@keyframes pfSway { 0%, 100% { transform: translateX(0); } 50% { transform: translateX(var(--pf-drift, 20px)); } }
@keyframes pfTumble { from { transform: rotateX(0deg) rotateY(0deg) rotateZ(0deg); } to { transform: rotateX(360deg) rotateY(720deg) rotateZ(200deg); } }
@keyframes pfHeart { 0%, 100% { transform: rotate(-12deg) scale(1); } 50% { transform: rotate(12deg) scale(1.12); } }
@keyframes pfDrift { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
`;

// Warm metallic golds for the "gold confetti" variant.
const GOLD = ['#f4b400', '#e8a917', '#ffd75e', '#d99310', '#ffe9a8', '#c98a12', '#f6c026'];
// Saturated party palette for the birthday variant.
const BIRTHDAY = ['#ff3b3b', '#ff9f1c', '#ffd23f', '#2ec4b6', '#3a86ff', '#8338ec', '#ff5da2', '#06d6a0', '#ef476f'];
// Glossy wrapped-candy colors.
const CANDY_COLORS = ['#e23b3b', '#ff6fae', '#37c26a', '#3a86ff', '#ff8c1a', '#9b5de5', '#f4243e'];

type P = {
  left: number; delay: number; fall: number; sway: number; drift: number;
  size: number; ratio: number; spin: number; color: string; round: boolean;
};

function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }

// A single flat confetti piece that tumbles in 3D. Slight inset shadow + a
// diagonal sheen make the flat rectangle read as a real foil/paper flake.
function ConfettiPiece({ p }: { p: P }) {
  return (
    <div style={{ animation: `pfTumble ${p.spin}s linear infinite`, transformStyle: 'preserve-3d', willChange: 'transform' }}>
      <span style={{
        display: 'block', width: p.size, height: Math.round(p.size * p.ratio), borderRadius: p.round ? '50%' : 1,
        background: `linear-gradient(135deg, ${p.color} 0%, ${p.color} 45%, rgba(255,255,255,0.55) 50%, ${p.color} 55%, ${p.color} 100%)`,
        boxShadow: 'inset 0 -2px 3px rgba(0,0,0,0.22)',
      }} />
    </div>
  );
}

// Six-fold crystalline snowflake drawn with SVG (one arm rotated at 60° steps).
function SnowflakeSvg({ size, opacity }: { size: number; opacity: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" style={{ display: 'block', color: '#eaf6ff', opacity, filter: 'drop-shadow(0 0 3px rgba(255,255,255,0.75))' }}>
      {[0, 60, 120, 180, 240, 300].map((a) => (
        <g key={a} transform={`rotate(${a} 50 50)`} stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" fill="none">
          <line x1="50" y1="50" x2="50" y2="8" />
          <line x1="50" y1="18" x2="41" y2="10" />
          <line x1="50" y1="18" x2="59" y2="10" />
          <line x1="50" y1="30" x2="43" y2="24" />
          <line x1="50" y1="30" x2="57" y2="24" />
        </g>
      ))}
    </svg>
  );
}

// Glossy wrapped candy (bonbon) drawn with SVG — twisted wrapper ends, a shaded
// body and a bright highlight so it reads as a real sweet rather than a flat dot.
function CandySvg({ size, color }: { size: number; color: string }) {
  return (
    <svg width={size * 1.5} height={size} viewBox="0 0 120 80" style={{ display: 'block', opacity: 0.7, filter: 'drop-shadow(0 2px 2px rgba(0,0,0,0.3))' }}>
      <path d="M34 40 L6 18 Q1 40 6 62 Z" fill={color} opacity="0.92" />
      <path d="M86 40 L114 18 Q119 40 114 62 Z" fill={color} opacity="0.92" />
      <path d="M14 28 L20 40 L14 52" fill="none" stroke="rgba(0,0,0,0.28)" strokeWidth="2" />
      <path d="M106 28 L100 40 L106 52" fill="none" stroke="rgba(0,0,0,0.28)" strokeWidth="2" />
      <ellipse cx="60" cy="40" rx="28" ry="26" fill={color} />
      <ellipse cx="60" cy="52" rx="24" ry="15" fill="rgba(0,0,0,0.20)" />
      <ellipse cx="50" cy="30" rx="11" ry="7" fill="rgba(255,255,255,0.6)" />
      <circle cx="67" cy="31" r="3" fill="rgba(255,255,255,0.7)" />
    </svg>
  );
}

// Solid black heart with a soft highlight (not an emoji).
function HeartSvg({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" style={{ display: 'block', opacity: 0.7, filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.35))' }}>
      <path d="M16 28.7C16 28.7 2.7 20.3 2.7 11.2 2.7 7.1 6 4 9.8 4 12.3 4 14.6 5.6 16 7.9 17.4 5.6 19.7 4 22.2 4 26 4 29.3 7.1 29.3 11.2 29.3 20.3 16 28.7 16 28.7Z" fill="#141414" />
      <ellipse cx="11" cy="11" rx="3.2" ry="2.1" fill="rgba(255,255,255,0.3)" />
    </svg>
  );
}

function Inner({ kind, p, imageUrl }: { kind: ParticleKind; p: P; imageUrl?: string | null }) {
  if (kind === 'custom') {
    if (!imageUrl) return null;
    return <div style={{ animation: `pfDrift ${p.spin * 3}s linear infinite` }}><img src={imageUrl} alt="" style={{ width: p.size, height: 'auto', display: 'block', opacity: 0.85 }} /></div>;
  }
  if (kind === 'confetti' || kind === 'birthday') return <ConfettiPiece p={p} />;
  if (kind === 'snow') return <div style={{ animation: `pfDrift ${p.spin * 4}s linear infinite` }}><SnowflakeSvg size={p.size} opacity={0.5 + p.ratio * 0.4} /></div>;
  if (kind === 'candy') return <div style={{ animation: `pfDrift ${p.spin * 3}s linear infinite` }}><CandySvg size={p.size} color={p.color} /></div>;
  // hearts: a soft rock/pulse rather than a full spin
  return <div style={{ animation: `pfHeart ${p.spin * 1.5}s ease-in-out infinite` }}><HeartSvg size={p.size} /></div>;
}

// Size range per kind so detailed shapes are large enough to read.
function sizeFor(k: ParticleKind): number {
  if (k === 'snow') return 12 + Math.random() * 14;
  if (k === 'candy') return 16 + Math.random() * 14;
  if (k === 'hearts') return 14 + Math.random() * 12;
  if (k === 'custom') return 22 + Math.random() * 20;
  return 7 + Math.random() * 7; // confetti / birthday
}

// Full-page falling particle overlay. Purely decorative, never intercepts pointer
// events, and sits above everything else. `fixed` anchors it to the viewport
// (public pages); otherwise it fills its nearest positioned ancestor (editor frame).
export function ParticleField({ kind, count = 80, fixed = false, imageUrl }: { kind?: ParticleKind | string | null; count?: number; fixed?: boolean; imageUrl?: string | null }) {
  const k = (kind ?? 'none') as ParticleKind;
  // Candies, hearts and custom images are larger — fewer of them read as
  // scattered accents rather than a dense, cluttered overlay.
  const n = (k === 'candy' || k === 'hearts' || k === 'custom') ? Math.round(count * 0.35) : count;
  const particles = useMemo<P[]>(() => {
    const palette = k === 'birthday' ? BIRTHDAY : k === 'candy' ? CANDY_COLORS : GOLD;
    return Array.from({ length: n }, () => ({
      left: Math.random() * 100,
      delay: -Math.random() * 14,
      fall: 6 + Math.random() * (k === 'snow' ? 12 : 7),
      sway: 2 + Math.random() * 3.5,
      drift: 8 + Math.random() * 34,
      size: sizeFor(k),
      ratio: 0.45 + Math.random() * 1.0,
      spin: 0.7 + Math.random() * 1.8,
      color: pick(palette),
      round: Math.random() < 0.25,
    }));
  }, [n, k]);

  if (!k || k === 'none') return null;
  if (k === 'custom' && !imageUrl) return null;

  return (
    <div aria-hidden style={{ position: fixed ? 'fixed' : 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 2147483000, perspective: 700 }}>
      <style>{KEYFRAMES}</style>
      {particles.map((p, i) => (
        <div key={i} style={{ position: 'absolute', top: 0, left: `${p.left}%`, animation: `pfFall ${p.fall}s linear ${p.delay}s infinite`, willChange: 'transform' }}>
          <div style={{ ['--pf-drift' as string]: `${p.drift}px`, animation: `pfSway ${p.sway}s ease-in-out infinite` }}>
            <Inner kind={k} p={p} imageUrl={imageUrl} />
          </div>
        </div>
      ))}
    </div>
  );
}
