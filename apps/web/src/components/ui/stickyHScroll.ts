/**
 * The pure half of `StickyHScroll` — the decisions, separate from the DOM
 * plumbing, so they can be covered by a suite that has no DOM.
 */
export type Side = 'scroller' | 'proxy';

export const OVERFLOW_EPSILON = 1;

/**
 * Whether a region can actually be scrolled sideways. Sub-pixel layout leaves a
 * fraction of a pixel of "overflow" on tables that fit perfectly well, and a
 * scrollbar with nowhere to go looks like a bug.
 */
export function overflowsHorizontally(scrollWidth: number, clientWidth: number): boolean {
  return scrollWidth - clientWidth > OVERFLOW_EPSILON;
}

export type SyncDecision = {
  /** Who owns the position after this event; null once an echo is absorbed. */
  drivenBy: Side | null;
  /** The element to copy the position onto, or null to do nothing. */
  write: { side: Side; value: number } | null;
};

/**
 * What a scroll event on one of the two elements should do.
 *
 * Copying `scrollLeft` onto the other element makes IT fire a scroll event,
 * which would copy the value straight back — a loop that fights the user's
 * finger. So a copy records who drove it, and the echo it provokes is
 * recognised and swallowed instead of being answered.
 */
export function nextScrollSync(
  from: Side,
  positions: Record<Side, number>,
  drivenBy: Side | null,
): SyncDecision {
  // An event on the side we just wrote to, while the other side was driving:
  // this is that write echoing back. Absorb it and release ownership.
  if (drivenBy !== null && drivenBy !== from) {
    return { drivenBy: null, write: null };
  }
  const other: Side = from === 'scroller' ? 'proxy' : 'scroller';
  if (positions[other] === positions[from]) {
    // Already in step — writing would produce an echo for no reason.
    return { drivenBy, write: null };
  }
  return { drivenBy: from, write: { side: other, value: positions[from] } };
}
