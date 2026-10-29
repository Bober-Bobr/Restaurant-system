import type { TranslationKey } from './translate';

/**
 * The month-grid arithmetic both booking calendars draw with — the admin's
 * per-hall calendar and the owner's Reports calendar.
 *
 * The slot windows used to live inside CalendarPage alone. The owner's calendar
 * is meant to read like the admin's, and two copies of "which hours are lunch"
 * would show the same booking as lunch on one screen and dinner on the other.
 */

export const MONTH_KEYS = [
  'month_january', 'month_february', 'month_march', 'month_april',
  'month_may', 'month_june', 'month_july', 'month_august',
  'month_september', 'month_october', 'month_november', 'month_december',
] as const satisfies readonly TranslationKey[];

/** The week starts on Monday (the international standard, and this market's). */
export const WEEKDAY_KEYS = [
  'weekday_mon', 'weekday_tue', 'weekday_wed', 'weekday_thu',
  'weekday_fri', 'weekday_sat', 'weekday_sun',
] as const satisfies readonly TranslationKey[];

export type Slot = 'breakfast' | 'lunch' | 'dinner';
export const SLOTS: Slot[] = ['breakfast', 'lunch', 'dinner'];
export const SLOT_COLORS: Record<Slot, string> = {
  breakfast: '#fde047',
  lunch: '#fb923c',
  dinner: '#818cf8',
};

/** Which slot an hour falls into, or null outside the three windows. */
export function slotForHour(hour: number): Slot | null {
  if (hour >= 6 && hour < 11) return 'breakfast';
  if (hour >= 11 && hour < 15) return 'lunch';
  if (hour >= 15 && hour < 20) return 'dinner';
  return null;
}

const pad = (value: number) => String(value).padStart(2, '0');

/** Local `YYYY-MM-DD`. `toISOString()` would shift the day for anyone east of UTC. */
export function localDay(at: Date): string {
  return `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}`;
}

/** Local `YYYY-MM`. */
export function localMonth(at: Date): string {
  return localDay(at).slice(0, 7);
}

/**
 * The reader's own clock time, 24-hour. Not `toLocaleTimeString`, which gives
 * an en-US reader "7:00 PM" beside every other time in the product.
 */
export function clockOf(iso: string): string {
  const at = new Date(iso);
  return Number.isNaN(at.getTime()) ? '' : `${pad(at.getHours())}:${pad(at.getMinutes())}`;
}

/** `YYYY-MM` moved by whole months, across year ends. */
export function shiftMonth(month: string, delta: number): string {
  const [year, monthNo] = month.split('-').map(Number);
  const index = year * 12 + (monthNo - 1) + delta;
  return `${Math.floor(index / 12)}-${pad((index % 12) + 1)}`;
}

/**
 * The cells of a Monday-first month grid: blank leading cells up to the 1st,
 * one per day, and blank trailing cells to finish the last week.
 */
export function monthGrid(month: string): (string | null)[] {
  const [year, monthNo] = month.split('-').map(Number);
  const lead = (new Date(year, monthNo - 1, 1).getDay() + 6) % 7;
  const days = new Date(year, monthNo, 0).getDate();
  const cells: (string | null)[] = Array.from({ length: lead }, () => null);
  for (let day = 1; day <= days; day += 1) cells.push(`${month}-${pad(day)}`);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

/**
 * Bookings filed under the reader's own day, earliest first. Keyed by the LOCAL
 * day, as the server's month window is: a 23:30 booking belongs to the evening
 * it is held on, not to the UTC date it happens to fall on.
 */
export function byLocalDay<T extends { eventDate: string }>(rows: T[]): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const row of rows) {
    const at = new Date(row.eventDate);
    if (Number.isNaN(at.getTime())) continue;
    const key = localDay(at);
    const list = map.get(key) ?? [];
    list.push(row);
    map.set(key, list);
  }
  for (const list of map.values()) {
    list.sort((a, b) => new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime());
  }
  return map;
}
