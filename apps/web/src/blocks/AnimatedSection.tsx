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

// How far up the viewport a block's top edge must travel before it reveals.
// 0.92 = the bottom 8% is a "not yet" strip, matching the observer's rootMargin.
const REVEAL_LINE = 0.92;

// Reveals its children with the given animation when scrolled into view.
// `replay` (used by the live editor) re-hides + re-animates whenever the anim
// config changes so the manager can preview tweaks immediately.
//
// ── A block starts INVISIBLE, so every path out of that state is load-bearing:
// anything that stops the reveal from firing leaves a published page with a
// blank hole in it. Two rules follow, and both were learned from real flyers:
//
//  1. The observer fires on ANY intersection (`threshold: 0`), never on a
//     fraction of the block. A threshold of 0.12 sounds harmless but silently
//     means "a block taller than ~8 screens can never appear": a tall photo,
//     or one long stitched-together poster image, can never put 12% of itself
//     on screen at once, so it — and the rest of the page below it — stayed
//     hidden no matter how far the visitor scrolled.
//  2. There is a fallback that does not involve the observer at all. If the
//     callback never arrives — a stale observation after the page was restored
//     from the back/forward cache, a browser that throttled it in a background
//     tab, an image that resized the page long after load — the poll below
//     still reveals anything that has reached the fold. It reads one rect per
//     tick while hidden and stops for good on the first reveal.
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
    if (reduce) { setShown(true); return; }

    let poll = 0;
    let io: IntersectionObserver | null = null;

    const reveal = () => {
      io?.disconnect();
      window.clearInterval(poll);
      setShown(true);
    };

    // True once the block's top edge has passed the reveal line — and it stays
    // true once scrolled past, so a block the visitor has already gone by can
    // never be left behind still hidden.
    const reached = () => {
      const h = window.innerHeight || document.documentElement.clientHeight || 0;
      return el.getBoundingClientRect().top < h * REVEAL_LINE;
    };

    if ('IntersectionObserver' in window) {
      // threshold 0: as soon as one pixel crosses the line. See note above.
      io = new IntersectionObserver(
        (entries) => entries.forEach((e) => { if (e.isIntersecting) reveal(); }),
        { threshold: 0, rootMargin: '0px 0px -8% 0px' },
      );
      io.observe(el);
      // Backstop only: while the block is hidden this costs one rect read a
      // second, and the browser answers it from cached layout when nothing has
      // changed. It ends the moment anything reveals the block.
      poll = window.setInterval(() => { if (reached()) reveal(); }, 900);
    } else {
      // No observer at all — never leave the page hidden waiting for one.
      setShown(true);
    }

    return () => { io?.disconnect(); window.clearInterval(poll); };
  }, [shown]);

  const dur = anim?.durationMs ?? 700;
  const delay = anim?.delayMs ?? 0;
  const transition = `opacity ${dur}ms ease ${delay}ms, transform ${dur}ms cubic-bezier(0.22,1,0.36,1) ${delay}ms, filter ${dur}ms ease ${delay}ms`;
  const visible: React.CSSProperties = { opacity: 1, transform: 'none', filter: 'none' };

  return (
    <div
      ref={ref}
      style={{
        ...style,
        transition,
        // Only while the block is waiting to animate. Left on permanently it
        // asks the browser to keep a composited layer for every block of every
        // flyer, for the whole visit — on a phone that is how a page ends up
        // with correctly-sized but blank areas where the photos should be.
        ...(shown ? null : { willChange: 'opacity, transform' }),
        ...(shown ? visible : hiddenStyle(type)),
      }}
    >
      {children}
    </div>
  );
}
