import { useEffect, useRef } from 'react';

/**
 * Reveal-on-scroll.
 *
 * Elements tagged with the `reveal` CSS class start hidden and fade/slide in as
 * they scroll into the viewport. Attach the returned ref to a container and all
 * current *and* future `.reveal` descendants are observed automatically — so it
 * keeps working when routed content swaps in or async queries load new cards.
 *
 * Respects `prefers-reduced-motion` and degrades gracefully where
 * IntersectionObserver is unavailable (everything is shown immediately).
 */
export function useScrollReveal<T extends HTMLElement = HTMLDivElement>(deps: unknown[] = []) {
  const containerRef = useRef<T>(null);

  useEffect(() => {
    const root = containerRef.current;
    if (!root) return;

    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion || !('IntersectionObserver' in window)) {
      root.querySelectorAll('.reveal').forEach((el) => el.classList.add('is-visible'));
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            io.unobserve(entry.target);
          }
        }
      },
      // Any intersection, not a fraction of the element: `threshold: 0.12` meant
      // an element taller than ~8 screens could never satisfy it, so a long
      // photo or poster stayed at `opacity: 0` however far the visitor scrolled.
      { threshold: 0, rootMargin: '0px 0px -8% 0px' }
    );

    const observe = (el: Element) => {
      if (!el.classList.contains('is-visible')) io.observe(el);
    };

    root.querySelectorAll('.reveal').forEach(observe);

    // Backstop, for the same reason the block renderer has one: `.reveal` hides
    // its element until JavaScript says otherwise, so an observation that never
    // arrives (a bfcache restore, a throttled background tab, a late image that
    // reflowed the page) would leave a published page with a blank hole in it.
    // One pass a second over what is still hidden, ended by the cleanup below.
    const sweep = window.setInterval(() => {
      const pending = root.querySelectorAll('.reveal:not(.is-visible)');
      if (pending.length === 0) return;
      const h = window.innerHeight || document.documentElement.clientHeight || 0;
      pending.forEach((el) => {
        // Top edge past the reveal line — and still true once scrolled by, so
        // nothing the visitor has already walked past is left behind hidden.
        if (el.getBoundingClientRect().top < h * 0.92) {
          el.classList.add('is-visible');
          io.unobserve(el);
        }
      });
    }, 900);

    // Watch for content swapped in by routing or async-loaded queries.
    const mo = new MutationObserver((mutations) => {
      for (const m of mutations) {
        m.addedNodes.forEach((node) => {
          if (!(node instanceof Element)) return;
          if (node.classList.contains('reveal')) observe(node);
          node.querySelectorAll?.('.reveal').forEach(observe);
        });
      }
    });
    mo.observe(root, { childList: true, subtree: true });

    return () => {
      io.disconnect();
      mo.disconnect();
      window.clearInterval(sweep);
    };
    // The container ref may mount after async content loads; `deps` lets callers
    // re-run the setup once their ref'd element is actually in the DOM.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return containerRef;
}
