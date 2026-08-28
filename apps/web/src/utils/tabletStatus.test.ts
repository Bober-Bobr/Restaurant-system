import { describe, expect, it } from 'vitest';
import {
  TABLET_STATUSES,
  isFreeChoice,
  isPaidExtra,
  isTabletStatus,
  showOnTabletFor,
  tabletStatusOf,
  toTabletStatus,
  withFree,
  withPaid,
  type TabletStatus,
} from './tabletStatus';

/**
 * The Additional page's two switches. They answer unrelated questions — is this
 * sold as a paid extra, and may a guest swap it in for free — so all four
 * combinations are meaningful, and the pair round-trips through the single
 * `tabletStatus` column.
 */
const TABLE: { paid: boolean; free: boolean; status: TabletStatus }[] = [
  { paid: true, free: true, status: 'BOTH' },
  { paid: true, free: false, status: 'PAID' },
  { paid: false, free: true, status: 'FREE' },
  { paid: false, free: false, status: 'NONE' },
];

describe('the two switches and the four states', () => {
  it('covers every combination, and each is a distinct state', () => {
    expect(new Set(TABLE.map((r) => r.status)).size).toBe(4);
    expect(new Set(TABLET_STATUSES)).toEqual(new Set(TABLE.map((r) => r.status)));
  });

  for (const { paid, free, status } of TABLE) {
    it(`paid=${paid} free=${free} → ${status}`, () => {
      expect(toTabletStatus(paid, free)).toBe(status);
      expect(isPaidExtra(status)).toBe(paid);
      expect(isFreeChoice(status)).toBe(free);
    });
  }

  it('BOTH is genuinely both, not a third thing', () => {
    // The whole point of the change: a dish can be a free substitute AND be on
    // sale under Additional at the same time.
    expect(isPaidExtra('BOTH')).toBe(true);
    expect(isFreeChoice('BOTH')).toBe(true);
  });

  it('PAID alone is not a free substitute', () => {
    expect(isFreeChoice('PAID')).toBe(false);
  });

  it('FREE alone is not sold under Additional', () => {
    expect(isPaidExtra('FREE')).toBe(false);
  });

  it('NONE is offered neither way', () => {
    // It is simply included in whichever table categories selected it.
    expect(isPaidExtra('NONE')).toBe(false);
    expect(isFreeChoice('NONE')).toBe(false);
  });
});

describe('flipping one switch leaves the other alone', () => {
  // This is the rule the single-toggle version could not express: turning Paid
  // off used to force the dish to FREE, and turning it on used to strip Free.
  for (const status of TABLET_STATUSES) {
    it(`from ${status}, toggling Paid preserves Free`, () => {
      for (const next of [true, false]) {
        const after = withPaid(status, next);
        expect(isPaidExtra(after)).toBe(next);
        expect(isFreeChoice(after)).toBe(isFreeChoice(status));
      }
    });

    it(`from ${status}, toggling Free preserves Paid`, () => {
      for (const next of [true, false]) {
        const after = withFree(status, next);
        expect(isFreeChoice(after)).toBe(next);
        expect(isPaidExtra(after)).toBe(isPaidExtra(status));
      }
    });
  }

  it('turning both off lands on NONE rather than on a paid item', () => {
    expect(withFree(withPaid('BOTH', false), false)).toBe('NONE');
  });

  it('a full round trip through the switches returns the same state', () => {
    for (const status of TABLET_STATUSES) {
      expect(toTabletStatus(isPaidExtra(status), isFreeChoice(status))).toBe(status);
    }
  });
});

describe('reading a dish that predates the column', () => {
  it('takes a stored value when there is one', () => {
    for (const status of TABLET_STATUSES) {
      expect(tabletStatusOf({ tabletStatus: status })).toBe(status);
    }
  });

  it('resolves a missing value to FREE, not NONE, when it was hidden', () => {
    // NONE and FREE behaved identically in the code that ran until now — a dish
    // that was not PAID was free to swap in either way. Resolving to NONE would
    // quietly withdraw substitutes guests can pick today.
    expect(tabletStatusOf({ showOnTablet: false })).toBe('FREE');
    expect(isFreeChoice(tabletStatusOf({ showOnTablet: false }))).toBe(true);
  });

  it('resolves a missing value to PAID when it was shown', () => {
    expect(tabletStatusOf({ showOnTablet: true })).toBe('PAID');
    expect(tabletStatusOf({})).toBe('PAID');
  });

  it('ignores a value that is not one of the four', () => {
    // The column is a plain String; a hand-edited or future value must not put
    // the page into a state with no switches lit.
    expect(tabletStatusOf({ tabletStatus: 'SOMETHING_ELSE' })).toBe('PAID');
    expect(tabletStatusOf({ tabletStatus: null })).toBe('PAID');
    expect(isTabletStatus('NONE')).toBe(true);
    expect(isTabletStatus('none')).toBe(false);
    expect(isTabletStatus(undefined)).toBe(false);
  });
});

describe('the legacy showOnTablet flag', () => {
  it('follows whether the dish is sold, so BOTH sets it too', () => {
    expect(showOnTabletFor('PAID')).toBe(true);
    expect(showOnTabletFor('BOTH')).toBe(true);
    expect(showOnTabletFor('FREE')).toBe(false);
    expect(showOnTabletFor('NONE')).toBe(false);
  });

  it('agrees with isPaidExtra for every state', () => {
    // Two names for one fact; if they ever diverge, a legacy reader and the
    // tablet would disagree about what is on sale.
    for (const status of TABLET_STATUSES) {
      expect(showOnTabletFor(status)).toBe(isPaidExtra(status));
    }
  });
});
