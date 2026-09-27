import { localDateKey } from '../components/ActivityCalendar';
import type { Event } from '../types/domain';

/**
 * Finding one booking in the kitchen's list.
 *
 * `/events` is deliberately unbounded (see the pagination note in CLAUDE.md), so
 * these pages hold every booking the restaurant has ever taken — which is right
 * for a month filter and a calendar and hopeless for "what am I cooking
 * tonight". The list needed a way in, and this is the whole of its logic: pure,
 * so it can be tested without a screen.
 *
 * All three are applied to the SAME array in one pass by `visibleEvents`,
 * because a filter that ran after the sort, or a search that ignored the
 * filters, is a list that disagrees with the count printed above it.
 */

export type KitchenWhen = 'all' | 'today' | 'upcoming' | 'past';

export type KitchenSort = 'date-asc' | 'date-desc' | 'number-desc' | 'number-asc' | 'guests-desc';

export type KitchenFilters = {
  /** A booking number, as typed. `#` and spaces are forgiven. */
  query: string;
  /** '' = any. */
  status: '' | Event['status'];
  /** '' = any hall. */
  hallId: string;
  when: KitchenWhen;
};

export const EMPTY_FILTERS: KitchenFilters = { query: '', status: '', hallId: '', when: 'all' };

/** Whether any filter is actually narrowing the list — what "Clear" is for. */
export function isFiltering(filters: KitchenFilters): boolean {
  return normalizeQuery(filters.query) !== ''
    || filters.status !== ''
    || filters.hallId !== ''
    || filters.when !== 'all';
}

/**
 * The digits of a typed booking number.
 *
 * Staff read the number off a card that prints it as `#12`, and a phone keyboard
 * puts a space in after a paste, so both are stripped rather than being made to
 * match nothing.
 */
export function normalizeQuery(query: string): string {
  return query.replace(/[^\d]/g, '');
}

/**
 * Whether a booking answers a typed number.
 *
 * **A prefix, not an exact match.** The list filters as it is typed, and an
 * exact match shows nothing at all until the last digit — on a venue whose
 * numbers have reached four figures that is three empty screens. `12` therefore
 * finds 12, 120 and 1234; the exact match is among them and the list is sorted,
 * so it is easy to pick out.
 */
export function matchesBookingNumber(event: Pick<Event, 'id'>, query: string): boolean {
  const digits = normalizeQuery(query);
  if (!digits) return true;
  return String(event.id).startsWith(digits);
}

/**
 * Whether a booking falls in the chosen window.
 *
 * **The day is the LOCAL one**, not `dayKey`'s UTC: this is a person asking
 * what is on today, in the restaurant, and east of Greenwich the UTC day turns
 * over in the middle of their evening service. (Occupancy on the floor map is a
 * different question and stays UTC — see CLAUDE.md.)
 */
export function matchesWhen(event: Pick<Event, 'eventDate'>, when: KitchenWhen, now: Date): boolean {
  if (when === 'all') return true;
  const at = new Date(event.eventDate);
  // A date nothing can read belongs to no window but "any": putting it in
  // today's would have the kitchen cooking for it tonight.
  if (Number.isNaN(at.getTime())) return false;
  const today = localDateKey(now);
  const day = localDateKey(at);
  if (when === 'today') return day === today;
  // Today counts as upcoming, and not as past: a booking being cooked for this
  // evening is not history, whatever the clock says.
  if (when === 'upcoming') return day >= today;
  return day < today;
}

/** The bookings a kitchen is looking at, filtered and then sorted. */
export function visibleEvents(
  events: Event[],
  filters: KitchenFilters,
  sort: KitchenSort,
  now: Date = new Date(),
): Event[] {
  const found = events.filter((event) => matchesBookingNumber(event, filters.query)
    && (!filters.status || event.status === filters.status)
    && (!filters.hallId || event.hallId === filters.hallId)
    && matchesWhen(event, filters.when, now));
  return sortEvents(found, sort);
}

const time = (event: Pick<Event, 'eventDate'>) => {
  const at = new Date(event.eventDate).getTime();
  // An unparseable date sorts last either way rather than scrambling the list,
  // which is what NaN in a comparator does.
  return Number.isNaN(at) ? Number.MAX_SAFE_INTEGER : at;
};

/** A copy, sorted. `Array.prototype.sort` is in place and the input is cached. */
export function sortEvents(events: Event[], sort: KitchenSort): Event[] {
  const out = [...events];
  switch (sort) {
    case 'date-desc': return out.sort((a, b) => time(b) - time(a));
    case 'number-asc': return out.sort((a, b) => a.id - b.id);
    case 'number-desc': return out.sort((a, b) => b.id - a.id);
    case 'guests-desc': return out.sort((a, b) => (b.guestCount ?? 0) - (a.guestCount ?? 0) || time(a) - time(b));
    case 'date-asc':
    default: return out.sort((a, b) => time(a) - time(b));
  }
}
