import { useMemo } from 'react';

export type ParticleKind = 'none' | 'confetti' | 'snow' | 'candy';

const KEYFRAMES = `
@keyframes pfFall { from { transform: translateY(-12vh) rotate(0deg); } to { transform: translateY(112vh) rotate(360deg); } }
@keyframes pfSway { 0%, 100% { margin-left: 0; } 50% { margin-left: var(--pf-drift, 18px); } }
`;

const CANDIES = ['🍬', '🍭', '🍫'];

type P = { left: number; delay: number; dur: number; sway: number; drift: number; size: number; glyph: string; hue: number };

function shape(kind: ParticleKind, p: P): React.CSSProperties {
  if (kind === 'snow') {
    return { width: p.size, height: p.size, borderRadius: '50%', background: 'rgba(255,255,255,0.9)', boxShadow: '0 0 4px rgba(255,255,255,0.7)' };
  }
  if (kind === 'confetti') {
    // Yellow confetti — a spread of warm golden hues.
    return { width: p.size, height: Math.round(p.size * 1.6), borderRadius: 2, background: `hsl(${p.hue}, 95%, 55%)` };
  }
  return {}; // candy renders an emoji glyph instead of a colored shape
}

// Full-page falling particle overlay (confetti / snow / candy). Purely decorative,
// never intercepts pointer events, and sits above everything else. `fixed` anchors
// it to the viewport (public pages, so particles cover the whole scrolling page);
// otherwise it fills its nearest positioned ancestor (the editor's phone frame).
export function ParticleField({ kind, count = 80, fixed = false }: { kind?: ParticleKind | string | null; count?: number; fixed?: boolean }) {
  const k = (kind ?? 'none') as ParticleKind;
  const particles = useMemo<P[]>(() => {
    return Array.from({ length: count }, () => ({
      left: Math.random() * 100,
      delay: -Math.random() * 12,
      dur: 7 + Math.random() * 9,
      sway: 2.5 + Math.random() * 3,
      drift: 10 + Math.random() * 26,
      size: 7 + Math.random() * 9,
      glyph: CANDIES[Math.floor(Math.random() * CANDIES.length)],
      hue: 40 + Math.random() * 18,
    }));
  }, [count, k]);

  if (!k || k === 'none') return null;

  return (
    <div aria-hidden style={{ position: fixed ? 'fixed' : 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 2147483000 }}>
      <style>{KEYFRAMES}</style>
      {particles.map((p, i) => (
        <div key={i} style={{ position: 'absolute', top: 0, left: `${p.left}%`, animation: `pfFall ${p.dur}s linear ${p.delay}s infinite`, willChange: 'transform' }}>
          <div style={{ ['--pf-drift' as string]: `${p.drift}px`, animation: `pfSway ${p.sway}s ease-in-out infinite`, fontSize: p.size + 10, lineHeight: 1 }}>
            {k === 'candy' ? p.glyph : <span style={shape(k, p)} />}
          </div>
        </div>
      ))}
    </div>
  );
}
