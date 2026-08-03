import { keepPreviousData, useQuery, type UseQueryOptions, type QueryKey } from '@tanstack/react-query';

// ── Live updates ────────────────────────────────────────────────────────────
// Everything that needs to stay current without a page reload goes through this
// module, and today it is implemented by polling.
//
// It exists as its own file because that is not the long-term answer. A native
// mobile app is planned, and food service wants push rather than a phone waking
// up every few seconds to ask. When that lands, the transport changes HERE —
// swap the body of `useLiveQuery` for an SSE or push subscription that
// invalidates the same query keys — and no calling component changes. That is
// the whole point of routing every live read through one hook instead of
// sprinkling `refetchInterval` across pages, which is what the rest of this
// codebase currently does.
//
// Cadences are named rather than numeric at the call sites so they can be tuned
// in one place, and so the intent ("a waiter is waiting on this") survives.

export const LIVE_INTERVAL = {
  /** A guest watching for a waiter to pick up their order. */
  guestOrder: 10_000,
  /** A waiter's own order list. */
  waiterOrders: 6_000,
  /** "Call waiter" alerts — the one a person is actively waiting on. */
  waiterAlerts: 5_000,
} as const;

export type LiveChannel = keyof typeof LIVE_INTERVAL;

/**
 * A query that keeps itself current.
 *
 * Deliberately narrower than useQuery: no `refetchInterval` is accepted from the
 * caller, because choosing a cadence per call site is exactly the sprawl this
 * replaces. Pick a named channel instead.
 */
export function useLiveQuery<TData>(
  channel: LiveChannel,
  options: Omit<UseQueryOptions<TData, Error, TData, QueryKey>, 'refetchInterval'>,
) {
  return useQuery<TData, Error, TData, QueryKey>({
    ...options,
    refetchInterval: LIVE_INTERVAL[channel],
    // A backgrounded tab is a phone in a pocket. Stop polling until it is
    // looked at again; React Query refetches on focus, so nothing goes stale
    // in front of a person.
    refetchIntervalInBackground: false,
    // Restaurant wifi drops. Keep showing the last known state rather than
    // flashing a spinner every time a poll fails.
    placeholderData: keepPreviousData,
  });
}
