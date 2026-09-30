/**
 * Who may report on what, and over which window.
 *
 * The owner's reports are the one place a caller names a restaurant they are not
 * assigned to: an OWNER's own `restaurantId` is null (they are a platform role —
 * see auth.service.ts), and they own several. So `requireRestaurant` cannot serve
 * these routes, and its `?restaurantId=` escape hatch is CHIEF_ADMIN/MANAGER only
 * by design. This module is the replacement, and it is the whole boundary:
 *
 *   an OWNER may report only on restaurants whose `ownerId` is their own id.
 *
 * Checked against the database on every request rather than from anything in the
 * token, because ownership can be moved after a token was issued, and a
 * fifteen-minute-old access token must not outlive a transfer.
 *
 * A restaurant that is not theirs is **404, not 403**: "not yours" and "not
 * there" have to look identical, or the status code enumerates other owners'
 * restaurant ids. Same rule as the section check in the events module.
 */

import { AdminRole } from '@prisma/client';
import createHttpError from 'http-errors';
import { prisma } from '../../db/prisma.js';

export type ReportScope = {
  /** The restaurants this report covers, always at least one. */
  restaurantIds: string[];
  from: Date;
  to: Date;
  /** The reader's offset from UTC in minutes, `-getTimezoneOffset()`. */
  tzOffsetMinutes: number;
};

/** Real-world offsets run −12:00 … +14:00; anything else is a bug or a probe. */
export function clampOffset(minutes: unknown): number {
  const value = Number(minutes);
  if (!Number.isFinite(value)) return 0;
  return Math.max(-720, Math.min(840, Math.round(value)));
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * The reporting window, both ends optional.
 *
 * Defaults to the last 365 days, which is also what order retention keeps
 * (order.retention.ts), so the default range can never promise order figures
 * that have already been purged. A reversed range is swapped rather than
 * returning nothing: an empty report looks exactly like a restaurant that did no
 * business, which is the worst possible way to show a mistyped date.
 *
 * `to` is EXCLUSIVE and pushed to the end of the named day, so a range typed as
 * 1–31 August includes the 31st. A half-open window whose end is midnight on the
 * 31st silently drops that day's takings, which on a Saturday is the biggest
 * number in the report.
 */
export function resolveRange(from?: string, to?: string): { from: Date; to: Date } {
  const end = to ? endOfDay(to) : new Date();
  const start = from ? new Date(from) : new Date(end.getTime() - 365 * DAY_MS);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    const now = new Date();
    return { from: new Date(now.getTime() - 365 * DAY_MS), to: now };
  }
  return start <= end ? { from: start, to: end } : { from: end, to: start };
}

function endOfDay(value: string): Date {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return date;
  // A bare `YYYY-MM-DD` parses as UTC midnight; a full timestamp is taken as
  // given. Only the bare form is extended, or "to: 2026-08-31T12:00" would be
  // quietly widened to the whole day the caller deliberately cut short.
  return /^\d{4}-\d{2}-\d{2}$/.test(value.trim())
    ? new Date(date.getTime() + DAY_MS - 1)
    : date;
}

/** `YYYY-MM-DD` in the reader's own time, from an instant. */
export function localDayKey(at: Date, tzOffsetMinutes: number): string {
  return new Date(at.getTime() + tzOffsetMinutes * 60_000).toISOString().slice(0, 10);
}

/** `YYYY-MM` in the reader's own time — the bucket every month chart is built on. */
export function localMonthKey(at: Date, tzOffsetMinutes: number): string {
  return localDayKey(at, tzOffsetMinutes).slice(0, 7);
}

/**
 * Every month in the window, in order, so a month with no business is a gap in
 * the chart rather than a month that is missing from it. A chart drawn only from
 * the months that have rows puts August next to October and reads as continuous.
 */
export function monthsBetween(from: Date, to: Date, tzOffsetMinutes: number): string[] {
  const first = localMonthKey(from, tzOffsetMinutes);
  const last = localMonthKey(to, tzOffsetMinutes);
  if (first > last) return [];
  const months: string[] = [];
  let [year, month] = first.split('-').map(Number);
  // Capped so a mistyped year cannot ask for a hundred thousand buckets.
  for (let guard = 0; guard < 600; guard += 1) {
    const key = `${year}-${String(month).padStart(2, '0')}`;
    months.push(key);
    if (key >= last) break;
    month += 1;
    if (month > 12) { month = 1; year += 1; }
  }
  return months;
}

/**
 * Every day in the window, in order. Same reason as `monthsBetween`, and capped
 * at a little over two years so a report cannot be asked for a million squares.
 */
export function daysBetween(from: Date, to: Date, tzOffsetMinutes: number): string[] {
  const days: string[] = [];
  const last = localDayKey(to, tzOffsetMinutes);
  let cursor = from.getTime();
  for (let guard = 0; guard < 800; guard += 1) {
    const key = localDayKey(new Date(cursor), tzOffsetMinutes);
    days.push(key);
    if (key >= last) break;
    cursor += DAY_MS;
  }
  return days;
}

/**
 * The restaurants a caller may report on, narrowed to one when they asked for one.
 *
 * A CHIEF_ADMIN reaches every restaurant already, so they are not narrowed to an
 * ownership list — but they still get 404 on an id that does not exist, so the
 * two roles behave the same way on a bad id.
 */
export async function resolveReportRestaurants(
  caller: { id: string; role: AdminRole },
  restaurantId?: string,
): Promise<string[]> {
  const asked = restaurantId?.trim() || undefined;

  if (caller.role === AdminRole.CHIEF_ADMIN) {
    if (!asked) {
      const all = await prisma.restaurant.findMany({ select: { id: true } });
      return all.map((row) => row.id);
    }
    const one = await prisma.restaurant.findUnique({ where: { id: asked }, select: { id: true } });
    if (!one) throw createHttpError(404, 'Restaurant not found');
    return [one.id];
  }

  const owned = await prisma.restaurant.findMany({
    where: { ownerId: caller.id },
    select: { id: true },
    orderBy: { name: 'asc' },
  });
  const ownedIds = owned.map((row) => row.id);

  if (!asked) return ownedIds;
  // Not `ownedIds.includes` against a list fetched for a different purpose — the
  // check and the answer come from the same query, so there is no way for one to
  // be filtered and the other not.
  if (!ownedIds.includes(asked)) throw createHttpError(404, 'Restaurant not found');
  return [asked];
}
