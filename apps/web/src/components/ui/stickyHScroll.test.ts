import { describe, expect, it } from 'vitest';
import { nextScrollSync, overflowsHorizontally, type Side } from './stickyHScroll';

/**
 * The sticky horizontal scrollbar is two elements kept in step. The interesting
 * part is not the sticky positioning — CSS does that — but the feedback loop
 * the syncing would otherwise create, and the measurement that decides whether
 * the second element exists at all.
 */
describe('deciding whether a region overflows', () => {
  it('a region wider than its box overflows', () => {
    expect(overflowsHorizontally(1400, 900)).toBe(true);
  });

  it('a region that fits does not', () => {
    expect(overflowsHorizontally(900, 900)).toBe(false);
    expect(overflowsHorizontally(700, 900)).toBe(false);
  });

  it('ignores a sub-pixel difference', () => {
    // Sub-pixel layout leaves a fraction of a pixel of "overflow" on tables
    // that fit perfectly well, and a scrollbar with nowhere to go reads as a bug.
    expect(overflowsHorizontally(900.4, 900)).toBe(false);
    expect(overflowsHorizontally(901.5, 900)).toBe(true);
  });
});

/**
 * A tiny model of the two elements, so a sequence of events can be played
 * through exactly as the browser would deliver it: every write to one element's
 * scrollLeft queues a scroll event on that element.
 */
function makePair() {
  const pos: Record<Side, number> = { scroller: 0, proxy: 0 };
  let drivenBy: Side | null = null;
  const queue: Side[] = [];
  let writes = 0;

  const dispatch = (from: Side) => {
    const decision = nextScrollSync(from, { ...pos }, drivenBy);
    drivenBy = decision.drivenBy;
    if (decision.write) {
      writes += 1;
      pos[decision.write.side] = decision.write.value;
      queue.push(decision.write.side); // the browser's echo
    }
  };

  return {
    pos,
    get writes() { return writes; },
    /** The user drags one element, and everything that follows settles. */
    userScrolls(side: Side, to: number) {
      pos[side] = to;
      queue.push(side);
      let guard = 0;
      while (queue.length) {
        if (guard++ > 20) throw new Error('scroll sync did not settle — feedback loop');
        dispatch(queue.shift()!);
      }
    },
  };
}

describe('keeping the two scrollbars in step', () => {
  it('dragging the sticky bar moves the table', () => {
    const pair = makePair();
    pair.userScrolls('proxy', 320);
    expect(pair.pos.scroller).toBe(320);
  });

  it('scrolling the table moves the sticky bar', () => {
    const pair = makePair();
    pair.userScrolls('scroller', 180);
    expect(pair.pos.proxy).toBe(180);
  });

  it('settles instead of bouncing the value back and forth', () => {
    // Copying scrollLeft makes the other element fire its own scroll event.
    // Answering that would copy the value straight back, forever — the loop
    // that fights the user's finger. `makePair` throws if it does not settle.
    const pair = makePair();
    pair.userScrolls('proxy', 500);
    expect(pair.pos).toEqual({ scroller: 500, proxy: 500 });
    // One write for the copy, and the echo absorbed rather than answered.
    expect(pair.writes).toBe(1);
  });

  it('survives a run of drags in both directions', () => {
    const pair = makePair();
    pair.userScrolls('scroller', 100);
    pair.userScrolls('proxy', 40);
    pair.userScrolls('scroller', 900);
    pair.userScrolls('proxy', 0);
    expect(pair.pos).toEqual({ scroller: 0, proxy: 0 });
  });

  it('does nothing when the two already agree', () => {
    // A scroll event that changed nothing must not provoke a write, or every
    // no-op event would generate an echo of its own.
    const decision = nextScrollSync('scroller', { scroller: 200, proxy: 200 }, null);
    expect(decision.write).toBeNull();
  });

  it('absorbs the echo of its own write', () => {
    const decision = nextScrollSync('proxy', { scroller: 300, proxy: 0 }, 'scroller');
    expect(decision.write).toBeNull();
    expect(decision.drivenBy).toBeNull();
  });

  it('lets the user take over again immediately after an echo', () => {
    // Ownership must be released by the echo, not held until some later event —
    // otherwise the first drag after any sync would be ignored.
    const decision = nextScrollSync('proxy', { scroller: 300, proxy: 700 }, null);
    expect(decision.write).toEqual({ side: 'scroller', value: 700 });
  });
});
