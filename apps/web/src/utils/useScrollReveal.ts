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
export function useScrollReveal<T extends HTMLElement = HTMLDivElement>() {
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
      { threshold: 0.12, rootMargin: '0px 0px -8% 0px' }
    );

    const observe = (el: Element) => {
      if (!el.classList.contains('is-visible')) io.observe(el);
    };

    root.querySelectorAll('.reveal').forEach(observe);

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
    };
  }, []);

  return containerRef;
}
