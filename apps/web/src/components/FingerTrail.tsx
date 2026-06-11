import { useEffect, useRef } from 'react';

// ── Finger-trail effect ─────────────────────────────────────────────────────
// A sparkly trail of accent-colored dots that follows the finger/cursor across
// the page. Renders on a full-screen canvas above the content (pointer-events
// disabled so it never blocks interaction).
export function FingerTrail({ accent }: { accent: string }) {
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
