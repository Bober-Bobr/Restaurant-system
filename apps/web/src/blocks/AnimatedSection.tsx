import { useEffect, useRef, useState } from 'react';
import type { SectionAnimation, AnimationType } from '../services/guestInvitation.service';

function hiddenStyle(type: AnimationType): React.CSSProperties {
  switch (type) {
    case 'none': return {};
    case 'fade': return { opacity: 0 };
    case 'slide-up': return { opacity: 0, transform: 'translateY(40px)' };
    case 'slide-down': return { opacity: 0, transform: 'translateY(-40px)' };
    case 'slide-left': return { opacity: 0, transform: 'translateX(40px)' };
    case 'slide-right': return { opacity: 0, transform: 'translateX(-40px)' };
    case 'zoom': return { opacity: 0, transform: 'scale(0.85)' };
    case 'blur': return { opacity: 0, filter: 'blur(12px)' };
    case 'flip': return { opacity: 0, transform: 'perspective(800px) rotateX(35deg)' };
    default: return { opacity: 0 };
  }
}

// Reveals its children with the given animation when scrolled into view.
// `replay` (used by the live editor) re-hides + re-animates whenever the anim
// config changes so the manager can preview tweaks immediately.
export function AnimatedSection({ anim, replay, style, children }: {
  anim?: SectionAnimation;
  replay?: boolean;
  style?: React.CSSProperties;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const type = anim?.type ?? 'fade';
  const [shown, setShown] = useState(type === 'none');

  // In the editor, re-trigger the animation whenever its parameters change.
  const animKey = replay ? `${type}-${anim?.durationMs ?? ''}-${anim?.delayMs ?? ''}` : '';
  useEffect(() => {
    if (!replay) return;
    setShown(type === 'none');
  }, [animKey, replay, type]);

  useEffect(() => {
    if (shown) return;
    const el = ref.current;
    if (!el) return;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce || !('IntersectionObserver' in window)) { setShown(true); return; }
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) { setShown(true); io.disconnect(); } }),
      { threshold: 0.12, rootMargin: '0px 0px -8% 0px' }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [shown]);

  const dur = anim?.durationMs ?? 700;
  const delay = anim?.delayMs ?? 0;
  const transition = `opacity ${dur}ms ease ${delay}ms, transform ${dur}ms cubic-bezier(0.22,1,0.36,1) ${delay}ms, filter ${dur}ms ease ${delay}ms`;
  const visible: React.CSSProperties = { opacity: 1, transform: 'none', filter: 'none' };

  return (
    <div ref={ref} style={{ ...style, transition, willChange: 'opacity, transform', ...(shown ? visible : hiddenStyle(type)) }}>
      {children}
    </div>
  );
}
