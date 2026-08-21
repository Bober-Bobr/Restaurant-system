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

// Warm metallic golds — the fallback when no base color can be parsed.
const GOLD = ['#f4b400', '#e8a917', '#ffd75e', '#d99310', '#ffe9a8', '#c98a12', '#f6c026'];

// ── Colour helpers: derive a tonal palette from one base colour ───────────────
// Particles default to (and can be pinned to) the design's accent colour; we
// spread it into lightness/saturation variants so the shower still has depth
// instead of one flat tone.
function hexToHsl(hex: string): [number, number, number] | null {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec((hex || '').trim());
  if (!m) return null;
  const r = parseInt(m[1], 16) / 255, g = parseInt(m[2], 16) / 255, b = parseInt(m[3], 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0, s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h /= 6;
  }
  return [h, s, l];
}
function hslToHex(h: number, s: number, l: number): string {
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1; if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  let r: number, g: number, b: number;
  if (s === 0) { r = g = b = l; }
  else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3); g = hue2rgb(p, q, h); b = hue2rgb(p, q, h - 1 / 3);
  }
  const to = (x: number) => Math.round(x * 255).toString(16).padStart(2, '0');
  return `#${to(r)}${to(g)}${to(b)}`;
}
function paletteFromBase(hex: string): string[] {
  const hsl = hexToHsl(hex);
  if (!hsl) return GOLD;
  const [h, s, l] = hsl;
  const cl = (x: number) => Math.max(0.14, Math.min(0.9, x));
  const cs = (x: number) => Math.max(0.15, Math.min(1, x));
  return [
    hslToHex(h, s, l),
    hslToHex(h, cs(s - 0.12), cl(l + 0.16)),
    hslToHex(h, s, cl(l - 0.12)),
    hslToHex(h, cs(s - 0.2), cl(l + 0.26)),
    hslToHex(h, s, cl(l + 0.07)),
    hslToHex(h, cs(s + 0.1), cl(l - 0.05)),
  ];
}

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

// Heart with a soft highlight (not an emoji); tinted with the particle colour.
function HeartSvg({ size, color }: { size: number; color: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" style={{ display: 'block', opacity: 0.8, filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.35))' }}>
      <path d="M16 28.7C16 28.7 2.7 20.3 2.7 11.2 2.7 7.1 6 4 9.8 4 12.3 4 14.6 5.6 16 7.9 17.4 5.6 19.7 4 22.2 4 26 4 29.3 7.1 29.3 11.2 29.3 20.3 16 28.7 16 28.7Z" fill={color} />
      <ellipse cx="11" cy="11" rx="3.2" ry="2.1" fill="rgba(255,255,255,0.35)" />
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
  return <div style={{ animation: `pfHeart ${p.spin * 1.5}s ease-in-out infinite` }}><HeartSvg size={p.size} color={p.color} /></div>;
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
export function ParticleField({ kind, count = 80, fixed = false, imageUrl, color }: { kind?: ParticleKind | string | null; count?: number; fixed?: boolean; imageUrl?: string | null; color?: string | null }) {
  const k = (kind ?? 'none') as ParticleKind;
  // Particle colour syncs with the accent (or an explicit override) by default.
  const base = color || '#d8b45f';
  // Candies, hearts and custom images are larger — fewer of them read as
  // scattered accents rather than a dense, cluttered overlay.
  const n = (k === 'candy' || k === 'hearts' || k === 'custom') ? Math.round(count * 0.35) : count;
  const particles = useMemo<P[]>(() => {
    const palette = paletteFromBase(base);
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
  }, [n, k, base]);

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
