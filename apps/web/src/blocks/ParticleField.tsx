import { useMemo } from 'react';

export type ParticleKind = 'none' | 'confetti' | 'birthday' | 'snow' | 'candy' | 'hearts';

// fall = vertical drop; sway = gentle side drift; tumble = 3D paper flip (gives
// confetti its realistic spinning look); heart = soft rock + pulse for emoji.
const KEYFRAMES = `
@keyframes pfFall { from { transform: translateY(-14vh); } to { transform: translateY(114vh); } }
@keyframes pfSway { 0%, 100% { transform: translateX(0); } 50% { transform: translateX(var(--pf-drift, 20px)); } }
@keyframes pfTumble { from { transform: rotateX(0deg) rotateY(0deg) rotateZ(0deg); } to { transform: rotateX(360deg) rotateY(720deg) rotateZ(200deg); } }
@keyframes pfHeart { 0%, 100% { transform: rotate(-13deg) scale(1); } 50% { transform: rotate(13deg) scale(1.14); } }
@keyframes pfDrift { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
`;

// Warm metallic golds for the "gold confetti" variant.
const GOLD = ['#f4b400', '#e8a917', '#ffd75e', '#d99310', '#ffe9a8', '#c98a12', '#f6c026'];
// Saturated party palette for the birthday variant.
const BIRTHDAY = ['#ff3b3b', '#ff9f1c', '#ffd23f', '#2ec4b6', '#3a86ff', '#8338ec', '#ff5da2', '#06d6a0', '#ef476f'];
const CANDIES = ['🍬', '🍭', '🍫'];
const HEARTS = ['❤️', '💖', '💗', '💕', '💘'];

type P = {
  left: number; delay: number; fall: number; sway: number; drift: number;
  size: number; ratio: number; spin: number; color: string; round: boolean;
  glyph: string; flip: number;
};

function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }

// A single flat confetti piece that tumbles in 3D. Slight inset shadow + a
// diagonal sheen make the flat rectangle read as a real foil/paper flake.
function ConfettiPiece({ p }: { p: P }) {
  const w = p.size;
  const h = Math.round(p.size * p.ratio);
  return (
    <div style={{ animation: `pfTumble ${p.spin}s linear infinite`, transformStyle: 'preserve-3d', willChange: 'transform' }}>
      <span style={{
        display: 'block', width: w, height: h, borderRadius: p.round ? '50%' : 1,
        background: `linear-gradient(135deg, ${p.color} 0%, ${p.color} 45%, rgba(255,255,255,0.55) 50%, ${p.color} 55%, ${p.color} 100%)`,
        boxShadow: 'inset 0 -2px 3px rgba(0,0,0,0.22)',
      }} />
    </div>
  );
}

function Snowflake({ p }: { p: P }) {
  return <span style={{ display: 'block', width: p.size, height: p.size, borderRadius: '50%', background: 'rgba(255,255,255,0.95)', boxShadow: '0 0 5px rgba(255,255,255,0.75)', opacity: 0.45 + (p.size % 5) / 9 }} />;
}

function Inner({ kind, p }: { kind: ParticleKind; p: P }) {
  if (kind === 'confetti' || kind === 'birthday') return <ConfettiPiece p={p} />;
  if (kind === 'snow') return <Snowflake p={p} />;
  if (kind === 'hearts') return <span style={{ display: 'block', fontSize: p.size + 12, lineHeight: 1, animation: `pfHeart ${p.spin}s ease-in-out infinite` }}>{p.glyph}</span>;
  // candy: emoji that slowly rotates as it falls
  return <span style={{ display: 'block', fontSize: p.size + 12, lineHeight: 1, animation: `pfDrift ${p.spin * 2}s linear infinite` }}>{p.glyph}</span>;
}

// Full-page falling particle overlay. Purely decorative, never intercepts pointer
// events, and sits above everything else. `fixed` anchors it to the viewport
// (public pages); otherwise it fills its nearest positioned ancestor (editor frame).
export function ParticleField({ kind, count = 80, fixed = false }: { kind?: ParticleKind | string | null; count?: number; fixed?: boolean }) {
  const k = (kind ?? 'none') as ParticleKind;
  const particles = useMemo<P[]>(() => {
    const palette = k === 'birthday' ? BIRTHDAY : GOLD;
    return Array.from({ length: count }, () => ({
      left: Math.random() * 100,
      delay: -Math.random() * 14,
      fall: 6 + Math.random() * (k === 'snow' ? 12 : 7),
      sway: 2 + Math.random() * 3.5,
      drift: 8 + Math.random() * 34,
      size: (k === 'snow' ? 5 : 7) + Math.random() * (k === 'snow' ? 8 : 7),
      ratio: 0.45 + Math.random() * 1.0, // rectangle aspect for confetti
      spin: 0.7 + Math.random() * 1.8,
      color: pick(palette),
      round: Math.random() < 0.25,
      glyph: k === 'hearts' ? pick(HEARTS) : pick(CANDIES),
      flip: Math.random(),
    }));
  }, [count, k]);

  if (!k || k === 'none') return null;

  return (
    <div aria-hidden style={{ position: fixed ? 'fixed' : 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 2147483000, perspective: 700 }}>
      <style>{KEYFRAMES}</style>
      {particles.map((p, i) => (
        <div key={i} style={{ position: 'absolute', top: 0, left: `${p.left}%`, animation: `pfFall ${p.fall}s linear ${p.delay}s infinite`, willChange: 'transform' }}>
          <div style={{ ['--pf-drift' as string]: `${p.drift}px`, animation: `pfSway ${p.sway}s ease-in-out infinite` }}>
            <Inner kind={k} p={p} />
          </div>
        </div>
      ))}
    </div>
  );
}
