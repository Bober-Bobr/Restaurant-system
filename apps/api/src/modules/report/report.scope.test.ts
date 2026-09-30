import { describe, expect, it } from 'vitest';
import {
  clampOffset, daysBetween, localDayKey, localMonthKey, monthsBetween, resolveRange,
} from './report.scope.js';

// The window and the buckets. No database: the ownership half of this module is
// one Prisma query and a list membership test, and what actually goes wrong here
// is arithmetic on dates.

describe('the reporting window', () => {
  it('defaults to the last 365 days, which is what order retention keeps', () => {
    // A default range longer than retention would promise order figures that
    // have already been purged and show them as a fall in trade.
    const { from, to } = resolveRange();
    const days = Math.round((to.getTime() - from.getTime()) / 86_400_000);
    expect(days).toBe(365);
  });

  it('includes the whole of the day named as `to`', () => {
    // A half-open window ending at midnight on the 31st drops that day's
    // takings — on a Saturday, the biggest number in the report.
    const { to } = resolveRange('2026-08-01', '2026-08-31');
    expect(to.toISOString().slice(0, 10)).toBe('2026-08-31');
    expect(to.getTime()).toBeGreaterThan(new Date('2026-08-31T23:00:00Z').getTime());
  });

  it('leaves a full timestamp alone rather than widening it to the whole day', () => {
    const { to } = resolveRange('2026-08-01', '2026-08-31T12:00:00.000Z');
    expect(to.toISOString()).toBe('2026-08-31T12:00:00.000Z');
  });

  it('swaps a reversed range instead of returning nothing', () => {
    // An empty report looks exactly like a restaurant that did no business,
    // which is the worst possible way to show a mistyped date.
    const { from, to } = resolveRange('2026-08-31', '2026-08-01');
    expect(from.toISOString().slice(0, 10)).toBe('2026-08-01');
    expect(to.toISOString().slice(0, 10)).toBe('2026-08-31');
  });

  it('falls back to the default window on an unparseable date', () => {
    const { from, to } = resolveRange('not-a-date', 'also-not');
    expect(Number.isNaN(from.getTime())).toBe(false);
    expect(Number.isNaN(to.getTime())).toBe(false);
  });
});

describe('the reader’s offset', () => {
  it('clamps to real-world offsets', () => {
    expect(clampOffset(300)).toBe(300);
    expect(clampOffset(-9999)).toBe(-720);
    expect(clampOffset(9999)).toBe(840);
  });

  it('reads a missing or junk offset as UTC rather than refusing the report', () => {
    expect(clampOffset(undefined)).toBe(0);
    expect(clampOffset('nonsense')).toBe(0);
  });
});

describe('buckets are in the reader’s own time', () => {
  // Uzbekistan is UTC+5, so this is the case that actually bites: a booking at
  // 01:00 Tashkent is still the previous day in UTC, and bucketing by UTC would
  // file a night's trade under the day before.
  const TASHKENT = 300;

  it('files a small-hours instant under the local day, not the UTC one', () => {
    const at = new Date('2026-08-12T20:30:00.000Z'); // 01:30 on the 13th in Tashkent
    expect(at.toISOString().slice(0, 10)).toBe('2026-08-12');
    expect(localDayKey(at, TASHKENT)).toBe('2026-08-13');
  });

  it('rolls a month over on the local boundary', () => {
    const at = new Date('2026-08-31T20:00:00.000Z'); // 01:00 on 1 September, locally
    expect(localMonthKey(at, TASHKENT)).toBe('2026-09');
    expect(localMonthKey(at, 0)).toBe('2026-08');
  });
});

describe('every bucket in the window is present', () => {
  // A chart drawn only from the months that HAVE rows puts August beside October
  // and reads as an unbroken run of trade. The gap is the information.
  it('lists every month between the ends, inclusive', () => {
    const months = monthsBetween(new Date('2026-08-05'), new Date('2026-11-02'), 0);
    expect(months).toEqual(['2026-08', '2026-09', '2026-10', '2026-11']);
  });

  it('crosses a year end', () => {
    const months = monthsBetween(new Date('2026-11-20'), new Date('2027-02-03'), 0);
    expect(months).toEqual(['2026-11', '2026-12', '2027-01', '2027-02']);
  });

  it('gives one month when both ends are in it', () => {
    expect(monthsBetween(new Date('2026-08-05'), new Date('2026-08-25'), 0)).toEqual(['2026-08']);
  });

  it('lists every day between the ends, inclusive', () => {
    const days = daysBetween(new Date('2026-08-30'), new Date('2026-09-02'), 0);
    expect(days).toEqual(['2026-08-30', '2026-08-31', '2026-09-01', '2026-09-02']);
  });

  it('cannot be made to produce an unbounded number of buckets', () => {
    // A mistyped year must not ask for a hundred thousand columns.
    expect(monthsBetween(new Date('1970-01-01'), new Date('2600-01-01'), 0).length).toBeLessThanOrEqual(600);
    expect(daysBetween(new Date('1970-01-01'), new Date('2600-01-01'), 0).length).toBeLessThanOrEqual(800);
  });
});
