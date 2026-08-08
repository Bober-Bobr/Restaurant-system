import { useCallback, useEffect, useRef, useState } from 'react';

// ── Landing-page motion helpers ─────────────────────────────────────────────
// Shared by the promotional site and the pricing page so both move the same way.
// Every one of them checks `prefers-reduced-motion` and degrades to the final
// state rather than to nothing — a visitor who asked for less movement still
// gets the whole page, just still.

export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined'
    && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Reveal-on-scroll. Returns a ref callback: attach it to anything carrying a
 * `vi-r` class and it lifts into place once, the first time it is seen.
 *
 * One observer for the whole page, and elements register themselves as they
 * mount — so a section that appears later (a filtered list, a lazy route) is
 * picked up without re-scanning the document.
 *
 * The marker class is `vi-pre` (= not yet revealed) rather than a "revealed"
 * one, and it is only ever added and removed HERE. React owns `className`, so a
 * re-render that changes it — the pricing tiers do exactly this when the
 * featured tier moves — rewrites the class attribute and drops anything added
 * imperatively. Marking the *hidden* state means that accident fails safe: the
 * element is simply shown without its animation, instead of being stranded at
 * `opacity: 0` with the observer no longer watching it.
 */
export function useReveal() {
  const observer = useRef<IntersectionObserver | null>(null);

  const get = () => {
    if (observer.current) return observer.current;
    if (typeof IntersectionObserver === 'undefined') return null;
    observer.current = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.remove('vi-pre');
          observer.current?.unobserve(entry.target);
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -8% 0px' },
    );
    return observer.current;
  };

  useEffect(() => () => observer.current?.disconnect(), []);

  return useCallback((el: HTMLElement | null) => {
    if (!el) return;
    // Default to a rise if the caller did not pick a direction, so `ref={reveal}`
    // alone is enough.
    if (!el.classList.contains('vi-r')) el.classList.add('vi-r', 'vi-r-up');
    // No observer support, or movement declined: leave it visible.
    if (prefersReducedMotion() || typeof IntersectionObserver === 'undefined') return;
    // Hide it now. Ref callbacks run during commit, before paint, so the
    // element never appears at full opacity first.
    el.classList.add('vi-pre');
    get()?.observe(el);
  }, []);
}

/** How far down the page we are, 0…1 — drives the progress rail. */
export function useScrollProgress(): number {
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    const onScroll = () => {
      const scrollable = document.documentElement.scrollHeight - window.innerHeight;
      setProgress(scrollable > 0 ? Math.min(1, window.scrollY / scrollable) : 0);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, []);
  return progress;
}

/**
 * Writes `--mx` / `--my` (pointer position) and `--rx` / `--ry` (a small tilt)
 * onto the element under the pointer. Both are consumed by CSS; nothing here
 * re-renders React, which is why a pointermove handler is affordable at all.
 */
export function usePointerTilt(maxDegrees = 6) {
  const onPointerMove = useCallback((e: React.PointerEvent<HTMLElement>) => {
    if (prefersReducedMotion()) return;
    const el = e.currentTarget;
    const rect = el.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    el.style.setProperty('--mx', `${x}px`);
    el.style.setProperty('--my', `${y}px`);
    el.style.setProperty('--ry', `${((x / rect.width) - 0.5) * 2 * maxDegrees}deg`);
    el.style.setProperty('--rx', `${((y / rect.height) - 0.5) * -2 * maxDegrees}deg`);
  }, [maxDegrees]);

  const onPointerLeave = useCallback((e: React.PointerEvent<HTMLElement>) => {
    const el = e.currentTarget;
    el.style.removeProperty('--rx');
    el.style.removeProperty('--ry');
  }, []);

  return { onPointerMove, onPointerLeave };
}

/**
 * Counts up to `value` once the element is on screen.
 *
 * Returns the ref to attach and the number to render. Eases out, so it decides
 * quickly and settles — a linear count reads like a loading spinner.
 */
export function useCountUp(value: number, durationMs = 1200): {
  ref: (el: HTMLElement | null) => void;
  display: number;
} {
  const [display, setDisplay] = useState(0);
  const started = useRef(false);

  const ref = useCallback((el: HTMLElement | null) => {
    if (!el || started.current) return;
    if (prefersReducedMotion() || typeof IntersectionObserver === 'undefined') {
      started.current = true;
      setDisplay(value);
      return;
    }
    const io = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting) || started.current) return;
      started.current = true;
      io.disconnect();
      const from = performance.now();
      const tick = (now: number) => {
        const t = Math.min(1, (now - from) / durationMs);
        setDisplay(Math.round(value * (1 - (1 - t) ** 3)));
        if (t < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }, { threshold: 0.4 });
    io.observe(el);
  }, [value, durationMs]);

  // A value that arrives late (templates finish loading) must still land.
  useEffect(() => {
    if (started.current) setDisplay(value);
  }, [value]);

  return { ref, display };
}
