import { useEffect, useRef } from 'react';

export type TrailTemplate = 'sparkle' | 'hearts' | 'candy';

// ── Finger-trail effect ─────────────────────────────────────────────────────
// A trail of accent-colored shapes that follows the finger/cursor across the
// page. Renders on a full-screen canvas above the content (pointer-events
// disabled so it never blocks interaction). `template` picks the particle shape:
//   sparkle — soft glowing dots (default; used by restaurant flyers)
//   hearts  — little hearts that float gently upward
//   candy   — twisted candy-wrapper shapes that drift and spin
export function FingerTrail({ accent, template = 'sparkle' }: { accent: string; template?: TrailTemplate }) {
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
    const [cr, cg, cb] = rgb;

    type P = { x: number; y: number; vx: number; vy: number; life: number; size: number; rot: number; spin: number };
    let particles: P[] = [];
    let raf = 0;

    // Draw a heart centered at (0,0) sized `s` in the current fill style.
    const heartPath = (s: number) => {
      ctx.beginPath();
      const t = s / 16;
      ctx.moveTo(0, 4 * t);
      ctx.bezierCurveTo(0, 1 * t, -2 * t, -3 * t, -6 * t, -3 * t);
      ctx.bezierCurveTo(-12 * t, -3 * t, -12 * t, 4 * t, -6 * t, 8 * t);
      ctx.bezierCurveTo(-3 * t, 11 * t, 0, 13 * t, 0, 16 * t);
      ctx.bezierCurveTo(0, 13 * t, 3 * t, 11 * t, 6 * t, 8 * t);
      ctx.bezierCurveTo(12 * t, 4 * t, 12 * t, -3 * t, 6 * t, -3 * t);
      ctx.bezierCurveTo(2 * t, -3 * t, 0, 1 * t, 0, 4 * t);
      ctx.closePath();
    };

    // Draw a candy-wrapper (rounded body + two triangular twisted ends).
    const candyPath = (s: number) => {
      const w = s * 1.1, h = s * 0.7;
      ctx.beginPath();
      ctx.moveTo(-w, 0);
      ctx.lineTo(-w * 0.45, -h);
      ctx.lineTo(-w * 0.45, h);
      ctx.closePath();
      ctx.moveTo(w, 0);
      ctx.lineTo(w * 0.45, -h);
      ctx.lineTo(w * 0.45, h);
      ctx.closePath();
      ctx.ellipse(0, 0, w * 0.5, h, 0, 0, Math.PI * 2);
    };

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    let lastX = 0, lastY = 0, hasLast = false;
    const emit = (x: number, y: number) => {
      // Number of particles scales with how fast the finger moves. Hearts/candy
      // are larger glyphs, so we emit fewer of them than sparkle dots.
      const dist = hasLast ? Math.hypot(x - lastX, y - lastY) : 0;
      const cap = template === 'sparkle' ? 6 : 3;
      const step = template === 'sparkle' ? 8 : 14;
      const count = Math.min(cap, 1 + Math.floor(dist / step));
      for (let i = 0; i < count; i++) {
        const size = template === 'sparkle' ? 2 + Math.random() * 3 : 9 + Math.random() * 7;
        particles.push({
          x, y,
          vx: (Math.random() - 0.5) * 0.6,
          vy: (Math.random() - 0.5) * 0.6 - (template === 'sparkle' ? 0.3 : 0.7),
          life: 1,
          size,
          rot: Math.random() * Math.PI * 2,
          spin: (Math.random() - 0.5) * 0.12,
        });
      }
      const max = template === 'sparkle' ? 400 : 160;
      if (particles.length > max) particles = particles.slice(-max);
      lastX = x; lastY = y; hasLast = true;
    };

    const onMouse = (e: MouseEvent) => emit(e.clientX, e.clientY);
    const onTouch = (e: TouchEvent) => {
      const t = e.touches[0];
      if (t) emit(t.clientX, t.clientY);
    };
    window.addEventListener('mousemove', onMouse, { passive: true });
    window.addEventListener('touchmove', onTouch, { passive: true });

    const fade = template === 'sparkle' ? 0.025 : 0.016;
    const tick = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const p of particles) {
        p.x += p.vx; p.y += p.vy; p.life -= fade;
        p.rot += p.spin;
        if (template !== 'sparkle') p.vy -= 0.004; // gentle upward float
        if (p.life <= 0) continue;

        if (template === 'sparkle') {
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${cr},${cg},${cb},${p.life * 0.85})`;
          ctx.shadowBlur = 8;
          ctx.shadowColor = `rgba(${cr},${cg},${cb},${p.life})`;
          ctx.fill();
        } else {
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rot);
          ctx.fillStyle = `rgba(${cr},${cg},${cb},${p.life * 0.9})`;
          ctx.shadowBlur = 6;
          ctx.shadowColor = `rgba(${cr},${cg},${cb},${p.life * 0.7})`;
          if (template === 'hearts') heartPath(p.size); else candyPath(p.size);
          ctx.fill();
          ctx.restore();
        }
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
  }, [accent, template]);

  return (
    <canvas
      ref={canvasRef}
      style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 50 }}
    />
  );
}
