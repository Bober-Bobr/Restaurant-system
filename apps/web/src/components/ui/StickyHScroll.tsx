import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { nextScrollSync, overflowsHorizontally, type Side } from './stickyHScroll';

/**
 * A horizontally scrolling region whose scrollbar stays reachable.
 *
 * A wide table in a tall page puts its scrollbar at the bottom of the TABLE,
 * which on a menu of two hundred dishes is several screens below the columns
 * you are trying to reach. The bar here is a separate `position: sticky`
 * element instead: it rides the bottom of the viewport while the region is on
 * screen, and comes to rest under the last row once the region's end scrolls
 * into view — so a short table still gets an ordinary scrollbar in the ordinary
 * place, with no scroll listener deciding which.
 *
 * The two are kept in step by copying `scrollLeft` between them. The real
 * region keeps its own scrollbar until the proxy is actually up, so a
 * mis-measurement can never leave the content unreachable.
 */
export function StickyHScroll({
  children,
  className,
  style,
  bottomOffset = 0,
}: {
  children: ReactNode;
  className?: string;
  style?: React.CSSProperties;
  /** Distance from the viewport bottom, for a page with its own fixed footer. */
  bottomOffset?: number;
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const proxyRef = useRef<HTMLDivElement>(null);
  const [contentWidth, setContentWidth] = useState(0);
  const [overflows, setOverflows] = useState(false);

  const measure = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    setContentWidth(el.scrollWidth);
    setOverflows(overflowsHorizontally(el.scrollWidth, el.clientWidth));
  }, []);

  useLayoutEffect(measure);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el || typeof ResizeObserver === 'undefined') {
      // No observer: the layout pass above still measured once, and a resize
      // listener covers the common case of the window changing.
      window.addEventListener('resize', measure);
      return () => window.removeEventListener('resize', measure);
    }
    // Watch the content as well as the box: columns are added and removed by
    // the page's own toggles, which resize neither the window nor the wrapper.
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    if (el.firstElementChild) observer.observe(el.firstElementChild);
    return () => observer.disconnect();
  }, [measure]);

  const drivenBy = useRef<Side | null>(null);
  const sync = (from: Side) => () => {
    const scroller = scrollerRef.current;
    const proxy = proxyRef.current;
    if (!scroller || !proxy) return;
    const decision = nextScrollSync(
      from,
      { scroller: scroller.scrollLeft, proxy: proxy.scrollLeft },
      drivenBy.current,
    );
    drivenBy.current = decision.drivenBy;
    if (decision.write) {
      (decision.write.side === 'scroller' ? scroller : proxy).scrollLeft = decision.write.value;
    }
  };

  return (
    <div className={className} style={{ position: 'relative', ...style }}>
      <div
        ref={scrollerRef}
        onScroll={sync('scroller')}
        // The native bar is dropped only once the proxy is up to replace it.
        className={overflows ? 'scrollbar-none' : undefined}
        style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}
      >
        {children}
      </div>

      {overflows && (
        <div
          ref={proxyRef}
          onScroll={sync('proxy')}
          className="adm-hscroll"
          // A decorative duplicate: it is kept out of the a11y tree and out of
          // the tab order, because the region itself is still a keyboard-
          // scrollable container — hiding its bar did not take that away.
          aria-hidden="true"
          tabIndex={-1}
          style={{ bottom: bottomOffset }}
        >
          <div style={{ width: contentWidth, height: 1 }} />
        </div>
      )}
    </div>
  );
}
